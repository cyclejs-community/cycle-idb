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
		$update: WriteOperation(dbPromise, 'put', true),
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

function updatedIndexes(storeObj, old, data) {
	return storeObj.indexNames
		.map(index => {
			const indexKeyPath = storeObj.index(index).keyPath
			return {
				index,
				oldValue: old[indexKeyPath],
				newValue: data.hasOwnProperty(indexKeyPath) ? data[indexKeyPath] : old[indexKeyPath]
			}
		})
		.reduce((acc, { index, oldValue, newValue }) => {
			const entry = acc[index] || []
			if (oldValue && entry.indexOf(oldValue) === -1) {
				entry.push(oldValue)
			}
			if (newValue && entry.indexOf(newValue) === -1) {
				entry.push(newValue)
			}
			acc[index] = entry
			return acc
		}, {})
}

const WriteOperation = (dbPromise, operation, merge=false) => async (store, data) => {
	const db = await dbPromise
	const tx = db.transaction(store, 'readwrite')
	const storeObj = tx.objectStore(store)

	const key = operation === 'delete' ? data : data[storeObj.keyPath]
	let old = {}
	if (key) {
		old = await storeObj.get(key)
	}
	//const old = await storeObj.get(key)

	const modifiedIndexes = updatedIndexes(storeObj, old, data)
	const updatedData = merge ? {...old, ...data} : data

	const [ result, _ ] = await Promise.all([
		storeObj[operation](updatedData),
		tx.complete
	])
	return {
		key: result || data, // $delete returns 'undefined', but then the key is in 'data'
		indexes: modifiedIndexes
	}
}

function executeDbUpdate({ dbOperation, operation, store, data }) {
	const result$ = xs.createWithMemory({
		start: listener => {
			dbOperation(store, data)
				.then(result => {
					listener.next({
						result,
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
		.remember()
}

function createError$(result$$) {
	return flattenConcurrently(result$$)
		.filter(_ => false)
}
