"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashFile = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const hashFile = (filePath) => {
    return new Promise((resolve) => {
        const fileDescriptor = (0, node_fs_1.createReadStream)(filePath);
        const hash = (0, node_crypto_1.createHash)('sha1').setEncoding('hex');
        fileDescriptor.on('error', () => {
            resolve(null);
        });
        fileDescriptor.on('end', () => {
            hash.end();
            resolve(hash.read());
        });
        fileDescriptor.pipe(hash);
    });
};
exports.hashFile = hashFile;
//# sourceMappingURL=hashFile.js.map