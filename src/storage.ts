import crypto from 'crypto';

interface IConfig {
    maxItems?: number;
    expireMs?: number;
    cleanupIntervalMs?: number;
}

class StorageManager<V> {
    private readonly _storage: Map<string | number | Buffer, V> = new Map();
    private readonly _maxItems: number;
    private readonly _expireMs: number;
    private readonly _cleanupInterval: NodeJS.Timeout;
    private readonly _cleanupIntervalMs: number;

    constructor({ maxItems, expireMs, cleanupIntervalMs }: IConfig) {
        this._maxItems = maxItems ?? Infinity;
        this._expireMs = expireMs ?? 24 * 60 * 60 * 1000;
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
}
