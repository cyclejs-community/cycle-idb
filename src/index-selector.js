import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'

import {
	ReadFromDb,
	hashKey,
	keyIsUndefined,
	promiseToStream,
	resultIsCleared,
	resultIsInsertedOrDeleted,
} from './selector-utils'

import { MultiKeyCache } from './cache'

import { any, xor } from './util'


export default function IndexSelector(dbPromise, result$, storeName, indexName) {
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
				.remember()
		}),
		getAll: MultiKeyCache(key => {
			const readFromDb = ReadFromDb('getAll', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$)
			return adapt(dbResult$)
				.remember()
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
				.remember()
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
				.remember()
		}),
		count: MultiKeyCache(key => {
			const readFromDb = ReadFromDb('count', { dbPromise, storeName, indexName, key })
			const dbResult$$ = result$.filter(any(resultIsCleared, filterByKey(key)))
				.startWith(1)
				.map(readFromDb)
				.map(promiseToStream)
			const dbResult$ = flattenConcurrently(dbResult$$).compose(dropRepeats())
			return adapt(dbResult$)
				.remember()
		}),
	}
}