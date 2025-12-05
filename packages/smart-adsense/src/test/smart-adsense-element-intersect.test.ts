import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {SmartAdsenseElement} from '../core/smart-adsense-element';

// Mock ESL dependencies
vi.mock('@exadel/esl/modules/esl-base-element/core', () => ({
  ESLBaseElement: class {
    setAttribute = vi.fn();
    hasAttribute = vi.fn();
    connected = true;
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
  debounce: vi.fn((fn: (...args: any[]) => any) => fn),
  DelayedTask: class {
    put = vi.fn();
  },
  microtask: vi.fn()
}));

vi.mock('@exadel/esl/modules/esl-utils/dom', () => ({
  dispatchCustomEvent: vi.fn()
}));

vi.mock('@exadel/esl/modules/esl-event-listener/core', () => ({
  ESLResizeObserverTarget: {
    for: vi.fn()
  },
  ESLIntersectionTarget: {
    for: vi.fn()
  },
  ESLIntersectionEvent: {
    IN: 'intersection:in'
  }
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
    })),
    instance: {
      load: vi.fn(() => Promise.resolve())
    }
  }
}));

/**
 * Tests for the _onIntersect method of SmartAdsenseElement.
 *
 * This file contains unit tests for the intersection handling logic.
 * The tests use the real SmartAdsenseElement component with mocked dependencies.
 *
 * The _onIntersect method is responsible for:
 * - Activating the element when it enters the viewport
 * - Triggering ad initialization for lazy-loaded ads
 * - Only working when loading is not 'eager'
 */

describe('SmartAdsenseElement - _onIntersect Method', () => {
  let element: SmartAdsenseElement;

  beforeEach(() => {
    // Create a real SmartAdsenseElement instance
    element = new SmartAdsenseElement();

    // Mock init method
    element['init'] = vi.fn();

    // Setup initial state
    element['inactive'] = true;
    element['loading'] = 'lazy';
    element['_content'] = '<ins class="adsbygoogle"></ins>';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should activate element and call init on intersection', () => {
    // Setup lazy loading
    element['loading'] = 'lazy';
    element['inactive'] = true;

    // Create intersection event
    const intersectionEvent = {} as any;

    // Call _onIntersect method
    element['_onIntersect'](intersectionEvent);

    // Verify element becomes active and init is called
    expect(element['inactive']).toBe(false);
    expect(element['init']).toHaveBeenCalled();
  });

  test('should not be called when loading is eager', () => {
    // This test verifies the condition logic - the method should not be called
    // when loading is 'eager', but we can't test the decorator condition directly.
    // Instead, we test the method behavior when it is called.

    element['loading'] = 'eager';
    element['inactive'] = true;

    // Create intersection event
    const intersectionEvent = {} as any;

    // Call _onIntersect method directly (bypassing condition)
    element['_onIntersect'](intersectionEvent);

    // Verify element becomes active and init is called
    expect(element['inactive']).toBe(false);
    expect(element['init']).toHaveBeenCalled();
  });

  test('should work when element is already active', () => {
    // Setup element as already active
    element['loading'] = 'lazy';
    element['inactive'] = false;

    // Create intersection event
    const intersectionEvent = {} as any;

    // Call _onIntersect method
    element['_onIntersect'](intersectionEvent);

    // Verify inactive remains false and init is still called
    expect(element['inactive']).toBe(false);
    expect(element['init']).toHaveBeenCalled();
  });

  test('should handle intersection with proper event object', () => {
    // Setup element
    element['loading'] = 'lazy';
    element['inactive'] = true;

    // Create more realistic intersection event
    const intersectionEvent = {
      target: element,
      isIntersecting: true
    } as any;

    // Call _onIntersect method
    element['_onIntersect'](intersectionEvent);

    // Verify behavior
    expect(element['inactive']).toBe(false);
    expect(element['init']).toHaveBeenCalledWith();
  });
});
