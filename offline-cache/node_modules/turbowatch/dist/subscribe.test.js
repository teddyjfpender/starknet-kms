"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const subscribe_1 = require("./subscribe");
const node_timers_1 = require("node:timers");
const sinon = __importStar(require("sinon"));
const vitest_1 = require("vitest");
const defaultTrigger = {
    abortSignal: new AbortController().signal,
    expression: ['match', 'foo', 'basename'],
    id: 'foo',
    initialRun: true,
    interruptible: false,
    name: 'foo',
    onChange: async () => { },
    onTeardown: async () => { },
    persistent: false,
    relativePath: 'foo',
    retry: {
        retries: 0,
    },
    throttleOutput: {
        delay: 0,
    },
    watch: 'foo',
};
const wait = (time) => {
    return new Promise((resolve) => {
        (0, node_timers_1.setTimeout)(resolve, time);
    });
};
(0, vitest_1.it)('evaluates onChange', async () => {
    const trigger = {
        ...defaultTrigger,
    };
    const triggerMock = sinon.mock(trigger);
    const onChangeExpectation = triggerMock
        .expects('onChange')
        .once()
        .resolves(null);
    const subscription = (0, subscribe_1.subscribe)(trigger);
    subscription.trigger([]);
    (0, vitest_1.expect)(triggerMock.verify());
    (0, vitest_1.expect)(onChangeExpectation.args[0][0].taskId).toMatch(/^[a-z\d]{8}$/u);
});
(0, vitest_1.it)('skips onChange if teardown is initiated', async () => {
    const trigger = {
        ...defaultTrigger,
    };
    const triggerMock = sinon.mock(trigger);
    const onChangeExpectation = triggerMock.expects('onChange').atLeast(1);
    onChangeExpectation.onFirstCall().resolves(wait(100));
    onChangeExpectation.onSecondCall().resolves(null);
    const subscription = (0, subscribe_1.subscribe)(trigger);
    subscription.trigger([{ filename: 'foo' }]);
    subscription.teardown();
    subscription.trigger([{ filename: 'bar' }]);
    await wait(300);
    (0, vitest_1.expect)(onChangeExpectation.callCount).toBe(1);
});
(0, vitest_1.it)('initiates teardown at most once', async () => {
    const trigger = {
        ...defaultTrigger,
    };
    const triggerMock = sinon.mock(trigger);
    const onTeardownExpectation = triggerMock.expects('onTeardown').atLeast(1);
    const subscription = (0, subscribe_1.subscribe)(trigger);
    subscription.teardown();
    subscription.teardown();
    await wait(300);
    (0, vitest_1.expect)(onTeardownExpectation.callCount).toBe(1);
});
(0, vitest_1.it)('swallow onChange errors', async () => {
    const trigger = {
        ...defaultTrigger,
    };
    const subscriptionMock = sinon.mock(trigger);
    subscriptionMock.expects('onChange').once().rejects(new Error('foo'));
    const subscription = (0, subscribe_1.subscribe)(trigger);
    await subscription.trigger([]);
    (0, vitest_1.expect)(subscriptionMock.verify());
});
(0, vitest_1.it)('removes duplicates', async () => {
    const trigger = {
        ...defaultTrigger,
    };
    const subscriptionMock = sinon.mock(trigger);
    const onChange = subscriptionMock.expects('onChange').once().resolves(null);
    const subscription = (0, subscribe_1.subscribe)(trigger);
    subscription.trigger([
        {
            filename: '/foo',
        },
        {
            filename: '/foo',
        },
        {
            filename: '/bar',
        },
    ]);
    (0, vitest_1.expect)(subscriptionMock.verify());
    (0, vitest_1.expect)(onChange.args[0][0].files).toEqual([
        { name: '/foo' },
        { name: '/bar' },
    ]);
});
(0, vitest_1.it)('waits for onChange to complete when { interruptible: false }', async () => {
    const abortController = new AbortController();
    const trigger = {
        ...defaultTrigger,
        abortSignal: abortController.signal,
        interruptible: false,
    };
    const triggerMock = sinon.mock(trigger);
    const onChange = triggerMock.expects('onChange').twice();
    let completed = false;
    onChange.onFirstCall().callsFake(async () => {
        await wait(100);
        completed = true;
    });
    onChange.onSecondCall().callsFake(() => {
        (0, vitest_1.expect)(completed).toBe(true);
        abortController.abort();
    });
    const subscription = (0, subscribe_1.subscribe)(trigger);
    await subscription.trigger([]);
    await subscription.trigger([]);
    (0, vitest_1.expect)(onChange.callCount).toBe(2);
});
(0, vitest_1.it)('waits for onChange to complete when { interruptible: true } when it receives a shutdown signal', async () => {
    const abortController = new AbortController();
    const trigger = {
        ...defaultTrigger,
        abortSignal: abortController.signal,
    };
    let resolved = false;
    const subscriptionMock = sinon.mock(trigger);
    subscriptionMock
        .expects('onChange')
        .once()
        .callsFake(() => {
        return new Promise((resolve) => {
            (0, node_timers_1.setTimeout)(() => {
                resolved = true;
                resolve(null);
            }, 100);
        });
    });
    const subscription = (0, subscribe_1.subscribe)(trigger);
    setImmediate(() => {
        abortController.abort();
    });
    await subscription.trigger([]);
    (0, vitest_1.expect)(subscriptionMock.verify());
    (0, vitest_1.expect)(resolved).toBe(true);
});
(0, vitest_1.it)('retries failing routines', async () => {
    const trigger = {
        ...defaultTrigger,
        retry: {
            retries: 1,
        },
    };
    const subscriptionMock = sinon.mock(trigger);
    const onChange = subscriptionMock.expects('onChange').twice();
    onChange.onFirstCall().rejects(new Error('foo'));
    onChange.onSecondCall().resolves(null);
    const subscription = await (0, subscribe_1.subscribe)(trigger);
    await subscription.trigger([]);
    (0, vitest_1.expect)(onChange.verify());
});
(0, vitest_1.it)('reports { first: true } only for the first event', async () => {
    const trigger = {
        ...defaultTrigger,
    };
    const subscriptionMock = sinon.mock(trigger);
    const onChange = subscriptionMock.expects('onChange').twice();
    onChange.onFirstCall().resolves(null);
    onChange.onSecondCall().resolves(null);
    const subscription = (0, subscribe_1.subscribe)(trigger);
    await subscription.trigger([]);
    await subscription.trigger([]);
    (0, vitest_1.expect)(onChange.args).toMatchObject([
        [
            {
                first: true,
            },
        ],
        [
            {
                first: false,
            },
        ],
    ]);
    (0, vitest_1.expect)(subscriptionMock.verify());
});
(0, vitest_1.it)('retries persistent routine if it exits with success', async () => {
    var _a, _b;
    const trigger = {
        ...defaultTrigger,
        persistent: true,
        retry: {
            maxTimeout: 100,
            retries: 1,
        },
    };
    const onChange = sinon.stub(trigger, 'onChange');
    onChange.resolves(() => {
        return wait(100);
    });
    const subscription = await (0, subscribe_1.subscribe)(trigger);
    void subscription.trigger([]);
    await wait(500);
    (_b = (_a = subscription.activeTask) === null || _a === void 0 ? void 0 : _a.abortController) === null || _b === void 0 ? void 0 : _b.abort();
    (0, vitest_1.expect)(onChange.callCount).toBeGreaterThan(2);
});
(0, vitest_1.it)('retries persistent routine if it exists with error', async () => {
    var _a, _b;
    const trigger = {
        ...defaultTrigger,
        persistent: true,
        retry: {
            maxTimeout: 100,
            retries: 1,
        },
    };
    const onChange = sinon.stub(trigger, 'onChange');
    onChange.resolves(async () => {
        await wait(100);
        throw new Error('foo');
    });
    const subscription = await (0, subscribe_1.subscribe)(trigger);
    void subscription.trigger([]);
    await wait(500);
    (_b = (_a = subscription.activeTask) === null || _a === void 0 ? void 0 : _a.abortController) === null || _b === void 0 ? void 0 : _b.abort();
    (0, vitest_1.expect)(onChange.callCount).toBeGreaterThan(2);
});
(0, vitest_1.it)('stops retrying persistent routine if teardown is called', async () => {
    const trigger = {
        ...defaultTrigger,
        persistent: true,
        retry: {
            maxTimeout: 100,
            retries: 1,
        },
    };
    const onChange = sinon.stub(trigger, 'onChange');
    onChange.resolves(async () => {
        await wait(100);
    });
    const subscription = await (0, subscribe_1.subscribe)(trigger);
    void subscription.trigger([]);
    await wait(500);
    await subscription.teardown();
    await wait(100);
    const firstCallCount = onChange.callCount;
    await wait(500);
    (0, vitest_1.expect)(onChange.callCount).toBe(firstCallCount);
});
(0, vitest_1.it)('does not begin the new routine until the interrupted routine has completed', async () => {
    var _a, _b;
    const trigger = {
        ...defaultTrigger,
        interruptible: true,
        persistent: true,
        retry: {
            maxTimeout: 100,
            retries: 1,
        },
    };
    const onChange = sinon.stub(trigger, 'onChange');
    onChange.resolves(async () => {
        await wait(100);
    });
    const subscription = await (0, subscribe_1.subscribe)(trigger);
    void subscription.trigger([]);
    await wait(10);
    void subscription.trigger([]);
    await wait(10);
    (_b = (_a = subscription.activeTask) === null || _a === void 0 ? void 0 : _a.abortController) === null || _b === void 0 ? void 0 : _b.abort();
    (0, vitest_1.expect)(onChange.callCount).toBe(1);
});
(0, vitest_1.it)('does not begin the new routine until the interrupted routine has completed (multiple-triggers)', async () => {
    var _a, _b;
    const trigger = {
        ...defaultTrigger,
        interruptible: true,
        persistent: true,
        retry: {
            maxTimeout: 100,
            retries: 1,
        },
    };
    const onChange = sinon.stub(trigger, 'onChange');
    onChange.resolves(async () => {
        await wait(100);
    });
    const subscription = await (0, subscribe_1.subscribe)(trigger);
    void subscription.trigger([]);
    await wait(10);
    void subscription.trigger([]);
    void subscription.trigger([]);
    await wait(10);
    (_b = (_a = subscription.activeTask) === null || _a === void 0 ? void 0 : _a.abortController) === null || _b === void 0 ? void 0 : _b.abort();
    (0, vitest_1.expect)(onChange.callCount).toBe(1);
});
//# sourceMappingURL=subscribe.test.js.map