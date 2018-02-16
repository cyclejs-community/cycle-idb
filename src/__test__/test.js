export const getTestId = (() => {
	let nextId = 0
	return () => `ponies-${nextId++}`
})()

export const sequenceListener = test => (listeners, errorHandler, bounded=true) => {
	let current = 0
	return {
		next: value => {
			if (current >= listeners.length) {
				if (bounded) {
					test.fail(`Unexpected value ${JSON.stringify(value)}`)
					return
				}
				else current = 0
			}
			listeners[current](value)
			current++
		},
		error: errorHandler || (e => {
			test.comment(e.stack)
			test.fail(e.message)
		}),
	}
}

export const range = (start, finish) => {
	const result = []
	for (let i=start; i<finish; i++) {
		result.push(i)
	}
	return result
}