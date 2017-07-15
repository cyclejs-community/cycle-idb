import test from 'tape'
import sinon from 'sinon'

import xs from 'xstream'
import fromDiagram from 'xstream/extra/fromDiagram'

import { 
	mockIdb,
	mockDatabase,
	mockDbWithIndex,
	mockDbWithTypeIndex,
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

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Pinkie Pie', type: 'Earth Pony' },
		{ name: 'Rainbow Dash', type: 'Pegasus' },
	]))(xs.never())
	driver.store('ponies').get('Pinkie Pie')
		.addListener({
			next: value => t.deepEqual(value, { name: 'Pinkie Pie', type: 'Earth Pony' })
		})
})

test('IdbDriver.get() selector should send undefined when value is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Rarity', type: 'unicorn' }
	]))(fromDiagram('-a--|', {
		values: {
			a: $delete('ponies', 'Rarity'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').get('Rarity')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { name: 'Rarity', type: 'unicorn' }, 'Rarity is in database'),
			value => t.equal(value, undefined, 'When Rarity is removed, undefined is sent'),
		]))
})

test('IdbDriver.count() should start with 0 when store is empty', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	driver.store('ponies').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 0),
		]))
})

test('IdbDriver.count() should start with 1 when store has one element', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.never())
	driver.store('ponies').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 1),
		]))
})

test('IdbDriver.count() should send new count when an element is added', t=> {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(
		fromDiagram('-a--|', {
			values: {
				a: $put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }),
			},
			timeUnit: 20,
		}))
	driver.store('ponies').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 0),
			value => t.equal(value, 1),
		]))
})

test('IdbDriver.count() should send new count when an element is removed', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Fluttershy', type: 'pegasus' },
	]))(fromDiagram('-a--|', {
		values: {
			a: $delete('ponies', 'Fluttershy'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 1),
			value => t.equal(value, 0),
		]))
})

test('IdbDriver.$put should send an error when key is missing', t => {
	t.plan(1)

	//process.on('unhandledRejection', e => t.fail(`Unhandled rejection: ${e}`))

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(
		fromDiagram('-a--|', {
			values: {
				a: $put('ponies', { type: 'earth pony' }),
			},
			timeUnit: 20,
		})
	)
	driver.store('ponies').getAll()
		.addListener({
			error: e => t.deepEqual(e.query, { operation: '$put', store: 'ponies', data: { type: 'earth pony' }})
		})
})

test('Errors should not get propagated to multiple stores', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([], [
		{ name: 'more-ponies', options: { keyPath: 'name' }}
	]))(xs.of($put('more-ponies', { type: 'pegasus' })))

	driver.store('ponies').getAll()
		.addListener({
			error: e => t.fail(`Unexpected error '${e.error}'`)
		})
	driver.store('more-ponies').getAll()
		.addListener({
			error: e => t.deepEqual(e.query, { operation: '$put', store: 'more-ponies', data: { type: 'pegasus' }})
		})
})

test('Updates should not get propagated to multiple stores', t => {
	t.plan(3)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([], [
		{ name: 'more-ponies', options: { keyPath: 'name' }}
	]))(xs.of($put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })))

	driver.store('ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, []),
		value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }]),
	]))
	driver.store('more-ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, []),
		value => t.fail(`Unexpected value '${value}'`)
	]))
})

test('Opening a store that doesn\'t exist should generate an error', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())

	process.on('unhandledRejection', e => t.fail(`Unhandled rejection: ${e}`))

	driver.store('not-found').getAll()
		.addListener({
			next: value => t.fail(value),
			error: e => t.deepEqual(e, {
				name: 'NotFoundError',
				message: 'No objectStore named not-found in this database'
			})
		})
})

test('Update errors should be propagated to error$', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$put('ponies', { type: 'pegasus' }),
	))

	driver.error$.addListener({
		error: e => t.deepEqual(e.query, $put('ponies', { type: 'pegasus' }))
	})
})

test('error$ should not propagate regular events', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$put('ponies', { name: 'Fluttershy', type: 'pegasus' }),
	))

	driver.error$.addListener({
		next: value => t.fail(`Received unexpected value '${value}'`)
	})
	driver.store('ponies').getAll().drop(1).addListener(sequenceListener(t)([
		value => t.deepEqual(value, [{ name: 'Fluttershy', type: 'pegasus' }]),
	]))
})

test('IdbDriver.count() should only broadcast when count changes', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Fluttershy', type: 'pegasus' },
	]))(fromDiagram('-a-b--|', {
		values: {
			a: $put('ponies', { name: 'Fluttershy', type: 'pegasus', element: 'kindness' }),
			b: $put('ponies', { name: 'Applejack', type: 'earth pony' }),
		},
		timeUnit: 20,
	}))

	driver.store('ponies').count().addListener(sequenceListener(t)([
		value => t.equal(value, 1),
		value => t.equal(value, 2),
		value => t.fail('Too many events'),
	]))
})

test('index(...).getAll() should get all the elements sorted by index', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
	]))(xs.never())
	driver.store('ponies').index('name').getAll().addListener({
		next: value => t.deepEqual(value, [
			{ id: 3, name: 'Applejack', type: 'earth pony' },
			{ id: 2, name: 'Rarity', type: 'unicorn' },
			{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' },
		])
	})
})

test('index(...).getAll(key) should get all the elements with the given key', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
	]))(xs.never())
	driver.store('ponies').index('type').getAll('unicorn').addListener({
		next: value => t.deepEqual(value, [
			{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' },
			{ id: 2, name: 'Rarity', type: 'unicorn' },
		])
	})
})

test('IdbDriver.$put should fail when inserting duplicated value for unique index', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Applejack' },
	]))(xs.of(
		$put('ponies', { name: 'Applejack' })
	))

	driver.store('ponies').getAll().drop(1).addListener({
		next: value => t.fail(`Unexpected data: ${JSON.stringify(value)}`),
		error: e => t.deepEqual(e.query, { store: 'ponies', operation: '$put', data: { name: 'Applejack' }}),
	})
})

test('index(...).getAll() should get updates when element is inserted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex())(xs.of(
		$put('ponies', { name: 'Applejack', type: 'earth pony' })
	))

	driver.store('ponies').index('name').getAll()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, []),
			value => t.deepEqual(value, [{ id: 1, name: 'Applejack', type: 'earth pony' }]),
		]))
})

test('index(...).getAll() should get updates when element is modified', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Applejack', type: 'earth pony' }
	]))(xs.of(
		$put('ponies', { id: 1, name: 'Applejack', type: 'earth pony', element: 'honesty' })
	))

	driver.store('ponies').index('name').getAll()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ id: 1, name: 'Applejack', type: 'earth pony' }]),
			value => t.deepEqual(value, [{ id: 1, name: 'Applejack', type: 'earth pony', element: 'honesty' }]),
		], e => t.fail(JSON.stringify(e))))
})

test('index(...).getAll(key) should get updates when element with key is inserted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex())(xs.of(
		$put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })
	))

	driver.store('ponies').index('type').getAll('unicorn').addListener(sequenceListener(t)([
		value => t.deepEqual(value, []),
		value => t.deepEqual(value, [{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' }])
	]))
})

test('index(...).getAll(key) should get updates when element with key is modified', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.of(
		$put('ponies', { id: 1, name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' })
	))
	driver.store('ponies').index('type').getAll('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' }]),
			value => t.deepEqual(value, [{ id: 1, name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' }])
		], e => t.fail(JSON.stringify(e))))
})

test('index(...).getAll(key) should get updates when element with key is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn'},
		{ name: 'Rarity', type: 'unicorn'},
	]))(xs.of(
		$delete('ponies', 2)
	))
	driver.store('ponies').index('type').getAll('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' },
				{ id: 2, name: 'Rarity', type: 'unicorn' },
			]),
			value => t.deepEqual(value, [
				{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' },
			])
		]))
})

test('index(...).getAll(key) should get updates when element with key is updated with a different key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn'},
		{ name: 'Rarity', type: 'unicorn'},
	]))(xs.of(
		$update('ponies', { id: 1, type: 'alicorn' }),
	))
	driver.store('ponies').index('type').getAll('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' },
				{ id: 2, name: 'Rarity', type: 'unicorn' },
			]),
			value => t.deepEqual(value, [
				{ id: 2, name: 'Rarity', type: 'unicorn' },
			])
		]))
})

test('index(...).getAll(key) should get updated when element with different key is updated with key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Celestia', type: 'alicorn' },
		{ name: 'Luna', type: 'alicorn' },
		{ name: 'Cadence', type: 'alicorn' },
		{ name: 'Shining Armor', type: 'unicorn' },
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').index('type').getAll('alicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Cadence', type: 'alicorn' },
				{ name: 'Celestia', type: 'alicorn' },
				{ name: 'Luna', type: 'alicorn' },
			]),
			value => t.deepEqual(value, [
				{ name: 'Cadence', type: 'alicorn' },
				{ name: 'Celestia', type: 'alicorn' },
				{ name: 'Luna', type: 'alicorn' },
				{ name: 'Twilight Sparkle', type: 'alicorn' },
			])
		]))
})

test('index(...).getAll(key) should not get updates when element with different key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Fluttershy', type: 'pegasus' },
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { id: 1, name: 'Fluttershy', element: 'kindness' })
	))
	driver.store('ponies').index('type').getAll('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ id: 2, name: 'Twilight Sparkle', type: 'unicorn'}]),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`)
		]))
})

test('index(...).getAll(key) should not get updates when element with different key is inserted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex())(xs.of(
		$put('ponies', { name: 'Pinkie Pie', type: 'earth pony' }),
	))
	driver.store('ponies').index('type').getAll('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, []),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`)
		]))
})

test('index(...).getAll(key) should not get updates when an element with different key is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Rainbow Dash', type: 'pegasus'},
		{ name: 'Pinkie Pie', type: 'earth pony'},
	]))(xs.of(
		$delete('ponies', 2),
	))
	driver.store('ponies').index('type').getAll('pegasus')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ id: 1, name: 'Rainbow Dash', type: 'pegasus' }]),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`)
		]))
})

test.skip('The read event fired after a DB update event should contain only the data updated by that event', t => {
	t.plan(4)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }),
		$update('ponies', { name: 'Twilight Sparkle', element: 'magic' }),
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }),
	))
	driver.store('ponies').get('Twilight Sparkle').addListener(sequenceListener(t)([
		value => t.deepEqual(value, undefined),
		value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
		value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' }),
		value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'alicorn', element: 'magic' }),
	]))
})

const sequenceListener = test => (listeners, errorHandler, bounded=true) => {
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

const getTestId = (() => {
	let nextId = 0
	return () => `ponies-${nextId++}`
})()
