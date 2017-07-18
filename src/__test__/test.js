export const getTestId = (() => {
	let nextId = 0
	return () => `ponies-${nextId++}`
})()

export const sequenceListener = test => (listeners, errorHandler, bounded=true) => {
	let current = 0
	return {
		next: value => {
			if (current >= listeners.length) {
				if (bounded) test.fail(`Sequence was longer than ${listeners.length}`)
				else current = 0
			}
			listeners[current](value)
			current++
		},
		error: errorHandler || (e => test.fail(JSON.stringify(e))),
	}
}