export function SingleKeyCache(factory) {
	let cache
	return () => {
		if (!cache) {
			cache = factory()
		}
		return cache
	}
}

export function MultiKeyCache(factory) {
	const cache = {}
	return key => {
		if (!cache[key]) {
			cache[key] = factory(key)
		}
		return cache[key]
	}
}