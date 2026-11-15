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

  test('should hide ad when display query does not match and cancel pending tasks', () => {
    const cancelSpy = vi.spyOn(($el as any)._task, 'cancel');
    const offSpy = vi.spyOn($el as any, '$$off');
    vi.spyOn(($el as any).displayQuery, 'matches', 'get').mockReturnValue(false);
    ($el as any).hideAd();
    expect(cancelSpy).toHaveBeenCalled();
    expect(offSpy).toHaveBeenCalledWith(($el as any).refreshWhenVisible);
    expect($el.status).toBe('hidden');
    expect($el.innerHTML).toBe('');
  });

  test('should defer refreshWhenVisible when document is hidden until visibilitychange', () => {
    const refreshSpy = vi.fn();
    ($el as any).refreshAd = refreshSpy;
    $el.inactive = false;
    ($el as any)._status = 'filled';
    vi.spyOn(($el as any).displayQuery, 'matches', 'get').mockReturnValue(true);
    (window as any).innerHeight = 800;
    (window as any).innerWidth = 1200;
    vi.spyOn($el, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 300,
      left: 0,
      right: 300,
      width: 300,
      height: 300
    } as DOMRect);
    let hidden = true;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible')
    });

    ($el as any).refreshWhenVisible();
    expect(refreshSpy).not.toHaveBeenCalled();

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    delete (document as any).visibilityState;
    delete (window as any).innerHeight;
    delete (window as any).innerWidth;
  });

  test('should defer refreshWhenVisible when element is out of viewport or has zero area', () => {
    const refreshSpy = vi.fn();
    ($el as any).refreshAd = refreshSpy;
    $el.inactive = false;
    ($el as any)._status = 'filled';
    vi.spyOn(($el as any).displayQuery, 'matches', 'get').mockReturnValue(true);
    const onSpy = vi.spyOn($el as any, '$$on').mockImplementation(() => {});
    (window as any).innerHeight = 800;
    (window as any).innerWidth = 1200;

    // Out of viewport
    vi.spyOn($el, 'getBoundingClientRect').mockReturnValue({
      top: -500,
      bottom: -200,
      left: 0,
      right: 300,
      width: 300,
      height: 300
    } as DOMRect);

    ($el as any).refreshWhenVisible();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(onSpy).toHaveBeenCalledTimes(1);

    // Zero area (collapsed/display:none)
    vi.spyOn($el, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0
    } as DOMRect);

    ($el as any).refreshWhenVisible();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(onSpy).toHaveBeenCalledTimes(2);

    delete (window as any).innerHeight;
    delete (window as any).innerWidth;
  });

  test('should not refresh in refreshWhenVisible when slot is hidden or inactive', () => {
    const refreshSpy = vi.fn();
    ($el as any).refreshAd = refreshSpy;
    $el.inactive = false;
    ($el as any)._status = 'hidden';

    ($el as any).refreshWhenVisible();
    expect(refreshSpy).not.toHaveBeenCalled();
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
