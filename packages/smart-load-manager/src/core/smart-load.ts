import {memoize} from '@exadel/esl/modules/esl-utils/decorators';
import {createDeferred} from '@exadel/esl/modules/esl-utils/async';
import {SmartService} from './smart-service';

function onReadyState(readyPredicate: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (readyPredicate()) {
      resolve();
    } else {
      const handler = (): void => {
        if (readyPredicate()) {
          document.removeEventListener('readystatechange', handler);
          resolve();
        }
      };
      document.addEventListener('readystatechange', handler);
    }
  });
}

export class SmartLoad {
  protected static _whenStarted = createDeferred<void>();

  @memoize()
  public static defaultMutex(): Promise<void> {
    return this.createMutex(this.now);
  }

  @memoize()
  public static now(): Promise<void> {
    return Promise.resolve();
  }

  @memoize()
  public static onLoaded(): Promise<void> {
    return onReadyState(() => document.readyState !== 'loading');
  }

  @memoize()
  public static onComplete(): Promise<void> {
    return onReadyState(() => document.readyState === 'complete');
  }

  protected static createMutex(previousTask: () => Promise<unknown>): Promise<void> {
    return new Promise<void>((resolve) => {
      (async (): Promise<void> => {
        try {
          await this._whenStarted.promise;
          await previousTask();
        } catch (e) {
          // ignore
        } finally {
          resolve();
        }
      })();
    });
  }

  public static queue(service: typeof SmartService | SmartService, after: () => Promise<unknown> = this.defaultMutex.bind(this)): void {
    const serviceInstance = service instanceof SmartService ? service : service.instance;
    serviceInstance.mutex = this.createMutex(after);
    serviceInstance.load().catch(() => void 0);
  }

  public static start(): void {
    this._whenStarted.resolve();
  }
}
