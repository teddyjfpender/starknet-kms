"use strict";
/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/method-signature-style */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatchingBackend = void 0;
const node_events_1 = require("node:events");
const node_path_1 = __importDefault(require("node:path"));
class FileWatchingBackend extends node_events_1.EventEmitter {
    constructor() {
        super();
    }
    emitReady() {
        this.emit('ready');
    }
    emitChange(event) {
        if (!node_path_1.default.isAbsolute(event.filename)) {
            throw new Error('Watchers must emit absolute paths');
        }
        this.emit('change', {
            filename: event.filename,
        });
    }
}
exports.FileWatchingBackend = FileWatchingBackend;
//# sourceMappingURL=FileWatchingBackend.js.map