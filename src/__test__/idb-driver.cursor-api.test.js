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
	$cursor,
} from '../idb-driver'


test('Cursor should send the ponies that fulfill filtering criteria', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Fluttershy', type: 'pegasus' },
		{ name: 'Rainbow Dash', type: 'pegasus' },
	]))(xs.of(
		$cursor('ponies', {
			category: 'foo',
			filter: pony => pony.name.indexOf('t') !== -1,
		})
	))
	driver.store('ponies').cursor('foo').addListener({
		next: value => t.deepEqual(value, [
			{ name: 'Fluttershy', type: 'pegasus'},
			{ name: 'Twilight Sparkle', type: 'unicorn' },
		], 'Twilight and Fluttershy are sent'),
	})
})

test('Cursor should send empty list when store is empty', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.of(
		$cursor('ponies', { category: 'foo', filter: pony => true })
	))
	driver.store('ponies').cursor('foo').addListener({
		next: value => t.deepEqual(value, [], 'Empty list is sent')
	})
})

test('Cursor should send empty list when nopony fulfills the filtering criteria', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase([
		{ name: 'Twilight Sparkle' },
		{ name: 'Pinkie Pie' },
	]))(xs.of(
		$cursor('ponies', { category: 'foo', filter: pony => false })
	))
	driver.store('ponies').cursor('foo').addListener({
		next: value => t.deepEqual(value, [], 'Empty list is sent')
	})
})
