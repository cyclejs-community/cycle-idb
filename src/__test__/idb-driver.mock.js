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

export function mockDatabase(entries=[], stores=[]) {
	return upgradeDb => {
		const ponies = upgradeDb.createObjectStore('ponies', { keyPath: 'name' })
		entries.forEach(e => ponies.put(e))
		stores.forEach(s => upgradeDb.createObjectStore(s.name, s.options))
	}
}

export function mockDbWithIndex(entries=[]) {
	return upgradeDb => {
		const ponies = upgradeDb.createObjectStore('ponies', { keyPath: 'id', autoIncrement: true })
		ponies.createIndex('name', 'name', { unique: true })
		ponies.createIndex('type', 'type', { unique: false })
		entries.forEach(e => ponies.put(e))
	}
}

export function mockDbWithTypeIndex(entries=[]) {
	return upgradeDb => {
		const ponies = upgradeDb.createObjectStore('ponies', { keyPath: 'name' })
		ponies.createIndex('type', 'type', { unique: false })
		entries.forEach(e => ponies.put(e))
	}
}

export function mockDbWithNameIndex(entries=[]) {
	return upgradeDb => {
		const ponies = upgradeDb.createObjectStore('ponies', { autoIncrement: true })
		ponies.createIndex('name', 'name', { unique: true })
		entries.forEach(e => ponies.put(e))
	}
}

export function mockDbWithNumberIndex(entries=[]) {
	return upgradeDb => {
		const ponies = upgradeDb.createObjectStore('ponies', { autoIncrement: true })
		ponies.createIndex('isManeSix', 'isManeSix', { unique: false })
		entries.forEach(e => ponies.put(e))
	}
}

export function mockEpisodesDb(entries=[]) {
	return upgradeDb => {
		const episodes = upgradeDb.createObjectStore('ponies', { keyPath: 'number' })
		episodes.createIndex('release_date', 'release_date')
		episodes.createIndex('season', 'season')
		episodes.createIndex('writer', 'writer')
		entries.forEach(e => episodes.put(e))
	}
}
