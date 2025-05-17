"use strict";
// cspell:words nocase
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testExpression = void 0;
const micromatch_1 = __importDefault(require("micromatch"));
const node_path_1 = __importDefault(require("node:path"));
const testExpression = (expression, fileName) => {
    if (node_path_1.default.isAbsolute(fileName)) {
        throw new Error('File name must be relative');
    }
    const name = expression[0];
    if (name === 'allof') {
        const nextExpressions = expression.slice(1);
        return nextExpressions.every((nextExpression) => {
            return (0, exports.testExpression)(nextExpression, fileName);
        });
    }
    if (name === 'anyof') {
        const nextExpressions = expression.slice(1);
        return nextExpressions.some((nextExpression) => {
            return (0, exports.testExpression)(nextExpression, fileName);
        });
    }
    if (name === 'dirname' || name === 'idirname') {
        return micromatch_1.default.isMatch(node_path_1.default.dirname(fileName), '**/' + expression[1] + '/**', {
            dot: true,
            nocase: name === 'idirname',
        });
    }
    if (name === 'match' || name === 'imatch') {
        const pattern = expression[1];
        const subject = expression[2] === 'wholename' ? fileName : node_path_1.default.basename(fileName);
        return micromatch_1.default.isMatch(subject, pattern, {
            dot: true,
            nocase: name === 'imatch',
        });
    }
    if (name === 'not') {
        const subExpression = expression[1];
        return !(0, exports.testExpression)(subExpression, fileName);
    }
    throw new Error('Unknown expression');
};
exports.testExpression = testExpression;
//# sourceMappingURL=testExpression.js.map