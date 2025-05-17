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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const watch_1 = require("./watch");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const promises_2 = require("node:timers/promises");
const sinon = __importStar(require("sinon"));
const vitest_1 = require("vitest");
const spyRoarr = () => {
    // eslint-disable-next-line node/no-process-env
    const { ROARR_LOG } = process.env;
    if (ROARR_LOG !== 'true') {
        throw new Error('ROARR_LOG must be set to "true"');
    }
    const messages = [];
    globalThis.ROARR.write = (message) => {
        const payload = JSON.parse(message);
        messages.push(payload);
    };
    return {
        getMessages: () => {
            return messages;
        },
    };
};
const fixturesPath = node_path_1.default.resolve(__dirname, '.fixtures');
(0, vitest_1.beforeEach)(async () => {
    await promises_1.default.rm(fixturesPath, {
        force: true,
        recursive: true,
    });
    await promises_1.default.mkdir(fixturesPath);
    await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
});
(0, vitest_1.afterEach)(async () => {
    await promises_1.default.rm(fixturesPath, {
        force: true,
        recursive: true,
    });
});
(0, vitest_1.it)('detects file change', async () => {
    const onChange = sinon.stub();
    const { shutdown } = await (0, watch_1.watch)({
        debounce: {
            wait: 100,
        },
        project: fixturesPath,
        triggers: [
            {
                expression: ['match', 'foo', 'basename'],
                initialRun: false,
                name: 'foo',
                onChange,
            },
        ],
    });
    await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
    await (0, promises_2.setTimeout)(1000);
    (0, vitest_1.expect)(onChange.called).toBe(true);
    await shutdown();
});
(0, vitest_1.it)('ignores file change events if the file hash is the same', async () => {
    const onChange = sinon.stub();
    const { shutdown } = await (0, watch_1.watch)({
        debounce: {
            wait: 100,
        },
        project: fixturesPath,
        triggers: [
            {
                expression: ['match', 'foo', 'basename'],
                initialRun: false,
                name: 'foo',
                onChange,
            },
        ],
    });
    await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
    await (0, promises_2.setTimeout)(1000);
    await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
    await (0, promises_2.setTimeout)(1000);
    (0, vitest_1.expect)(onChange.callCount).toBe(1);
    await shutdown();
});
// While desirable, at the moment this is not possible to implement.
// Implementing this would require to index all files when the watch starts.
vitest_1.it.skip('ignores file change events if the file hash is the same; file existed before watch started', async () => {
    const onChange = sinon.stub();
    await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
    const { shutdown } = await (0, watch_1.watch)({
        debounce: {
            wait: 100,
        },
        project: fixturesPath,
        triggers: [
            {
                expression: ['match', 'foo', 'basename'],
                initialRun: false,
                name: 'foo',
                onChange,
            },
        ],
    });
    await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
    await (0, promises_2.setTimeout)(1000);
    (0, vitest_1.expect)(onChange.callCount).toBe(0);
    await shutdown();
});
// https://github.com/gajus/turbowatch/issues/17
// Not clear why this is failing in CI/CD.
vitest_1.it.skip('does not log every file change', async () => {
    const onChange = sinon.stub();
    const roarrSpy = spyRoarr();
    const { shutdown } = await (0, watch_1.watch)({
        debounce: {
            wait: 100,
        },
        project: fixturesPath,
        triggers: [
            {
                expression: ['match', 'foo', 'basename'],
                initialRun: false,
                name: 'foo',
                onChange,
            },
        ],
    });
    for (let index = 0; index++ < 100;) {
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
    }
    await (0, promises_2.setTimeout)(1000);
    (0, vitest_1.expect)(onChange.called).toBe(true);
    (0, vitest_1.expect)(roarrSpy.getMessages().length).toBeLessThan(20);
    await shutdown();
});
(0, vitest_1.it)('executes the initial run (persistent)', async () => {
    const onChange = sinon.stub();
    const { shutdown } = await (0, watch_1.watch)({
        debounce: {
            wait: 100,
        },
        project: fixturesPath,
        triggers: [
            {
                expression: ['match', 'foo', 'basename'],
                name: 'foo',
                onChange,
                persistent: true,
            },
        ],
    });
    (0, vitest_1.expect)(onChange.called).toBe(true);
    await shutdown();
});
(0, vitest_1.it)('executes the initial run (non-persistent)', async () => {
    const onChange = sinon.stub();
    const { shutdown } = await (0, watch_1.watch)({
        debounce: {
            wait: 100,
        },
        project: fixturesPath,
        triggers: [
            {
                expression: ['match', 'foo', 'basename'],
                name: 'foo',
                onChange,
                persistent: false,
            },
        ],
    });
    (0, vitest_1.expect)(onChange.called).toBe(true);
    await shutdown();
});
//# sourceMappingURL=watch.test.js.map