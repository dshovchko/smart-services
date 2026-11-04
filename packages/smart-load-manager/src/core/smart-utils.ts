import {promisifyTimeout, promisifyEvent} from '@exadel/esl/modules/esl-utils/async';

type AsyncTask = () => Promise<unknown>;
type WaitTask = (signal?: AbortSignal) => Promise<unknown>;

/** Options for promisifyIdle function */
export interface PromisifyIdleOptions {
  /** Thresholds to determine idle state */
  thresholds?: {
    /** Total idle time threshold in ms */
    duration?: number;
    /** Idle time to frame time ratio threshold */
    ratio?: number;
  };
  /** Maximum timeout in ms */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** AbortSignal to cancel the idle detection */
  signal?: AbortSignal;
}

/** Default idle detection thresholds and timeout */
const IDLE_THRESHOLD_DURATION = 46.6;
const IDLE_THRESHOLD_RATIO = 0.9;
const IDLE_TIMEOUT = 10000;

const reqIdle = (cb: IdleRequestCallback, opts?: IdleRequestOptions): number => (
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(cb, opts)
    : setTimeout(() => cb({didTimeout: false, timeRemaining: () => 50}), 1) as unknown as number
);
const cancelIdle = (id?: number): void => {
  if (id === undefined) return;
  typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id);
};

/** Promisify requestIdleCallback with enhanced idle detection
 * The promise resolves when the browser is considered idle based on:
 * - ratio of idle time to frame time over a series of frames
 * - total idle time accumulated over a series of frames
 * - maximum timeout
 *
 * @param options - Configuration options for idle detection
 * @returns Promise that resolves when idle state is reached or rejects on abort
 */
export function promisifyIdle(options: PromisifyIdleOptions = {}): Promise<any> {
  const idleThresholdRatio = options.thresholds?.ratio || IDLE_THRESHOLD_RATIO;
  const idleThresholdDuration = options.thresholds?.duration || IDLE_THRESHOLD_DURATION;
  const idleTimeout = options.timeout || IDLE_TIMEOUT;
  const {debug, signal} = options;
  debug && performance.mark('idle.S');

  return new Promise((resolve, reject) => {
    const start = performance.now();
    let previousFrameEnd = start;
    let idleId: number | undefined;
    let settled = false;
    const log: (string | number)[][] = [];
    const last3 = [0, 0, 0];

    function finish(withResolve: boolean, reason?: any): void {
      if (settled) return;
      settled = true;
      !withResolve && cancelIdle(idleId);
      signal?.removeEventListener('abort', onAbort);
      if (debug) {
        console.table(log);
        console.log(`Idle has ${withResolve ? 'reached' : 'aborted'} after ${performance.now() - start}ms`);
        performance.mark('idle.E');
        performance.measure('idlePromisify', 'idle.S', 'idle.E');
      }
      return withResolve ? resolve(true) : reject(reason);
    }
    const onAbort = (): void => finish(false, new Error('Rejected by abort signal'));
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, {once: true});

    const cb: IdleRequestCallback = (deadline: IdleDeadline) => {
      if (signal?.aborted) return onAbort();
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
      idleId = reqIdle(cb, {timeout});
    };

    idleId = reqIdle(cb, {timeout: idleTimeout});
  });
}

/** Executes asynchronous tasks in series
 * Each task starts after the previous one has completed.
 *
 * @param tasks - Array of asynchronous tasks to execute
 * @returns Promise that resolves when all tasks have completed
 */
export async function asyncSeries(tasks: AsyncTask[]): Promise<void> {
  for (const task of tasks) {
    await task().catch(() => void 0);
  }
}

/** Executes multiple wait tasks in parallel
 * Resolves when any of the tasks completes.
 *
 * @param tasks - Array of wait tasks to execute
 * @param signal - Optional AbortSignal to cancel the wait
 * @returns A wait task that resolves when any of the input tasks completes
 */
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

/** Creates a wait task that resolves after a specified timeout
 *
 * @param timeout - The timeout duration in milliseconds
 * @returns A wait task that resolves after the specified timeout
 */
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

/** Creates a wait task that resolves when the browser is idle
 *
 * @param options - Configuration options for idle detection
 * @returns A wait task that resolves when the browser is idle
 */
export function waitIdle(options: PromisifyIdleOptions = {}): WaitTask {
  return async (abortSignal?: AbortSignal) => promisifyIdle({...options, signal: abortSignal ?? options.signal});
}
