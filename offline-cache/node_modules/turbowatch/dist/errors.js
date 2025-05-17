"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbortError = exports.UnexpectedError = exports.TurbowatchError = void 0;
const ts_custom_error_1 = require("ts-custom-error");
class TurbowatchError extends ts_custom_error_1.CustomError {
}
exports.TurbowatchError = TurbowatchError;
class UnexpectedError extends TurbowatchError {
}
exports.UnexpectedError = UnexpectedError;
class AbortError extends TurbowatchError {
}
exports.AbortError = AbortError;
//# sourceMappingURL=errors.js.map