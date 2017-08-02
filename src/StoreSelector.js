import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'

import { SingleKeyCache, MultiKeyCache } from './cache'

import { and, any, pipe, xor } from './util'


export default function StoreSelector(dbPromise, result$$, storeName) {
	const result$ = flattenConcurrently(result$$.filter($ => $._store === storeName))
	const keyCache = MultiKeyCache(key => KeyRangeSelector(dbPromise, result$, storeName, key), hashKey)

	return {
		get: key => keyCache(IDBKeyRange.only(key)).get(),
		getAll: MultiKeyCache(() => GetAllSelector(dbPromise, result$, storeName)),
		getAllKeys: MultiKeyCache(() => GetAllKeysSelector(dbPromise, result$, storeName)),
		count: MultiKeyCache(() => CountSelector(dbPromise, result$, storeName)),
		index: MultiKeyCache(indexName => IndexSelector(dbPromise, result$, storeName, indexName)),
		query: MultiKeyCache(filter => QuerySelector(dbPromise, result$, filter, storeName)),
		only: key => keyCache(IDBKeyRange.only(key)),
		bound: (lower, upper, lowerOpen=false, upperOpen=false) =>
			keyCache(IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)),
		lowerBound: (lower, lowerOpen=false) => keyCache(IDBKeyRange.lowerBound(lower, lowerOpen)),
		upperBound: (upper, upperOpen=false) => keyCache(IDBKeyRange.upperBound(upper, upperOpen)),
	}
}

function KeyRangeSelector(dbPromise, result$, storeName, keyRange) {
	return {
		get: MultiKeyCache(() => GetSelector(dbPromise, result$, storeName, keyRange), hashKey),
		getAll: MultiKeyCache(() => GetAllSelector(dbPromise, result$, storeName, keyRange), hashKey),
		getAllKeys: MultiKeyCache(() => GetAllKeysSelector(dbPromise, result$, storeName, keyRange), hashKey),
		count: MultiKeyCache(() => CountSelector(dbPromise, result$, storeName, keyRange), hashKey),
	}
}

const hashKey = key => key instanceof IDBKeyRange ? `${key.lower}#${key.lowerOpen}#${key.upper}#${key.upperOpen}` : key

function IndexSelector(dbPromise, result$, storeName, indexName) {
	const filterByKey = key => ({ result }) => (key === undefined || result.indexes[indexName].oldValue === key || result.indexes[indexName].newValue === key)

	return {
		get: MultiKeyCache(key => {
			const readFromDb = ReadFromDb('get', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
		}),
		getAll: MultiKeyCache(key => {
			const readFromDb = ReadFromDb('getAll', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
		}),
		getAllKeys: MultiKeyCache(key => {
			const readFromDb = ReadFromDb('getAllKeys', { dbPromise, storeName, indexName, key })
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
			const readFromDb = ReadFromDb('getKey', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.filter(any(resultIsCleared, resultIsInsertedOrDeleted))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
		}),
		count: MultiKeyCache(key => {
			const readFromDb = ReadFromDb('count', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$).compose(dropRepeats())
			return adapt(dbResult$)
		}),
	}
}

const resultIsInsertedOrDeleted = ({ result }) =>
	result.operation === 'inserted' || result.operation === 'deleted'

const resultIsCleared = ({ result }) => result.operation === 'cleared'

const resultIsInKey = key => ({ result }) => key && key.includes(result.key)

const keyIsUndefined = key => () => key === undefined

const GetSelector = (dbPromise, result$, storeName, key) => {
	const readFromDb = ReadFromDb('get', { dbPromise, storeName, key })
	const dbResult$$ = result$.filter(any(resultIsCleared, resultIsInKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
}

const GetAllSelector = (dbPromise, result$, storeName, key) => {
	const readFromDb = ReadFromDb('getAll', { dbPromise, storeName, key })
	const dbResult$$ = result$
		.filter(any(keyIsUndefined(key), resultIsCleared, resultIsInKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
}

const CountSelector = (dbPromise, result$, storeName, key) => {
	const readFromDb = ReadFromDb('count', { dbPromise, storeName, key })
	const dbResult$$ = result$
		.filter(any(keyIsUndefined(key), resultIsCleared, resultIsInKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$).compose(dropRepeats())
	return adapt(dbResult$)
}

const GetAllKeysSelector = (dbPromise, result$, storeName, key) => {
	const readFromDb = ReadFromDb('getAllKeys', { dbPromise, storeName, key })
	const dbResult$$ = result$
		.filter(any(
			resultIsCleared,
			and(keyIsUndefined(key), resultIsInsertedOrDeleted),
			and(resultIsInKey(key), resultIsInsertedOrDeleted),
		))
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

const ReadFromDb = (operation, { dbPromise, storeName, indexName, key }) => {
	const read = pipe(
		db => db.transaction(storeName).objectStore(storeName),
		store => indexName ? store.index(indexName) : store,
		store => store[operation].bind(store),
	)
	return async () => {
		const db = await dbPromise
		const data = await read(db)(key)
		return data
	}
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
