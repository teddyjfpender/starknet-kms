"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watch = void 0;
const TurboWatcher_1 = require("./backends/TurboWatcher");
const createFileChangeQueue_1 = require("./createFileChangeQueue");
const generateShortId_1 = require("./generateShortId");
const Logger_1 = require("./Logger");
const subscribe_1 = require("./subscribe");
const serialize_error_1 = require("serialize-error");
const log = Logger_1.Logger.child({
    namespace: 'watch',
});
const watch = (configurationInput) => {
    var _a, _b, _c, _d;
    const { abortController, cwd, project, triggers, debounce: userDebounce, Watcher, } = {
        abortController: new AbortController(),
        // as far as I can tell, this is a bug in unicorn/no-unused-properties
        // https://github.com/sindresorhus/eslint-plugin-unicorn/issues/2051
        // eslint-disable-next-line unicorn/no-unused-properties
        debounce: {
            wait: 1000,
        },
        // eslint-disable-next-line unicorn/no-unused-properties
        Watcher: TurboWatcher_1.TurboWatcher,
        ...configurationInput,
    };
    const abortSignal = abortController.signal;
    const subscriptions = [];
    const watcher = new Watcher(project);
    let terminating = false;
    const shutdown = async () => {
        if (terminating) {
            return;
        }
        terminating = true;
        await watcher.close();
        abortController.abort();
        for (const subscription of subscriptions) {
            const { activeTask } = subscription;
            if (activeTask === null || activeTask === void 0 ? void 0 : activeTask.promise) {
                await (activeTask === null || activeTask === void 0 ? void 0 : activeTask.promise);
            }
        }
        for (const subscription of subscriptions) {
            const { teardown } = subscription;
            if (teardown) {
                await teardown();
            }
        }
    };
    if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
            shutdown();
        }, {
            once: true,
        });
    }
    for (const trigger of triggers) {
        const initialRun = (_a = trigger.initialRun) !== null && _a !== void 0 ? _a : true;
        const persistent = (_b = trigger.persistent) !== null && _b !== void 0 ? _b : false;
        if (persistent && !initialRun) {
            throw new Error('Persistent triggers must have initialRun set to true.');
        }
        subscriptions.push((0, subscribe_1.subscribe)({
            abortSignal,
            cwd,
            expression: trigger.expression,
            id: (0, generateShortId_1.generateShortId)(),
            initialRun,
            interruptible: (_c = trigger.interruptible) !== null && _c !== void 0 ? _c : true,
            name: trigger.name,
            onChange: trigger.onChange,
            onTeardown: trigger.onTeardown,
            persistent,
            retry: {
                retries: 3,
                ...trigger.retry,
            },
            throttleOutput: (_d = trigger.throttleOutput) !== null && _d !== void 0 ? _d : { delay: 1000 },
        }));
    }
    let ready = false;
    const fileChangeQueue = (0, createFileChangeQueue_1.createFileChangeQueue)({
        abortSignal,
        project,
        subscriptions,
        userDebounce,
    });
    watcher.on('change', (event) => {
        if (!ready) {
            log.warn('ignoring change event before ready');
            return;
        }
        fileChangeQueue.trigger(event);
    });
    return new Promise((resolve, reject) => {
        watcher.on('error', (error) => {
            log.error({
                error: (0, serialize_error_1.serializeError)(error),
            }, 'could not watch project');
            if (ready) {
                shutdown();
            }
            else {
                reject(error);
            }
        });
        watcher.on('ready', () => {
            ready = true;
            if (!terminating) {
                log.info('triggering initial runs');
                for (const subscription of subscriptions) {
                    if (subscription.initialRun) {
                        void subscription.trigger([]);
                    }
                }
                log.info('ready for file changes');
            }
            resolve({
                shutdown,
            });
        });
    });
};
exports.watch = watch;
//# sourceMappingURL=watch.js.map