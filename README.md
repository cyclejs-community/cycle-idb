# cycle-idb
A [cyclejs](https://github.com/cyclejs/cyclejs) driver for IndexedDB. It uses [idb](https://github.com/jakearchibald/idb) to interface with IndexedDB. If you need more details about how to work with IndexedDB, the [Google Developers Guide](https://developers.google.com/web/ilt/pwa/working-with-indexeddb) is a good place to start.

**Warning:** this library is in early development phase. It hasn't been tested extensively and only provides a subset of the operations available for IndexedDB. Use at your own risk.

- [Installation](#installation)
- [Usage](#usage)
- [Planned features](#planned-features)

## Installation

**cycle-idb** is available through npm packages.
```shell
$ npm i cycle-idb
```

## Usage

Take a look at the [examples](examples) folder for complete samples.

- [Create IDB driver](#create-idb-driver)
- [Query data](#query-data)
- [Update data](#update-data)
- [Indexes](#indexes)
- [Error handling](#error-handling)

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

    // This returs a stream that will emit an event every time the count of objects in the 'ponies' store changes.
    const ponyCount$ = sources.IDB.store('ponies').count()
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
            // Will update the entry 'Twilight Sparkle', keeping the previous property 'type'
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

### Indexes

Indexes allow to sort the data in a store according to a particular property or to query only a subset of the data.

#### Create indexes

Indexes are created in the upgrade function passed to `makeIdbDriver`. The created store objects expose the method `createIndex(indexName, keyPath, options)`, which is used for that purpose.

- `indexName`: the name that will be used to query that specific index.
- `keyPath`: the stuff.
- `options`: an optional object with a few extra options.

You can check the documentation in [IDBObjectStore.createIndex](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/createIndex) for additional details.

```javascript
makeIdbDriver('pony-db', 1, upgradeDb => {
    const ponyStore = upgradeDb.createObjectStore('ponies', { keyPath: 'name' })
    ponyStore.createIndex('type', 'type')
})
```

#### Subscribe to indexes

The `store` method in the `IDBDriver` exposes the `index` selector, which can be used to select a specific index in the selected store.

```javascript
const ponyTypeIndex = sources.IDB.store('ponies').index('type')
```

The index selector returns an object with the following methods:
- `getAll`: returns a stream subscribed to all items in the store, sorted by the selected index. This method accepts an optional `key` argument. If provided, it will only subscribe to the items where the index property equals the provided key.

```javascript
const ponyTypeIndex = sources.IDB.store('ponies').index('type')
const poniesByType = ponyTypeIndex.getAll() // This returns a stream subscribed to all ponies, sorted by 'type'
const unicorns = ponyTypeIndex.getAll('unicorn') // This returns a stream subscribed only to the ponies of type 'unicorn'
```

### Error handling

The cycle-idb driver exposes an `error$` stream that broadcasts all errors that occur during any database writing operation. The error events contain the following data:
- `error`: the error thrown from IndexedDB.
- `query`: an object containing the following properties:
  - `operation`: the operation being performed (`'$put'`, `'$update'` or `'$delete'`).
  - `data`: the data sent to the database operation.
  - `store`: the name of the store being updated.

```javascript
function main(sources) {
    sources.IDB.error$
        .addListener({
            error: e => console.log(`Operation ${e.query.operation}(${e.query.data}) on store ${e.query.store} failed.`)
        })
}
```

Unfortunately, the exposed `error$` doesn't broadcast errors occurred during reading operations, as the error thrown when querying a store object that doesn't exist.

To catch these errors, you need to add an error listener to the streams returned by the methods `get()`, `getAll()` and `count()` returned by `IDB.store(...)`.

```javascript
function main(sources) {
    sources.IDB.store('not-found')
        .getAll()
        .addListener({
            error: e => console.log(e)
        })
}
```

These listeners will also catch the errors raised by writing operations that affect the result of the query created by that method. This means that the stream returned by `store('ponies').get('Twilight Sparkle')` will also receive any error raised when updating the entry with the key `'Twilight Sparkle'`, and the streams returned by `store('ponies').getAll()` and `store('ponies').count()` will receive any error raised when updating the `'ponies'` store.

## Planned features

- [ ] Store selectors
  - [x] ~~get~~
  - [x] ~~getAll~~
  - [x] ~~count~~
  - [ ] getAllKeys
- [ ] Update operations
  - [x] ~~put~~
  - [x] ~~delete~~
  - [x] ~~update~~
  - [ ] add
  - [ ] clear
- [ ] Index selectors
  - [x] ~~getAll~~
  - [x] ~~get~~
  - [ ] getKey
  - [ ] getAllKeys
  - [x] ~~count~~
- [ ] Support for cursors