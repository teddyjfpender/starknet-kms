"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testExpression_1 = require("./testExpression");
const vitest_1 = require("vitest");
(0, vitest_1.it)('[allof] evaluates as true if all of the grouped expressions also evaluated as true (true)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['allof', ['match', 'bar', 'basename']], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[allof] evaluates as true if all of the grouped expressions also evaluated as true (false, true)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['allof', ['match', 'foo', 'basename'], ['match', 'bar', 'basename']], 'foo/bar')).toBe(false);
});
(0, vitest_1.it)('[allof] evaluates as true if all of the grouped expressions also evaluated as true (false)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['allof', ['match', 'foo', 'basename']], 'foo/bar')).toBe(false);
});
(0, vitest_1.it)('[anyof] evaluates as true if any of the grouped expressions also evaluated as true (true)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['anyof', ['match', 'bar', 'basename']], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[anyof] evaluates as true if any of the grouped expressions also evaluated as true (false, true)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['anyof', ['match', 'foo', 'basename'], ['match', 'bar', 'basename']], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[anyof] evaluates as true if any of the grouped expressions also evaluated as true (false)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['anyof', ['match', 'foo', 'basename']], 'foo/bar')).toBe(false);
});
(0, vitest_1.it)('[dirname] dot directory in subject does not break the pattern', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', 'node_modules'], 'node_modules/.dist/foo.js')).toBe(true);
});
(0, vitest_1.it)('[dirname] evaluates as true if a given file has a matching parent directory (foo)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', 'foo'], 'foo/bar')).toBe(true);
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', 'bar'], 'foo/bar/baz')).toBe(true);
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', 'bar/baz'], 'foo/bar/baz/qux')).toBe(true);
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', 'foo/bar'], 'foo/bar/baz/qux')).toBe(true);
});
(0, vitest_1.it)('[dirname] evaluates as false if a given file does not have a matching parent directory (bar)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', 'bar'], 'foo/bar')).toBe(false);
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', '/bar'], 'foo/bar/baz')).toBe(false);
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['dirname', 'foo'], '.foo/bar')).toBe(false);
});
(0, vitest_1.it)('[idirname] evaluates as true if a given file has a matching parent directory (foo)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['idirname', 'FOO'], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[idirname] evaluates as false if a given file does not have a matching parent directory (bar)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['idirname', 'BAR'], 'foo/bar')).toBe(false);
});
(0, vitest_1.it)('[match] matches basename (bar)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['match', 'bar', 'basename'], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[match] matches basename (b*r)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['match', 'b*r', 'basename'], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[match] does not match basename (bar)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['match', 'foo', 'basename'], 'foo/bar')).toBe(false);
});
(0, vitest_1.it)('[match] matches basename (BAR) (case insensitive)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['imatch', 'bar', 'basename'], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[match] matches basename (B*R) (case insensitive)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['imatch', 'b*r', 'basename'], 'foo/bar')).toBe(true);
});
(0, vitest_1.it)('[match] does not match basename (BAR) (case insensitive)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['imatch', 'foo', 'basename'], 'foo/bar')).toBe(false);
});
(0, vitest_1.it)('[not] evaluates as true if the sub-expression evaluated as false, i.e. inverts the sub-expression (true -> false)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['not', ['match', 'bar', 'basename']], 'foo/bar')).toBe(false);
});
(0, vitest_1.it)('[not] evaluates as true if the sub-expression evaluated as false, i.e. inverts the sub-expression (false -> true)', () => {
    (0, vitest_1.expect)((0, testExpression_1.testExpression)(['not', ['match', 'foo', 'basename']], 'foo/bar')).toBe(true);
});
//# sourceMappingURL=testExpression.test.js.map