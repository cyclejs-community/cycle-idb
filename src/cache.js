export function SingleKeyCache(factory) {
	let cache
	return () => {
		if (!cache) {
			cache = factory()
		}
		return cache
	}
}

export function MultiKeyCache(factory, hashFn) {
	const cache = {}
	return key => {
		const hashKey = hashFn ? hashFn(key) : key
		if (!cache[hashKey]) {
			cache[hashKey] = factory(key)
		}
		return cache[hashKey]
	}
}