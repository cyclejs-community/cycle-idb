import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'

import {
	//ReadFromDb,
	hashKey,
	keyIsUndefined,
	promiseToStream,
	resultIsCleared,
	resultIsInsertedOrDeleted,
} from './selector-utils'

import { MultiKeyCache } from './cache'

import { any, pipe, xor } from './util'


const ReadFromDb = ({ dbPromise, storeName, indexName }) => (operation, key) => {
	const read = pipe(
		db => db.transaction(storeName).objectStore(storeName),
		store => indexName ? store.index(indexName) : store,
		store => store[operation].bind(store)
	)
	return async () => {
		const db = await dbPromise
		const data = await read(db)(key)
		return data
	}
}

export default function IndexSelector(dbPromise, result$, storeName, indexName) {
	const filterByKey = key => ({ result }) => (key === undefined || result.indexes[indexName].oldValue === key || result.indexes[indexName].newValue === key)
	const makeDbReader = ReadFromDb({ dbPromise, storeName, indexName })
	const keyRangeCache = MultiKeyCache(key => KeyRangeSelector(result$, makeDbReader, filterByKey, key), hashKey)

	return {
		get: MultiKeyCache(key => GetSelector(result$, makeDbReader, filterByKey, key)),
		getAll: MultiKeyCache(key => GetAllSelector(result$, makeDbReader, filterByKey, key)),
		getAllKeys: MultiKeyCache(key => GetAllKeysSelector(result$, makeDbReader, filterByKey, indexName, key)),
		getKey: MultiKeyCache(key => GetKeySelector(result$, makeDbReader, filterByKey, key)),
		count: MultiKeyCache(key => CountSelector(result$, makeDbReader, filterByKey, key)),
		only: key => keyRangeCache(IDBKeyRange.only(key)),
	}
}

function KeyRangeSelector(result$, makeDbReader, filterByKey, keyRange) {
	return {
		get: MultiKeyCache(key => GetSelector(result$, makeDbReader, filterByKey, keyRange)),
		getAll: MultiKeyCache(key => GetAllSelector(result$, makeDbReader, filterByKey, keyRange)),
		getAllKeys: MultiKeyCache(key => GetAllKeysSelector(result$, makeDbReader, filterByKey, indexName, keyRange)),
		getKey: MultiKeyCache(key => GetKeySelector(result$, makeDbReader, filterByKey, keyRange)),
		count: MultiKeyCache(key => CountSelector(result$, makeDbReader, filterByKey, keyRange)),
	}
}

function GetSelector(result$, makeDbReader, filterByKey, key) {
	const readFromDb = makeDbReader('get', key)
	const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
}

function GetAllSelector(result$, makeDbReader, filterByKey, key) {
	const readFromDb = makeDbReader('getAll', key)
	const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
}

function GetAllKeysSelector(result$, makeDbReader, filterByKey, indexName, key) {
	const readFromDb = makeDbReader('getAllKeys', key)
	const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
		.filter(any(resultIsCleared, ({ result }) => result.indexes.hasOwnProperty(indexName)))
		.filter(any(resultIsCleared, ({ result }) => xor(result.indexes[indexName].oldValue !== key, result.indexes[indexName].newValue !== key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
}

function GetKeySelector(result$, makeDbReader, filterByKey, key) {
	const readFromDb = makeDbReader('getKey', key)
	const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
		.filter(any(resultIsCleared, resultIsInsertedOrDeleted))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
}

function CountSelector(result$, makeDbReader, filterByKey, key) {
	const readFromDb = makeDbReader('count', key)
	const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$).compose(dropRepeats())
	return adapt(dbResult$)
		.remember()
}
