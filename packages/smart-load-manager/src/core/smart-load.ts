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

/** Manager for smart loading of services */
export class SmartLoad {
  protected static _whenStarted = createDeferred<void>();

  /** Get the default mutex promise which resolves immediately */
  @memoize()
  public static defaultMutex(): Promise<void> {
    return this.createMutex(this.now);
  }

  /** No wait and resolve immediately */
  @memoize()
  public static now(): Promise<void> {
    return Promise.resolve();
  }

  /** Wait until the document is at least interactive and then resolve */
  @memoize()
  public static onLoaded(): Promise<void> {
    return onReadyState(() => document.readyState !== 'loading');
  }

  /** Wait until the document is fully loaded and then resolve */
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

  /** Queue a service to be loaded after the given task */
  public static queue(service: typeof SmartService | SmartService, after: () => Promise<unknown> = this.defaultMutex.bind(this)): void {
    const serviceInstance = service instanceof SmartService ? service : service.instance;
    serviceInstance.mutex = this.createMutex(after);
    serviceInstance.load().catch(() => void 0);
  }

  /** Start the smart loading process */
  public static start(): void {
    this._whenStarted.resolve();
  }
}
