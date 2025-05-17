"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hashFile_1 = require("./hashFile");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
(0, vitest_1.it)('hashes file', async () => {
    await (0, vitest_1.expect)((0, hashFile_1.hashFile)((0, node_path_1.resolve)(__dirname, 'Logger.ts'))).resolves.toBe('8f8bf20d9e97101d36989916146db88c825b7922');
});
(0, vitest_1.it)('resolves null if file cannot be read', async () => {
    await (0, vitest_1.expect)((0, hashFile_1.hashFile)((0, node_path_1.resolve)(__dirname, 'does-not-exist.ts'))).resolves.toBe(null);
});
//# sourceMappingURL=hashFile.test.js.map