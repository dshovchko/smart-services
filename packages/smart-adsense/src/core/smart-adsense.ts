import {dispatchCustomEvent} from '@exadel/esl/modules/esl-utils/dom';
import {SmartService, type SmartServiceOptions} from 'smart-load-manager';

interface AdElement extends HTMLElement {
  dataset: {
    adStatus?: string;
    adsbygoogleStatus?: string;
  };
}

/** Configuration options for SmartAdsense */
export interface SmartAdsenseOptions extends SmartServiceOptions {
  /** Base rootMargin in pixels for lazy loading intersection observer */
  baseMargin: number;
  /** Retrying unfilled ads: delay between retry attempts in seconds, 0 means no retrying */
  retryDelay: number;
  /** Retrying unfilled ads: number of retry attempts, 0 means infinite */
  retryCount: number;
  /** Refreshing filled ads: interval in seconds, 0 means no refresh */
  refreshInterval: number;
  /** Refreshing filled ads: maximum number of refreshes per slot, 0 means infinite */
  maxRefreshes: number;
  /** Refreshing filled ads: refresh on ad block resize, false means no refresh */
  refreshOnResize: boolean;
}

export const STATUS_EVENT = 'adsense:status';
const AD_STATUS_ATTR = 'data-ad-status';
const ADSBYGOOGLE_STATUS_ATTR = 'data-adsbygoogle-status';

/** SmartAdsense service class for managing adsense scripts and status observing */
export class SmartAdsense extends SmartService {
  protected static override _config: SmartAdsenseOptions = {
    name: 'Adsense',
    baseMargin: 1500,
    retryDelay: 30,
    retryCount: 2,
    refreshInterval: 0,
    maxRefreshes: 10,
    refreshOnResize: false,
    attrs: {crossorigin: 'anonymous'}
  };

  protected _initStatusObserving(): void {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const mutation$$ = new MutationObserver(this._onMutation);
    mutation$$.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: [AD_STATUS_ATTR, ADSBYGOOGLE_STATUS_ATTR]
    });
  }

  protected _onMutation(mutations: MutationRecord[]): void {
    mutations.forEach((record: MutationRecord) => {
      const {attributeName, target, type} = record;
      if (type !== 'attributes' || (attributeName !== AD_STATUS_ATTR && attributeName !== ADSBYGOOGLE_STATUS_ATTR)) return;

      const {adStatus, adsbygoogleStatus} = (target as AdElement).dataset;
      if (adStatus) {
        dispatchCustomEvent(target, STATUS_EVENT, {detail: adStatus});
        return;
      }
      if (adsbygoogleStatus === 'done' && !adStatus) {
        // filled by fallback
        const status = (target as AdElement).innerHTML.trim() === '' ? 'unfilled' : 'filled';
        dispatchCustomEvent(target, STATUS_EVENT, {detail: status});
      }
    });
  }

  protected override _onLoadScript(): void {
    super._onLoadScript();
    this._initStatusObserving();
  }
}
