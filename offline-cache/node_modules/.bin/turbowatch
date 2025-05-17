#!/usr/bin/env node
"use strict";
/* eslint-disable node/shebang */
/* eslint-disable require-atomic-updates */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("../Logger");
const glob_1 = require("glob");
const jiti_1 = __importDefault(require("jiti"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const helpers_1 = require("yargs/helpers");
const yargs_1 = __importDefault(require("yargs/yargs"));
const log = Logger_1.Logger.child({
    namespace: 'turbowatch',
});
// eslint-disable-next-line node/no-process-env
if (process.env.ROARR_LOG !== 'true') {
    // eslint-disable-next-line no-console
    console.warn('[turbowatch] running turbowatch without logging enabled; set ROARR_LOG=true to enable logging. Install @roarr/cli to pretty-print logs.');
}
const findTurbowatchScript = (inputPath) => {
    let resolvedPath = null;
    const providedPath = node_path_1.default.resolve(process.cwd(), inputPath);
    const possiblePaths = [providedPath];
    if (node_path_1.default.extname(providedPath) === '') {
        possiblePaths.push(providedPath + '.ts', providedPath + '.js');
    }
    for (const possiblePath of possiblePaths) {
        if ((0, node_fs_1.existsSync)(possiblePath)) {
            resolvedPath = possiblePath;
        }
    }
    return resolvedPath;
};
const main = async () => {
    const abortController = new AbortController();
    let terminating = false;
    process.once('SIGINT', () => {
        if (terminating) {
            log.warn('already terminating; ignoring SIGINT');
            return;
        }
        terminating = true;
        log.warn('received SIGINT; gracefully terminating');
        abortController.abort();
    });
    process.once('SIGTERM', () => {
        if (terminating) {
            log.warn('already terminating; ignoring SIGTERM');
            return;
        }
        terminating = true;
        log.warn('received SIGTERM; gracefully terminating');
        abortController.abort();
    });
    const { watch, } = (0, jiti_1.default)(__filename)('../watch');
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .command('$0 [patterns...]', 'Start Turbowatch', (commandYargs) => {
        commandYargs.positional('patterns', {
            array: true,
            default: ['turbowatch.ts'],
            describe: 'Script with Turbowatch instructions. Can provide multiple. It can also be a glob pattern, e.g. **/turbowatch.ts',
            type: 'string',
        });
    })
        .parse();
    const patterns = argv.patterns;
    const scriptPaths = [];
    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            scriptPaths.push(...(await (0, glob_1.glob)(pattern)));
        }
        else {
            scriptPaths.push(pattern);
        }
    }
    const resolvedScriptPaths = [];
    for (const scriptPath of scriptPaths) {
        const resolvedPath = findTurbowatchScript(scriptPath);
        if (!resolvedPath) {
            log.error('%s not found', scriptPath);
            process.exitCode = 1;
            return;
        }
        resolvedScriptPaths.push(resolvedPath);
    }
    for (const resolvedPath of resolvedScriptPaths) {
        const turbowatchConfiguration = (0, jiti_1.default)(__filename)(resolvedPath)
            .default;
        if (typeof (turbowatchConfiguration === null || turbowatchConfiguration === void 0 ? void 0 : turbowatchConfiguration.Watcher) !== 'function') {
            log.error('Expected user script to export an instance of TurbowatchController');
            process.exitCode = 1;
            return;
        }
        await watch({
            abortController,
            cwd: node_path_1.default.dirname(resolvedPath),
            ...turbowatchConfiguration,
        });
    }
};
void main();
//# sourceMappingURL=turbowatch.js.map