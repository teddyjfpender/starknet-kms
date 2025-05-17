import { FileWatchingBackend } from './FileWatchingBackend';
export declare class ChokidarWatcher extends FileWatchingBackend {
    private chokidar;
    private indexingIntervalId;
    constructor(project: string);
    close(): Promise<void>;
}
//# sourceMappingURL=ChokidarWatcher.d.ts.map