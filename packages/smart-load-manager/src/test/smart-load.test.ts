import {describe, test, expect, vi, afterEach, beforeEach} from 'vitest';
import {createDeferred} from '@exadel/esl/modules/esl-utils/async';
import {memoize} from '@exadel/esl/modules/esl-utils/decorators';
import {SmartLoad} from '../core/smart-load';
import {SmartService} from '../core/smart-service';

describe('SmartLoad', () => {
  const log: string[] = [];
  class MockService extends SmartService {
    public override load = vi.fn(() => {
      log.push(this._config.name || 'mock');
      return Promise.resolve(true);
    });
  }

  beforeEach(() => {
    // Reset document state before each test
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
    });
  });

  afterEach(() => {
    SmartLoad['_whenStarted'] = createDeferred<void>();
    // Clear memoization cache for fresh state in each test
    memoize.clear(SmartLoad, 'onLoaded');
    memoize.clear(SmartLoad, 'onComplete');
    memoize.clear(SmartLoad, 'defaultMutex');
    memoize.clear(SmartLoad, 'now');
  });

  test('now should be resolved', async () => {
    await expect(SmartLoad.now()).resolves.toBeUndefined();
  });

  test('onLoaded should resolve when document is loaded', async () => {
    Object.defineProperty(document, 'readyState', {
      value: 'interactive',
      writable: true,
    });
    await expect(SmartLoad.onLoaded()).resolves.toBeUndefined();
  });

  test('onLoaded should wait for loading to complete', async () => {
    // Simulate loading state
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
    });

    const promise = SmartLoad.onLoaded();
    let resolved = false;
    promise.then(() => { resolved = true; });

    // Should not resolve immediately when loading
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resolved).toBe(false);

    // Simulate state change to interactive
    Object.defineProperty(document, 'readyState', {
      value: 'interactive',
      writable: true,
    });

    // Trigger readystatechange event
    const event = new Event('readystatechange');
    document.dispatchEvent(event);

    // Should resolve now
    await expect(promise).resolves.toBeUndefined();
  });

  test('onLoaded should resolve immediately if already loaded', async () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
    });

    const startTime = Date.now();
    await SmartLoad.onLoaded();
    const endTime = Date.now();

    // Should resolve almost immediately (within 5ms tolerance)
    expect(endTime - startTime).toBeLessThan(5);
  });

  test('onComplete should resolve when document is complete', async () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
    });
    await expect(SmartLoad.onComplete()).resolves.toBeUndefined();
  });

  test('onComplete should wait for complete state', async () => {
    // Simulate interactive state
    Object.defineProperty(document, 'readyState', {
      value: 'interactive',
      writable: true,
    });

    const promise = SmartLoad.onComplete();
    let resolved = false;
    promise.then(() => { resolved = true; });

    // Should not resolve immediately when interactive
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resolved).toBe(false);

    // Simulate state change to complete
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
    });

    // Trigger readystatechange event
    const event = new Event('readystatechange');
    document.dispatchEvent(event);

    // Should resolve now
    await expect(promise).resolves.toBeUndefined();
  });

  test('onComplete should not resolve on loading->interactive transition', async () => {
    // Start with loading state
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
    });

    const promise = SmartLoad.onComplete();
    let resolved = false;
    promise.then(() => { resolved = true; });

    // Change to interactive (not complete)
    Object.defineProperty(document, 'readyState', {
      value: 'interactive',
      writable: true,
    });

    const event = new Event('readystatechange');
    document.dispatchEvent(event);

    // Should still not resolve
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(resolved).toBe(false);

    // Now change to complete
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
    });

    document.dispatchEvent(new Event('readystatechange'));

    // Should resolve now
    await expect(promise).resolves.toBeUndefined();
  });

  test('onLoaded and onComplete should be memoized', async () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
    });

    // Multiple calls should return the same promise instance
    const promise1 = SmartLoad.onLoaded();
    const promise2 = SmartLoad.onLoaded();
    const promise3 = SmartLoad.onComplete();
    const promise4 = SmartLoad.onComplete();

    expect(promise1).toBe(promise2);
    expect(promise3).toBe(promise4);
  });

  test('onLoaded should work with different document states', async () => {
    const states = ['loading', 'interactive', 'complete'];

    for (const state of states) {
      // Clear cache before each iteration
      memoize.clear(SmartLoad, 'onLoaded');

      Object.defineProperty(document, 'readyState', {
        value: state,
        writable: true,
      });

      const promise = SmartLoad.onLoaded();

      if (state === 'loading') {
        // Should not resolve immediately
        let resolved = false;
        promise.then(() => { resolved = true; });
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(resolved).toBe(false);
      } else {
        // Should resolve immediately for 'interactive' and 'complete'
        await expect(promise).resolves.toBeUndefined();
      }
    }
  });

  test('onComplete should only resolve for complete state', async () => {
    const states = ['loading', 'interactive'];

    for (const state of states) {
      // Clear cache before each iteration
      memoize.clear(SmartLoad, 'onComplete');

      Object.defineProperty(document, 'readyState', {
        value: state,
        writable: true,
      });

      const promise = SmartLoad.onComplete();
      let resolved = false;
      promise.then(() => { resolved = true; });

      // Should not resolve for loading or interactive
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(resolved).toBe(false);
    }

    // Test complete state
    memoize.clear(SmartLoad, 'onComplete');
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
    });

    await expect(SmartLoad.onComplete()).resolves.toBeUndefined();
  });

  test('start should resolve _whenStarted promise', async () => {
    SmartLoad.start();
    await expect(SmartLoad['_whenStarted'].promise).resolves.toBeUndefined();
  });

  test('defaultMutex should be SmartLoad.now', async () => {
    const originalCreateMutex = SmartLoad['createMutex'];
    SmartLoad['createMutex'] = vi.fn().mockResolvedValue(undefined);
    SmartLoad.defaultMutex();
    expect(SmartLoad['createMutex']).toHaveBeenCalledWith(SmartLoad.now);
    SmartLoad['createMutex'] = originalCreateMutex;
  });

  test('defaultMutex should resolve after starting', async () => {
    SmartLoad.start();
    await expect(SmartLoad.defaultMutex()).resolves.toBeUndefined();
  });

  test('queue should set mutex on service', async () => {
    const mockService = MockService.create({name: 'mock', url: 'mock-url'});
    SmartLoad.queue(mockService);
    expect(mockService.mutex).toBeInstanceOf(Promise);
  });

  test('queue should set mutex with SmartLoad.defaultMutex() by default', async () => {
    const mockService = MockService.create({name: 'mock', url: 'mock-url'});
    SmartLoad.queue(mockService);
    expect(mockService.mutex).toEqual(SmartLoad.defaultMutex());
  });

  test('queue should call load on queued services in order', async () => {
    log.length = 0;
    const mockService1 = MockService.create({name: 'mock1', url: 'mock-url-1'});
    const mockService2 = MockService.create({name: 'mock2', url: 'mock-url-2'});
    SmartLoad.queue(mockService2);
    SmartLoad.queue(mockService1, mockService2.load);
    SmartLoad.start();
    expect(log).toEqual(['mock2', 'mock1']);
  });
});
