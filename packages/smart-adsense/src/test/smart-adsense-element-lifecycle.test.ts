import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {SmartAdsenseElement} from '../core/smart-adsense-element';

// Mock ESL dependencies
vi.mock('@exadel/esl/modules/esl-base-element/core', () => ({
  ESLBaseElement: class {
    setAttribute = vi.fn();
    hasAttribute = vi.fn(() => false);
    connected = true;
    _onStatusChange = vi.fn();
    connectedCallback() {
      this.connected = true;
    }
    disconnectedCallback() {
      this.connected = false;
    }
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
 * Tests for the lifecycle methods of SmartAdsenseElement.
 *
 * This file contains unit tests for the connection/disconnection lifecycle.
 * The tests use the real SmartAdsenseElement component with mocked dependencies.
 *
 * The lifecycle methods are responsible for:
 * - Setting up the element when connected to DOM
 * - Cleaning up when disconnected from DOM
 * - Managing inactive state based on loading strategy
 * - Storing and restoring content
 * - Initializing accessibility attributes
 */

describe('SmartAdsenseElement - Lifecycle Methods', () => {
  let element: SmartAdsenseElement;

  beforeEach(() => {
    // Create a real SmartAdsenseElement instance
    element = new SmartAdsenseElement();

    // Mock methods that will be called during lifecycle but keep storeContent, restoreContent, initA11y real
    element['init'] = vi.fn();

    // Setup initial state
    element['loading'] = 'lazy';
    element['inactive'] = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connectedCallback', () => {
    test('should set inactive to true when loading is lazy', () => {
      // Setup lazy loading
      element['loading'] = 'lazy';

      // Call connectedCallback
      (element as any).connectedCallback();

      // Verify inactive is set to true for lazy loading
      expect(element['inactive']).toBe(true);
    });

    test('should set inactive to false when loading is eager', () => {
      // Setup eager loading
      element['loading'] = 'eager';

      // Call connectedCallback
      (element as any).connectedCallback();

      // Verify inactive is set to false for eager loading
      expect(element['inactive']).toBe(false);
    });

    test('should call all required initialization methods', () => {
      // Spy on the real methods
      const storeContentSpy = vi.spyOn(element as any, 'storeContent');
      const initA11ySpy = vi.spyOn(element as any, 'initA11y');

      // Call connectedCallback
      (element as any).connectedCallback();

      // Verify all initialization methods are called
      expect(storeContentSpy).toHaveBeenCalled();
      expect(element['init']).toHaveBeenCalled();
      expect(initA11ySpy).toHaveBeenCalled();
    });

    test('should call methods in correct order', () => {
      const callOrder: string[] = [];

      // Spy on the real methods and track order
      vi.spyOn(element as any, 'storeContent').mockImplementation(() => callOrder.push('storeContent'));
      element['init'] = vi.fn().mockImplementation(() => {
        callOrder.push('init');
        return Promise.resolve();
      });
      vi.spyOn(element as any, 'initA11y').mockImplementation(() => callOrder.push('initA11y'));

      // Call connectedCallback
      (element as any).connectedCallback();

      // Verify methods are called in correct order
      expect(callOrder).toEqual(['storeContent', 'init', 'initA11y']);
    });
  });

  describe('disconnectedCallback', () => {
    test('should call restoreContent when disconnected', () => {
      // Spy on the real method
      const restoreContentSpy = vi.spyOn(element as any, 'restoreContent');

      // Call disconnectedCallback
      (element as any).disconnectedCallback();

      // Verify restoreContent is called
      expect(restoreContentSpy).toHaveBeenCalled();
    });

    test('should clean up properly when element is removed', () => {
      // Setup element as connected first
      (element as any).connectedCallback();
      vi.clearAllMocks();

      // Spy on the real method
      const restoreContentSpy = vi.spyOn(element as any, 'restoreContent');

      // Now disconnect
      (element as any).disconnectedCallback();

      // Verify cleanup
      expect(restoreContentSpy).toHaveBeenCalled();
    });
  });

  describe('storeContent method', () => {
    test('should store initial content and clear innerHTML', () => {
      const initialContent = '<ins class="adsbygoogle"></ins>';

      // Create a proper mock for innerHTML
      let mockContent = initialContent;
      Object.defineProperty(element, 'innerHTML', {
        get: () => mockContent,
        set: (value: string) => { mockContent = value; },
        configurable: true
      });

      // Call storeContent directly
      (element as any).storeContent();

      // Verify content is stored and innerHTML is cleared
      expect(element['_content']).toBe(initialContent);
      expect(mockContent).toBe('');
    });
  });

  describe('restoreContent method', () => {
    test('should restore stored content to innerHTML', () => {
      const storedContent = '<ins class="adsbygoogle"></ins>';
      element['_content'] = storedContent;

      let mockContent = '';
      Object.defineProperty(element, 'innerHTML', {
        get: () => mockContent,
        set: (value: string) => { mockContent = value; },
        configurable: true
      });

      // Call restoreContent directly
      (element as any).restoreContent();

      // Verify content is restored
      expect(mockContent).toBe(storedContent);
    });
  });

  describe('initA11y method', () => {
    test('should set role attribute when not present', () => {
      // Mock hasAttribute to return false (no role attribute)
      element.hasAttribute = vi.fn(() => false);

      // Call initA11y directly
      (element as any).initA11y();

      // Verify role attribute is set
      expect(element.setAttribute).toHaveBeenCalledWith('role', 'complementary');
    });

    test('should not set role attribute when already present', () => {
      // Mock hasAttribute to return true (role attribute exists)
      element.hasAttribute = vi.fn((attr: string) => attr === 'role');

      // Call initA11y directly
      (element as any).initA11y();

      // Verify role attribute is not set
      expect(element.setAttribute).not.toHaveBeenCalledWith('role', 'complementary');
    });
  });

  describe('complete lifecycle flow', () => {
    test('should handle connect -> disconnect -> connect cycle', () => {
      // First connection
      const storeContentSpy = vi.spyOn(element as any, 'storeContent');
      const initA11ySpy = vi.spyOn(element as any, 'initA11y');
      const restoreContentSpy = vi.spyOn(element as any, 'restoreContent');

      (element as any).connectedCallback();
      expect(storeContentSpy).toHaveBeenCalledTimes(1);
      expect(element['init']).toHaveBeenCalledTimes(1);
      expect(initA11ySpy).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Disconnection
      (element as any).disconnectedCallback();
      expect(restoreContentSpy).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // Second connection
      (element as any).connectedCallback();
      expect(storeContentSpy).toHaveBeenCalledTimes(1);
      expect(element['init']).toHaveBeenCalledTimes(1);
      expect(initA11ySpy).toHaveBeenCalledTimes(1);
    });
  });
});
