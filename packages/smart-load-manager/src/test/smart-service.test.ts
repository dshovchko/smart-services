import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';

// Mock the ESL utilities
vi.mock('@exadel/esl/modules/esl-utils/dom', () => ({
  loadScript: vi.fn(),
  setAttr: vi.fn()
}));

// Import the mocked loadScript
import {loadScript} from '@exadel/esl/modules/esl-utils/dom';
import {SmartService, type SmartServiceOptions} from '../core/smart-service';

describe('SmartService', () => {
  let service: SmartService;
  const mockConfig: SmartServiceOptions = {
    name: 'test-service',
    url: 'https://example.com/script.js',
    attrs: {crossorigin: 'anonymous'},
    debug: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset static properties
    SmartService['_instance'] = undefined as any;
    SmartService['_config'] = {name: 'service', debug: false};

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    service = SmartService.create(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Static methods', () => {
    test('config should set and get configuration', () => {
      const newConfig = {name: 'new-service', url: 'https://new.com/script.js'};
      const result = SmartService.config(newConfig);

      expect(result).toEqual({...{name: 'service', debug: false}, ...newConfig});
    });

    test('config should return current configuration when called without arguments', () => {
      const result = SmartService.config();
      expect(result).toEqual({name: 'service', debug: false});
    });

    test('create should return new instance with provided config', () => {
      const newService = SmartService.create(mockConfig);
      expect(newService).toBeInstanceOf(SmartService);
      expect(newService['_config']).toEqual(mockConfig);
    });

    test('instance should return singleton instance', () => {
      const instance1 = SmartService.instance;
      const instance2 = SmartService.instance;

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(SmartService);
    });

    test('load static method should call instance load', async () => {
      const mockLoad = vi.fn().mockResolvedValue(true);
      vi.spyOn(SmartService, 'instance', 'get').mockReturnValue({
        load: mockLoad
      } as any);

      const result = await SmartService.load();
      expect(mockLoad).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('preload static method should call instance preload', async () => {
      const mockPreload = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(SmartService, 'instance', 'get').mockReturnValue({
        preload: mockPreload
      } as any);

      await SmartService.preload();
      expect(mockPreload).toHaveBeenCalled();
    });
  });

  describe('Instance properties', () => {
    test('isLoaded should return false initially', () => {
      expect(service.isLoaded).toBe(false);
    });

    test('isLoaded should return true after successful load', async () => {
      (loadScript as any).mockResolvedValue(undefined);

      await service.load();

      expect(service.isLoaded).toBe(true);
    });

    test('mutex should be settable and gettable', async () => {
      const newMutex = Promise.resolve();
      service.mutex = newMutex;

      expect(service.mutex).toBe(newMutex);
    });
  });

  describe('load method', () => {
    test('should successfully load script', async () => {
      (loadScript as any).mockResolvedValue(undefined);

      const result = await service.load();

      expect(result).toBe(true);
      expect(service.isLoaded).toBe(true);
      expect(loadScript).toHaveBeenCalledWith(
        'smart-test-service-script',
        'https://example.com/script.js',
        {crossorigin: 'anonymous'}
      );
    });

    test('should return same promise for multiple calls', async () => {
      (loadScript as any).mockResolvedValue(undefined);

      // Ensure service state is fresh
      service['_state'] = undefined as any;

      const promise1 = service.load();
      const promise2 = service.load();

      // Both calls should resolve to the same result
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe(true);
      expect(result2).toBe(true);

      // loadScript should only be called once due to promise caching
      expect(loadScript).toHaveBeenCalledTimes(1);
    });

    test('should handle load failure', async () => {
      const error = new Error('Script load failed');
      (loadScript as any).mockRejectedValue(error);

      await expect(service.load()).rejects.toBe(false);
      expect(service.isLoaded).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load test-service script',
        ': Script load failed'
      );
    });

    test('should handle non-Error exceptions', async () => {
      (loadScript as any).mockRejectedValue('String error');

      await expect(service.load()).rejects.toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load test-service script',
        ''
      );
    });

    test('should throw error if service name is not specified', async () => {
      const serviceWithoutName = SmartService.create({url: 'https://example.com/script.js'});

      await expect(serviceWithoutName.load()).rejects.toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load undefined script',
        ': Service name is not specified'
      );
    });

    test('should throw error if service URL is not specified', async () => {
      const serviceWithoutUrl = SmartService.create({name: 'test-service'});

      await expect(serviceWithoutUrl.load()).rejects.toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load test-service script',
        ': Service URL is not specified'
      );
    });

    test('should sanitize service name for script id', async () => {
      const serviceWithSpaces = SmartService.create({
        name: 'Test Service With Spaces',
        url: 'https://example.com/script.js'
      });
      (loadScript as any).mockResolvedValue(undefined);

      await serviceWithSpaces.load();

      expect(loadScript).toHaveBeenCalledWith(
        'smart-testservicewithspaces-script',
        'https://example.com/script.js',
        undefined
      );
    });
  });

  describe('_loadTask method', () => {
    test('should wait for mutex before loading', async () => {
      let mutexResolved = false;
      const mutex = new Promise<void>((resolve) => {
        setTimeout(() => {
          mutexResolved = true;
          resolve();
        }, 50);
      });

      service.mutex = mutex;
      (loadScript as any).mockImplementation(() => {
        expect(mutexResolved).toBe(true);
        return Promise.resolve();
      });

      await service.load();
      expect(loadScript).toHaveBeenCalled();
    });

    test('should call _onLoadScript on successful load', async () => {
      (loadScript as any).mockResolvedValue(undefined);
      const onLoadScriptSpy = vi.spyOn(service as any, '_onLoadScript');

      await service.load();

      expect(onLoadScriptSpy).toHaveBeenCalled();
    });

    test('should call _onFailedScript on load failure', async () => {
      const error = new Error('Load failed');
      (loadScript as any).mockRejectedValue(error);
      const onFailedScriptSpy = vi.spyOn(service as any, '_onFailedScript');

      await expect(service.load()).rejects.toBe(false);

      expect(onFailedScriptSpy).toHaveBeenCalledWith(error);
    });

    test('should log loading progress', async () => {
      (loadScript as any).mockResolvedValue(undefined);

      await service.load();

      expect(console.log).toHaveBeenCalledWith(
        'Service loading started: ',
        'test-service'
      );
      expect(console.log).toHaveBeenCalledWith(
        'Service script loaded: ',
        'test-service'
      );
    });
  });

  describe('preload method', () => {
    test('should create preload link element', async () => {
      const appendChildSpy = vi.spyOn(document.head, 'appendChild');
      const initialCallCount = appendChildSpy.mock.calls.length;

      await service.preload();

      // Wait for setTimeout to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      const newCallCount = appendChildSpy.mock.calls.length;
      expect(newCallCount).toBeGreaterThan(initialCallCount);

      const linkElement = appendChildSpy.mock.calls[newCallCount - 1][0] as HTMLLinkElement;
      expect(linkElement.tagName).toBe('LINK');
      expect(linkElement.rel).toBe('preload');
      expect(linkElement.href).toBe('https://example.com/script.js');
    });

    test('should handle service without URL', async () => {
      const serviceWithoutUrl = SmartService.create({name: 'test-service'});
      const appendChildSpy = vi.spyOn(document.head, 'appendChild');
      const initialCallCount = appendChildSpy.mock.calls.length;

      await serviceWithoutUrl.preload();

      // Wait for setTimeout to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      const newCallCount = appendChildSpy.mock.calls.length;
      expect(newCallCount).toBe(initialCallCount);
    });

    test('should log preload action', async () => {
      await service.preload();

      expect(console.log).toHaveBeenCalledWith(
        'Service preload(): ',
        'test-service'
      );
    });
  });

  describe('setupEarlyHints', () => {
    test('should setup early hints and return function', () => {
      const options = [
        {rel: 'preconnect' as const, href: 'https://example.com'},
        {rel: 'dns-prefetch' as const, href: 'https://api.example.com'}
      ];

      const earlyHintsFunction = SmartService.setupEarlyHints(options);
      expect(typeof earlyHintsFunction).toBe('function');
    });

    test('should create link elements when early hints function is called', async () => {
      const appendChildSpy = vi.spyOn(document.head, 'appendChild');
      const options = [
        {rel: 'preconnect' as const, href: 'https://example.com', attrs: {as: 'style'}},
        {rel: 'dns-prefetch' as const, href: 'https://api.example.com'}
      ];

      const earlyHintsFunction = SmartService.setupEarlyHints(options);
      await earlyHintsFunction();

      // Wait for setTimeout to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have at least 2 calls for our options
      expect(appendChildSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Check the last two calls which should be our links
      const calls = appendChildSpy.mock.calls;
      const link1 = calls[calls.length - 2][0] as HTMLLinkElement;
      const link2 = calls[calls.length - 1][0] as HTMLLinkElement;

      expect(link1.rel).toBe('preconnect');
      expect(link1.href).toBe('https://example.com/');

      expect(link2.rel).toBe('dns-prefetch');
      expect(link2.href).toBe('https://api.example.com/');
    });
  });

  describe('Error handling', () => {
    test('should handle empty service name gracefully', async () => {
      const serviceWithEmptyName = SmartService.create({name: '', url: 'https://example.com/script.js'});

      await expect(serviceWithEmptyName.load()).rejects.toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load  script',
        ': Service name is not specified'
      );
    });

    test('should handle service name with special characters', async () => {
      const serviceWithSpecialChars = SmartService.create({
        name: 'Test-Service_123 & More!',
        url: 'https://example.com/script.js'
      });
      (loadScript as any).mockResolvedValue(undefined);

      await serviceWithSpecialChars.load();

      expect(loadScript).toHaveBeenCalledWith(
        'smart-test-service_123&more!-script',
        'https://example.com/script.js',
        undefined
      );
    });
  });
});
