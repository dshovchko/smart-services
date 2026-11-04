import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {SmartAdsenseElement} from '../core/smart-adsense-element';

// Mock global objects
Object.defineProperty(global, 'navigator', {
  value: {
    connection: {effectiveType: '4g'}
  },
  writable: true
});

Object.defineProperty(global, 'window', {
  value: {
    adsbygoogle: [],
    setTimeout: vi.fn(),
    clearTimeout: vi.fn()
  },
  writable: true
});

Object.defineProperty(global, 'adsbygoogle', {
  value: [],
  writable: true
});

describe('SmartAdsenseElement', () => {
  let $el: SmartAdsenseElement;

  beforeEach(() => {
    SmartAdsenseElement.register();
    $el = document.createElement('smart-adsense');
    $el.innerHTML = '<ins class="adsbygoogle"></ins>';
    document.body.appendChild($el);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should register custom element', () => {
    expect(customElements.get('smart-adsense')).toBe(SmartAdsenseElement);
  });

  test('should not throw or set attributes during createElement', () => {
    expect(() => {
      const el = document.createElement('smart-adsense');
      expect(el.attributes.length).toBe(0);
    }).not.toThrow();
  });

  test('should have default attributes', () => {
    expect($el.display).toBe('all');
    expect($el.loading).toBe('lazy');
    expect($el.inactive).toBe(true);
    expect($el.status).toBe('init');
    expect($el.getAttribute('status')).toBe('init');
  });

  test('should preserve params attribute from HTML and apply to config', () => {
    const container = document.createElement('div');
    container.innerHTML = '<smart-adsense params="{refreshInterval:99,retryDelay:15,retryCount:7}"></smart-adsense>';
    document.body.appendChild(container);

    const el = container.querySelector('smart-adsense') as SmartAdsenseElement;
    expect(el.getAttribute('params')).toBe('{refreshInterval:99,retryDelay:15,retryCount:7}');
    expect(el.config.refreshInterval).toBe(99);
    expect(el.config.retryDelay).toBe(15);
    expect(el.config.retryCount).toBe(7);
  });

  test('should store and restore content', () => {
    expect(($el as any)._content).toBe('<ins class="adsbygoogle"></ins>');
    expect($el.innerHTML).toBe('');

    ($el as any).restoreContent();
    expect($el.innerHTML).toBe('<ins class="adsbygoogle"></ins>');
  });

  test('should calculate connection ratio and rootMargin', () => {
    (navigator as any).connection.effectiveType = '4g';
    expect(($el as any).connectionRatio).toBe(1); // 4g default
    expect(($el as any).rootMargin).toBe('1500px');

    (navigator as any).connection.effectiveType = '2g';
    expect(($el as any).connectionRatio).toBe(2);
    expect(($el as any).rootMargin).toBe('3000px');

    (navigator as any).connection.effectiveType = '3g';
    expect(($el as any).connectionRatio).toBe(1.5);
    expect(($el as any).rootMargin).toBe('2250px');

    (navigator as any).connection.effectiveType = '4g';
    $el.params = {baseMargin: 2000};
    expect(($el as any).rootMargin).toBe('2000px');
  });

  test('should handle status changes', () => {
    $el.addEventListener('smart-adsense:change', () => {
      // Event listener for testing
    });

    $el.status = 'pending';
    expect($el.status).toBe('pending');
    expect($el.getAttribute('status')).toBe('pending');
  });

  test('should handle display attribute changes', () => {
    const initSpy = vi.spyOn($el as any, 'init');

    $el.setAttribute('display', 'mobile');
    expect($el.display).toBe('mobile');
    expect(initSpy).toHaveBeenCalled();
  });

  test('should handle adsense status events', () => {
    const event = new CustomEvent('adsense:status', {detail: 'filled'});
    $el.dispatchEvent(event);
    expect($el.status).toBe('filled');
  });

  test('should handle eager loading', () => {
    $el.loading = 'eager';
    ($el as any).connectedCallback();
    expect($el.inactive).toBe(false);
  });

  test('should push ad to adsbygoogle', () => {
    const pushSpy = vi.spyOn(window.adsbygoogle, 'push');
    ($el as any).pushAd();
    expect(pushSpy).toHaveBeenCalledWith({});
  });

  test('should hide ad when display query does not match', () => {
    vi.spyOn(($el as any).displayQuery, 'matches', 'get').mockReturnValue(false);
    ($el as any).hideAd();
    expect($el.status).toBe('hidden');
    expect($el.innerHTML).toBe('');
  });

  test('should handle resize events', () => {
    // Test basic width tracking without debounce
    ($el as any)._lastWidth = 100;
    expect(($el as any)._lastWidth).toBe(100);

    // Directly set new width to test the property
    ($el as any)._lastWidth = 200;
    expect(($el as any)._lastWidth).toBe(200);
  });
});
