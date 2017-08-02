export const xor = (a, b) => (a || b) && !(a && b)

export const any = (...fns) => value => {
	for (let fn of fns) {
		if (fn(value)) {
			return true
		}
	}
	return false
}

export const and = (...fns) => value => {
	for (let fn of fns) {
		if(!fn(value)) {
			return false
		}
	}
	return true
}

export const pipe = (...fns) => data => fns.reduce((acc, fn) => fn(acc), data)
/*
export const pipe = (...fns) => data => {
	for (let fn of fns) {
		data = fn(data)
	}
	return data
}
*/