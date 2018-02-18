import xs from 'xstream'

import { pipe } from './util'


export const resultIsInsertedOrDeleted = ({ result }) =>
	result.operation === 'inserted' || result.operation === 'deleted'

export const resultIsCleared = ({ result }) => result.operation === 'cleared'

export const resultIsInKey = key => ({ result }) => key && key.includes(result.key)

export const keyIsUndefined = key => () => key === undefined

export const hashKey = key => key instanceof IDBKeyRange ? `${key.lower}#${key.lowerOpen}#${key.upper}#${key.upperOpen}` : key

export const ReadFromDb = ({ dbPromise, storeName, indexName }) => (operation, key) => {
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

export const ReadFromDbCursor = ({ dbPromise, storeName, indexName }) => (filter, key) => {
	const openStore = pipe(
		db => db.transaction(storeName).objectStore(storeName),
		store => indexName ? store.index(indexName) : store,
	)
	return async () => {
		const db = await dbPromise
		let cursor = await openStore(db).openCursor(key)
		const result = []
		while (cursor) {
			if (filter(cursor.value)) {
				result.push(cursor.value)
			}
			cursor = await cursor.continue()
		}
		return result
	}
}

export function promiseToStream(p) {
	const $ = xs.fromPromise(p)
	$.addListener({
		next: () => {},
		error: () => {},
		complete: () => {},
	})
	return $
}