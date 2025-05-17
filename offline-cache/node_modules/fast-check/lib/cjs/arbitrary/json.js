"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.json = json;
const jsonValue_1 = require("./jsonValue");
const safeJsonStringify = JSON.stringify;
/**@__NO_SIDE_EFFECTS__*/function json(constraints = {}) {
    const arb = (0, jsonValue_1.jsonValue)(constraints);
    return arb.map(safeJsonStringify);
}
