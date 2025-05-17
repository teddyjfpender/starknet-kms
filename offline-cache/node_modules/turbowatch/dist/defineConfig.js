"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineConfig = void 0;
const TurboWatcher_1 = require("./backends/TurboWatcher");
const defineConfig = (configurationInput) => {
    return {
        Watcher: TurboWatcher_1.TurboWatcher,
        ...configurationInput,
    };
};
exports.defineConfig = defineConfig;
//# sourceMappingURL=defineConfig.js.map