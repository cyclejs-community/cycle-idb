import xs from 'xstream'

import { run } from '@cycle/run'
import { makeDOMDriver, div, ul, li, h4, button } from '@cycle/dom'

import makeIdbDriver, { $put, $clear } from 'cycle-idb'


const PONIES = [
	{ name: 'Twilight Sparkle', type: 'unicorn' },
	{ name: 'Pinkie Pie', type: 'earth pony' },
	{ name: 'Rainbow Dash', type: 'pegasus' },
	{ name: 'Applejack', type: 'earth pony' },
	{ name: 'Rarity', type: 'unicorn' },
	{ name: 'Fluttershy', type: 'pegasus' },
]

function main(sources) {
	const addPonies$ = xs.periodic(1000).take(6)
		.map(x => PONIES[x])
		.map(x => $put('ponies', x))
	const clearPonies$ = sources.DOM.select('.clear').events('click')
		.map(x => $clear('ponies'))
	const updateDb$ = xs.merge(addPonies$, clearPonies$)
	
	const ponyTypeIndex = sources.IDB.store('ponies').index('type')
	const unicornVtree$ = ponyTypeIndex.getAll('unicorn')
		.startWith([])
		.map(ponies => ul(
			ponies.map(pony => li(pony.name))
		))
	const unicornCount$ = ponyTypeIndex.count('unicorn')

	const pegasusVtree$ = ponyTypeIndex.getAll('pegasus')
		.startWith([])
		.map(ponies => ul(
			ponies.map(pony => li(pony.name))
		))
	const pegasusCount$ = ponyTypeIndex.count('pegasus')

	const earthPonyVtree$ = ponyTypeIndex.getAll('earth pony')
		.startWith([])
		.map(ponies => ul(
			ponies.map(pony => li(pony.name))
		))
	const earthPonyCount$ = ponyTypeIndex.count('earth pony')

	const ponies$ = xs.combine(unicornVtree$, pegasusVtree$, earthPonyVtree$)
	const count$ = xs.combine(unicornCount$, pegasusCount$, earthPonyCount$)
	
	const vtree$ = xs.combine(ponies$, count$)
		.map(([ ponies, count ]) => {
			const [ unicorns, pegasi, earthPonies ] = ponies
			const [ unicornCount, pegasusCount, earthPonyCount ] = count
			return div([
				h4(`Unicorns (${unicornCount})`),
				unicorns,
				h4(`Pegasi (${pegasusCount})`),
				pegasi,
				h4(`Earth Ponies (${earthPonyCount})`),
				earthPonies,
				button('.clear', 'Clear'),
			])
		})
	
	return {
		IDB: updateDb$,
		DOM: vtree$,
	}
}

const drivers = {
	IDB: makeIdbDriver('pony-db', 1, upgradeDb => {
		switch (upgradeDb.oldVersion) {
			case 0:
				const store = upgradeDb.createObjectStore('ponies', { keyPath: 'name' })
				store.createIndex('type', 'type')
		}	
	}),
	DOM: makeDOMDriver('#app'),
}

run(main, drivers)