import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'

import { adapt } from '@cycle/run/lib/adapt'

import idb from 'idb'

import Store from './Store'
import { MultiKeyCache } from './cache'


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
			store: MultiKeyCache(name => Store(dbPromise, result$$, name)),
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
	return { store, data, operation: '$update' }
}

function updatedIndexes(storeObj, old, data) {
	return Array.from(storeObj.indexNames)
		.map(index => {
			const indexKeyPath = storeObj.index(index).keyPath
			old = old || {}
			return {
				index,
				oldValue: old[indexKeyPath],
				newValue: data.hasOwnProperty(indexKeyPath) ? data[indexKeyPath] : undefined
			}
		})
		.filter(({ oldValue, newValue }) => oldValue || newValue)
		.reduce((acc, { index, oldValue, newValue }) => {
			acc[index] = {
				oldValue,
				newValue,
			}
			return acc
		}, {})
}

const WriteOperation = (dbPromise, operation, merge=false) => async (store, data) => {
	const db = await dbPromise
	const tx = db.transaction(store, 'readwrite')
	const storeObj = tx.objectStore(store)

	const keyPath = storeObj.keyPath
	const key = operation === 'delete' ? data : data[keyPath]
	let old = {}
	if (key) {
		old = await storeObj.get(key)
	}

	const updatedData = merge ? {...old, ...data} : data
	const modifiedIndexes = updatedIndexes(storeObj, old, updatedData)

	const [ result, _ ] = await Promise.all([
		storeObj[operation](updatedData),
		tx.complete
	])
	return {
		key: result || data, // $delete returns 'undefined', but then the key is in 'data'
		indexes: modifiedIndexes,
		operation: operation === 'delete' ? 'deleted' : (old === undefined ? 'inserted' : 'modified'),
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
				.catch(error => {
					error = error || new Error(error) // Why does idb throw null errors?
					error.query = { store, data, operation }
					listener.error(error)
				})
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
