import xs from 'xstream'

import { run } from '@cycle/run'
import { makeDOMDriver, div, ul, li, span } from '@cycle/dom'

import makeIdbDriver, { $put } from 'cycle-idb'


const PONIES = [
	{ id: 2, name: 'Pinkie Pie', type: 'earth pony' },
	{ id: 3, name: 'Applejack', type: 'earth pony' },
	{ id: 4, name: 'Rainbow Dasy', type: 'pegasus' },
	{ id: 5, name: 'Rarity', type: 'unicorn' },
	{ id: 6, name: 'Fluttershy', type: 'pegasus' },
]

function main(sources) {
	const addPonies$ = xs.periodic(1000).take(5)
		.map(x => PONIES[x])
		.map(x => $put('ponies', x))
	
	const ponyListVtree$ = sources.IDB.store('ponies').getAll()
		.map(ponies => ul(
			ponies.map(pony => li(`${pony.name} is a ${pony.type}.`))
		))
	const ponyCountVtree$ = sources.IDB.store('ponies').count()
		.map(x => span(`There are ${x} ponies.`))
	const vtree$ = xs.combine(ponyListVtree$, ponyCountVtree$)
		.map(([ ponyList, ponyCount ]) => div([
			ponyList,
			ponyCount
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
				const store = upgradeDb.createObjectStore('ponies', { keyPath: 'id' })
				store.put({ id: 1, name: 'Twilight Sparkle', type: 'unicorn' })
		}	
	}),
	DOM: makeDOMDriver('#app'),
}

run(main, drivers)