"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChokidarWatcher = void 0;
const Logger_1 = require("../Logger");
const FileWatchingBackend_1 = require("./FileWatchingBackend");
const chokidar = __importStar(require("chokidar"));
const log = Logger_1.Logger.child({
    namespace: 'ChokidarWatcher',
});
class ChokidarWatcher extends FileWatchingBackend_1.FileWatchingBackend {
    constructor(project) {
        super();
        let discoveredFileCount = 0;
        this.indexingIntervalId = setInterval(() => {
            log.trace('indexed %s %s...', discoveredFileCount.toLocaleString('en-US'), discoveredFileCount === 1 ? 'file' : 'files');
        }, 5000);
        this.chokidar = chokidar.watch(project, {
            awaitWriteFinish: false,
            followSymlinks: true,
        });
        let ready = false;
        this.chokidar.on('ready', () => {
            clearInterval(this.indexingIntervalId);
            ready = true;
            this.emitReady();
        });
        this.chokidar.on('all', (event, filename) => {
            if (!ready) {
                discoveredFileCount++;
                return;
            }
            if (event === 'addDir') {
                return;
            }
            this.emitChange({ filename });
        });
    }
    close() {
        clearInterval(this.indexingIntervalId);
        return this.chokidar.close();
    }
}
exports.ChokidarWatcher = ChokidarWatcher;
//# sourceMappingURL=ChokidarWatcher.js.map