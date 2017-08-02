import xs from 'xstream'

import { run } from '@cycle/run'
import { makeDOMDriver, div, ul, li, span } from '@cycle/dom'

import makeIdbDriver, { $put } from 'cycle-idb'


const PONIES = [
	{ name: 'Pinkie Pie', type: 'earth pony' },
	{ name: 'Applejack', type: 'earth pony' },
	{ name: 'Rainbow Dash', type: 'pegasus' },
	{ name: 'Rarity', type: 'unicorn' },
	{ name: 'Fluttershy', type: 'pegasus' },
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
				const store = upgradeDb.createObjectStore('ponies', { autoIncrement: true })
				store.put({ name: 'Twilight Sparkle', type: 'unicorn' })
		}	
	}),
	DOM: makeDOMDriver('#app'),
}

run(main, drivers)