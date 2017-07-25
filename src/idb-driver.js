import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'

import { adapt } from '@cycle/run/lib/adapt'

import idb from 'idb'

import StoreSelector from './StoreSelector'
import { MultiKeyCache } from './cache'


export default function makeIdbDriver(name, version, upgrade) {
	const dbPromise = idb.open(name, version, upgrade)

	const dbOperations = {
		$put: WriteOperation(dbPromise, 'put'),
		$delete: WriteOperation(dbPromise, 'delete'),
		$update: WriteOperation(dbPromise, 'put', true),
		$add: WriteOperation(dbPromise, 'add'),
		$clear: ClearOperation(dbPromise),
		$cursor: CursorOperation(dbPromise),
	}

	return function idbDriver(write$) {
		const result$$ = createResult$$(dbPromise, dbOperations, write$)
		const error$ = createError$(result$$)

		return {
			error$,
			store: MultiKeyCache(name => StoreSelector(dbPromise, result$$, name)),
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

export function $add(store, data) {
	return { store, data, operation: '$add' }
}

export function $clear(store) {
	return { store, operation: '$clear' }
}

export function $cursor(store, { category, filter }) {
	return { store, data: { category, filter }, operation: '$cursor' }
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
		.filter(({ oldValue, newValue }) => oldValue !== undefined || newValue !== undefined)
		.reduce((acc, { index, oldValue, newValue }) => ({...acc, [index]: { oldValue, newValue }}), {})
}

const ClearOperation = (dbPromise) => async store => {
	const db = await dbPromise
	const tx = db.transaction(store, 'readwrite')

	const [ result, _ ] = await Promise.all([
		tx.objectStore(store).clear(),
		tx.complete,
	])
	return {
		operation: 'cleared',
	}
}

const WriteOperation = (dbPromise, operation, merge=false) => async (store, data) => {
	const db = await dbPromise
	const tx = db.transaction(store, 'readwrite')
	const storeObj = tx.objectStore(store)

	const keyPath = storeObj.keyPath
	const key = operation === 'delete' ? data : data[keyPath]
	let old
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
		oldValue: old,
		newValue: operation !== 'delete' ? updatedData : undefined,
	}
}

const CursorOperation = dbPromise => async (store, { category, filter }) => {
	const db = await dbPromise
	const cursor = await db.transaction(store)
		.objectStore(store)
		.openCursor()
	const result = await executeCursor(cursor, filter)

	return {
		data: result,
		indexes: {},
		category,
	}
}

async function executeCursor(cursor, filter) {
	const result = []
	while (cursor) {
		if (filter(cursor.value)) {
			result.push(cursor.value)
		}
		cursor = await cursor.continue()
	}
	return result
}

function executeDbUpdate({ dbOperation, operation, store, data }) {
	const p = dbOperation(store, data)
		.catch(e => {
			e = e || new Error(e) // Why does idb throw null errors?
			e.query = { store, data, operation }
			throw e
		})
	const result$ = xs.fromPromise(p)
		.map(result => ({ result, store }))
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
