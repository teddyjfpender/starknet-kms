"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deduplicateFileChangeEvents_1 = require("./deduplicateFileChangeEvents");
const vitest_1 = require("vitest");
(0, vitest_1.it)('keeps only the latest entry of a file change', async () => {
    (0, vitest_1.expect)((0, deduplicateFileChangeEvents_1.deduplicateFileChangeEvents)([
        {
            filename: '/foo',
            hash: '1',
        },
        {
            filename: '/foo',
            hash: '2',
        },
        {
            filename: '/foo',
            hash: '3',
        },
    ])).toEqual([
        {
            filename: '/foo',
            hash: '3',
        },
    ]);
});
//# sourceMappingURL=deduplicateFileChangeEvents.test.js.map