"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findNearestDirectory = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * Iterates up the directory tree from the given path until it finds a directory
 * containing the given file.
 */
const findNearestDirectory = async (fileName, startPath) => {
    let currentPath = startPath;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const targetPath = node_path_1.default.join(currentPath, fileName);
        try {
            await promises_1.default.access(targetPath, promises_1.default.constants.F_OK);
        }
        catch (_a) {
            const nextPath = node_path_1.default.resolve(currentPath, '..');
            if (nextPath === currentPath) {
                break;
            }
            currentPath = nextPath;
            continue;
        }
        return targetPath;
    }
    return null;
};
exports.findNearestDirectory = findNearestDirectory;
//# sourceMappingURL=findNearestDirectory.js.map