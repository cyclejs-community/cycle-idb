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

const testSelector = (selectorName, { test, cases, getStream, mockDb=mockDbWithTypeIndex }) => {
	cases.forEach(({ description, initialData=[], input$=xs.never(), output, skip=false }) => {
		const run = skip ? test.skip : test
		run(`#${selectorName} ${description}`, t => {
			t.plan(output.length)
			const driver = makeIdbDriver(getTestId(), 1, mockDb(initialData))(input$)
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

const {
	friendshipIsMagic_1,
	friendshipIsMagic_2,
	theTicketMaster,
	applebuckSeason,
	griffonTheBrushOff,
	// ...
	lookBeforeYouSleep,
	bridleGossip,
	swarmOfTheCentury,
	winterWrapUp,
	callOfTheCutie,
} = mlpEpisodes

const boundTests = [{
	name: 'index(...).bound(date_1, date_2).getAll()',
	getStream: store => store.index('release_date').bound('2010-10-22', '2010-11-12').getAll(),
	transformOutput: x => x.map(x => x),
	updateWhenModified: true,
}, {
	name: 'index(...).bound(date_1, date_2).getAllKeys()',
	getStream: store => store.index('release_date').bound('2010-10-22', '2010-11-12').getAllKeys(),
	transformOutput: x => x.map(x => x.number),
	updateWhenModified: false,
}, {
	name: 'index(...).bound(date_1, date_2).count()',
	getStream: store => store.index('release_date').bound('2010-10-22', '2010-11-12').count(),
	transformOutput: x => x.length,
	updateWhenModified: false,
}, {
	name: 'index(...).bound(date_1, date_2).get()',
	getStream: store => store.index('release_date').bound('2010-10-22', '2010-11-12').get(),
	transformOutput: x => x[0],
	updateWhenModified: true,
}, {
	name: 'index(...).bound(date_1, date_2).getKey()',
	getStream: store => store.index('release_date').bound('2010-10-22', '2010-11-12').getKey(),
	transformOutput: x => x[0].number,
	updateWhenModified: false,
}]
boundTests.forEach(({ name, getStream, transformOutput, updateWhenModified }) => testSelector(name, { test,
	getStream,
	mockDb: mockEpisodesDb,
	cases: [{
		description: 'should get episodes within range',
		initialData: mlpEpisodesList,
		output: [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff]), 'Episodes released between 2010-10-22 and 2010-11-12 found'],
		]
	}, {
		description: 'should update when episode within range is added',
		initialData: mlpEpisodesList.filter(x => x !== applebuckSeason),
		input$: xs.of($add('ponies', applebuckSeason)),
		output: [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, griffonTheBrushOff]), 'Episodes 2, 3, and 5 found'],
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff]), 'Episode 4 is added'],
		]
	}, {
		description: 'should update when episode within range is modified',
		initialData: mlpEpisodesList,
		input$: xs.of($update('ponies', {...theTicketMaster, views: 3})),
		output: updateWhenModified ? [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff])],
			[transformOutput([friendshipIsMagic_2, {...theTicketMaster, views: 3}, applebuckSeason, griffonTheBrushOff])],
		] : [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff])],
		]
	}, {
		description: 'should update when episode within range is removed',
		initialData: mlpEpisodesList,
		input$: xs.of($delete('ponies', 2)),
		output: [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff])],
			[transformOutput([theTicketMaster, applebuckSeason, griffonTheBrushOff]), 'Episode is deleted'],
		]
	}, {
		description: 'should not update when episode outside range is added',
		initialData: mlpEpisodesList.filter(x => x !== friendshipIsMagic_1),
		input$: xs.of($add('ponies', friendshipIsMagic_1)),
		output: [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff]), 'Only one event is received.'],
		]
	}, {
		description: 'should not update when episode outside range is modified',
		initialData: mlpEpisodesList.filter(x => x !== friendshipIsMagic_1),
		input$: xs.of($update('ponies', {...friendshipIsMagic_1, views: 4})),
		output: [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff]), 'Only one event is received.'],
		]
	}, {
		description: 'should not update when episode outside range is deleted',
		initialData: mlpEpisodesList,
		input$: xs.of($delete('ponies', 1)),
		output: [
			[transformOutput([friendshipIsMagic_2, theTicketMaster, applebuckSeason, griffonTheBrushOff]), 'Only one event is received.'],
		]
	}]
}))

const lowerBoundTests = [{
	name: 'index(...).lowerBound(date).getAll()',
	getStream: store => store.index('release_date').lowerBound('2010-12-03').getAll(),
	transformOutput: x => x.map(x => x),
	updateWhenModified: true,
}, {
	name: 'index(...).lowerBound(date).getAllKeys()',
	getStream: store => store.index('release_date').lowerBound('2010-12-03').getAllKeys(),
	transformOutput: x => x.map(x => x.number),
	updateWhenModified: false,
}, {
	name: 'index(...).lowerBound(date).count()',
	getStream: store => store.index('release_date').lowerBound('2010-12-03').count(),
	transformOutput: x => x.length,
	updateWhenModified: false,
}, {
	name: 'index(...).lowerBound(date).get()',
	getStream: store => store.index('release_date').lowerBound('2010-12-03').get(),
	transformOutput: x => x[0],
	updateWhenModified: true,
}, {
	name: 'index(...).lowerBound(date).getKey()',
	getStream: store => store.index('release_date').lowerBound('2010-12-03').getKey(),
	transformOutput: x => x[0].number,
	updateWhenModified: false,
}]
const lowerBoundEpisodes = [lookBeforeYouSleep, bridleGossip, swarmOfTheCentury, winterWrapUp, callOfTheCutie]
lowerBoundTests.forEach(({ name, getStream, transformOutput, updateWhenModified }) => testSelector(name, { test,
	getStream,
	mockDb: mockEpisodesDb,
	cases: [{
		description: 'should get episodes within range',
		initialData: mlpEpisodesList,
		output: [
			[transformOutput(lowerBoundEpisodes)],
		]
	}, {
		description: 'should update when episode within range is added',
		initialData: mlpEpisodesList.filter(x => x !== lookBeforeYouSleep),
		input$: xs.of($add('ponies', lookBeforeYouSleep)),
		output: [
			[transformOutput(lowerBoundEpisodes.filter(x => x !== lookBeforeYouSleep))],
			[transformOutput(lowerBoundEpisodes)],
		]
	}, {
		description: 'should update when episode within range is modified',
		initialData: mlpEpisodesList,
		input$: xs.of($update('ponies', {...lookBeforeYouSleep, views: 3})),
		output: updateWhenModified ? [
			[transformOutput(lowerBoundEpisodes)],
			[transformOutput(lowerBoundEpisodes.map(x => x === lookBeforeYouSleep ? {...lookBeforeYouSleep, views: 3} : x))],
		] : [
			[transformOutput(lowerBoundEpisodes)],
		]
	}, {
		description: 'should update when episode within range is removed',
		initialData: mlpEpisodesList,
		input$: xs.of($delete('ponies', lookBeforeYouSleep.number)),
		output: [
			[transformOutput(lowerBoundEpisodes)],
			[transformOutput(lowerBoundEpisodes.filter(x => x !== lookBeforeYouSleep)), 'Episode is deleted'],
		]
	}, {
		description: 'should not update when episode outside range is added',
		initialData: mlpEpisodesList.filter(x => x !== friendshipIsMagic_1),
		input$: xs.of($add('ponies', friendshipIsMagic_1)),
		output: [
			[transformOutput(lowerBoundEpisodes), 'Only one event is received.'],
		]
	}, {
		description: 'should not update when episode outside range is modified',
		initialData: mlpEpisodesList.filter(x => x !== friendshipIsMagic_1),
		input$: xs.of($update('ponies', {...friendshipIsMagic_1, views: 4})),
		output: [
			[transformOutput(lowerBoundEpisodes), 'Only one event is received.'],
		]
	}, {
		description: 'should not update when episode outside range is deleted',
		initialData: mlpEpisodesList,
		input$: xs.of($delete('ponies', applebuckSeason.number)),
		output: [
			[transformOutput(lowerBoundEpisodes), 'Only one event is received.'],
		]
	}]
}))

const upperBoundTests = [{
	name: 'index(...).upperBound(date).getAll()',
	getStream: store => store.index('release_date').upperBound('2010-11-05').getAll(),
	transformOutput: x => x.map(x => x),
	updateWhenModified: true,
}, {
	name: 'index(...).upperBound(date).getAllKeys()',
	getStream: store => store.index('release_date').upperBound('2010-11-05').getAllKeys(),
	transformOutput: x => x.map(x => x.number),
	updateWhenModified: false,
}, {
	name: 'index(...).upperBound(date).count()',
	getStream: store => store.index('release_date').upperBound('2010-11-05').count(),
	transformOutput: x => x.length,
	updateWhenModified: false,
}, {
	name: 'index(...).upperBound(date).get()',
	getStream: store => store.index('release_date').upperBound('2010-11-05').get(),
	transformOutput: x => x[0],
	updateWhenModified: true,
}, {
	name: 'index(...).upperBound(date).getKey()',
	getStream: store => store.index('release_date').upperBound('2010-11-05').getKey(),
	transformOutput: x => x[0].number,
	updateWhenModified: false,
}]
const upperBoundEpisodes = [friendshipIsMagic_1, friendshipIsMagic_2, theTicketMaster, applebuckSeason]
upperBoundTests.forEach(({ name, getStream, transformOutput, updateWhenModified }) => testSelector(name, { test,
	getStream,
	mockDb: mockEpisodesDb,
	cases: [{
		description: 'should get episodes within range',
		initialData: mlpEpisodesList,
		output: [
			[transformOutput(upperBoundEpisodes)],
		]
	}, {
		description: 'should update when episode within range is added',
		initialData: mlpEpisodesList.filter(x => x !== theTicketMaster),
		input$: xs.of($add('ponies', theTicketMaster)),
		output: [
			[transformOutput(upperBoundEpisodes.filter(x => x !== theTicketMaster))],
			[transformOutput(upperBoundEpisodes)],
		]
	}, {
		description: 'should update when episode within range is modified',
		initialData: mlpEpisodesList,
		input$: xs.of($update('ponies', {...theTicketMaster, views: 3})),
		output: updateWhenModified ? [
			[transformOutput(upperBoundEpisodes)],
			[transformOutput(upperBoundEpisodes.map(x => x === theTicketMaster ? {...theTicketMaster, views: 3} : x))],
		] : [
			[transformOutput(upperBoundEpisodes)],
		]
	}, {
		description: 'should update when episode within range is removed',
		initialData: mlpEpisodesList,
		input$: xs.of($delete('ponies', theTicketMaster.number)),
		output: [
			[transformOutput(upperBoundEpisodes)],
			[transformOutput(upperBoundEpisodes.filter(x => x !== theTicketMaster)), 'Episode is deleted'],
		]
	}, {
		description: 'should not update when episode outside range is added',
		initialData: mlpEpisodesList.filter(x => x !== swarmOfTheCentury),
		input$: xs.of($add('ponies', swarmOfTheCentury)),
		output: [
			[transformOutput(upperBoundEpisodes), 'Only one event is received.'],
		]
	}, {
		description: 'should not update when episode outside range is modified',
		initialData: mlpEpisodesList.filter(x => x !== swarmOfTheCentury),
		input$: xs.of($update('ponies', {...swarmOfTheCentury, views: 4})),
		output: [
			[transformOutput(upperBoundEpisodes), 'Only one event is received.'],
		]
	}, {
		description: 'should not update when episode outside range is deleted',
		initialData: mlpEpisodesList,
		input$: xs.of($delete('ponies', swarmOfTheCentury.number)),
		output: [
			[transformOutput(upperBoundEpisodes), 'Only one event is received.'],
		]
	}]
}))
