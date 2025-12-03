import {promisifyTimeout, promisifyEvent} from '@exadel/esl/modules/esl-utils/async';

type AsyncTask = () => Promise<unknown>;
type WaitTask = (signal?: AbortSignal) => Promise<unknown>;

interface PromisifyIdleOptions {
  thresholds?: {
    duration?: number;
    ratio?: number;
  };
  timeout?: number;
  debug?: boolean;
  signal?: AbortSignal;
}

const IDLE_THRESHOLD_DURATION = 46.6;
const IDLE_THRESHOLD_RATIO = 0.9;
const IDLE_TIMEOUT = 10000;

export function promisifyIdle(options: PromisifyIdleOptions = {}): Promise<any> {
  const idleThresholdRatio = options.thresholds?.ratio || IDLE_THRESHOLD_RATIO;
  const idleThresholdDuration = options.thresholds?.duration || IDLE_THRESHOLD_DURATION;
  const idleTimeout = options.timeout || IDLE_TIMEOUT;
  const {debug, signal} = options;
  debug && performance.mark('idle.S');

  return new Promise((resolve, reject) => {
    const start = performance.now();
    let previousFrameEnd = start;
    const log: (string | number)[][] = [];

    const last3 = [0, 0, 0];

    function finish(withResolve: boolean, reason?: any): void {
      if (debug) {
        console.table(log);
        console.log(`Idle has ${withResolve ? 'reached' : 'aborted'} after ${performance.now() - start}ms`);
        performance.mark('idle.E');
        performance.measure('idlePromisify', 'idle.S', 'idle.E');
      }
      return withResolve ? resolve(true) : reject(reason);
    }

    const cb: IdleRequestCallback = (deadline: IdleDeadline) => {
      if (signal?.aborted) return finish(false, new Error('Rejected by abort signal'));

      const allocated = deadline.timeRemaining();
      const frameEnd = performance.now() + allocated;
      const frameLength = frameEnd - previousFrameEnd;
      const idleRatio = allocated / frameLength;
      const timeout = Math.max(0, idleTimeout - (performance.now() - start));

      const isBadFrame = frameLength < 15;
      if (!isBadFrame) {
        last3.splice(0, 1);
        last3.push(idleRatio > idleThresholdRatio ? allocated : 0);
      }
      const isIdleNow = last3.reduce((acc, val) => acc + val, 0) > idleThresholdDuration;
      debug && !isBadFrame && log.push([timeout, frameLength, allocated, idleRatio, idleRatio > idleThresholdRatio ? 1 : 0, last3.toString()]);

      if (isIdleNow || deadline.didTimeout) return finish(true);
      !isBadFrame && (previousFrameEnd = frameEnd);
      requestIdleCallback(cb, {timeout});
    };

    requestIdleCallback(cb, {timeout: idleTimeout});
  });
}

export async function asyncSeries(tasks: AsyncTask[]): Promise<void> {
  for (const task of tasks) {
    await task().catch();
  }
}

export function waitAny(tasks: WaitTask[], signal?: AbortSignal): WaitTask {
  return async (abortSignal?: AbortSignal): Promise<void> => {
    const activeSignal = signal ?? abortSignal;
    if (activeSignal) {
      await Promise.race(tasks.map((task) => task(activeSignal)));
      return;
    }

    const controller = new AbortController();
    try {
      await Promise.race(tasks.map((task) => task(controller.signal)));
    } finally {
      controller.abort();
    }
  };
}

export function waitTimeout(timeout: number): WaitTask {
  return async () => promisifyTimeout(timeout);
}

const USER_ACTIVITY_EVENTS = ['keydown', 'mousemove', 'pointerdown', 'wheel'];
export function waitUserActivity(): WaitTask {
  return async (abortSignal: AbortSignal) => {
    await waitAny(
      USER_ACTIVITY_EVENTS.map((event) => (signal: AbortSignal): Promise<Event> => promisifyEvent(document, event, null, {passive: true, signal})),
      abortSignal
    )();
  };
}

export function waitIdle(options: PromisifyIdleOptions = {}): WaitTask {
  return async (abortSignal: AbortSignal) => promisifyIdle({...options, signal: abortSignal});
}
