import test from 'tape'
import sinon from 'sinon'

import xs from 'xstream'
import fromDiagram from 'xstream/extra/fromDiagram'

import { 
	mockIdb,
	mockDatabase,
	mockDbWithIndex,
	mockDbWithTypeIndex,
	mockDbWithNameIndex,
	mockDbWithNumberIndex,
} from './idb-driver.mock'
import idb from 'idb'

import {
	getTestId,
	sequenceListener,
	range,
} from './test'

import makeIdbDriver, {
	$add,
	$delete,
	$put,
	$update,
	$clear,
} from '../idb-driver'


test('store(...).getAll() should send db updates to listeners', t => {
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

test('store(...).getAll() should send multiple db updates to listeners', t => {
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

test('store(...).getAll() should send value in db when a listener is registered', t => {
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

test('store(...).getAll() should send empty list when a listener is registered to an empty store', t => {
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

test('store(...).getAll() should be updated when an object is added to the store', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$add('ponies', { name: 'Fluttershy' })
	))
	driver.store('ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [], 'The store is empty'),
		value => t.deepEqual(value, [{ name: 'Fluttershy' }], 'Fluttershy is added'),
	]))
})

test('store(...).get() selector should work', t => {
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

test('store(...).get() selector should send undefined value when no key found', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	driver.store('ponies').get('Pinkie Pie')
		.addListener({
			next: value => t.equal(value, undefined)
		})
})

test('store(...).get() selector shound send db value when listener registers', t => {
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

test('store(...).get() selector should send undefined when value is deleted', t => {
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

test('store(...).get(key) should be updated when an object with the given key is added', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$add('ponies', { name: 'Fluttershy' })
	))
	driver.store('ponies').get('Fluttershy').addListener(sequenceListener(t)([
		value => t.deepEqual(value, undefined, 'Fluttershy is not in the store'),
		value => t.deepEqual(value, { name: 'Fluttershy' }, 'Fluttershy is added'),
	]))
})

test('store(...).get(key) should not be updated when an object with a different key is added', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$add('ponies', { name: 'Fluttershy' })
	))
	driver.store('ponies').get('Rainbow Dash').addListener(sequenceListener(t)([
		value => t.deepEqual(value, undefined, 'The store is empty'),
		value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
	]))
})

test('store(...).count() should start with 0 when store is empty', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	driver.store('ponies').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 0),
		]))
})

test('store(...).count() should start with 1 when store has one element', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.never())
	driver.store('ponies').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 1),
		]))
})

test('store(...).count() should send new count when an element is added', t=> {
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

test('store(...).count() should send new count when an element is removed', t => {
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

test('store(...).count() should only broadcast when count changes', t => {
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

test('store(...).count() should be updated when an object is added to the store', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$add('ponies', { name: 'Fluttershy' })
	))
	driver.store('ponies').count().addListener(sequenceListener(t)([
		value => t.deepEqual(value, 0, 'The store is empty'),
		value => t.deepEqual(value, 1, 'Fluttershy is added'),
	]))
})

test('store(...).getAllKeys() should return all keys present in the store', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Fluttershy', type: 'pegasus' },
		{ name: 'Pinkie Pie', type: 'earth pony' },
		{ name: 'Rarity', type: 'unicorn' },
	]))(xs.never())
	driver.store('ponies').getAllKeys()
		.addListener({
			next: value => t.deepEqual(value, [ 'Fluttershy', 'Pinkie Pie', 'Rarity' ])
		})
})

test('store(...).getAllKeys() should get updates when a new object is added to the store', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Fluttershy', type: 'pegasus' },
		{ name: 'Pinkie Pie', type: 'earth pony' },
	]))(xs.of(
		$put('ponies', { name: 'Rarity', type: 'unicorn' })
	))
	driver.store('ponies').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Fluttershy', 'Pinkie Pie' ], 'Fluttershy and Pinkie are in the list'),
			value => t.deepEqual(value, [ 'Fluttershy', 'Pinkie Pie', 'Rarity' ], 'Rarity is added')
		]))
})

test('store(...).getAllKeys() should get updates when an object is removed from the store', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Fluttershy', type: 'pegasus' },
		{ name: 'Pinkie Pie', type: 'earth pony' },
	]))(xs.of(
		$delete('ponies', 'Pinkie Pie')
	))
	driver.store('ponies').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Fluttershy', 'Pinkie Pie' ], 'Fluttershy and Pinkie are in the list'),
			value => t.deepEqual(value, [ 'Fluttershy' ], 'Pinkie is removed')
		]))
})

test('store(...).getAllKeys() should not get updates when an existing object is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Pinkie Pie', type: 'earth pony' },
		{ name: 'Rainbow Dash', type: 'pegasus' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Pinkie Pie', 'Rainbow Dash', 'Twilight Sparkle' ], 'Twilight, Rainbow and Pinkie are in the list'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).getAllKeys() should get an update when an object is added to the store', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$add('ponies', { name: 'Fluttershy' })
	))
	driver.store('ponies').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [], 'Database is empty'),
			value => t.deepEqual(value, [ 'Fluttershy' ], 'Fluttershy is added'),
		]))
})

test.skip('successive calls to store(...).get(key) with the same key should return the same stream', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	const get$_1 = driver.store('ponies').get('Twilight Sparkle')
	const get$_2 = driver.store('ponies').get('Twilight Sparkle')
	t.equal(get$_1, get$_2)
})

test('when a selector is invoked multiple times it should send the latest data each time', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.never())

	xs.periodic(5).take(2)
		.map(() => driver.store('ponies').get('Twilight Sparkle'))
		.flatten()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
			value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
		]))
})

test('when a selector is invoked multiple times it should send the latest data each time', t => {
	t.plan(3)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.never())

	xs.merge(
		driver.store('ponies').get('Twilight Sparkle'),
		driver.store('ponies').get('Twilight Sparkle'),
		driver.store('ponies').get('Twilight Sparkle'),
	).addListener(sequenceListener(t)([
		value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
		value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
		value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
	]))
})

test('when store(...).getAll() is invoked multiple times it should send the latest data each time', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.never())

	xs.periodic(5).take(2)
		.map(() => driver.store('ponies').getAll())
		.flatten()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }]),
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }]),
		]))
})

const methods = [
	'get',
	'getAll',
	'getAllKeys',
	'count',
]
methods.forEach(method => test(`when store(...).${method} is invoked multiple times, it should send data each time`, t => {
	t.plan(5)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.never())

	xs.periodic(5).take(5)
		.map(() => driver.store('ponies')[method]('Twilight Sparkle'))
		.flatten()
		.addListener(sequenceListener(t)(range(1, 6).map(x => 
			value => t.pass(`Value received ${x} times`)
		)))

}))
