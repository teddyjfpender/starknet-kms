"use strict";
/* eslint-disable canonical/filename-match-regex */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboWatcher = void 0;
const isFSWatcherAvailable_1 = require("../isFSWatcherAvailable");
const Logger_1 = require("../Logger");
const ChokidarWatcher_1 = require("./ChokidarWatcher");
const FileWatchingBackend_1 = require("./FileWatchingBackend");
const FSWatcher_1 = require("./FSWatcher");
const log = Logger_1.Logger.child({
    namespace: 'TurboWatcher',
});
class TurboWatcher extends FileWatchingBackend_1.FileWatchingBackend {
    constructor(project) {
        super();
        if ((0, isFSWatcherAvailable_1.isFSWatcherAvailable)()) {
            log.info('using native FSWatcher');
            this.backend = new FSWatcher_1.FSWatcher(project);
        }
        else {
            log.info('using native ChokidarWatcher');
            this.backend = new ChokidarWatcher_1.ChokidarWatcher(project);
        }
        this.backend.on('ready', () => {
            this.emit('ready');
        });
        this.backend.on('change', (event) => {
            this.emit('change', event);
        });
    }
    close() {
        return this.backend.close();
    }
}
exports.TurboWatcher = TurboWatcher;
//# sourceMappingURL=TurboWatcher.js.map