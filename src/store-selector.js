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
	const makeDbReader = ReadFromDb({ dbPromise, storeName })
	const makeDbCursorReader = ReadFromDbCursor({ dbPromise, storeName })
	const result$ = flattenConcurrently(result$$.filter($ => $._store === storeName))
	const keyCache = MultiKeyCache(key => KeyRangeSelector(result$, makeDbReader, key), hashKey)

	return {
		get: key => keyCache(IDBKeyRange.only(key)).get(),
		getAll: SingleKeyCache(() => GetAllSelector(result$, makeDbReader)),
		getAllKeys: SingleKeyCache(() => GetAllKeysSelector(result$, makeDbReader)),
		count: SingleKeyCache(() => CountSelector(result$, makeDbReader)),
		index: MultiKeyCache(indexName => IndexSelector(dbPromise, result$, storeName, indexName)),
		query: MultiKeyCache(filter => QuerySelector(result$, makeDbCursorReader, filter)),
		only: key => keyCache(IDBKeyRange.only(key)),
		bound: (lower, upper, lowerOpen=false, upperOpen=false) =>
			keyCache(IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen)),
		lowerBound: (lower, lowerOpen=false) => keyCache(IDBKeyRange.lowerBound(lower, lowerOpen)),
		upperBound: (upper, upperOpen=false) => keyCache(IDBKeyRange.upperBound(upper, upperOpen)),
	}
}

function KeyRangeSelector(result$, makeDbReader, keyRange) {
	return {
		get: SingleKeyCache(() => GetSelector(result$, makeDbReader, keyRange), hashKey),
		getAll: SingleKeyCache(() => GetAllSelector(result$, makeDbReader, keyRange), hashKey),
		getAllKeys: SingleKeyCache(() => GetAllKeysSelector(result$, makeDbReader, keyRange), hashKey),
		count: SingleKeyCache(() => CountSelector(result$, makeDbReader, keyRange), hashKey),
	}
}

const GetSelector = (result$, makeDbReader, key) => {
	const readFromDb = makeDbReader('get', key)
	const dbResult$$ = result$.filter(any(resultIsCleared, resultIsInKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
}

const GetAllSelector = (result$, makeDbReader, key) => {
	const readFromDb = makeDbReader('getAll', key)
	const dbResult$$ = result$
		.filter(any(keyIsUndefined(key), resultIsCleared, resultIsInKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
		.remember()
}

const CountSelector = (result$, makeDbReader, key) => {
	const readFromDb = makeDbReader('count', key)
	const dbResult$$ = result$
		.filter(any(keyIsUndefined(key), resultIsCleared, resultIsInKey(key)))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$).compose(dropRepeats())
	return adapt(dbResult$)
		.remember()
}

const GetAllKeysSelector = (result$, makeDbReader, key) => {
	const readFromDb = makeDbReader('getAllKeys', key)
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

const QuerySelector = (result$, makeDbCursorReader, filter) => {
	const readFromDb = makeDbCursorReader(filter)
	const dbResult$$ = result$
		.filter(any(resultIsCleared, ({ result: { oldValue, newValue }}) => 
			(oldValue && filter(oldValue)) || (newValue && filter(newValue))))
		.startWith(1)
		.map(readFromDb)
		.map(promiseToStream)
	const dbResult$ = flattenConcurrently(dbResult$$)
	return adapt(dbResult$)
}
