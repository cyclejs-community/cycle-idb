import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'

import { SingleKeyCache, MultiKeyCache } from './cache'


export default function StoreSelector(dbPromise, result$$, storeName) {
	const result$ = flattenConcurrently(result$$.filter($ => $._store === storeName))

	return {
		get: MultiKeyCache(key => GetSelector(dbPromise, result$, storeName, key)),
		getAll: SingleKeyCache(() => GetAllSelector(dbPromise, result$, storeName)),
		getAllKeys: SingleKeyCache(() => GetAllKeysSelector(dbPromise, result$, storeName)),
		count: SingleKeyCache(() => CountSelector(dbPromise, result$, storeName)),
		index: MultiKeyCache(indexName => IndexSelector(dbPromise, result$, storeName, indexName)),
		query: MultiKeyCache(filter => QuerySelector(dbPromise, result$, filter, storeName)),
	}
}

function IndexSelector(dbPromise, result$, storeName, indexName) {
	const filterByKey = key => ({ result }) => (key === undefined || result.indexes[indexName].oldValue === key || result.indexes[indexName].newValue === key)

	return {
		get: MultiKeyCache(key => {
			const readFromDb = ReadFromDbIndex('get', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
		}),
		getAll: MultiKeyCache(key => {
			const readFromDb = ReadFromDbIndex('getAll', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
		}),
		getAllKeys: MultiKeyCache(key => {
			const readFromDb = ReadFromDbIndex('getAllKeys', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.filter(any(resultIsCleared, ({ result }) => result.indexes.hasOwnProperty(indexName)))
				.filter(any(resultIsCleared, ({ result }) => xor(result.indexes[indexName].oldValue !== key, result.indexes[indexName].newValue !== key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
		}),
		getKey: MultiKeyCache(key => {
			const readFromDb = ReadFromDbIndex('getKey', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.filter(any(resultIsCleared, resultIsInsertedOrDeleted))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
		}),
		count: MultiKeyCache(key => {
			const readFromDb = ReadFromDbIndex('count', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$).compose(dropRepeats())
			return adapt(dbResult$)
		}),
	}
}

const xor = (a, b) => (a || b) && !(a && b)

const any = (...fns) => value => {
	for (let fn of fns) {
		if (fn(value)) {
			return true
		}
	}
	return false
}

const resultIsInsertedOrDeleted = ({ result }) => result.operation === 'inserted' || result.operation === 'deleted'

const resultIsCleared = ({ result }) => result.operation === 'cleared'

const GetSelector = (dbPromise, result$, storeName, key) => {
	const readFromDb = ReadFromDb('get', { dbPromise, storeName, key })
	const dbResult$$ = result$.filter(any(resultIsCleared, ({ result }) => result.key === key))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
}

const GetAllSelector = (dbPromise, result$, storeName) => {
	const readFromDb = ReadFromDb('getAll', { dbPromise, storeName })
	const dbResult$$ = result$.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
}

const CountSelector = (dbPromise, result$, storeName) => {
	const readFromDb = ReadFromDb('count', { dbPromise, storeName })
	const dbResult$$ = result$.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$).compose(dropRepeats())
	return adapt(dbResult$)
}

const GetAllKeysSelector = (dbPromise, result$, storeName) => {
	const readFromDb = ReadFromDb('getAllKeys', { dbPromise, storeName })
	const dbResult$$ = result$.filter(any(resultIsInsertedOrDeleted, resultIsCleared))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
}

const QuerySelector = (dbPromise, result$, filter, storeName) => {
	const readFromDb = ReadFromDbCursor({ dbPromise, filter, storeName })
	const dbResult$$ = result$
		.filter(any(resultIsCleared, ({ result: { oldValue, newValue }}) => 
			(oldValue && filter(oldValue)) || (newValue && filter(newValue))))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
}

const ReadFromDb = (operation, { dbPromise, storeName, key }) => async () => {
	const db = await dbPromise
	const data = await db.transaction(storeName)
		.objectStore(storeName)[operation](key)
	return data
}

const ReadFromDbIndex = (operation, { dbPromise, storeName, indexName, key}) => async () => {
	const db = await dbPromise
	const data = await db.transaction(storeName)
		.objectStore(storeName)
		.index(indexName)[operation](key)
	return data
}

const ReadFromDbCursor = ({ filter, storeName, dbPromise }) => async () => {
	const db = await dbPromise
	let cursor = await db.transaction(storeName)
		.objectStore(storeName)
		.openCursor()
	const result = []
	while (cursor) {
		if (filter(cursor.value)) {
			result.push(cursor.value)
		}
		cursor = await cursor.continue()
	}
	return result
}

function promiseToStream(p) {
	const $ = xs.fromPromise(p)
	$.addListener({
		next: () => {},
		error: () => {},
		complete: () => {},
	})
	return $
}
