"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduplicateFileChangeEvents = void 0;
const deduplicateFileChangeEvents = (fileChangeEvents) => {
    const changedFilePaths = [];
    return fileChangeEvents
        .slice()
        .reverse()
        .filter((event) => {
        if (changedFilePaths.includes(event.filename)) {
            return false;
        }
        changedFilePaths.push(event.filename);
        return true;
    })
        .reverse();
};
exports.deduplicateFileChangeEvents = deduplicateFileChangeEvents;
//# sourceMappingURL=deduplicateFileChangeEvents.js.map