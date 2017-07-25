import test from 'tape'

import xs from 'xstream'
import fromDiagram from 'xstream/extra/fromDiagram'

import { 
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
	$put,
	$update,
	$delete,
	$clear,
} from '../idb-driver'


test('Query should send the ponies that fulfill filtering criteria', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Fluttershy', type: 'pegasus' },
		{ name: 'Rainbow Dash', type: 'pegasus' },
	]))(xs.never())
	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener({
			next: value => t.deepEqual(value, [
				{ name: 'Fluttershy', type: 'pegasus'},
				{ name: 'Twilight Sparkle', type: 'unicorn' },
			], 'Twilight and Fluttershy are sent'),
		})
})

test('Query should send empty list when store is empty', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	driver.store('ponies')
		.query(pony => trye)
		.addListener({
			next: value => t.deepEqual(value, [], 'Empty list is sent')
		})
})

test('Query should send empty list when nopony fulfills the filtering criteria', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
	]))(xs.never())
	driver.store('ponies')
		.query(pony => false)
		.addListener({
			next: value => t.deepEqual(value, [], 'Empty list is sent')
		})
})

test('Query should send updates when an element that fulfills filter is modified', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
	]))(xs.of(
		$update('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })
	))

	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle' }], 'Twilight is here'),
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle', type: 'unicorn' }], 'Twilight is a unicorn'),
		]))
})

test('Query should send updates when an element that fulfills filter is inserted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
	]))(xs.of(
		$add('ponies', { name: 'Minuette' })
	))

	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle' }], 'Twilight is here'),
			value => t.deepEqual(value, [
				{ name: 'Minuette' },
				{ name: 'Twilight Sparkle' },
			], 'Minuette is added'),
		]))
})

test('Query should send updates when an element that fulfills filter is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
		{ name: 'Minuette' },
	]))(xs.of(
		$delete('ponies', 'Minuette')
	))

	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Minuette' },
				{ name: 'Twilight Sparkle' },
			], 'Twilight and Minuette are here'),
			value => t.deepEqual(value, [
				{ name: 'Twilight Sparkle' },
			], 'Minuette is removed'),
		]))
})

test('Query should send updates when the store is cleared', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
		{ name: 'Minuette' },
	]))(xs.of(
		$clear('ponies')
	))

	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Minuette' },
				{ name: 'Twilight Sparkle' },
			], 'Twilight and Minuette are here'),
			value => t.deepEqual(value, [], 'The store is empty'),
		]))
})

test('Query should not send updates when an element that does not fulfill filter is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
	]))(xs.of(
		$update('ponies', { name: 'Pinkie Pie', type: 'earth pony' })
	))

	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle' }], 'Twilight is here'),
			value => t.fali(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('Query should not send updates when an element that does not fulfill filter is inserted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
	]))(xs.of(
		$add('ponies', { name: 'Rainbow Dash' })
	))

	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [{ name: 'Twilight Sparkle' }], 'Twilight is here'),
			value => t.deepEqual(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})

test('Query should not send updates when an element that does not fulfill filter is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
		{ name: 'Minuette' },
	]))(xs.of(
		$delete('ponies', 'Pinkie Pie')
	))

	driver.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Minuette' },
				{ name: 'Twilight Sparkle' },
			], 'Twilight and Minuette are here'),
			value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
		]))
})
