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
} from 'idb-driver.mock'
import idb from 'idb'

import {
	getTestId,
	sequenceListener,
	range,
} from 'test'

import makeIdbDriver, {
	$add,
	$delete,
	$put,
	$update,
	$clear,
} from 'idb-driver'


test('index(...).only(key).getAll() should get all the elements sorted by index with the given key', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
	]))(xs.never())
	driver.store('ponies').index('type').only('unicorn').getAll().addListener({
		next: value => t.deepEqual(value, [
			{ name: 'Rarity', type: 'unicorn' },
			{ name: 'Twilight Sparkle', type: 'unicorn' },
		])
	})
})