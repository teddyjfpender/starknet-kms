"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileChangeQueue = void 0;
const deduplicateFileChangeEvents_1 = require("./deduplicateFileChangeEvents");
const hashFile_1 = require("./hashFile");
const testExpression_1 = require("./testExpression");
const node_path_1 = __importDefault(require("node:path"));
const throttle_debounce_1 = require("throttle-debounce");
const createFileChangeQueue = ({ project, abortSignal, userDebounce, subscriptions, }) => {
    const fileHashMap = {};
    let queuedFileChangeEvents = [];
    const evaluateSubscribers = (0, throttle_debounce_1.debounce)(userDebounce.wait, () => {
        const currentFileChangeEvents = (0, deduplicateFileChangeEvents_1.deduplicateFileChangeEvents)(queuedFileChangeEvents);
        queuedFileChangeEvents = [];
        const filesWithUnchangedHash = [];
        for (const fileChangeEvent of currentFileChangeEvents) {
            const { filename, hash } = fileChangeEvent;
            if (!hash) {
                continue;
            }
            const previousHash = fileHashMap[filename];
            if (previousHash === hash) {
                filesWithUnchangedHash.push(filename);
            }
            else {
                fileHashMap[filename] = hash;
            }
        }
        for (const subscription of subscriptions) {
            const relevantEvents = [];
            for (const fileChangeEvent of currentFileChangeEvents) {
                if (filesWithUnchangedHash.includes(fileChangeEvent.filename)) {
                    continue;
                }
                if (!(0, testExpression_1.testExpression)(subscription.expression, node_path_1.default.relative(project, fileChangeEvent.filename))) {
                    continue;
                }
                relevantEvents.push(fileChangeEvent);
            }
            if (relevantEvents.length) {
                if (abortSignal === null || abortSignal === void 0 ? void 0 : abortSignal.aborted) {
                    return;
                }
                void subscription.trigger(relevantEvents);
            }
        }
    }, {
        noLeading: true,
    });
    return {
        trigger: (fileChangeEvent) => {
            if (fileChangeEvent.hash === undefined) {
                // eslint-disable-next-line promise/prefer-await-to-then
                (0, hashFile_1.hashFile)(fileChangeEvent.filename).then((hash) => {
                    queuedFileChangeEvents.push({
                        ...fileChangeEvent,
                        hash,
                    });
                    evaluateSubscribers();
                });
            }
            else {
                queuedFileChangeEvents.push(fileChangeEvent);
                evaluateSubscribers();
            }
        },
    };
};
exports.createFileChangeQueue = createFileChangeQueue;
//# sourceMappingURL=createFileChangeQueue.js.map