import xs from 'xstream'

import { run } from '@cycle/run'
import { makeDOMDriver, div, ul, li, h4 } from '@cycle/dom'

import makeIdbDriver, { $put } from 'cycle-idb'


const PONIES = [
	{ name: 'Twilight Sparkle', type: 'unicorn' },
	{ name: 'Pinkie Pie', type: 'earth pony' },
	{ name: 'Rainbow Dasy', type: 'pegasus' },
	{ name: 'Applejack', type: 'earth pony' },
	{ name: 'Rarity', type: 'unicorn' },
	{ name: 'Fluttershy', type: 'pegasus' },
]

function main(sources) {
	const addPonies$ = xs.periodic(1000).take(6)
		.map(x => PONIES[x])
		.map(x => $put('ponies', x))
	
	const ponyTypeIndex = sources.IDB.store('ponies').index('type')
	const unicornVtree$ = ponyTypeIndex.getAll('unicorn')
		.startWith([])
		.map(ponies => ul(
			ponies.map(pony => li(pony.name))
		))
	const pegasusVtree$ = ponyTypeIndex.getAll('pegasus')
		.startWith([])
		.map(ponies => ul(
			ponies.map(pony => li(pony.name))
		))
	const earthPoniesVtree$ = ponyTypeIndex.getAll('earth pony')
		.startWith([])
		.map(ponies => ul(
			ponies.map(pony => li(pony.name))
		))
	
	const vtree$ = xs.combine(unicornVtree$, pegasusVtree$, earthPoniesVtree$)
		.map(([ unicorns, pegasi, earthPonies ]) => div([
			h4('Unicorns'),
			unicorns,
			h4('Pegasi'),
			pegasi,
			h4('Earth Ponies'),
			earthPonies,
		]))
	
	return {
		IDB: addPonies$,
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