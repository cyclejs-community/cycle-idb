import test from 'tape'
import sinon from 'sinon'

import xs from 'xstream'
import fromDiagram from 'xstream/extra/fromDiagram'

import { 
	mockIdb,
	mockDatabase,
} from './idb-driver.mock'
import idb from 'idb'

import makeIdbDriver, {
	$delete,
	$put,
	$update,
} from './idb-driver'


test('#makeIdbDriver() should call idb.open() with name, version and upgrade', t => {
	t.plan(4)
	const idbMock = mockIdb(idb, {
		open: sinon.spy()
	})

	const fakeUpgrade = () => {}
	makeIdbDriver('ponies', 1, fakeUpgrade)

	t.true(idbMock.open.calledOnce, 'idb.open() is be called once')
	t.equal(idbMock.open.getCall(0).args[0], 'ponies', 'db name is \'ponies\'')
	t.equal(idbMock.open.getCall(0).args[1], 1, 'db version is 1')
	t.equal(idbMock.open.getCall(0).args[2], fakeUpgrade, 'upgrade function is fakeUpgrade()')

	idbMock.$restore()
	t.end()
})

test('IdbDriver.getAll() should send db updates to listeners', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })
	))
	driver.store('ponies').getAll().drop(1)
		.addListener({
			next: value => {
				t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }])
				t.end()
			}
		})
})

test('IdbDriver.getAll() should send multiple db updates to listeners', t => {
	t.plan(4)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(
		fromDiagram('-a-b-c--|', {
			values: {
				a: $put('ponies',  { name: 'Twilight Sparkle', type: 'unicorn' }),
				b: $put('ponies', { name: 'Rainbow Dash', type: 'pegasus' }),
				c: $put('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }),
			},
			timeUnit: 20,
		})
	)
	driver.store('ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, []),
		value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }]),
		value => t.deepEqual(value, [
			{ name: 'Rainbow Dash', type: 'pegasus' },
			{ name: 'Twilight Sparkle', type: 'unicorn' },
		]),
		value => t.deepEqual(value, [
			{ name: 'Rainbow Dash', type: 'pegasus' },
			{ name: 'Twilight Sparkle', type: 'alicorn' },
		]),
	]))
})

test('IdbDriver.getAll() should send value in db when a listener is registered', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' }
	]))(xs.empty())
	driver.store('ponies').getAll()
		.addListener({
			next: value => {
				t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }])
				t.end()
			}
		})
})

test('IdbDriver.getAll() should send empty list when a listener is registered to an empty store', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.empty())
	driver.store('ponies').getAll()
		.addListener({
			next: value => {
				t.deepEqual(value, [])
				t.end()
			}
		})
})

test('IdbDriver.$delete should delete entries', t => {
	t.plan(5)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(
		fromDiagram('-a-b-c-d--|', {
			values: {
				a: $put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }),
				b: $put('ponies', { name: 'Rainbow Dash', type: 'pegasus' }),
				c: $delete('ponies', 'Twilight Sparkle'),
				d: $delete('ponies', 'Rainbow Dash'),
			},
			timeUnit: 20,
		})
	)
	driver.store('ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [], 'db is empty'),
		value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }], 'Twilight Sparkle is added'),
		value => t.deepEqual(value, [
			{ name: 'Rainbow Dash', type: 'pegasus' },
			{ name: 'Twilight Sparkle', type: 'unicorn' },
		], 'Rainbow Dash is added'),
		value => t.deepEqual(value, [{ name: 'Rainbow Dash', type: 'pegasus' }], 'Twilight Sparkle is removed'),
		value => t.deepEqual(value, [], 'Rainbow Dash is removed'),
	]))
})

test('IdbDriver.$update should insert entry when key doesn\'t exist', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })
	))
	driver.store('ponies').getAll().drop(1)
		.addListener({
			next: value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }])
		})
})

test('IdbDriver.$update should update entry when key exists', t => {
	t.plan(3)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' }
	]))(fromDiagram('-a-b--|', {
		values: {
			a: $update('ponies', { name: 'Twilight Sparkle', colour: 'purple' }),
			b: $update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').getAll()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }], 'Gets value from database'),
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn', colour: 'purple' }], 'Adds new key'),
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'alicorn', colour: 'purple' }], 'Modifies existing key'),
		]))
})

test('IdbDriver.get() selector should work', t => {
	t.plan(3)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(fromDiagram('-a-b-c--|', {
		values: {
			a: $put('ponies', { name: 'Rainbow Dash', type: 'pegasus' }),
			b: $put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }),
			c: $update('ponies', { name: 'Rainbow Dash', type: 'pegasus', colour: 'blue' }),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').get('Rainbow Dash')
		.addListener(sequenceListener(t)([
			value => t.equal(value, undefined, 'First value should be undefined'),
			value => t.deepEqual(value, { name: 'Rainbow Dash', type: 'pegasus' }, 'Second value should be Rainbow Dash'),
			value => t.deepEqual(value, { name: 'Rainbow Dash', type: 'pegasus', colour: 'blue' }, 'Third value should be updated Rainbow Dash'),
		]))
})

test('IdbDriver.get() selector should send undefined value when no key found', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	driver.store('ponies').get('Pinkie Pie')
		.addListener({
			next: value => t.equal(value, undefined)
		})
})

test('IdbDriver.get() selector shound send db value when listener registers', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId, 1, mockDatabase([
		{ name: 'Pinkie Pie', type: 'Earth Pony' },
		{ name: 'Rainbow Dash', type: 'Pegasus' },
	]))(xs.never())
	driver.store('ponies').get('Pinkie Pie')
		.addListener({
			next: value => t.deepEqual(value, { name: 'Pinkie Pie', type: 'Earth Pony' })
		})
})

const sequenceListener = test => (listeners, bounded=true) => {
	let current = 0
	return {
		next: value => {
			if (current >= listeners.length) {
				if (bounded) test.fail(`Sequence was longer than ${listeners.length}`)
				else current = 0
			}
			listeners[current](value)
			current++
		}
	}
}

const getTestId = (() => {
	let nextId = 0
	return () => `ponies-${nextId++}`
})()
