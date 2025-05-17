"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShortId = void 0;
const node_crypto_1 = require("node:crypto");
const generateShortId = () => {
    return (0, node_crypto_1.randomUUID)().split('-')[0];
};
exports.generateShortId = generateShortId;
//# sourceMappingURL=generateShortId.js.map