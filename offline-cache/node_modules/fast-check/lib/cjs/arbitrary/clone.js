"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clone = clone;
const CloneArbitrary_1 = require("./_internals/CloneArbitrary");
/**@__NO_SIDE_EFFECTS__*/function clone(arb, numValues) {
    return new CloneArbitrary_1.CloneArbitrary(arb, numValues);
}
