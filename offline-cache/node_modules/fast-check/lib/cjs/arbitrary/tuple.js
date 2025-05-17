"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tuple = tuple;
const TupleArbitrary_1 = require("./_internals/TupleArbitrary");
/**@__NO_SIDE_EFFECTS__*/function tuple(...arbs) {
    return new TupleArbitrary_1.TupleArbitrary(arbs);
}
