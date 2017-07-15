import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'

import { adapt } from '@cycle/run/lib/adapt'

import idb from 'idb'

import Store from './Store'


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
		const result$$ = createResult$$(dbPromise, dbOperations, write$)
		const error$ = createError$(result$$)

		return {
			error$,
			store: name => Store(dbPromise, result$$, name),
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
