# ts-map-storage

This ts-map-storage is a simple storage management module for standardizing behavior when interacting with Map Object as a in-memory-storage, written in typescript.

The basic features limiting the items in storage, cleaning up expired key in interval, deleting the lru (least recently used) key when the item count limit is hit

## Installation

```bash
npm install @es-node/ts-map-storage
```

## Usage

```js
import { StorageManager } from '@es-node/ts-map-storage';

// Create a new instance of StorageManager
const storage = new StorageManager({
    maxItems: 100, // Maximum number of items allowed in the storage (optional)
    expireMs: 3600000, // Expiration time in milliseconds for items in the storage (optional)
    keyLength: 12, // Length of keys used for storage items (optional)
    cleanupIntervalMs: 86400000, // Interval in milliseconds for automatic cleanup (optional)
});

// Add an entry to the storage
storage.add({ key: 'key1', value: 'value1' });

// Get the value of an entry from the storage
const item = storage.get('key1');
console.log(item); // { value: 'value1', expireAt: [expiration date], updateAt: [last update date] }

// Delete an entry from the storage
storage.delete('key1');

// Clear all entries from the storage
storage.clear();
```

## API

The StorageManager module provides the following methods and properties:

### Constructor

`new StorageManager(config: IConfig)`
Creates a new instance of StorageManager with the specified configuration options.

The `config` object can have the following properties:

-   `maxItems` (optional): Maximum number of items allowed in the storage.
-   `expireMs` (optional): Expiration time in milliseconds for items in the storage.
-   `keyLength` (optional): Length of keys used for storage items.
-   `cleanupIntervalMs` (optional): Interval in milliseconds for automatic cleanup.

### Methods

`add(entry: { key: string; value: V }): TStorageResult<V>`
Adds an entry to the storage.

Returns a storage result object indicating the success or failure of the operation.

`update(entry: { key: string; value: V }): TStorageResult<V>`
Updates an existing entry in the storage.

Returns a storage result object indicating the success or failure of the operation.

`upsert(entry: { key: string; value: V }): TStorageResult<V>`
Adds or updates an entry in the storage.

Returns a storage result object indicating the success or failure of the operation.

`get(key: string): TStorageValue<V> | undefined`
Retrieves the value of an entry in the storage based on the provided key.

Returns the value and metadata of the retrieved entry, or undefined if the key does not exist.

`delete(key: string): boolean`
Deletes an entry from the storage based on the provided key.

Returns a boolean indicating whether the deletion was successful (true) or the key did not exist (false).

`clear(): void`
Clears all entries from the storage.

`stopCleanup(): void`
Stops the automatic cleanup process by clearing the cleanup interval.

`getUniqueKey(): string`
Generates a unique key for storage, ensuring it does not already exist in the storage.

Returns a unique key.

### Properties

`maxItems: number`
The maximum number of items allowed in the storage. This property is read-only.

`expireMs: number`
The expiration time in milliseconds for items in the storage. This property is read-only.

`size: number`
The current size of the storage. It represents the number of items currently stored in the storage. This property is read-only.

### Types

The StorageManager module defines several types to support its functionality:

`TStorageValue<V>`
A type representing the value stored in the storage. If the value is an object, it includes additional properties for expiration and update timestamps. If the value is not an object, it includes the `value`, `expireAt`, and `updateAt` properties.

`TStorageResult<V>`
A type representing the result of storage operations. It can be either a success result, including the stored value and metadata, or a failure result.

`IConfig`
An interface representing the configuration options for the StorageManager constructor. It includes optional properties for `maxItems`, `expireMs`, `keyLength`, and `cleanupIntervalMs`.

I hope this provides you with the necessary information about the StorageManager module. Let me know if you have any further questions!
