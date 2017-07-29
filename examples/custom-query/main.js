import xs from 'xstream'

import { run } from '@cycle/run'
import { makeDOMDriver, div, ul, li, h4, button } from '@cycle/dom'

import makeIdbDriver, { $put, $clear } from 'cycle-idb'


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
	const clearPonies$ = sources.DOM.select('.clear').events('click')
		.map(x => $clear('ponies'))
	const updateDb$ = xs.merge(addPonies$, clearPonies$)
	
	const poniesWithT$ = sources.IDB.store('ponies')
		.query(pony => pony.name.indexOf('t') !== -1)
	const poniesWithTvtree$ = poniesWithT$
		.map(ponies => ul(
			ponies.map(pony => li(pony.name))
		))
	
	const vtree$ = poniesWithTvtree$
		.map(poniesVtree => div([
			h4('Ponies with \'T\''),
			poniesVtree,
			button('.clear', 'Clear'),
		]))
	
	return {
		IDB: updateDb$,
		DOM: vtree$,
	}
}

const drivers = {
	IDB: makeIdbDriver('pony-db', 1, upgradeDb => {
		switch (upgradeDb.oldVersion) {
			case 0:
				upgradeDb.createObjectStore('ponies', { keyPath: 'name' })
		}	
	}),
	DOM: makeDOMDriver('#app'),
}

run(main, drivers)