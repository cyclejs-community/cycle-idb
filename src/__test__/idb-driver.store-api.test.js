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

test('store(...).get(key) should work when key is IDBKeyRange.only', t => {
	t.plan(2)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
		{ name: 'Rainbow Dash' },
	]))(xs.of(
		$delete('ponies', 'Fluttershy')
	))
	driver.store('ponies').get(IDBKeyRange.only('Fluttershy'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { name: 'Fluttershy' }, 'Fluttershy is sent'),
			value => t.deepEqual(value, undefined, 'Fluttershy is removed'),
		]))
})

test('store(...).get(key) should send the first matching value when key is IDBKeyRange.lowerBound', t => {
	t.plan(3)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
		{ name: 'Rainbow Dash' },
	]))(fromDiagram('-a-b-|', {
		values: {
			a: $add('ponies', { name: 'Pinkie Pie' }),
			b: $delete('ponies', 'Pinkie Pie'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').get(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { name: 'Rainbow Dash' }, 'Rainbow is first matching pony'),
			value => t.deepEqual(value, { name: 'Pinkie Pie' }, 'Pinkie Pie is added'),
			value => t.deepEqual(value, { name: 'Rainbow Dash' }, 'Pinkie Pie is removed'),
		]))
})

test('store(...).get(key) should send the first matching value when key is IDBKeyRange.upperBound', t => {
	t.plan(4)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
		{ name: 'Rainbow Dash' },
	]))(fromDiagram('-a-b-c-|', {
		values: {
			a: $add('ponies', { name: 'Applejack' }),
			b: $delete('ponies', 'Applejack'),
			c: $delete('ponies', 'Fluttershy'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').get(IDBKeyRange.upperBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { name: 'Fluttershy' }, 'Fluttershy is first matching pony'),
			value => t.deepEqual(value, { name: 'Applejack' }, 'Applejack is added'),
			value => t.deepEqual(value, { name: 'Fluttershy' }, 'Applejack is removed'),
			value => t.deepEqual(value, undefined, 'No matching pony is left'),
		]))
})

test('Successive calls to store(...).get(key) with equivalent IDBKeyRange objects should return the same stream', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())

	const $1 = driver.store('ponies').get(IDBKeyRange.lowerBound('Applejack'))
	const $2 = driver.store('ponies').get(IDBKeyRange.lowerBound('Applejack'))

	t.equal($1, $2)
})

test('Successive calls to store(...).get(key) with different IDBKeyRange objects should return different streams', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())

	const $1 = driver.store('ponies').get(IDBKeyRange.lowerBound('Applejack'))
	const $2 = driver.store('ponies').get(IDBKeyRange.only('Applejack'))

	t.notEqual($1, $2)
})

test('store(...).getAll(key) when key is IDBKeyRange object should work', t => {
	t.plan(6)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
		{ name: 'Rainbow Dash' },
	]))(fromDiagram('-a-b-c-d-e-|', {
		values: {
			a: $add('ponies', { name: 'Rarity' }),
			b: $delete('ponies', 'Rainbow Dash'),
			c: $update('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }),
			d: $delete('ponies', 'Rarity'),
			e: $clear('ponies'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').getAll(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Rainbow Dash' },
				{ name: 'Twilight Sparkle' },
			], 'Gets matching objects in the store'),
			value => t.deepEqual(value, [
				{ name: 'Rainbow Dash' },
				{ name: 'Rarity' },
				{ name: 'Twilight Sparkle' },
			], 'Gets objects with matching key added'),
			value => t.deepEqual(value, [
				{ name: 'Rarity' },
				{ name: 'Twilight Sparkle' },
			], 'Gets objects with matching key deleted'),
			value => t.deepEqual(value, [
				{ name: 'Rarity' },
				{ name: 'Twilight Sparkle', type: 'unicorn' },
			], 'Gets objects with matching key updated'),
			value => t.deepEqual(value, [
				{ name: 'Twilight Sparkle', type: 'unicorn' },
			], 'Rarity is removed'),
			value => t.deepEqual(value, [], 'Store is cleared'),
		]))
})

test('store(...).getAll(key) when key is IDBKeyRange object should not update when element not included in key is modified', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$update('ponies', { name: 'Fluttershy', type: 'pegasus' })
	))
	driver.store('ponies').getAll(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Twilight Sparkle' },
			], 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).getAll(key) when key is IDBKeyRange object should not update when element not included in key is added', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$add('ponies', { name: 'Applejack' })
	))
	driver.store('ponies').getAll(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Twilight Sparkle' },
			], 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).getAll(key) when key is IDBKeyRange object should not update when element not included in key is removed', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$delete('ponies', 'Fluttershy')
	))
	driver.store('ponies').getAll(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Twilight Sparkle' },
			], 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).count(key) when key is IDBKeyRange object should work', t => {
	t.plan(4)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
		{ name: 'Rainbow Dash' },
	]))(fromDiagram('-a-b-c-d-|', {
		values: {
			a: $add('ponies', { name: 'Rarity' }),
			b: $delete('ponies', 'Rainbow Dash'),
			c: $update('ponies', { name: 'Rarity', type: 'unicorn' }),
			d: $clear('ponies'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').count(IDBKeyRange.bound('G', 'T'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, 1, 'Gets matching objects in the store'),
			value => t.deepEqual(value, 2, 'Gets objects with matching key added'),
			value => t.deepEqual(value, 1, 'Gets objects with matching key deleted'),
			value => t.deepEqual(value, 0, 'Store is cleared'),
		]))
})

test('store(...).count(key) when key is IDBKeyRange object should not update when element included in key is modified', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$update('ponies', { name: 'Fluttershy', type: 'pegasus' })
	))
	driver.store('ponies').count(IDBKeyRange.lowerBound('B'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, 2, 'Fluttershy and Twilight matche the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).count(key) when key is IDBKeyRange object should not update when element not included in key is modified', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$update('ponies', { name: 'Fluttershy', type: 'pegasus' })
	))
	driver.store('ponies').count(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, 1, 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).count(key) when key is IDBKeyRange object should not update when element not included in key is added', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$add('ponies', { name: 'Applejack' })
	))
	driver.store('ponies').count(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, 1, 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).count(key) when key is IDBKeyRange object should not update when element not included in key is removed', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$delete('ponies', 'Fluttershy')
	))
	driver.store('ponies').count(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, 1, 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).getAllKeys(key) when key is IDBKeyRange object should work', t => {
	t.plan(4)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
		{ name: 'Rainbow Dash' },
	]))(fromDiagram('-a-b-c-|', {
		values: {
			a: $add('ponies', { name: 'Rarity' }),
			b: $delete('ponies', 'Rainbow Dash'),
			c: $clear('ponies'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').getAllKeys(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				'Rainbow Dash',
				'Twilight Sparkle',
			], 'Gets matching keys in the store'),
			value => t.deepEqual(value, [
				'Rainbow Dash',
				'Rarity',
				'Twilight Sparkle',
			], 'Gets keys with matching key added'),
			value => t.deepEqual(value, [
				'Rarity',
				'Twilight Sparkle',
			], 'Gets keys with matching key deleted'),
			value => t.deepEqual(value, [], 'Store is cleared'),
		]))
})

test('store(...).getAllKeys(key) when key is IDBKeyRange object should not update when element included in key is modified', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })
	))
	driver.store('ponies').getAllKeys(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				'Twilight Sparkle',
			], 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).getAllKeys(key) when key is IDBKeyRange object should not update when element not included in key is modified', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$update('ponies', { name: 'Fluttershy', type: 'pegasus' })
	))
	driver.store('ponies').getAllKeys(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				'Twilight Sparkle',
			], 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).getAllKeys(key) when key is IDBKeyRange object should not update when element not included in key is added', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$add('ponies', { name: 'Applejack' })
	))
	driver.store('ponies').getAllKeys(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				'Twilight Sparkle' ,
			], 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('store(...).getAllKeys(key) when key is IDBKeyRange object should not update when element not included in key is removed', t => {
	t.plan(1)
	
	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Fluttershy' },
	]))(xs.of(
		$delete('ponies', 'Fluttershy')
	))
	driver.store('ponies').getAllKeys(IDBKeyRange.lowerBound('G'))
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				'Twilight Sparkle',
			], 'Twilight matches the key'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})
