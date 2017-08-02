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


test('store(...).only(key) should return the same object when called multiple times with the same key', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	const keyRange_1 = driver.store('ponies').only('Twilight Sparkle')
	const keyRange_2 = driver.store('ponies').only('Twilight Sparkle')
	t.equal(keyRange_1, keyRange_2)
})

test('store(...).only(key) and store(...).bound(key, key) should return the same object when called with the same key', t => {
	t.plan(1)

	const driver = makeIdbDriver(getTestId(), 1, mockDatabase())(xs.never())
	const keyRange_1 = driver.store('ponies').only('Twilight Sparkle')
	const keyRange_2 = driver.store('ponies').only('Twilight Sparkle')
	t.equal(keyRange_1, keyRange_2)
})

const twilightAndFluttershy = [
	{ name: 'Twilight Sparkle' },
	{ name: 'Fluttershy' },
]

const testSelector = (selectorName, { test, cases, getStream }) => {
	cases.forEach(({ description, initialData=[], input$=xs.never(), output, skip=false }) => {
		const run = skip ? test.skip : test
		run(`#${selectorName} ${description}`, t => {
			t.plan(output.length)
			const driver = makeIdbDriver(getTestId(), 1, mockDatabase(initialData))(input$)
			getStream(driver.store('ponies')).addListener(sequenceListener(t)([
				...output.map(([expected, text]) => value => t.deepEqual(value, expected, text)),
				value => t.fail(`Unexpected value: ${JSON.stringify(value)}`),
			]))
		})
	})
}

testSelector('store(...).only(key).get()', { test,
	getStream: store => store.only('Twilight Sparkle').get(),
	cases: [{
		description: 'should return the first value matching the key',
		initialData: twilightAndFluttershy,
		output: [
			[{ name: 'Twilight Sparkle' }, 'Twilight is sent'],
		]
	}, {
		description: 'should be updated when an object with the given key is added',
		initialData: [{ name: 'Fluttershy' }],
		input$: xs.of($add('ponies', { name: 'Twilight Sparkle' })),
		output: [
			[undefined, 'No Twilight found'],
			[{ name: 'Twilight Sparkle' }, 'Twilight is added'],
		]
	}, {
		description: 'should be updated when an object with the given key is modified',
		initialData: twilightAndFluttershy,
		input$: xs.of($update('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })),
		output: [
			[{ name: 'Twilight Sparkle' }, 'Twilight found'],
			[{ name: 'Twilight Sparkle', type: 'unicorn' }, 'Twilight is modified'],
		]
	}, {
		description: 'should be updated when an object with the given key is deleted',
		initialData: twilightAndFluttershy,
		input$: xs.of($delete('ponies', 'Twilight Sparkle')),
		output: [
			[{ name: 'Twilight Sparkle' }, 'Twilight found'],
			[undefined, 'Twilight is removed'],
		]
	}, {
		description: 'should not be updated when an object with a different key is added',
		input$: xs.of($add('ponies', { name: 'Fluttershy' })),
		output: [
			[undefined, 'No Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is modified',
		initialData: twilightAndFluttershy,
		input$: xs.of($update('ponies', { name: 'Fluttershy', type: 'pegasus' })),
		output: [
			[{ name: 'Twilight Sparkle' }, 'Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is deleted',
		initialData: twilightAndFluttershy,
		input$: xs.of($delete('ponies', 'Fluttershy')),
		output: [
			[{ name: 'Twilight Sparkle' }, 'Twilight found'],
		]
	}]
})

testSelector('store(...).only(key).getAll()', { test,
	getStream: store => store.only('Twilight Sparkle').getAll(),
	cases: [{
		description: 'should return a list with the value matching the key',
		initialData: twilightAndFluttershy,
		output: [
			[[{ name: 'Twilight Sparkle' }], 'Twilight is sent']
		]
	}, {
		description: 'should be updated when an object with the given key is added',
		initialData: [{ name: 'Fluttershy' }],
		input$: xs.of($add('ponies', { name: 'Twilight Sparkle' })),
		output: [
			[[], 'No Twilight found'],
			[[{ name: 'Twilight Sparkle' }], 'Twilight is added'],
		]
	}, {
		description: 'should be updated when an object with the given key is modified',
		initialData: twilightAndFluttershy,
		input$: xs.of($update('ponies', { name: 'Twilight Sparkle', type: 'unicorn' })),
		output: [
			[[{ name: 'Twilight Sparkle' }], 'Twilight found'],
			[[{ name: 'Twilight Sparkle', type: 'unicorn' }], 'Twilight is modified'],
		]
	}, {
		description: 'should be updated when an object with the given key is deleted',
		initialData: twilightAndFluttershy,
		input$: xs.of($delete('ponies', 'Twilight Sparkle')),
		output: [
			[[{ name: 'Twilight Sparkle' }], 'Twilight found'],
			[[], 'Twilight is removed'],
		]
	}, {
		description: 'should not be updated when an object with a different key is added',
		input$: xs.of($add('ponies', { name: 'Fluttershy' })),
		output: [
			[[], 'No Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is modified',
		input$: xs.of($update('ponies', { name: 'Fluttershy', type: 'pegasus' })),
		initialData: twilightAndFluttershy,
		output: [
			[[{ name: 'Twilight Sparkle' }], 'Twilight found'],
		]
	}, {
		description: 'should not be updated when an object with a different key is deleted',
		input$: xs.of($delete('ponies', 'Fluttershy')),
		initialData: twilightAndFluttershy,
		output: [
			[[{ name: 'Twilight Sparkle' }], 'Twilight found'],
		]
	}]
})

const applejack = { name: 'Applejack', type: 'earth pony' }
const fluttershy = { name: 'Fluttershy', type: 'pegasus' }
const pinkie = { name: 'Pinkie Pie', type: 'earth pony' }
const rainbow = { name: 'Rainbow Dash', type: 'pegasus' }
const rarity = { name: 'Rarity', type: 'unicorn' }
const twilight = { name: 'Twilight Sparkle', type: 'unicorn' }
const everypony = [
	applejack,
	fluttershy,
	pinkie,
	rainbow,
	rarity,
	twilight,
]

testSelector('store(...).bound(A, R).getAll()', { test,
	getStream: store => store.bound('A', 'R').getAll(),
	cases: [{
		description: 'should get ponies within range',
		initialData: everypony,
		output: [
			[[applejack, fluttershy, pinkie], 'Ponies from A to R found'],
		]
	}, {
		description: 'should update when pony within range is added',
		initialData: [fluttershy, pinkie, rainbow, rarity, twilight],
		input$: xs.of($add('ponies', applejack)),
		output: [
			[[fluttershy, pinkie], 'Fluttershy and Pinkie found'],
			[[applejack, fluttershy, pinkie], 'Applejack is added'],
		]
	}, {
		description: 'should update when pony within range is modified',
		initialData: everypony,
		input$: xs.of($update('ponies', { name: 'Applejack', element: 'honesty' })),
		output: [
			[[applejack, fluttershy, pinkie], 'Applejack, Fluttershy and Pinkie found'],
			[[{ name: 'Applejack', type: 'earth pony', element: 'honesty'}, fluttershy, pinkie], 'Applejack is updated'],
		]
	}, {
		description: 'should update when pony within range is removed',
		initialData: everypony,
		input$: xs.of($delete('ponies', 'Applejack')),
		output: [
			[[applejack, fluttershy, pinkie], 'Applejack, Fluttershy and Pinkie found'],
			[[fluttershy, pinkie], 'Applejack is removed'],
		]
	}, {
		description: 'should not update when pony outside range is added',
		initialData: [applejack, fluttershy, pinkie, rainbow, rarity],
		input$: xs.of($add('ponies', twilight)),
		output: [
			[[applejack, fluttershy, pinkie], 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should not update when pony outside range is modified',
		initialData: everypony,
		input$: xs.of($update('ponies', Object.assign({}, rainbow, { element: 'loyalty' }))),
		output: [
			[[applejack, fluttershy, pinkie], 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should not update when pony outside range is deleted',
		initialData: everypony,
		input$: xs.of($delete('ponies', 'Rarity')),
		output: [
			[[applejack, fluttershy, pinkie], 'Applejack, Fluttershy and Pinkie found'],
		]
	}]
})

testSelector('store(...).bound(A, R).getAllKeys()', { test,
	getStream: store => store.bound('A', 'R').getAllKeys(),
	cases: [{
		description: 'should get ponies within range',
		initialData: everypony,
		output: [
			[[applejack, fluttershy, pinkie].map(x => x.name), 'Ponies from A to R found'],
		]
	}, {
		description: 'should update when pony within range is added',
		initialData: [fluttershy, pinkie, rainbow, rarity, twilight],
		input$: xs.of($add('ponies', applejack)),
		output: [
			[[fluttershy, pinkie].map(x => x.name), 'Fluttershy and Pinkie found'],
			[[applejack, fluttershy, pinkie].map(x => x.name), 'Applejack is added'],
		]
	}, {
		description: 'should not update when pony within range is modified',
		initialData: everypony,
		input$: xs.of($update('ponies', { name: 'Applejack', element: 'honesty' })),
		output: [
			[[applejack, fluttershy, pinkie].map(x => x.name), 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should update when pony within range is removed',
		initialData: everypony,
		input$: xs.of($delete('ponies', 'Applejack')),
		output: [
			[[applejack, fluttershy, pinkie].map(x => x.name), 'Applejack, Fluttershy and Pinkie found'],
			[[fluttershy, pinkie].map(x => x.name), 'Applejack is removed'],
		]
	}, {
		description: 'should not update when pony outside range is added',
		initialData: [applejack, fluttershy, pinkie, rainbow, rarity],
		input$: xs.of($add('ponies', twilight)),
		output: [
			[[applejack, fluttershy, pinkie].map(x => x.name), 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should not update when pony outside range is modified',
		initialData: everypony,
		input$: xs.of($update('ponies', Object.assign({}, rainbow, { element: 'loyalty' }))),
		output: [
			[[applejack, fluttershy, pinkie].map(x => x.name), 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should not update when pony outside range is deleted',
		initialData: everypony,
		input$: xs.of($delete('ponies', 'Rarity')),
		output: [
			[[applejack, fluttershy, pinkie].map(x => x.name), 'Applejack, Fluttershy and Pinkie found'],
		]
	}]
})

testSelector('store(...).bound(A, R).count()', { test,
	getStream: store => store.bound('A', 'R').count(),
	cases: [{
		description: 'should get ponies within range',
		initialData: everypony,
		output: [
			[3, 'Ponies from A to R found'],
		]
	}, {
		description: 'should update when pony within range is added',
		initialData: [fluttershy, pinkie, rainbow, rarity, twilight],
		input$: xs.of($add('ponies', applejack)),
		output: [
			[2, 'Fluttershy and Pinkie found'],
			[3, 'Applejack is added'],
		]
	}, {
		description: 'should not update when pony within range is modified',
		initialData: everypony,
		input$: xs.of($update('ponies', { name: 'Applejack', element: 'honesty' })),
		output: [
			[3, 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should update when pony within range is removed',
		initialData: everypony,
		input$: xs.of($delete('ponies', 'Applejack')),
		output: [
			[3, 'Applejack, Fluttershy and Pinkie found'],
			[2, 'Applejack is removed'],
		]
	}, {
		description: 'should not update when pony outside range is added',
		initialData: [applejack, fluttershy, pinkie, rainbow, rarity],
		input$: xs.of($add('ponies', twilight)),
		output: [
			[3, 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should not update when pony outside range is modified',
		initialData: everypony,
		input$: xs.of($update('ponies', Object.assign({}, rainbow, { element: 'loyalty' }))),
		output: [
			[3, 'Applejack, Fluttershy and Pinkie found'],
		]
	}, {
		description: 'should not update when pony outside range is deleted',
		initialData: everypony,
		input$: xs.of($delete('ponies', 'Rarity')),
		output: [
			[3, 'Applejack, Fluttershy and Pinkie found'],
		]
	}]
})
