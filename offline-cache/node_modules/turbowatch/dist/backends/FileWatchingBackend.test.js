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
const isFSWatcherAvailable_1 = require("../isFSWatcherAvailable");
const ChokidarWatcher_1 = require("./ChokidarWatcher");
const FSWatcher_1 = require("./FSWatcher");
const TurboWatcher_1 = require("./TurboWatcher");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const promises_2 = require("node:timers/promises");
const sinon = __importStar(require("sinon"));
const vitest_1 = require("vitest");
const fixturesPath = node_path_1.default.resolve(__dirname, '.fixtures');
(0, vitest_1.beforeEach)(async () => {
    await promises_1.default.rm(fixturesPath, {
        force: true,
        recursive: true,
    });
    await promises_1.default.mkdir(fixturesPath);
});
const waitForReady = (watcher) => {
    return new Promise((resolve) => {
        watcher.on('ready', () => {
            resolve(null);
        });
    });
};
const backends = [
    {
        name: 'Chokidar',
        Watcher: ChokidarWatcher_1.ChokidarWatcher,
    },
    {
        name: 'FS',
        Watcher: FSWatcher_1.FSWatcher,
    },
    {
        name: 'Turbo',
        Watcher: TurboWatcher_1.TurboWatcher,
    },
];
for (const { Watcher, name } of backends) {
    if ((0, isFSWatcherAvailable_1.isFSWatcherAvailable)() === false && Watcher === FSWatcher_1.FSWatcher) {
        continue;
    }
    (0, vitest_1.it)('[' + name + '] detects file change', async () => {
        const watcher = new Watcher(fixturesPath);
        await waitForReady(watcher);
        const onChange = sinon.stub();
        watcher.on('change', onChange);
        await (0, promises_2.setTimeout)(100);
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
        await (0, promises_2.setTimeout)(100);
        (0, vitest_1.expect)(onChange.calledWith(sinon.match({
            filename: node_path_1.default.join(fixturesPath, 'foo'),
        }))).toBe(true);
        await watcher.close();
    });
    (0, vitest_1.it)('[' + name + '] detects changes to a file that is replaced', async () => {
        const watcher = new Watcher(fixturesPath);
        await waitForReady(watcher);
        const onChange = sinon.stub();
        watcher.on('change', onChange);
        await (0, promises_2.setTimeout)(100);
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
        await (0, promises_2.setTimeout)(100);
        await promises_1.default.unlink(node_path_1.default.join(fixturesPath, 'foo'));
        await (0, promises_2.setTimeout)(100);
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'foo'), '');
        await (0, promises_2.setTimeout)(100);
        (0, vitest_1.expect)(onChange.callCount).toBeGreaterThanOrEqual(3);
        await watcher.close();
    });
    (0, vitest_1.it)('[' + name + '] detects hard link change (linked file)', async () => {
        await promises_1.default.mkdir(node_path_1.default.resolve(fixturesPath, 'foo'));
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'bar'), '');
        await promises_1.default.link(node_path_1.default.join(fixturesPath, 'bar'), node_path_1.default.join(fixturesPath, 'foo', 'bar'));
        const watcher = new Watcher(node_path_1.default.resolve(fixturesPath, 'foo'));
        await waitForReady(watcher);
        const onChange = sinon.stub();
        watcher.on('change', onChange);
        await (0, promises_2.setTimeout)(100);
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'bar'), '');
        await (0, promises_2.setTimeout)(100);
        (0, vitest_1.expect)(onChange.calledWith(sinon.match({
            filename: node_path_1.default.join(fixturesPath, 'foo', 'bar'),
        }))).toBe(true);
        await watcher.close();
    });
    (0, vitest_1.it)('[' + name + '] detects symlink change (linked file)', async () => {
        await promises_1.default.mkdir(node_path_1.default.resolve(fixturesPath, 'foo'));
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'bar'), '');
        await promises_1.default.symlink(node_path_1.default.join(fixturesPath, 'bar'), node_path_1.default.join(fixturesPath, 'foo', 'bar'));
        const watcher = new Watcher(node_path_1.default.resolve(fixturesPath, 'foo'));
        await waitForReady(watcher);
        const onChange = sinon.stub();
        watcher.on('change', onChange);
        await (0, promises_2.setTimeout)(100);
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'bar'), '');
        await (0, promises_2.setTimeout)(100);
        (0, vitest_1.expect)(onChange.calledWith(sinon.match({
            filename: node_path_1.default.join(fixturesPath, 'foo', 'bar'),
        }))).toBe(true);
        await watcher.close();
    });
    (0, vitest_1.it)('[' + name + '] detects symlink change (linked path)', async () => {
        await promises_1.default.mkdir(node_path_1.default.resolve(fixturesPath, 'foo'));
        await promises_1.default.mkdir(node_path_1.default.resolve(fixturesPath, 'bar'));
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'bar', 'baz'), '');
        await promises_1.default.symlink(node_path_1.default.join(fixturesPath, 'bar'), node_path_1.default.join(fixturesPath, 'foo', 'bar'));
        const watcher = new Watcher(node_path_1.default.resolve(fixturesPath, 'foo'));
        await waitForReady(watcher);
        const onChange = sinon.stub();
        watcher.on('change', onChange);
        await (0, promises_2.setTimeout)(100);
        await promises_1.default.writeFile(node_path_1.default.join(fixturesPath, 'bar', 'baz'), '');
        await (0, promises_2.setTimeout)(100);
        (0, vitest_1.expect)(onChange.calledWith(sinon.match({
            filename: node_path_1.default.join(fixturesPath, 'foo', 'bar', 'baz'),
        }))).toBe(true);
        // TODO investigate why this is failing in GitHub CI
        // expect(
        //   onChange.calledWith({
        //     filename: path.join(fixturesPath, 'foo', 'bar'),
        //   }),
        // ).toBe(true);
        await watcher.close();
    });
}
//# sourceMappingURL=FileWatchingBackend.test.js.map