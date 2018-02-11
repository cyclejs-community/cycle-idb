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
	resultIsInKey,
	resultIsInsertedOrDeleted,
} from './selector-utils'

import { SingleKeyCache, MultiKeyCache } from './cache'

import { and, any, xor } from './util'

import IndexSelector from './index-selector'


export default function StoreSelector(dbPromise, result$$, storeName) {
	const result$ = flattenConcurrently(result$$.filter($ => $._store === storeName))
	const keyCache = MultiKeyCache(key => KeyRangeSelector(dbPromise, result$, storeName, key), hashKey)

	return {
		get: key => keyCache(IDBKeyRange.only(key)).get(),
		getAll: SingleKeyCache(() => GetAllSelector(dbPromise, result$, storeName)),
		getAllKeys: SingleKeyCache(() => GetAllKeysSelector(dbPromise, result$, storeName)),
		count: SingleKeyCache(() => CountSelector(dbPromise, result$, storeName)),
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
		get: SingleKeyCache(() => GetSelector(dbPromise, result$, storeName, keyRange), hashKey),
		getAll: SingleKeyCache(() => GetAllSelector(dbPromise, result$, storeName, keyRange), hashKey),
		getAllKeys: SingleKeyCache(() => GetAllKeysSelector(dbPromise, result$, storeName, keyRange), hashKey),
		count: SingleKeyCache(() => CountSelector(dbPromise, result$, storeName, keyRange), hashKey),
	}
}

const GetSelector = (dbPromise, result$, storeName, key) => {
	const readFromDb = ReadFromDb('get', { dbPromise, storeName, key })
	const dbResult$$ = result$.filter(any(resultIsCleared, resultIsInKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
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
		.remember()
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
		.remember()
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
		.remember()
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
