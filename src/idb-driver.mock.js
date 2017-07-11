import 'fake-indexeddb/build/global'


export function mockIdb(idb, mocks) {
	const originals = {}
	Object.keys(mocks).forEach(key => {
		originals[key] = idb[key]
		idb[key] = mocks[key]
	})
	idb.$restore = () => Object.keys(originals).forEach(key => idb[key] = originals[key])
	return idb
}

export function mockDatabase(entries=[]) {
	return (upgradeDb) => {
		const ponies = upgradeDb.createObjectStore('ponies', { keyPath: 'name' })
		entries.forEach(e => ponies.put(e))
	}
}