# cycle-idb
A cycle driver for IndexedDB. It uses [idb](https://github.com/jakearchibald/idb) to interface with IndexedDB.

**Warning:** this library is in early development phase. It hasn't been tested extensively and only provides a subset of the operations available for IndexedDB. Use at your own risk.

## Installation

**cycle-idb** is available through npm packages.
```
npm i cycle-idb
```

## Usage

Take a look at the [examples](examples).

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

### Update data

TBD