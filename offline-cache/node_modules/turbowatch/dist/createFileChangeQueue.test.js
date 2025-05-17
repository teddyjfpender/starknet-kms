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
const createFileChangeQueue_1 = require("./createFileChangeQueue");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const promises_2 = require("node:timers/promises");
const sinon = __importStar(require("sinon"));
const vitest_1 = require("vitest");
const FIXTURES_DIRECTORY = (0, node_path_1.join)(__dirname, '.createFileChangeQueueFixtures');
(0, vitest_1.beforeEach)(async () => {
    try {
        await (0, promises_1.rmdir)(FIXTURES_DIRECTORY, {
            recursive: true,
        });
    }
    catch (_a) {
        //
    }
    await (0, promises_1.mkdir)(FIXTURES_DIRECTORY);
});
(0, vitest_1.test)('deduplicates triggers', async () => {
    const fooFile = (0, node_path_1.join)(FIXTURES_DIRECTORY, 'foo');
    await (0, promises_1.writeFile)(fooFile, 'foo');
    const abortController = new AbortController();
    const trigger = sinon.stub().resolves(null);
    const subscription = {
        activeTask: null,
        expression: ['match', '*'],
        initialRun: false,
        persistent: false,
        teardown: async () => { },
        trigger,
    };
    const fileChangeQueue = (0, createFileChangeQueue_1.createFileChangeQueue)({
        abortSignal: abortController.signal,
        project: FIXTURES_DIRECTORY,
        subscriptions: [subscription],
        userDebounce: {
            wait: 100,
        },
    });
    fileChangeQueue.trigger({
        filename: fooFile,
        hash: 'bar',
    });
    fileChangeQueue.trigger({
        filename: fooFile,
        hash: 'baz',
    });
    await (0, promises_2.setTimeout)(200);
    (0, vitest_1.expect)(trigger.callCount).toBe(1);
    (0, vitest_1.expect)(trigger.firstCall.args[0]).toEqual([
        {
            filename: fooFile,
            hash: 'baz',
        },
    ]);
});
//# sourceMappingURL=createFileChangeQueue.test.js.map