"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subarray = subarray;
const SubarrayArbitrary_1 = require("./_internals/SubarrayArbitrary");
/**@__NO_SIDE_EFFECTS__*/function subarray(originalArray, constraints = {}) {
    const { minLength = 0, maxLength = originalArray.length } = constraints;
    return new SubarrayArbitrary_1.SubarrayArbitrary(originalArray, true, minLength, maxLength);
}
