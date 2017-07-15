import xs from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import dropRepeats from 'xstream/extra/dropRepeats'

import { adapt } from '@cycle/run/lib/adapt'


export default function Store(dbPromise, result$$, name) {
	const cache = {}

	return {
		get: key => {
			const hash = 'get#' + key
			const selector = cache[hash] || GetSelector(dbPromise, result$$, name, key)
			cache[hash] = selector
			return selector
		},
		getAll: () => {
			const hash = 'getAll'
			const selector = cache[hash] || GetAllSelector(dbPromise, result$$, name)
			cache[hash] = selector
			return selector
		},
		count: () => {
			const hash = 'count'
			const selector = cache[hash] || CountSelector(dbPromise, result$$, name)
				.compose(dropRepeats())
			cache[hash] = selector
			return selector
		},
		index: indexName => {
			const hash = 'index#' + indexName
			const selector = cache[hash] || IndexSelector(dbPromise, result$$, name, indexName)
			cache[hash] = selector
			return selector
		},
	}
}

function IndexSelector(dbPromise, result$$, storeName, indexName) {
	const cache = {}

	return {
		getAll: key => {
			const hash = 'getAll#' + key
			const selector = cache[hash] || adapt(xs.createWithMemory({
				start: listener => flattenConcurrently(result$$.filter($ => $._store === storeName))
					.filter(({ result }) => !key || result.indexes[indexName].indexOf(key) !== -1)
					.startWith(storeName)
					.addListener({
						next: async value => {
							try {
								const db = await dbPromise
								const data = await db.transaction(storeName)
									.objectStore(storeName)
									.index(indexName)
									.getAll(key)
								listener.next(data)
							} catch (e) {
								listener.error(e)
							}
						},
						error: e => listener.error(e),
					}),
				stop: () => {},
			}))
			cache[hash] = selector
			return selector
		}
	}
}

function GetSelector(dbPromise, result$$, name, key) {
	return adapt(xs.createWithMemory({
		start: listener => flattenConcurrently(result$$
				.filter($ => $._store === name))
			.filter(({ result }) => result.key === key)
			.startWith(name)
			.addListener({
				next: async value => {
					try {
						const db = await dbPromise
						const data = await db.transaction(name)
							.objectStore(name)
							.get(key)
						listener.next(data)
					} catch (e) {
						listener.error(e)
					}
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}

function GetAllSelector(dbPromise, result$$, name) {
	return adapt(xs.createWithMemory({
		start: listener => flattenConcurrently(result$$
				.filter($ => $._store === name))
			.startWith(name)
			.addListener({
				next: async value => {
					try {
						const db = await dbPromise
						const data = await db.transaction(name)
							.objectStore(name)
							.getAll()
						listener.next(data)
					} catch (e) {
						listener.error(e)
					}
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}

function CountSelector(dbPromise, result$$, name) {
	return adapt(xs.createWithMemory({
		start: listener => flattenConcurrently(result$$
				.filter($ => $._store === name))
			.startWith(name)
			.addListener({
				next: async value => {
					try {
						const db = await dbPromise
						const count = await db.transaction(name)
							.objectStore(name)
							.count()
						listener.next(count)
					} catch (e) {
						listener.error(e)
					}
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}
