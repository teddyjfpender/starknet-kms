"use strict";
/* eslint-disable canonical/filename-match-regex */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FSWatcher = void 0;
const FileWatchingBackend_1 = require("./FileWatchingBackend");
const glob_1 = require("glob");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const findSymlinks = async (project) => {
    const filenames = await (0, glob_1.glob)('./**/*/', {
        absolute: true,
        cwd: project,
        dot: true,
        follow: false,
    });
    const symlinks = [];
    for (const filename of filenames) {
        let stats;
        try {
            stats = await (0, promises_1.lstat)(filename);
        }
        catch (_a) {
            continue;
        }
        if (stats.isSymbolicLink()) {
            let fileRealpath;
            try {
                fileRealpath = await (0, promises_1.realpath)(filename);
            }
            catch (_b) {
                continue;
            }
            if (!symlinks.some((symlink) => symlink.symlink === fileRealpath)) {
                symlinks.push({
                    realpath: fileRealpath,
                    symlink: filename,
                });
            }
        }
    }
    return symlinks;
};
class FSWatcher extends FileWatchingBackend_1.FileWatchingBackend {
    constructor(project) {
        super();
        this.fsWatchers = [];
        this.closed = false;
        // eslint-disable-next-line unicorn/consistent-function-scoping
        const watchPath = (target) => {
            return (0, node_fs_1.watch)(target, {
                encoding: 'utf8',
                persistent: true,
                recursive: true,
            }, (eventType, filename) => {
                this.emitChange({ filename: node_path_1.default.resolve(target, filename) });
            });
        };
        this.fsWatchers.push(watchPath(project));
        // TODO detect when a new symlink is added to the project
        // eslint-disable-next-line promise/prefer-await-to-then
        findSymlinks(project).then((symlinks) => {
            if (this.closed) {
                return;
            }
            for (const symlink of symlinks) {
                this.fsWatchers.push((0, node_fs_1.watch)(symlink.realpath, {
                    encoding: 'utf8',
                    persistent: true,
                    recursive: true,
                }, (eventType, filename) => {
                    const absolutePath = node_path_1.default.resolve(symlink.realpath, filename);
                    this.emitChange({
                        filename: node_path_1.default.join(symlink.symlink, node_path_1.default.relative(symlink.realpath, absolutePath)),
                    });
                }));
            }
            this.emitReady();
        });
    }
    async close() {
        this.closed = true;
        for (const fsWatcher of this.fsWatchers) {
            fsWatcher.close();
        }
    }
}
exports.FSWatcher = FSWatcher;
//# sourceMappingURL=FSWatcher.js.map