import {dispatchCustomEvent} from '@exadel/esl/modules/esl-utils/dom';
import {SmartService, type SmartServiceOptions} from 'smart-load-manager';

interface AdElement extends HTMLElement {
  dataset: {
    adStatus?: string;
    adsbygoogleStatus?: string;
  };
}

export interface SmartAdsenseOptions extends SmartServiceOptions {
  // retrying unfilled ads
  retryDelay: number; // 0 - no retrying
  retryCount: number; // 0 - infinite

  // refreshing filled ads
  refreshInterval: number; // 0 - no refresh
  refreshOnResize: boolean; // false - no refresh
}

export const STATUS_EVENT = 'adsense:status';
const AD_STATUS_ATTR = 'data-ad-status';
const ADSBYGOOGLE_STATUS_ATTR = 'data-adsbygoogle-status';

export class SmartAdsense extends SmartService {
  protected static override _config: SmartAdsenseOptions = {
    name: 'Adsense',
    retryDelay: 20,
    retryCount: 3,
    refreshInterval: 0,
    refreshOnResize: false,
    attrs: {crossorigin: 'anonymous'}
  };

  protected _initStatusObserving(): void {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const mutation$$ = new MutationObserver(this._onMutation);
    mutation$$.observe(document.documentElement, {
      subtree: true,
      childList: true,
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
