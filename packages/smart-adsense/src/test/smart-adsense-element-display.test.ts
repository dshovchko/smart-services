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

const mockMediaQuery = {
  matches: true,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

vi.mock('@exadel/esl/modules/esl-media-query/core', () => ({
  ESLMediaQuery: {
    for: vi.fn(() => mockMediaQuery)
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
 * Tests for the _onDisplayChange method of SmartAdsenseElement.
 *
 * This file contains unit tests for the display change handling logic.
 * The tests use the real SmartAdsenseElement component with mocked dependencies.
 *
 * The _onDisplayChange method is responsible for:
 * - Responding to media query changes
 * - Reinitializing the ad when display conditions change
 * - Managing the display query state
 */

describe('SmartAdsenseElement - _onDisplayChange Method', () => {
  let element: SmartAdsenseElement;

  beforeEach(() => {
    // Create a real SmartAdsenseElement instance
    element = new SmartAdsenseElement();

    // Mock init method
    element['init'] = vi.fn();

    // Setup initial state
    element['display'] = 'all';
    element['_content'] = '<ins class="adsbygoogle"></ins>';

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should call init when display change event occurs', () => {
    // Create media change event
    const mediaChangeEvent = {
      type: 'change',
      target: mockMediaQuery,
      matches: true
    } as any;

    // Call _onDisplayChange method
    element['_onDisplayChange'](mediaChangeEvent);

    // Verify init is called
    expect(element['init']).toHaveBeenCalled();
  });

  test('should call init when called without event', () => {
    // Call _onDisplayChange method without event
    element['_onDisplayChange']();

    // Verify init is called
    expect(element['init']).toHaveBeenCalled();
  });

  test('should handle media query matching state change', () => {
    // Setup media query as not matching
    mockMediaQuery.matches = false;

    // Create media change event for non-matching query
    const mediaChangeEvent = {
      type: 'change',
      target: mockMediaQuery,
      matches: false
    } as any;

    // Call _onDisplayChange method
    element['_onDisplayChange'](mediaChangeEvent);

    // Verify init is still called (it will handle the non-matching state)
    expect(element['init']).toHaveBeenCalled();
  });

  test('should handle multiple consecutive display changes', () => {
    // First change
    element['_onDisplayChange']();
    expect(element['init']).toHaveBeenCalledTimes(1);

    // Second change
    element['_onDisplayChange']();
    expect(element['init']).toHaveBeenCalledTimes(2);

    // Third change with event
    const mediaChangeEvent = {
      type: 'change',
      target: mockMediaQuery,
      matches: true
    } as any;

    element['_onDisplayChange'](mediaChangeEvent);
    expect(element['init']).toHaveBeenCalledTimes(3);
  });

  test('should work with different display query values', () => {
    // Test with different display values
    const testCases = [
      'all',
      '(min-width: 768px)',
      '(max-width: 1024px)',
      'screen and (min-width: 480px)'
    ];

    testCases.forEach((displayValue) => {
      element['display'] = displayValue;
      element['_onDisplayChange']();
      expect(element['init']).toHaveBeenCalled();
      vi.clearAllMocks();
    });
  });
});
