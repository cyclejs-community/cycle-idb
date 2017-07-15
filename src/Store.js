import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'


export default function Store(dbPromise, result$$, name) {
	const cache = {}
	const result$ = flattenConcurrently(result$$.filter($ => $._store === name))

	return {
		get: key => {
			const hash = 'get#' + key
			const selector = cache[hash] || GetSelector(dbPromise, result$, name, key)
			cache[hash] = selector
			return selector
		},
		getAll: () => {
			const hash = 'getAll'
			const selector = cache[hash] || GetAllSelector(dbPromise, result$, name)
			cache[hash] = selector
			return selector
		},
		count: () => {
			const hash = 'count'
			const selector = cache[hash] || CountSelector(dbPromise, result$, name)
			cache[hash] = selector
			return selector
		},
		index: indexName => {
			const hash = 'index#' + indexName
			const selector = cache[hash] || IndexSelector(dbPromise, result$, name, indexName)
			cache[hash] = selector
			return selector
		},
	}
}

function IndexSelector(dbPromise, result$, storeName, indexName) {
	const cache = {}

	return {
		getAll: key => {
			const hash = 'getAll#' + key
			const selector = cache[hash] || adapt(xs.createWithMemory({
				start: listener => result$
					.filter(({ result }) => !key || result.indexes[indexName].indexOf(key) !== -1)
					.startWith(storeName)
					.addListener(ReadDbIndexListener(listener, dbPromise, storeName, indexName, 'getAll', key)),
				stop: () => {},
			}))
			cache[hash] = selector
			return selector
		}
	}
}

function GetSelector(dbPromise, result$, name, key) {
	return adapt(xs.createWithMemory({
		start: listener => result$
			.filter(({ result }) => result.key === key)
			.startWith(name)
			.addListener(ReadDbListener(listener, dbPromise, name, 'get', key)),
		stop: () => {},
	}))
}

function GetAllSelector(dbPromise, result$, name) {
	return adapt(xs.createWithMemory({
		start: listener => result$
			.startWith(name)
			.addListener(ReadDbListener(listener, dbPromise, name, 'getAll')),
		stop: () => {},
	}))
}

function CountSelector(dbPromise, result$, name) {
	return adapt(xs.createWithMemory({
		start: listener => result$
			.startWith(name)
			.addListener(ReadDbListener(listener, dbPromise, name, 'count')),
		stop: () => {},
	})).compose(dropRepeats())
}

function ReadDbListener(listener, dbPromise, storeName, operation, key) {
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

function ReadDbIndexListener(listener, dbPromise, storeName, indexName, operation, key) {
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
