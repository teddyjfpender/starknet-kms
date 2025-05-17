import { FileWatchingBackend } from './FileWatchingBackend';
export declare class FSWatcher extends FileWatchingBackend {
    private fsWatchers;
    private closed;
    constructor(project: string);
    close(): Promise<void>;
}
//# sourceMappingURL=FSWatcher.d.ts.map