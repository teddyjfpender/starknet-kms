"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const createSpawn_1 = require("./createSpawn");
const vitest_1 = require("vitest");
(0, vitest_1.it)('returns outputs', async () => {
    const spawn = (0, createSpawn_1.createSpawn)('foo');
    const result = await spawn `echo 'Hello, World!'`;
    (0, vitest_1.expect)(String(result === null || result === void 0 ? void 0 : result.stdout)).toEqual('Hello, World!\n');
});
(0, vitest_1.it)('injects path to node_modules/.bin', async () => {
    const spawn = (0, createSpawn_1.createSpawn)('foo');
    const result = await spawn `echo $PATH`;
    (0, vitest_1.expect)(String(result === null || result === void 0 ? void 0 : result.stdout)).toMatch(/node_modules\/\.bin/u);
});
(0, vitest_1.it)('rejects if process produces an error', async () => {
    const spawn = (0, createSpawn_1.createSpawn)('foo');
    await (0, vitest_1.expect)(spawn `does-not-exist`).rejects.toThrowError('Program exited with code 127.');
});
const TIMEOUT = 100;
(0, vitest_1.it)('terminates spawned process when it receives abort signal', async () => {
    const abortController = new AbortController();
    const spawn = (0, createSpawn_1.createSpawn)('foo', { abortSignal: abortController.signal });
    setTimeout(() => {
        void abortController.abort();
    }, 50);
    await (0, vitest_1.expect)(spawn `sleep 10`).rejects.toThrowError();
}, TIMEOUT);
(0, vitest_1.it)('waits for termination', async () => {
    const abortController = new AbortController();
    const spawn = (0, createSpawn_1.createSpawn)('foo', { abortSignal: abortController.signal });
    setTimeout(() => {
        void abortController.abort();
    }, 50);
    const start = Date.now();
    await (0, vitest_1.expect)(spawn `( trap '' TERM; exec sleep 0.1 )`).rejects.toThrowError();
    (0, vitest_1.expect)(Date.now() - start).toBeGreaterThan(100);
}, TIMEOUT * 2);
//# sourceMappingURL=createSpawn.test.js.map