import test from 'tape'

import xs from 'xstream'
import fromDiagram from 'xstream/extra/fromDiagram'
import delay from 'xstream/extra/delay'

import { 
	mockIdb,
	mockDatabase,
	mockDbWithIndex,
	mockDbWithTypeIndex,
	mockDbWithNameIndex,
	mockDbWithNumberIndex,
	mockEpisodesDb,
} from 'idb-driver.mock'
import idb from 'idb'

import {
	getTestId,
	sequenceListener,
	range,
} from 'test'

import {
	mlpEpisodes,
	mlpEpisodesList,
} from 'data/mlp-episodes'

import makeIdbDriver, {
	$add,
	$delete,
	$put,
	$update,
	$clear,
} from 'idb-driver'

const {
	dragonshy,
	bridleGossip,
	callOfTheCutie,
} = mlpEpisodes

const fakeEpisode = { number: 19, title: 'Fake', writer: 'Meghan McCarthy', release_date: 'never' }


const makeDriver = (update$=xs.never()) => makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))
	(update$)

const titleHasNoSpaces = episode => episode.title.indexOf(' ') === -1

const writtenByMeghan = driver => driver.store('ponies').index('writer').only('Meghan McCarthy')


test('index(...).only(key).query(filter) should return all items that match the key and the filter', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.never())

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy])
		]))
})

test('index(...).only(key).query(filter) should update when an element that matches the key and the filter is added', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.of(
		$add('ponies', fakeEpisode)
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy]),
			value => t.deepEqual(value, [dragonshy, fakeEpisode])
		]))
})

test('index(...).only(key).query(filter) should update when an element that matches the key and the filter is modified', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.of(
		$update('ponies', {...dragonshy, views: 3})
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy]),
			value => t.deepEqual(value, [{...dragonshy, views: 3}])
		]))
})

test('index(...).only(key).query(filter) should update when an element that matches the key and the filter is deleted', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.of(
		$delete('ponies', dragonshy.number)
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy]),
			value => t.deepEqual(value, [])
		]))
})

test('index(...).only(key).query(filter) should not update when an element that matches the key but not the filter is added', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList.filter(x => x !== callOfTheCutie)))(xs.of(
		$add('ponies', callOfTheCutie)
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy])
		]))
})

test('index(...).only(key).query(filter) should not update when an element that matches the key but not the filter is updated', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.of(
		$update('ponies', {...callOfTheCutie, views: 3})
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy]),
		]))
})

test('index(...).only(key).query(filter) should not update when an element that matches the key but not the filter is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.of(
		$delete('ponies', callOfTheCutie.number)
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy])
		]))
})

test('index(...).only(key).query(filter) should update when an element that matches the key is updated to match the filter', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.of(
		$update('ponies', {...callOfTheCutie, title: 'CallOfTheCutie'})
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy]),
			value => t.deepEqual(value, [dragonshy, {...callOfTheCutie, title: 'CallOfTheCutie'}])
		]))
})

test('index(...).only(key).query(filter) should update when an element that matches the key and the filter is updated not to match the filter', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb(mlpEpisodesList))(xs.of(
		$update('ponies', {...dragonshy, title: 'Dragon Shy'})
	))

	driver.store('ponies').index('writer')
		.only('Meghan McCarthy')
		.query(episode => episode.title.indexOf(' ') === -1)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy]),
			value => t.deepEqual(value, [])
		]))
})

test('index(...).only(key).query(filter) should not update when an element that matches the filter but not the key is added', t => {
	t.plan(1)

	const driver = makeDriver(xs.of(
		$add('ponies', {...fakeEpisode, writer: 'John Doe'})
	))

	writtenByMeghan(driver)
		.query(titleHasNoSpaces)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy])
		]))
})

test('index(...).only(key).query(filter) should not update when an element that matches the filter but not the key is modified', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb([...mlpEpisodesList, {...fakeEpisode, writer: 'John Doe'}]))(xs.of(
		$update('ponies', {...fakeEpisode, writer: 'John Doe', views: 3})
	))

	writtenByMeghan(driver)
		.query(titleHasNoSpaces)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy])
		]))
})

test('index(...).only(key).query(filter) should not update when an element that matches the filter but not the key is deleted', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb([...mlpEpisodesList, {...fakeEpisode, writer: 'John Doe'}]))(xs.of(
		$delete('ponies', fakeEpisode.number)
	))

	writtenByMeghan(driver)
		.query(titleHasNoSpaces)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy])
		]))
})

test('index(...).only(key).query(filter) should update when an element that matches the filter is updated to match the key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb([...mlpEpisodesList, {...fakeEpisode, writer: 'John Doe'}]))(xs.of(
		$update('ponies', {...fakeEpisode, writer: 'Meghan McCarthy'})
	))

	writtenByMeghan(driver)
		.query(titleHasNoSpaces)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy]),
			value => t.deepEqual(value, [dragonshy, {...fakeEpisode, writer: 'Meghan McCarthy'}])
		]))
})

test('index(...).only(key).query(filter) should update when an element that matches the filter is updated not to match the key', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockEpisodesDb([...mlpEpisodesList, fakeEpisode]))(xs.of(
		$update('ponies', {...fakeEpisode, writer: 'John Doe'})
	))

	writtenByMeghan(driver)
		.query(titleHasNoSpaces)
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [dragonshy, fakeEpisode]),
			value => t.deepEqual(value, [dragonshy])
		]))
})
