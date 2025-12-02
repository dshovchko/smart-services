import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {SmartAdsenseElement} from '../core/smart-adsense-element';

// Mock ESL dependencies
vi.mock('@exadel/esl/modules/esl-base-element/core', () => ({
  ESLBaseElement: class {
    setAttribute = vi.fn();
    _onStatusChange = vi.fn();
  }
}));

vi.mock('@exadel/esl/modules/esl-utils/decorators', () => ({
  attr: () => () => {},
  boolAttr: () => () => {},
  bind: () => () => {},
  decorate: () => () => {},
  jsonAttr: () => () => {},
  listen: () => () => {},
  memoize: () => () => {},
  prop: () => () => {}
}));

vi.mock('@exadel/esl/modules/esl-utils/async', () => ({
  debounce: vi.fn(),
  DelayedTask: class {
    put = vi.fn();
  },
  microtask: vi.fn()
}));

vi.mock('@exadel/esl/modules/esl-utils/dom', () => ({
  dispatchCustomEvent: vi.fn()
}));

vi.mock('@exadel/esl/modules/esl-event-listener/core', () => ({
  ESLResizeObserverTarget: class {},
  ESLIntersectionTarget: class {},
  ESLIntersectionEvent: class {}
}));

vi.mock('@exadel/esl/modules/esl-media-query/core', () => ({
  ESLMediaQuery: {
    for: vi.fn(() => ({matches: true}))
  }
}));

vi.mock('../core/smart-adsense', () => ({
  SmartAdsense: {
    config: vi.fn(() => ({
      name: 'Adsense',
      retryCount: 3,
      retryDelay: 5,
      refreshInterval: 30,
      refreshOnResize: false,
      attrs: {crossorigin: 'anonymous'}
    }))
  }
}));

/**
 * Tests for the _onAdsenseStatusChange method of SmartAdsenseElement.
 *
 * This file contains unit tests for the status change handling logic.
 * The tests use the real SmartAdsenseElement component with mocked dependencies.
 *
 * The _onAdsenseStatusChange method is responsible for:
 * - Updating the element's status
 * - Scheduling retries for 'unfilled' ads based on retry configuration
 * - Scheduling periodic refreshes for all other statuses based on refresh configuration
 */

describe('SmartAdsenseElement - _onAdsenseStatusChange Method', () => {
  let element: SmartAdsenseElement;

  // Helper to create base config
  const createConfig = (overrides = {}) => ({
    name: 'Adsense',
    retryCount: 3,
    retryDelay: 5,
    refreshInterval: 30,
    refreshOnResize: false,
    debug: false,
    attrs: {crossorigin: 'anonymous' as const},
    ...overrides
  });

  beforeEach(() => {
    // Create a real SmartAdsenseElement instance
    element = new SmartAdsenseElement();

    // Mock the task put method for verification
    vi.spyOn(element['_task'], 'put');

    // Mock refreshAd method
    element['refreshAd'] = vi.fn();

    // Reset retries counter
    element['_retries'] = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should handle "unfilled" status with retry logic', () => {
    // Setup initial state
    element['_retries'] = 1;

    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](event);

    // Verify status is updated
    expect(element.status).toBe('unfilled');

    // Verify retry is scheduled
    expect(element['_task'].put).toHaveBeenCalledWith(element['refreshAd'], 5000); // retryDelay * 1000
  });

  test('should not retry when retry count is exceeded', () => {
    // Setup state where retries exceed retryCount
    element['_retries'] = 5; // More than retryCount (3)
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      retryCount: 3
    }));

    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](event);

    // Verify status is updated but no retry is scheduled
    expect(element.status).toBe('unfilled');
    expect(element['_task'].put).not.toHaveBeenCalled();
  });

  test('should retry when retryCount is 0 (unlimited retries)', () => {
    // Setup unlimited retries
    element['_retries'] = 10;
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      retryCount: 0 // Unlimited
    }));

    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](event);

    // Verify retry is scheduled even with high retry count
    expect(element['_task'].put).toHaveBeenCalledWith(element['refreshAd'], 5000);
  });

  test('should not retry when retryDelay is 0', () => {
    // Setup no retry delay
    element['_retries'] = 1;
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      retryDelay: 0
    }));

    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](event);

    // Verify no retry is scheduled
    expect(element.status).toBe('unfilled');
    expect(element['_task'].put).not.toHaveBeenCalled();
  });

  test('should handle "filled" status with refresh interval', () => {
    // Mock Math.random to have predictable results
    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0.5);

    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'filled'});
    element['_onAdsenseStatusChange'](event);

    // Verify status is updated
    expect(element.status).toBe('filled');

    // Verify refresh is scheduled with random component
    // refreshInterval + Math.random() = 30 + 0.5 = 30.5 seconds = 30500ms
    expect(element['_task'].put).toHaveBeenCalledWith(element['refreshAd'], 30500);

    // Restore Math.random
    Math.random = originalRandom;
  });

  test('should not schedule refresh when refreshInterval is 0', () => {
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      refreshInterval: 0
    }));

    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'filled'});
    element['_onAdsenseStatusChange'](event);

    // Verify status is updated but no refresh is scheduled
    expect(element.status).toBe('filled');
    expect(element['_task'].put).not.toHaveBeenCalled();
  });

  test('should handle "pending" status and schedule refresh if refreshInterval > 0', () => {
    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'pending'});
    element['_onAdsenseStatusChange'](event);

    // Verify status is updated and refresh is scheduled (because refreshInterval = 30)
    expect(element.status).toBe('pending');
    expect(element['_task'].put).toHaveBeenCalledTimes(1);
  });

  test('should handle "failed" status and schedule refresh if refreshInterval > 0', () => {
    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'failed'});
    element['_onAdsenseStatusChange'](event);

    // Verify status is updated and refresh is scheduled (because refreshInterval = 30)
    expect(element.status).toBe('failed');
    expect(element['_task'].put).toHaveBeenCalledTimes(1);
  });

  test('should handle "hidden" status and schedule refresh if refreshInterval > 0', () => {
    // Create and dispatch event
    const event = new CustomEvent('adsense:status', {detail: 'hidden'});
    element['_onAdsenseStatusChange'](event);

    // Verify status is updated and refresh is scheduled (because refreshInterval = 30)
    expect(element.status).toBe('hidden');
    expect(element['_task'].put).toHaveBeenCalledTimes(1);
  });

  test('should not schedule refresh for non-unfilled status when refreshInterval is 0', () => {
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      refreshInterval: 0
    }));

    // Test with different statuses
    const statuses = ['pending', 'failed', 'hidden', 'filled'];

    statuses.forEach((status) => {
      vi.clearAllMocks(); // Clear previous calls
      const event = new CustomEvent('adsense:status', {detail: status});
      element['_onAdsenseStatusChange'](event);

      // Verify no refresh is scheduled
      expect(element['_task'].put).not.toHaveBeenCalled();
    });
  });

  test('should use correct timing calculations for different retry delays', () => {
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      retryDelay: 10
    }));
    element['_retries'] = 1;

    const unfilledEvent = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](unfilledEvent);

    expect(element['_task'].put).toHaveBeenCalledWith(element['refreshAd'], 10000); // 10 * 1000
  });

  test('should use correct timing calculations for refresh intervals', () => {
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      refreshInterval: 60
    }));

    // Mock Math.random for predictable test
    const originalRandom = Math.random;
    Math.random = vi.fn(() => 0.25);

    const filledEvent = new CustomEvent('adsense:status', {detail: 'filled'});
    element['_onAdsenseStatusChange'](filledEvent);

    expect(element['_task'].put).toHaveBeenCalledWith(element['refreshAd'], 60250); // (60 + 0.25) * 1000

    // Restore Math.random
    Math.random = originalRandom;
  });

  test('should log appropriate console messages', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({debug: true}));

    // Test unfilled retry message
    element['_retries'] = 2;
    const unfilledEvent = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](unfilledEvent);

    expect(consoleSpy).toHaveBeenCalledWith('Ad status:', 'unfilled');
    expect(consoleSpy).toHaveBeenCalledWith('Ad unfilled will be reattempted in 5s (2)');

    consoleSpy.mockClear();

    // Test filled refresh message
    const filledEvent = new CustomEvent('adsense:status', {detail: 'filled'});
    element['_onAdsenseStatusChange'](filledEvent);

    expect(consoleSpy).toHaveBeenCalledWith('Ad status:', 'filled');
    expect(consoleSpy).toHaveBeenCalledWith('Refresh interval:', 30);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ad filled will be refreshed in 30s')
    );

    consoleSpy.mockRestore();
  });

  test('should handle edge case where both retry and refresh conditions are met', () => {
    // Test that unfilled takes precedence over other logic
    element['_retries'] = 1;
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      retryDelay: 3,
      refreshInterval: 20
    }));

    const unfilledEvent = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](unfilledEvent);

    // Should only schedule retry, not refresh
    expect(element['_task'].put).toHaveBeenCalledTimes(1);
    expect(element['_task'].put).toHaveBeenCalledWith(element['refreshAd'], 3000);
  });

  test('should stop retrying once retry limit is reached', () => {
    // Exact boundary where _retries equals retryCount
    element['_retries'] = 3;
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      retryCount: 3
    }));

    const unfilledEvent = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](unfilledEvent);

    expect(element['_task'].put).not.toHaveBeenCalled();
  });

  test('should handle boundary condition just over retry count', () => {
    // Test one over the boundary
    element['_retries'] = 4;
    // Override config for this test
    vi.spyOn(element, 'config', 'get').mockReturnValue(createConfig({
      retryCount: 3
    }));

    const unfilledEvent = new CustomEvent('adsense:status', {detail: 'unfilled'});
    element['_onAdsenseStatusChange'](unfilledEvent);

    // Should not schedule retry since retryCount < _retries (3 < 4)
    expect(element['_task'].put).not.toHaveBeenCalled();
  });
});
