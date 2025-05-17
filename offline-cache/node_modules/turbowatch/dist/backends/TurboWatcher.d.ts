import { FileWatchingBackend } from './FileWatchingBackend';
export declare class TurboWatcher extends FileWatchingBackend {
    private backend;
    constructor(project: string);
    close(): Promise<void>;
}
//# sourceMappingURL=TurboWatcher.d.ts.map