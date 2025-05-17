"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const killPsTree_1 = require("./killPsTree");
const node_child_process_1 = require("node:child_process");
const node_path_1 = require("node:path");
const promises_1 = require("node:timers/promises");
const vitest_1 = require("vitest");
(0, vitest_1.test)('kills a good process tree', async () => {
    const childProcess = (0, node_child_process_1.exec)(`node ${(0, node_path_1.join)(__dirname, '__fixtures__/killPsTree/goodTree/a.js')}`);
    if (!childProcess.pid) {
        throw new Error('Expected child process to have a pid');
    }
    await (0, promises_1.setTimeout)(500);
    await (0, killPsTree_1.killPsTree)(childProcess.pid);
});
(0, vitest_1.test)('kills a bad process tree', async () => {
    const childProcess = (0, node_child_process_1.exec)(`node ${(0, node_path_1.join)(__dirname, '__fixtures__/killPsTree/badTree/a.js')}`);
    if (!childProcess.pid) {
        throw new Error('Expected child process to have a pid');
    }
    await (0, promises_1.setTimeout)(500);
    await (0, killPsTree_1.killPsTree)(childProcess.pid, 1000);
});
//# sourceMappingURL=killPsTree.test.js.map