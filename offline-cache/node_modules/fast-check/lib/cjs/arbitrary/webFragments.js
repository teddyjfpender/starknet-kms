"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webFragments = webFragments;
const UriQueryOrFragmentArbitraryBuilder_1 = require("./_internals/builders/UriQueryOrFragmentArbitraryBuilder");
/**@__NO_SIDE_EFFECTS__*/function webFragments(constraints = {}) {
    return (0, UriQueryOrFragmentArbitraryBuilder_1.buildUriQueryOrFragmentArbitrary)(constraints.size);
}
