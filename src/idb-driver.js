import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'

import { adapt } from '@cycle/run/lib/adapt'

import idb from 'idb'


export default function makeIdbDriver(name, version, upgrade) {
	const dbPromise = idb.open(name, version, upgrade)

	const dbOperations = {
		$put: WriteOperation(dbPromise, 'put'),
		$delete: WriteOperation(dbPromise, 'delete'),
		$update: async (store, data) => {
			const db = await dbPromise
			const tx = db.transaction(store, 'readwrite')
			const storeObj = tx.objectStore(store)
			const oldValue = await storeObj.get(data[storeObj.keyPath])
			return await storeObj.put({...oldValue, ...data})
		},
	}

	return function idbDriver(write$) {
		const stores = {}
		const result$$ = createResult$$(dbPromise, dbOperations, write$)
		const error$ = createError$(result$$)

		return {
			error$,
			store: name => ({
				get: key => {
					const hash = name + '#get#' + key
					const selector = stores[hash] || GetSelector(dbPromise, result$$, name, key)
					stores[hash] = selector
					return selector
				},
				getAll: () => {
					const hash = name + '#getAll'
					const selector = stores[hash] || GetAllSelector(dbPromise, result$$, name)
					stores[hash] = selector
					return selector
				},
				count: () => {
					const hash = name + '#count'
					const selector = stores[hash] || CountSelector(dbPromise, result$$, name)
					stores[hash] = selector
					return selector
				}
			})
		}
	}
}

export function $put(store, data) {
	return { store, data, operation: '$put' }
}

export function $delete(store, key) {
	return { store, data: key, operation: '$delete' }
}

export function $update(store, data) {
	return { store, data: data, operation: '$update' }
}

const WriteOperation = (dbPromise, operation) => async (store, data) => {
	const db = await dbPromise
	return await db.transaction(store, 'readwrite')
		.objectStore(store)[operation](data)
}

function executeDbUpdate({ dbOperation, operation, store, data }) {
	const result$ = xs.createWithMemory({
		start: listener => {
			dbOperation(store, data)
				.then(result => {
					listener.next({
						updatedKey: result || data, // $delete returns 'undefined', but then the key is in 'data'
						store
					})
					listener.complete()
				})
				.catch(error => listener.error({
					error,
					query: { store, data, operation },
				}))
		},
		stop: () => {},
	})
	result$.addListener({
		next: () => {},
		complete: () => {},
		error: () => {},
	})
	result$._store = store
	return adapt(result$)
}

function createResult$$(dbPromise, dbOperations, write$) {
	return write$
		.map(({ operation, store, data }) => ({ dbOperation: dbOperations[operation], operation, store, data }))
		.map(executeDbUpdate)
}

function createError$(result$$) {
	return flattenConcurrently(result$$)
		.filter(_ => false)
}

function GetSelector(dbPromise, result$$, name, key) {
	return adapt(xs.createWithMemory({
		start: listener => flattenConcurrently(result$$
				.filter($ => $._store === name))
			.filter(({ updatedKey }) => updatedKey === key)
			.startWith(name)
			.addListener({
				next: async value => {
					try {
						const db = await dbPromise
						const data = await db.transaction(name)
							.objectStore(name)
							.get(key)
						listener.next(data)
					} catch (e) {
						listener.error(e)
					}
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}

function GetAllSelector(dbPromise, result$$, name) {
	return adapt(xs.createWithMemory({
		start: listener => flattenConcurrently(result$$
				.filter($ => $._store === name))
			.startWith(name)
			.addListener({
				next: async value => {
					try {
						const db = await dbPromise
						const data = await db.transaction(name)
							.objectStore(name)
							.getAll()
						listener.next(data)
					} catch (e) {
						listener.error(e)
					}
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}

function CountSelector(dbPromise, result$$, name) {
	return adapt(xs.createWithMemory({
		start: listener => flattenConcurrently(result$$
				.filter($ => $._store === name))
			.startWith(name)
			.addListener({
				next: async value => {
					try {
						const db = await dbPromise
						const count = await db.transaction(name)
							.objectStore(name)
							.count()
						listener.next(count)
					} catch (e) {
						listener.error(e)
					}
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}
