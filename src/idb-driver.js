import xs from 'xstream'
import { adapt } from '@cycle/run/lib/adapt'

import idb from 'idb'


export default function makeIdbDriver(name, version, upgrade) {
	const dbPromise = idb.open(name, version, upgrade)

	const BasicOperation = (operation) => async (store, data) => {
		const db = await dbPromise
		const tx = db.transaction(store, 'readwrite')
		const storeObj = tx.objectStore(store)
		storeObj[operation](data)
		return await tx.complete
	}
	const IDB_OPERATIONS = {
		$put: BasicOperation('put'),
		$delete: BasicOperation('delete'),
		$update: async (store, data) => {
			const db = await dbPromise
			const tx = db.transaction(store, 'readwrite')
			const storeObj = tx.objectStore(store)
			const oldValue = await storeObj.get(data[storeObj.keyPath])
			storeObj.put({...oldValue, ...data})
			return await tx.complete
		},
	}

	return function idbDriver(write$) {
		const stores = {}

		write$.addListener({
			next: async ({ operation, store, data }) => {
				return await IDB_OPERATIONS[operation](store, data)
			},
			error: () => {},
			complete: () => {},
		})

		return {
			store: name => ({
				get: key => {
					const hash = name + '#' + key
					const selector = stores[hash] || GetSelector(dbPromise, write$, name, key)
					stores[hash] = selector
					return selector
				},
				getAll: () => {
					const selector = stores[name] || GetAllSelector(dbPromise, write$, name)
					stores[name] = selector
					return selector
				}
			})
		}
	}
}

export function $put(store, data) {
	return { store, data, operation: '$put' }
}

export function $delete(store, key) {
	return { store, data: key, operation: '$delete' }
}

export function $update(store, data) {
	return { store, data: data, operation: '$update' }
}

function GetSelector(dbPromise, write$, name, key) {
	return adapt(xs.createWithMemory({
		start: listener => write$
			.filter(({ store }) => store === name)
			.startWith(name)
			.addListener({
				next: async value => {
					const db = await dbPromise
					const tx = db.transaction(name)
					const store = tx.objectStore(name)
					const keyPath = store.keyPath

					if (value !== name && value.data[keyPath] !== key) {
						return
					}
					const data = await store.get(key)
					listener.next(data)
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}

function GetAllSelector(dbPromise, write$, name) {
	return adapt(xs.createWithMemory({
		start: listener => write$
			.filter(({ store }) => store === name)
			.startWith(name)
			.addListener({
				next: async value => {
					const db = await dbPromise
					const tx = db.transaction(name)
					const store = tx.objectStore(name)
					const data = await store.getAll()
					listener.next(data)
				},
				error: e => listener.error(e)
			}),
		stop: () => {},
	}))
}
