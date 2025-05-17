"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anything = anything;
const AnyArbitraryBuilder_1 = require("./_internals/builders/AnyArbitraryBuilder");
const QualifiedObjectConstraints_1 = require("./_internals/helpers/QualifiedObjectConstraints");
/**@__NO_SIDE_EFFECTS__*/function anything(constraints) {
    return (0, AnyArbitraryBuilder_1.anyArbitraryBuilder)((0, QualifiedObjectConstraints_1.toQualifiedObjectConstraints)(constraints));
}
