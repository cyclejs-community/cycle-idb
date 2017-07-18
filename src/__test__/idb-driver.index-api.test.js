import test from 'tape'

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

test('index(...).get(key) should get updates when element with key is inserted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex())(xs.of(
		$put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })
	))

	driver.store('ponies').index('type').get('unicorn').addListener(sequenceListener(t)([
		value => t.deepEqual(value, undefined),
		value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' })
	]))
})

test('index(...).get(key) should get updates when element with key is modified', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.of(
		$put('ponies', { name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' })
	))
	driver.store('ponies').index('type').get('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
			value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' })
		], e => t.fail(JSON.stringify(e))))
})

test('index(...).get(key) should get updates when element with key is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithNameIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn'},
		{ name: 'Rarity', type: 'unicorn'},
	]))(xs.of(
		$delete('ponies', 1)
	))
	driver.store('ponies').index('name').get('Twilight Sparkle')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'unicorn' }),
			value => t.deepEqual(value, undefined)
		]))
})

test('index(...).get(key) should get updates when element with key is updated with a different key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn'},
	]))(xs.of(
		$update('ponies', { id: 1, type: 'alicorn' }),
	))
	driver.store('ponies').index('type').get('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { id: 1, name: 'Twilight Sparkle', type: 'unicorn' }),
			value => t.deepEqual(value, undefined)
		]))
})

test('index(...).get(key) should get updated when element with different key is updated with key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').index('type').get('alicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, undefined),
			value => t.deepEqual(value, { name: 'Twilight Sparkle', type: 'alicorn' })
		]))
})

test('index(...).get(key) should not get updates when element with different key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Fluttershy', type: 'pegasus' },
		{ name: 'Twilight Sparkle', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { id: 1, name: 'Fluttershy', element: 'kindness' })
	))
	driver.store('ponies').index('type').get('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { id: 2, name: 'Twilight Sparkle', type: 'unicorn'}),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`)
		]))
})

test('index(...).get(key) should not get updates when element with different key is inserted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex())(xs.of(
		$put('ponies', { name: 'Pinkie Pie', type: 'earth pony' }),
	))
	driver.store('ponies').index('type').get('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, undefined),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`)
		]))
})

test('index(...).get(key) should not get updates when an element with different key is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Rainbow Dash', type: 'pegasus'},
		{ name: 'Pinkie Pie', type: 'earth pony'},
	]))(xs.of(
		$delete('ponies', 2),
	))
	driver.store('ponies').index('type').get('pegasus')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, { id: 1, name: 'Rainbow Dash', type: 'pegasus' }),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`)
		]))
})

test('index(...).count() should count all the items with the specified index', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.never())
	driver.store('ponies').index('type').count()
		.addListener({
			next: value => t.equal(value, 2, 'Twilight and Applejack are counted, Spike is not')
		})
})

test('index(...).count() should update when item with the specified index is added', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$put('ponies', { name: 'Rarity', type: 'unicorn' }),
	))
	driver.store('ponies').index('type').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Twilight and Applejack are counted'),
			value => t.equal(value, 3, 'Twilight, Applejack and Rarity are counted'),
		]))
})

test('index(...).count() should update when item with the specified index is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$delete('ponies', 'Twilight Sparkle')
	))
	driver.store('ponies').index('type').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Twilight and Applejack are counted'),
			value => t.equal(value, 1, 'Only Applejack is counted'),
		]))
})

test('index(...).count() should not update when item with the specified index is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').index('type').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Only Twilight and Applejack are counted'),
			value => t.fail(`Unexpected count: ${value}`),
		]))
})

test('index(...).count() should not update when item without the specified index is added', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$put('ponies', { name: 'Gilda' })
	))
	driver.store('ponies').index('type').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Only Twilight and Applejack are counted'),
			value => t.fail(`Unexpected count: ${value}`)
		], e => t.fail(e)))
})

test('index(...).count() should not update when item without the specified index is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$delete('ponies', 'Spike')
	))
	driver.store('ponies').index('type').count()
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Only Twilight and Applejack are counted'),
			value => t.fail(`Unexpected count: ${value}`),
		]))
})

test('index(...).count(key) should count all the items with the specified key', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.never())
	driver.store('ponies').index('type').count('unicorn')
		.addListener({
			next: value => t.equal(value, 1, 'Twilight is counted, Applejack and Spike are not')
		})
})

test('index(...).count(key) should update when an item with the specified key is added', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
	]))(xs.of(
		$put('ponies', { name: 'Rarity', type: 'unicorn' })
	))
	driver.store('ponies').index('type').count('unicorn')
		.addListener(sequenceListener(t)([
			value => t.equal(value, 1, 'Only Twilight is counted'),
			value => t.equal(value, 2, 'Twilight and Rarity are counted'),
		]))
})

test('index(...).count(key) should update when an item with the specified key is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
	]))(xs.of(
		$delete('ponies', 'Rarity')
	))
	driver.store('ponies').index('type').count('unicorn')
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Twilight and Rarity are unicorns'),
			value => t.equal(value, 1, 'Rarity is gone :('),
		]))
})

test('index(...).count(key) should not update when an item with the specified key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', element: 'magic' })
	))
	driver.store('ponies').index('type').count('unicorn')
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Twilight and Rarity are counted'),
			value => t.fail(`Unexpected count: ${value}`)
		]))
})

test('index(...).count(key) should update when an item with a different key is updated with the specified key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity' },
	]))(xs.of(
		$update('ponies', { name: 'Rarity', type: 'unicorn' })
	))
	driver.store('ponies').index('type').count('unicorn')
		.addListener(sequenceListener(t)([
			value => t.equal(value, 1, 'Only Twilight is counted'),
			value => t.equal(value, 2, 'Twilight and Rarity are counted'),
		]))
})

test('index(...).count(key) should update when an item with the specified key is updated to a different key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').index('type').count('unicorn')
		.addListener(sequenceListener(t)([
			value => t.equal(value, 2, 'Twilight and Rarity are counted'),
			value => t.equal(value, 1, 'Only Rarity is counted because Twilight is an alicorn'),
		]))
})

test('index(...).getAllKeys() should return all keys in the index', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.never())
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys() should update when an object with the key is added', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$put('ponies', { name: 'Pinkie Pie', type: 'earth pony' })
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.deepEqual(value, [ 'Applejack', 'Pinkie Pie', 'Twilight Sparkle' ], 'Pinkie is added'),
		]))
})

test('index(...).getAllKeys() should update when an object with the key is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$delete('ponies', 'Applejack')
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.deepEqual(value, [ 'Twilight Sparkle' ], 'Applejack is removed :('),
		]))
})

test('index(...).getAllKeys() should not update when an object with the key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$put('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys() should not update when an object without the key is added', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$put('ponies', { name: 'Gilda' })
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys() should not update when an object without the key is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$delete('ponies', 'Spike')
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys() should not update when an object without the key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$put('ponies', { name: 'Spike', colour: 'purple' })
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys() should update when an object without the key is updated with the key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Rainbow Dash' },
	]))(xs.of(
		$put('ponies', { name: 'Rainbow Dash', type: 'pegasus' })
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted'),
			value => t.deepEqual(value, [ 'Applejack', 'Rainbow Dash', 'Twilight Sparkle' ], 'Rainbow Dash is added'),
		]))
})

test('index(...).getAllKeys() should update when an object with the key is updated without the key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Spike' },
	]))(xs.of(
		$put('ponies', { name: 'Applejack' })
	))
	driver.store('ponies').index('type').getAllKeys()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Applejack', 'Twilight Sparkle' ], 'Applejack and Twilight are counted, but not Spike'),
			value => t.deepEqual(value, [ 'Twilight Sparkle' ], 'Applejack is not counted anymore'),
		]))
})

test('index(...).getAllKeys(key) should return all the keys for the index with the given value', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
		{ name: 'Rainbow Dash', type: 'pegasus' },
	]))(xs.never())
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Rarity', 'Twilight Sparkle' ], 'Twilight and Rarity are counted, but not Rainbow'),
		]))
})

test('index(...).getAllKeys(key) should update when an element with the given key is inserted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
	]))(xs.of(
		$put('ponies', { name: 'Minuette', type: 'unicorn' })
	))
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Twilight Sparkle' ], 'Twilight is the only unicorn'),
			value => t.deepEqual(value, [ 'Minuette', 'Twilight Sparkle' ], 'Minuette is added'),
		]))
})

test('index(...).getAllKeys(key) should update when an element with the given key is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Minuette', type: 'unicorn' },
	]))(xs.of(
		$delete('ponies', 'Twilight Sparkle')
	))
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Minuette', 'Twilight Sparkle' ], 'Minuette and Twilight Sparkle are counted'),
			value => t.deepEqual(value, [ 'Minuette' ], 'Twilight is removed :('),
		]))
})

test('index(...).getAllKeys(key) should not update when an element with the given key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Minuette', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', element: 'magic' })
	))
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Minuette', 'Twilight Sparkle' ], 'Minuette and Twilight Sparkle are counted'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys(key) should update when an element with the given key is modified with a different key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Minuette', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Minuette', 'Twilight Sparkle' ], 'Minuette and Twilight Sparkle are counted'),
			value => t.deepEqual(value, [ 'Minuette' ], 'Twilight no longer a unicorn'),
		]))
})

test('index(...).getAllKeys(key) should update when an element with a different key is modified with the given key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Luna', type: 'alicorn' },
		{ name: 'Celestia', type: 'alicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').index('type').getAllKeys('alicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Celestia', 'Luna' ], 'Celestia and Luna are alicorns'),
			value => t.deepEqual(value, [ 'Celestia', 'Luna', 'Twilight Sparkle' ], 'Twilight becomes an alicorn'),
		]))
})

test('index(...).getAllKeys(key) should not update when an element with a different key is inserted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Minuette', type: 'unicorn' },
	]))(xs.of(
		$put('ponies', { name: 'Spitfire', type: 'pegasus' })
	))
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Minuette', 'Twilight Sparkle' ], 'Minuette and Twilight Sparkle are counted'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys(key) should not update when an element with a different key is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Minuette', type: 'unicorn' },
	]))(xs.of(
		$delete('ponies', 'Applejack')
	))
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Minuette', 'Twilight Sparkle' ], 'Minuette and Twilight Sparkle are counted'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...).getAllKeys(key) should not update when an element with a different key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1 , mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
		{ name: 'Minuette', type: 'unicorn' },
	]))(xs.of(
		$update('ponies', { name: 'Applejack', element: 'honesty' })
	))
	driver.store('ponies').index('type').getAllKeys('unicorn')
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [ 'Minuette', 'Twilight Sparkle' ], 'Minuette and Twilight Sparkle are counted'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('index(...) should work with numerical indexes', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithNumberIndex([
		{ name: 'Twilight Sparkle', isManeSix: 1 },
		{ name: 'Rainbow Dash', isManeSix: 1 },
		{ name: 'Minuette', isManeSix: 0 },
		{ name: 'Bon Bon' },
	]))(xs.never())
	driver.store('ponies').index('isManeSix').getAll()
		.addListener({
			next: value => t.deepEqual(value, [
				{ name: 'Minuette', isManeSix: 0 },
				{ name: 'Twilight Sparkle', isManeSix: 1 },
				{ name: 'Rainbow Dash', isManeSix: 1 },
			], '.getAll() returns all ponies with the index')
		})
	driver.store('ponies').index('isManeSix').getAll(1)
		.addListener({
			next: value => t.deepEqual(value, [
				{ name: 'Twilight Sparkle', isManeSix: 1 },
				{ name: 'Rainbow Dash', isManeSix: 1 },
			], '.getAll(true) returns all ponies with the index being true')
		})
})

test('$clear should notify all index selectors', t => {
	t.plan(14)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Pinkie Pie', type: 'earth pony' },
		{ name: 'Rainbow Dash', type: 'pegasus' },
		{ name: 'Spike' },
	]))(fromDiagram('-a-|', {
		values: {
			a: $clear('ponies'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').index('type').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [
			{ id: 2, name: 'Pinkie Pie', type: 'earth pony' },
			{ id: 3, name: 'Rainbow Dash', type: 'pegasus' },
			{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' },
		], 'Everypony is here!'),
		value => t.deepEqual(value, [], 'Clear is propagated to index(\'type\').getAll()')
	]))
	driver.store('ponies').index('type').getAll('unicorn').addListener(sequenceListener(t)([
		value => t.deepEqual(value, [
			{ id: 1, name: 'Twilight Sparkle', type: 'unicorn' },
		], 'Unicorns are here!'),
		value => t.deepEqual(value, [], 'Clear is propagated to index(\'type\').getAll(\'unicorn\')')
	]))
	driver.store('ponies').index('name').get('Twilight Sparkle').addListener(sequenceListener(t)([
		value => t.deepEqual(value, { id: 1, name: 'Twilight Sparkle', type: 'unicorn' }, 'Twilight is here!'),
		value => t.deepEqual(value, undefined, 'Clear is propagated to index(\'name\').get(\'Twilight Sparkle\')')
	]))
	driver.store('ponies').index('type').getAllKeys().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [
			2, // Pinkie Pie
			3, // Rainbow Dash
			1, // Twilight Sparkle
		], 'Everypony is here!'),
		value => t.deepEqual(value, [], 'Clear is propagated to index(\'type\').getAllKeys()')
	]))
	driver.store('ponies').index('type').getAllKeys('unicorn').addListener(sequenceListener(t)([
		value => t.deepEqual(value, [
			1, // Twilight Sparkle
		], 'Unicorns is here!'),
		value => t.deepEqual(value, [], 'Clear is propagated to index(\'type\').getAllKeys(\'unicorn\')')
	]))
	driver.store('ponies').index('type').count().addListener(sequenceListener(t)([
		value => t.deepEqual(value, 3, 'Everypony is here!'),
		value => t.deepEqual(value, 0, 'Clear is propagated to index(\'type\').count()')
	]))
	driver.store('ponies').index('type').count('unicorn').addListener(sequenceListener(t)([
		value => t.deepEqual(value, 1, 'Unicorns are here!'),
		value => t.deepEqual(value, 0, 'Clear is propagated to index(\'type\').count(\'unicorn\')')
	]))
})
