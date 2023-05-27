import crypto from 'crypto';

// Configuration interface for StorageManager
interface IConfig {
    maxItems?: number; // Maximum number of items allowed in the storage
    expireMs?: number; // Expiration time in milliseconds for items in the storage
    keyLength?: number; // Length of keys used for storage items
    cleanupIntervalMs?: number; // Interval in milliseconds for automatic cleanup
}

// Interface for StorageManager
interface IStorageManager<V> {
    readonly maxItems: number; // Maximum number of items allowed in the storage
    readonly expireMs: number; // Expiration time in milliseconds for items in the storage
    readonly size: number; // Current size of the storage

    // Add an entry to the storage
    add(entry: { key: string; value: V }): TStorageResult<V>;

    // Update an existing entry in the storage
    update(entry: { key: string; value: V }): TStorageResult<V>;

    // Add or update an entry in the storage
    upsert(entry: { key: string; value: V }): TStorageResult<V>;

    // Get the value of an entry in the storage based on the key
    get(key: string): TStorageValue<V> | undefined;

    // Delete an entry from the storage based on the key
    delete(key: string): boolean;

    // Clear all entries from the storage
    clear(): void;

    // Stop the automatic cleanup process
    stopCleanup(): void;

    // Get a unique key for the storage
    getUniqueKey(): string;
}

// Type for the value stored in the storage
type TStorageValue<V> = V extends object
    ? V & {
          expireAt: Date; // Expiration date for the item
          updateAt: Date; // Last update date for the item
      }
    : {
          value: V; // Value of the item
          expireAt: Date; // Expiration date for the item
          updateAt: Date; // Last update date for the item
      };

// Type for the result of storage operations
type TStorageResult<V> =
    | ({ success: true; key: string } & TStorageValue<V>) // Success result with the stored value and metadata
    | { success: false }; // Failure result

class StorageManager<V> implements IStorageManager<V> {
    private readonly _storage: Map<string, TStorageValue<V>> = new Map(); // Internal storage map
    private readonly _maxItems: number; // Maximum number of items allowed in the storage
    private readonly _expireMs: number; // Expiration time in milliseconds for items in the storage
    private readonly _keyLength: number; // Length of keys used for storage items
    private readonly _cleanupInterval: NodeJS.Timeout; // Interval timer for automatic cleanup
    private readonly _cleanupIntervalMs: number; // Interval in milliseconds for automatic cleanup

    // Constructor for StorageManager
    constructor({ maxItems, expireMs, keyLength, cleanupIntervalMs }: IConfig) {
        if (keyLength && (keyLength < 6 || keyLength > 32)) {
            console.warn(
                'Key length is recommended to be greater than 6 and less than 32'
            );
        }

        this._maxItems = maxItems ?? Infinity;
        this._expireMs = expireMs ?? 24 * 60 * 60 * 1000;
        this._keyLength = keyLength ?? 8;
        this._cleanupIntervalMs = cleanupIntervalMs ?? 24 * 60 * 60 * 1000;
        this._cleanupInterval = setInterval(
            () => this.cleanup(),
            this._cleanupIntervalMs
        );
    }

    // Get the maximum number of items allowed in the storage
    get maxItems() {
        return this._maxItems;
    }

    // Get the expiration time in milliseconds for items in the storage
    get expireMs() {
        return this._expireMs;
    }

    // Get the current size of the storage
    get size() {
        return this._storage.size;
    }

    /**
     * Performs a cleanup of expired entries in the storage.
     * Entries with an expiration date older than the current time will be deleted.
     */
    private cleanup(): void {
        const currentTime = new Date(Date.now());
        for (const [key, data] of this._storage.entries()) {
            if (data.expireAt > currentTime) {
                this._storage.delete(key);
            }
        }
    }

    /**
     * Retrieves the least recently used (LRU) key from the storage.
     * The LRU key is determined by the entry with the earliest expiration date.
     * @returns The LRU key or undefined if the storage is empty.
     */
    private lruKey(): string | undefined {
        let lruKey: string | undefined;
        let lruKeyExpireAt = new Date('275760-12-31');
        for (const [key, data] of this._storage.entries()) {
            if (data.expireAt < lruKeyExpireAt) {
                lruKeyExpireAt = data.expireAt;
                lruKey = key;
            }
        }
        return lruKey;
    }

    /**
     * Builds the storage value for a given input value.
     * If the value is an object, it adds additional properties for expiration and update timestamps.
     * @param value - The input value for storage.
     * @returns The storage value with expiration and update timestamps.
     */
    private buildData(value: V): TStorageValue<V> {
        const now = Date.now();
        const expireAt = new Date(now + this._expireMs);
        const updateAt = new Date(now);
        if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
        ) {
            return { ...value, expireAt, updateAt } as TStorageValue<V>;
        }

        return { value, expireAt, updateAt } as TStorageValue<V>;
    }

    /**
     * Validates the provided key to ensure it is a string.
     * @param key - The key to validate.
     * @throws {TypeError} If the key is not a string.
     */
    private validateKey(key: string) {
        if (typeof key !== 'string')
            throw new TypeError(
                `Key ${key} is not a string. Please provide a valid string`
            );
    }

    /**
     * Handles the maximum capacity of the storage.
     * If the storage exceeds the maximum number of items, it performs a cleanup and removes the least recently used (LRU) entry.
     */
    private handleMaxCapacity(): void {
        if (this._storage.size >= this._maxItems) this.cleanup();
        if (this._storage.size >= this._maxItems) {
            const lruKey = this.lruKey() as string;
            this._storage.delete(lruKey);
        }
    }

    /**
     * Adds an entry to the storage.
     * @param entry - The entry object containing the key and value to be added.
     * @returns A storage result object indicating success or failure of the operation.
     *          If successful, it includes the key, value, expiration date, and last update date of the stored item.
     *          If unsuccessful, it returns { success: false }.
     */
    public add({ key, value }: { key: string; value: V }): TStorageResult<V> {
        this.validateKey(key);
        if (this._storage.has(key)) return { success: false };
        this.handleMaxCapacity();

        const data = this.buildData(value);
        this._storage.set(key, data);
        return { success: true, key, ...data };
    }

    /**
     * Updates an existing entry in the storage.
     * @param entry - The entry object containing the key and value to be updated.
     * @returns A storage result object indicating success or failure of the operation.
     *          If successful, it includes the key, value, expiration date, and last update date of the updated item.
     *          If unsuccessful (e.g., the key does not exist), it returns { success: false }.
     */
    public update({
        key,
        value,
    }: {
        key: string;
        value: V;
    }): TStorageResult<V> {
        this.validateKey(key);
        if (!this._storage.has(key)) return { success: false };
        this.handleMaxCapacity();

        const data = this.buildData(value);
        this._storage.set(key, data);
        return { success: true, key, ...data };
    }

    /**
     * Adds or updates an entry in the storage.
     * @param entry - The entry object containing the key and value to be added or updated.
     * @returns A storage result object indicating success or failure of the operation.
     *          If successful, it includes the key, value, expiration date, and last update date of the stored or updated item.
     *          If unsuccessful, it returns { success: false }.
     */
    public upsert({
        key,
        value,
    }: {
        key: string;
        value: V;
    }): TStorageResult<V> {
        this.validateKey(key);
        if (!this._storage.has(key)) this.handleMaxCapacity();

        const data = this.buildData(value);
        this._storage.set(key, data);
        return { success: true, key, ...data };
    }

    /**
     * Retrieves the value of an entry in the storage based on the provided key.
     * @param key - The key of the entry to retrieve.
     * @returns The value and metadata of the retrieved entry, or undefined if the key does not exist.
     */

    public get(key: string): TStorageValue<V> | undefined {
        this.validateKey(key);
        const result = this._storage.get(key);
        return result;
    }

    /**
     * Deletes an entry from the storage based on the provided key.
     * @param key - The key of the entry to delete.
     * @returns A boolean indicating whether the deletion was successful (true) or the key did not exist (false).
     */
    public delete(key: string): boolean {
        this.validateKey(key);
        return this._storage.delete(key);
    }

    /**
     * Clears all entries from the storage.
     */
    public clear(): void {
        this._storage.clear();
    }

    /**
     * Stops the automatic cleanup process by clearing the cleanup interval.
     */
    public stopCleanup() {
        clearInterval(this._cleanupInterval);
    }

    /**
     * Generates a unique key for storage, ensuring it does not already exist in the storage.
     * @returns A unique key.
     * @throws {Error} If a unique key cannot be generated within the maximum number of retries.
     */
    private generateKey(): string {
        return crypto.randomBytes(this._keyLength / 2).toString('hex');
    }

    /**
     * Gets a unique key for storage, ensuring it does not already exist in the storage.
     * @returns A unique key.
     * @throws {Error} If a unique key cannot be generated within the maximum number of retries.
     */
    public getUniqueKey(): string {
        const maxRetries = 15;
        let retryCount = 0;
        let key: string;

        do {
            key = this.generateKey();
            if (!this._storage.has(key)) break;
        } while (++retryCount <= maxRetries);

        return key;
    }
}

export { StorageManager };
