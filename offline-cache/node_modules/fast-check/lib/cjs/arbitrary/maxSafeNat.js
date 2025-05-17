"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxSafeNat = maxSafeNat;
const IntegerArbitrary_1 = require("./_internals/IntegerArbitrary");
const safeMaxSafeInteger = Number.MAX_SAFE_INTEGER;
/**@__NO_SIDE_EFFECTS__*/function maxSafeNat() {
    return new IntegerArbitrary_1.IntegerArbitrary(0, safeMaxSafeInteger);
}
