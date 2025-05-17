"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toQualifiedObjectConstraints = toQualifiedObjectConstraints;
const boolean_1 = require("../../boolean");
const constant_1 = require("../../constant");
const double_1 = require("../../double");
const maxSafeInteger_1 = require("../../maxSafeInteger");
const oneof_1 = require("../../oneof");
const string_1 = require("../../string");
const BoxedArbitraryBuilder_1 = require("../builders/BoxedArbitraryBuilder");
function defaultValues(constraints, stringArbitrary) {
    return [
        (0, boolean_1.boolean)(),
        (0, maxSafeInteger_1.maxSafeInteger)(),
        (0, double_1.double)(),
        stringArbitrary(constraints),
        (0, oneof_1.oneof)(stringArbitrary(constraints), (0, constant_1.constant)(null), (0, constant_1.constant)(undefined)),
    ];
}
function boxArbitraries(arbs) {
    return arbs.map((arb) => (0, BoxedArbitraryBuilder_1.boxedArbitraryBuilder)(arb));
}
function boxArbitrariesIfNeeded(arbs, boxEnabled) {
    return boxEnabled ? boxArbitraries(arbs).concat(arbs) : arbs;
}
function toQualifiedObjectConstraints(settings = {}) {
    const valueConstraints = {
        size: settings.size,
        unit: 'stringUnit' in settings ? settings.stringUnit : settings.withUnicodeString ? 'binary' : undefined,
    };
    return {
        key: settings.key !== undefined ? settings.key : (0, string_1.string)(valueConstraints),
        values: boxArbitrariesIfNeeded(settings.values !== undefined ? settings.values : defaultValues(valueConstraints, string_1.string), settings.withBoxedValues === true),
        depthSize: settings.depthSize,
        maxDepth: settings.maxDepth,
        maxKeys: settings.maxKeys,
        size: settings.size,
        withSet: settings.withSet === true,
        withMap: settings.withMap === true,
        withObjectString: settings.withObjectString === true,
        withNullPrototype: settings.withNullPrototype === true,
        withBigInt: settings.withBigInt === true,
        withDate: settings.withDate === true,
        withTypedArray: settings.withTypedArray === true,
        withSparseArray: settings.withSparseArray === true,
    };
}
