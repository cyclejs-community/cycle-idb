# cycle-idb
A cycle driver for IndexedDB. It uses [idb](https://github.com/jakearchibald/idb) to interface with IndexedDB. If you need more details about working with IndexedDB, the [Google Developers Guide](https://developers.google.com/web/ilt/pwa/working-with-indexeddb) is a good place to start.

**Warning:** this library is in early development phase. It hasn't been tested extensively and only provides a subset of the operations available for IndexedDB. Use at your own risk.

## Installation

**cycle-idb** is available through npm packages.
```shell
$ npm i cycle-idb
```

## Usage

Take a look at the [examples](examples) folder for a complete sample.

### Create IDB driver

The function `makeIdbDriver` accepts three arguments.
- `name`: the name of the database
- `version`: the version of the database. Whenever you add or modify new object stores, the version should be increased.
- `upgradeFn`: a function that receives an `UpgradeDB` object and performs any updates required to the database.

```javascript
import makeIdbDriver from 'cycle-idb'

const drivers = {
	IDB: makeIdbDriver('pony-db', 1, upgradeDb => {
		// Contains the current version of the database before upgrading
		upgradeDb.oldVersion
		// Creates a new store in the database
		upgradeDb.createObjectStore('ponies', { keyPath: 'name' })
	})
}
```

### Query data

Cycle-idb is designed around subscribing to the data and receiving updates when that data changes.

```javascript
function main(sources) {
	// This returns a stream that will emit an event every time the data in the 'ponies' store changes.
	const allPonies$ = sources.IDB.store('ponies').getAll()

	// This returns a stream that will emit an event every time the data in the 'ponies' store
	// with the primary key 'Twilight Sparkle' changes.
	const twilight$ = sources.IDB.store('ponies').get('Twilight Sparkle')
}
```

### Update data

The cycle-idb driver receives a stream that accepts three database operations: `put`, `update` and `delete`. Factories for these operations can be imported from the `cycle-idb` package.

- `put`: adds an object to the store, replacing it if an object with the same primary key already exists.
- `update`: adds an object to the store. If an object with the same primary key already exists, it will update the object with the fields existing in the event, but keeping the fields that are not present in the event.
- `delete`: removes any object from the store with the primary key sent in the event.

```javascript
import fromDiagram from 'xstream/extra/fromDiagram'
import { $put, $update, $delete } from 'cycle-idb'

function main(sources) {
	const updateDb$ = fromDiagram('-a-b-c-|', {
		values: {
			// Will add the entry 'Twilight Sparkle' to the store 'ponies'
			a: $put('ponies', { name: 'Twilight Sparkle', type: 'unicorn' }),
			// Will update the entry 'Twilight Sparkle', keeping the previous 'type' field
			b: $update('ponies', { name: 'Twilight Sparkle', element: 'magic' }),
			// Will remove 'Twilight Sparkle' from the store 'ponies'
			c: $delete('ponies', 'Twilight Sparkle'),
		}
	})

	return {
		IDB: updateDb$,
	}
}
```
