/// <reference types="node" />
import { type FileChangeEvent } from '../types';
import { EventEmitter } from 'node:events';
interface BackendEventEmitter {
    on(name: 'ready', listener: () => void): this;
    on(name: 'change', listener: (event: FileChangeEvent) => void): this;
}
export declare abstract class FileWatchingBackend extends EventEmitter implements BackendEventEmitter {
    constructor();
    abstract close(): Promise<void>;
    protected emitReady(): void;
    protected emitChange(event: FileChangeEvent): void;
}
export {};
//# sourceMappingURL=FileWatchingBackend.d.ts.map