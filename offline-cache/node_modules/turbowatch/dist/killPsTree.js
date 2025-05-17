"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.killPsTree = void 0;
const Logger_1 = require("./Logger");
const find_process_1 = __importDefault(require("find-process"));
const promises_1 = require("node:timers/promises");
const pidtree_1 = __importDefault(require("pidtree"));
const log = Logger_1.Logger.child({
    namespace: 'killPsTree',
});
const killPsTree = async (rootPid, gracefulTimeout = 30000) => {
    const childPids = await (0, pidtree_1.default)(rootPid);
    const pids = [rootPid, ...childPids];
    for (const pid of pids) {
        try {
            process.kill(pid, 'SIGTERM');
        }
        catch (error) {
            if (error.code === 'ESRCH') {
                log.debug({ pid }, 'process already terminated');
            }
            else {
                throw error;
            }
        }
    }
    let hangingPids = [...pids];
    let hitTimeout = false;
    const timeoutId = setTimeout(() => {
        hitTimeout = true;
        log.debug({ hangingPids }, 'sending SIGKILL to processes...');
        for (const pid of hangingPids) {
            try {
                process.kill(pid, 'SIGKILL');
            }
            catch (error) {
                if (error.code === 'ESRCH') {
                    log.debug({ pid }, 'process already terminated');
                }
                else {
                    throw error;
                }
            }
        }
    }, gracefulTimeout);
    // eslint-disable-next-line no-unmodified-loop-condition
    while (!hitTimeout && hangingPids.length > 0) {
        for (const hangingPid of hangingPids) {
            const processes = await (0, find_process_1.default)('pid', hangingPid);
            if (processes.length === 0) {
                hangingPids = hangingPids.filter((pid) => pid !== hangingPid);
            }
        }
        await (0, promises_1.setTimeout)(100);
    }
    clearTimeout(timeoutId);
    log.debug('all processes terminated');
};
exports.killPsTree = killPsTree;
//# sourceMappingURL=killPsTree.js.map