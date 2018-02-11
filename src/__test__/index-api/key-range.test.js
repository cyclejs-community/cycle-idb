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

test('index(...).only(key).getAll() should update when an element is modified', t => {
	t.plan(2)

	const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex([
		{ name: 'Twilight Sparkle', type: 'unicorn' },
		{ name: 'Rarity', type: 'unicorn' },
		{ name: 'Applejack', type: 'earth pony' },
	]))(xs.of($update('ponies', { name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' })))

	driver.store('ponies').index('type').only('unicorn').getAll()
		.addListener(sequenceListener(t)([
			value => t.deepEqual(value, [
				{ name: 'Rarity', type: 'unicorn' },
				{ name: 'Twilight Sparkle', type: 'unicorn' },
			]),
			value => t.deepEqual(value, [
				{ name: 'Rarity', type: 'unicorn' },
				{ name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' },
			])
		]))
})

const twilight = { name: 'Twilight Sparkle', type: 'unicorn' }
const rarity = { name: 'Rarity', type: 'unicorn' }
const fluttershy = { name: 'Fluttershy', type: 'pegasus' }
const twilightRarityAndFluttershy = [ twilight, rarity, fluttershy ]
const twilightAndFluttershy = [ twilight, fluttershy ]

const testSelector = (selectorName, { test, cases, getStream }) => {
	cases.forEach(({ description, initialData=[], input$=xs.never(), output, skip=false }) => {
		const run = skip ? test.skip : test
		run(`#${selectorName} ${description}`, t => {
			t.plan(output.length)
			const driver = makeIdbDriver(getTestId(), 1, mockDbWithTypeIndex(initialData))(input$)
			getStream(driver.store('ponies')).addListener(sequenceListener(t)([
				...output.map(([expected, text]) => value => t.deepEqual(value, expected, text)),
				value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
			]))
		})
	})
}

testSelector('index(...).only(key).get()', { test,
	getStream: store => store.index('type').only('unicorn').get(),
	cases: [{
		description: 'should return the first value matching the key',
		initialData: twilightAndFluttershy,
		output: [
			[twilight, 'Twilight is sent'],
		]
	}, {
		description: 'should be updated when an object with the given key is added',
		initialData: [fluttershy],
		input$: xs.of($add('ponies', twilight)),
		output: [
			[undefined, 'No Twilight found'],
			[twilight, 'Twilight is added'],
		]
	}, {
		description: 'should be updated when an object with the given key is modified',
		initialData: twilightAndFluttershy,
		input$: xs.of($update('ponies', { name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' })),
		output: [
			[twilight, 'Twilight found'],
			[{ name: 'Twilight Sparkle', type: 'unicorn', element: 'magic' }, 'Twilight is modified'],
		]
	}, {
		description: 'should be updated when an object with the given key is deleted',
		initialData: twilightAndFluttershy,
		input$: xs.of($delete('ponies', 'Twilight Sparkle')),
		output: [
			[twilight, 'Twilight found'],
			[undefined, 'Twilight is removed'],
		]
	}, {
		description: 'should not be updated when an object with a different key is added',
		input$: xs.of($add('ponies', fluttershy)),
		output: [
			[undefined, 'No Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is modified',
		initialData: twilightAndFluttershy,
		input$: xs.of($update('ponies', fluttershy)),
		output: [
			[twilight, 'Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is deleted',
		initialData: twilightAndFluttershy,
		input$: xs.of($delete('ponies', 'Fluttershy')),
		output: [
			[twilight, 'Twilight found'],
		]
	}]
})

const getAllTests = [{
	name: 'index(...).only(key).getAll()',
	getStream: store => store.index('type').only('unicorn').getAll()
}, {
	name: 'index(...).bound(key).getAll()',
	getStream: store => store.index('type').bound('t', 'v').getAll()
}]
getAllTests.forEach(({ name, getStream }) => testSelector(name, { test,
	getStream,
	cases: [{
		description: 'should return a list with the value matching the key',
		initialData: twilightAndFluttershy,
		output: [
			[[ twilight ], 'Twilight is sent']
		]
	}, {
		description: 'should be updated when an object with the given key is added',
		initialData: [ fluttershy ],
		input$: xs.of($add('ponies', twilight)),
		output: [
			[[], 'No Twilight found'],
			[[ twilight ], 'Twilight is added'],
		]
	}, {
		description: 'should be updated when an object with the given key is modified',
		initialData: twilightAndFluttershy,
		input$: xs.of($update('ponies', {...twilight, element: 'magic'})),
		output: [
			[[twilight], 'Twilight found'],
			[[{...twilight, element: 'magic'}], 'Twilight is modified'],
		]
	}, {
		description: 'should be updated when an object with the given key is deleted',
		initialData: twilightAndFluttershy,
		input$: xs.of($delete('ponies', 'Twilight Sparkle')),
		output: [
			[[twilight], 'Twilight found'],
			[[], 'Twilight is removed'],
		]
	}, {
		description: 'should not be updated when an object with a different key is added',
		input$: xs.of($add('ponies', fluttershy)),
		output: [
			[[], 'No Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is modified',
		input$: xs.of($update('ponies', fluttershy)),
		initialData: twilightAndFluttershy,
		output: [
			[[twilight], 'Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is deleted',
		input$: xs.of($delete('ponies', 'Fluttershy')),
		initialData: twilightAndFluttershy,
		output: [
			[[twilight], 'Twilight found'],
		]
	}]
}))
