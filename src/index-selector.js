import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'

import {
	ReadFromDb,
	ReadFromDbCursor,
	hashKey,
	keyIsUndefined,
	promiseToStream,
	resultIsCleared,
	resultIsInsertedOrDeleted,
} from './selector-utils'

import { MultiKeyCache } from './cache'

import { any, xor, isDefined } from './util'


export default function IndexSelector(dbPromise, result$, storeName, indexName) {
	const filterByKey = key => ({ result }) => (key === undefined || result.indexes[indexName].oldValue === key || result.indexes[indexName].newValue === key)
	const filterByKeyRange = key => ({ result }) => {
		return key === undefined
			|| (result.indexes[indexName].oldValue && key.includes(result.indexes[indexName].oldValue))
			|| (result.indexes[indexName].newValue && key.includes(result.indexes[indexName].newValue))
	}
	const keyIsAddedOrRemoved = key =>
		({ result }) => xor(result.indexes[indexName].oldValue !== key, result.indexes[indexName].newValue !== key)

	const makeDbReader = ReadFromDb({ dbPromise, storeName, indexName })
	const makeDbCursorReader = ReadFromDbCursor({ dbPromise, storeName, indexName })
	const keyRangeCache = MultiKeyCache(key => KeyRangeSelector(result$, makeDbReader, makeDbCursorReader, filterByKeyRange, indexName, key), hashKey)

	return {
		get: MultiKeyCache(key => GetSelector(result$, makeDbReader, filterByKey, key)),
		getAll: MultiKeyCache(key => GetAllSelector(result$, makeDbReader, filterByKey, key)),
		getAllKeys: MultiKeyCache(key => GetAllKeysSelector(result$, makeDbReader, filterByKey, keyIsAddedOrRemoved, indexName, key)),
		getKey: MultiKeyCache(key => GetKeySelector(result$, makeDbReader, filterByKey, key)),
		count: MultiKeyCache(key => CountSelector(result$, makeDbReader, filterByKey, key)),
		query: MultiKeyCache(filter => QuerySelector(result$, makeDbCursorReader, filterByKey, filter)),
		only: key => keyRangeCache(IDBKeyRange.only(key)),
		bound: (lower, upper, lowerOpen=false, upperOpen=false) =>
			keyRangeCache(IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)),
		lowerBound: (lower, lowerOpen=false) => keyRangeCache(IDBKeyRange.lowerBound(lower, lowerOpen)),
		upperBound: (upper, upperOpen=false) => keyRangeCache(IDBKeyRange.upperBound(upper, upperOpen)),
	}
}

function KeyRangeSelector(result$, makeDbReader, makeDbCursorReader, filterByKey, indexName, keyRange) {
	const indexIsIncluded = (key, indexValue) => isDefined(indexValue) && key.includes(indexValue)
	const keyIsAddedOrRemoved = key => ({ result }) => xor(
		indexIsIncluded(key, result.indexes[indexName].oldValue),
		indexIsIncluded(key, result.indexes[indexName].newValue)
	)
	
	return {
		get: MultiKeyCache(key => GetSelector(result$, makeDbReader, filterByKey, keyRange)),
		getAll: MultiKeyCache(key => GetAllSelector(result$, makeDbReader, filterByKey, keyRange)),
		getAllKeys: MultiKeyCache(key => GetAllKeysSelector(result$, makeDbReader, filterByKey, keyIsAddedOrRemoved, indexName, keyRange)),
		getKey: MultiKeyCache(key => GetKeySelector(result$, makeDbReader, filterByKey, keyRange)),
		count: MultiKeyCache(key => CountSelector(result$, makeDbReader, filterByKey, keyRange)),
		query: MultiKeyCache(filter => QuerySelector(result$, makeDbCursorReader, filterByKey, filter, keyRange)),
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

function GetAllKeysSelector(result$, makeDbReader, filterByKey, keyIsAddedOrRemoved, indexName, key) {
	const readFromDb = makeDbReader('getAllKeys', key)
	const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
		.filter(any(resultIsCleared, ({ result }) => result.indexes.hasOwnProperty(indexName)))
		.filter(any(resultIsCleared, keyIsAddedOrRemoved(key)))
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

function QuerySelector(result$, makeDbCursorReader, filterByKey, filter, key) {
	const readFromDb = makeDbCursorReader(filter, key)
	const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
		.filter(any(resultIsCleared, ({ result: { oldValue, newValue }}) => 
			(oldValue && filter(oldValue)) || (newValue && filter(newValue))))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
}
