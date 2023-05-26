import crypto from 'crypto';

interface IConfig {
    maxItems?: number;
    expireMs?: number;
    keyLength?: number;
    cleanupIntervalMs?: number;
}

interface IStorageManager<V> {
    readonly maxItems: number;
    readonly expireMs: number;
    readonly size: number;

    add(entry: { key: string; value: V }): TStorageResult<V>;
    update(entry: { key: string; value: V }): TStorageResult<V>;
    upsert(entry: { key: string; value: V }): TStorageResult<V>;
    get(key: string): TStorageValue<V> | undefined;
    delete(key: string): boolean;
    clear(): void;
    stopCleanup(): void;
    getUniqueKey(): string;
}

type TStorageValue<V> = V extends object
    ? V & {
          expireAt: Date;
          updateAt: Date;
      }
    : {
          value: V;
          expireAt: Date;
          updateAt: Date;
      };

type TStorageResult<V> =
    | ({ success: true; key: string } & TStorageValue<V>)
    | { success: false };

class StorageManager<V> implements IStorageManager<V> {
    private readonly _storage: Map<string, TStorageValue<V>> = new Map();
    private readonly _maxItems: number;
    private readonly _expireMs: number;
    private readonly _keyLength: number;
    private readonly _cleanupInterval: NodeJS.Timeout;
    private readonly _cleanupIntervalMs: number;

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

    get maxItems() {
        return this._maxItems;
    }

    get expireMs() {
        return this._expireMs;
    }

    get size() {
        return this._storage.size;
    }

    private cleanup(): void {
        const currentTime = new Date(Date.now());
        for (const [key, data] of this._storage.entries()) {
            if (data.expireAt > currentTime) {
                this._storage.delete(key);
            }
        }
    }

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

    private validateKey(key: string) {
        if (typeof key !== 'string')
            throw new TypeError(
                `Key ${key} is not a string. Please provide a valid string`
            );
    }

    private handleMaxCapacity(): void {
        if (this._storage.size >= this._maxItems) this.cleanup();
        if (this._storage.size >= this._maxItems) {
            const lruKey = this.lruKey() as string;
            this._storage.delete(lruKey);
        }
    }

    public add({ key, value }: { key: string; value: V }): TStorageResult<V> {
        this.validateKey(key);
        if (this._storage.has(key)) return { success: false };
        this.handleMaxCapacity();

        const data = this.buildData(value);
        this._storage.set(key, data);
        return { success: true, key, ...data };
    }

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

    public get(key: string): TStorageValue<V> | undefined {
        this.validateKey(key);
        const result = this._storage.get(key);
        return result;
    }

    public delete(key: string): boolean {
        this.validateKey(key);
        return this._storage.delete(key);
    }

    public clear(): void {
        this._storage.clear();
    }

    public stopCleanup() {
        clearInterval(this._cleanupInterval);
    }

    private generateKey(): string {
        return crypto.randomBytes(this._keyLength / 2).toString('hex');
    }

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
