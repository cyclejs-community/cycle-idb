import test from 'tape'

import xs from 'xstream'
import fromDiagram from 'xstream/extra/fromDiagram'

import { 
	mockIdb,
	mockDatabase,
	mockDbWithIndex,
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

test('IdbDriver.$put should send an error when key is missing', t => {
	t.plan(1)

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

test('Update errors should be propagated to error$', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$put('ponies', { type: 'pegasus' }),
	))

	driver.error$.addListener({
		error: e => t.deepEqual(e.query, $put('ponies', { type: 'pegasus' }))
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

test('$add should insert a new object in the store', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$add('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })
	))
	driver.store('ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [], 'There are no ponies in the store'),
		value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }], 'Twilight is added'),
	]))
})

test('$add should fail when adding an object with a key that already exists', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' }
	]))(xs.of(
		$add('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }),
	))
	driver.error$.addListener({
		error: e => t.deepEqual(e.query, $add('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }), 'Error trying to add Twilight when she is already in the store')
	})
})

test('$add should fail when adding an object with a unique index that already exists', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' }
	]))(xs.of(
		$add('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.error$.addListener({
		error: e => t.deepEqual(e.query, $add('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }), 'Error trying to add Twilight when she is already in the store')
	})
})

test('Errors generated when using $add should propagate to get listeners', t => {
	t.plan(4)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' }
	]))(xs.of(
		$add('ponies', { name: 'Twilight Sparkle', type: 'alicorn' })
	))
	driver.store('ponies').getAll().addListener({
		error: e => t.deepEqual(e.query, $add('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }), 'Error is propagated to getAll() listener')
	})
	driver.store('ponies').get('Twilight Sparkle').addListener({
		error: e => t.deepEqual(e.query, $add('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }), 'Error is propagated to get(\'Twilight Sparkle\') listener')
	})
	driver.store('ponies').getAllKeys().addListener({
		error: e => t.deepEqual(e.query, $add('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }), 'Error is propagated to getAllKeys() listener')
	})
	driver.store('ponies').count().addListener({
		error: e => t.deepEqual(e.query, $add('ponies', { name: 'Twilight Sparkle', type: 'alicorn' }), 'Error is propagated to count() listener')
	})
})

test('$clear should remove all items in the store', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
		{ name: 'Rainbow Dash' },
	]))(xs.of(
		$clear('ponies')
	))
	driver.store('ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [
			{ name: 'Pinkie Pie' },
			{ name: 'Rainbow Dash' },
			{ name: 'Twilight Sparkle' },
		], 'Everypony is here :)'),
		value => t.deepEqual(value, [], 'Nopony is here :(')
	]))
})

test('$clear should notify all store selectors', t => {
	t.plan(8)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
		{ name: 'Rainbow Dash' },
	]))(fromDiagram('-a-|', {
		values: {
			a: $clear('ponies'),
		},
		timeUnit: 20,
	}))
	driver.store('ponies').getAll().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [
			{ name: 'Pinkie Pie' },
			{ name: 'Rainbow Dash' },
			{ name: 'Twilight Sparkle' },
		], 'Everypony is here!'),
		value => t.deepEqual(value, [], 'Clear is propagated to getAll()')
	]))
	driver.store('ponies').get('Twilight Sparkle').addListener(sequenceListener(t)([
		value => t.deepEqual(value, { name: 'Twilight Sparkle' }, 'Twilight is here!'),
		value => t.deepEqual(value, undefined, 'Clear is propagated to get(\'Twilight Sparkle\')')
	]))
	driver.store('ponies').getAllKeys().addListener(sequenceListener(t)([
		value => t.deepEqual(value, [
			'Pinkie Pie',
			'Rainbow Dash',
			'Twilight Sparkle',
		], 'Everypony is here!'),
		value => t.deepEqual(value, [], 'Clear is propagated to getAllKeys()')
	]))
	driver.store('ponies').count().addListener(sequenceListener(t)([
		value => t.deepEqual(value, 3, 'Everypony is here!'),
		value => t.deepEqual(value, 0, 'Clear is propagated to count()')
	]))
})
