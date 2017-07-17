import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'

import { SingleKeyCache, MultiKeyCache } from './cache'


export default function Store(dbPromise, result$$, name) {
	const result$ = flattenConcurrently(result$$.filter($ => $._store === name))

	return {
		get: MultiKeyCache(key => GetSelector(dbPromise, result$, name, key)),
		getAll: SingleKeyCache(() => GetAllSelector(dbPromise, result$, name)),
		getAllKeys: SingleKeyCache(() => GetAllKeysSelector(dbPromise, result$, name)),
		count: SingleKeyCache(() => CountSelector(dbPromise, result$, name)),
		index: MultiKeyCache(indexName => IndexSelector(dbPromise, result$, name, indexName)),
	}
}

function IndexSelector(dbPromise, result$, storeName, indexName) {
	return {
		getAll: MultiKeyCache(key => {
			const filteredResult$ = result$.filter(({ result }) => !key || result.indexes[indexName].indexOf(key) !== -1)
			const options = { dbPromise, storeName, indexName, key, operation: 'getAll' }
			return DbSelector(filteredResult$, ReadDbIndexListener, options)
		}),
		get: MultiKeyCache(key => {
			const filteredResult$ = result$.filter(({ result }) => !key || result.indexes[indexName].indexOf(key) !== -1)
			const options = { dbPromise, storeName, indexName, key, operation: 'get' }
			return DbSelector(filteredResult$, ReadDbIndexListener, options)
		}),
		count: MultiKeyCache(key => {
			const filteredResult$ = result$.filter(({ result }) => !key || result.indexes[indexName].indexOf(key) !== -1)
			const options = { dbPromise, storeName, indexName, key, operation: 'count' }
			return DbSelector(filteredResult$, ReadDbIndexListener, options)
				.compose(dropRepeats())
		})
	}
}

function DbSelector(result$, Listener, options) {
	return adapt(xs.createWithMemory({
		start: listener => result$
			.startWith(1)
			.addListener(Listener(listener, options)),
		stop: () => {},
	}))
}

const GetSelector = (dbPromise, result$, storeName, key) => 
	DbSelector(result$.filter(({ result }) => result.key === key), ReadDbListener, {
		dbPromise, storeName, operation: 'get', key
	})

const GetAllSelector = (dbPromise, result$, storeName) => 
	DbSelector(result$, ReadDbListener, { dbPromise, storeName, operation: 'getAll' })

const CountSelector = (dbPromise, result$, storeName) =>
	DbSelector(result$, ReadDbListener, { dbPromise, storeName, operation: 'count'})
		.compose(dropRepeats())

const GetAllKeysSelector = (dbPromise, result$, storeName) => {
	const filteredResult$ = result$
		.filter(({ result }) => result.operation === 'inserted' || result.operation === 'deleted')
	return DbSelector(filteredResult$, ReadDbListener, { dbPromise, storeName, operation: 'getAllKeys' })
}

function ReadDbListener(listener, { dbPromise, storeName, operation, key }) {
	return {
		next: async value => {
			try {
				const db = await dbPromise
				const data = await db.transaction(storeName)
					.objectStore(storeName)[operation](key)
				listener.next(data)
			} catch (e) {
				listener.error(e)
			}
		},
		error: e => listener.error(e)
	}
}

function ReadDbIndexListener(listener, { dbPromise, storeName, indexName, operation, key }) {
	return {
		next: async value => {
			try {
				const db = await dbPromise
				const data = await db.transaction(storeName)
					.objectStore(storeName)
					.index(indexName)[operation](key)
				listener.next(data)
			} catch (e) {
				listener.error(e)
			}
		},
		error: e => listener.error(e)
	}
}
