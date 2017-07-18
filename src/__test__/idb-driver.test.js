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
} from '../idb-driver'


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

test('Calling index(...) multiple times should return the same object', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithIndex())(xs.never())
	const ponyStore = driver.store('ponies')
	const index_1 = ponyStore.index('type')
	const index_2 = ponyStore.index('type')

	t.equal(index_1, index_2)
})

test('Calling store(...) multiple times with the same name should return the same object', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	const store_1 = driver.store('ponies')
	const store_2 = driver.store('ponies')

	t.equal(store_1, store_2)
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
