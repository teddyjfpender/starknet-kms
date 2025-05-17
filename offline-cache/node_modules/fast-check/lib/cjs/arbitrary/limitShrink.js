"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limitShrink = limitShrink;
const LimitedShrinkArbitrary_1 = require("./_internals/LimitedShrinkArbitrary");
/**@__NO_SIDE_EFFECTS__*/function limitShrink(arbitrary, maxShrinks) {
    return new LimitedShrinkArbitrary_1.LimitedShrinkArbitrary(arbitrary, maxShrinks);
}
