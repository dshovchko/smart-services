import {ESLBaseElement} from '@exadel/esl/modules/esl-base-element/core';
import {attr, boolAttr, bind, decorate, jsonAttr, listen, memoize, prop} from '@exadel/esl/modules/esl-utils/decorators';
import {debounce, DelayedTask, microtask} from '@exadel/esl/modules/esl-utils/async';
import {dispatchCustomEvent} from '@exadel/esl/modules/esl-utils/dom';
import {ESLResizeObserverTarget} from '@exadel/esl/modules/esl-event-listener/core';
import {ESLIntersectionTarget, ESLIntersectionEvent} from '@exadel/esl/modules/esl-event-listener/core/targets/intersection.target';
import {ESLMediaQuery} from '@exadel/esl/modules/esl-media-query/core';

import {SmartAdsense, type SmartAdsenseOptions} from './smart-adsense';

import type {ESLElementResizeEvent} from '@exadel/esl/modules/esl-event-listener/core';
import type {ESLMediaChangeEvent} from '@exadel/esl/modules/esl-media-query/core';

/** SmartAdsense web component for displaying Adsense ads */
export class SmartAdsenseElement extends ESLBaseElement {
  public static override is = 'smart-adsense';
  public static observedAttributes = ['display'];

  @prop(750) baseMargin: number;
  @prop([0, 0.01]) protected INTERSECTION_THRESHOLD: number[];
  @prop('smart-adsense:change') public CHANGE_EVENT: string;

  /** Condition {@link ESLMediaQuery} to allow display of ad. Default: `all` */
  @attr({defaultValue: 'all'}) public display: string;
  /** Ad loading strategy ('lazy' or 'eager'). Default: `lazy` */
  @attr({defaultValue: 'lazy'}) public loading: string;
  /** Configuration parameters for SmartAdsense */
  @jsonAttr<Partial<SmartAdsenseOptions>>() public params: Partial<SmartAdsenseOptions> = {};
  /** Inactive state of the ad (not loaded until becomes active) */
  @boolAttr() public inactive: boolean = true;

  protected _content: string = '';
  protected _lastWidth: number = 0;
  protected _retries: number = 0;
  protected _status: string = 'init';
  protected _task: DelayedTask = new DelayedTask();

  /** Current configuration */
  @memoize()
  public get config(): SmartAdsenseOptions {
    return {...SmartAdsense.config(), ...(this.params || {})};
  }
  /** ESLMediaQuery to limit display */
  protected get displayQuery(): ESLMediaQuery {
    return ESLMediaQuery.for(this.display);
  }
  /** Check if ad content is empty */
  protected get isEmpty(): boolean {
    return this._content.trim() === '';
  }
  /** Current ad status */
  public get status(): string {
    return this._status;
  }
  public set status(value: string) {
    if (this._status === value) return;
    this.setAttribute('status', this._status = value);
    this._onStatusChange();
  }

  /** IntersectionObserver rootMargin value */
  protected get rootMargin(): string {
    return `${this.baseMargin * this.connectionRatio}px`;
  }

  /** Connection speed ratio */
  protected get connectionRatio(): number {
    switch (navigator.connection?.effectiveType) {
      case 'slow-2g':
      case '2g': return 2;
      case '3g': return 1.5;
      case '4g':
      default: return 1;
    }
  }

  protected override connectedCallback(): void {
    super.connectedCallback();
    this.inactive = this.loading !== 'eager';
    this.storeContent();
    this.init();
    this.initA11y();
  }

  protected override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.restoreContent();
  }

  protected override attributeChangedCallback(attrName: string, oldVal: string, newVal: string): void {
    if (!this.connected) return;
    if (attrName === 'display') {
      this.$$on(this._onDisplayChange);
      this.init();
    }
  }

  /** Initializes ad */
  protected async init(): Promise<void> {
    if (this.isEmpty) return;
    if (!this.displayQuery.matches) {
      this._task.put(this.hideAd);
      return;
    }
    if (this.inactive) return;
    try {
      await SmartAdsense.instance.load();
      this._task.put(this.refreshAd, 0);
    } catch (e) {
      this.status = 'failed';
    }
  }

  /** Sets initial a11y attributes */
  protected initA11y(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'complementary');
  }

  /** Stores initial ad content */
  protected storeContent(): void {
    this._content = this.innerHTML;
    this.innerHTML = '';
  }

  /** Restores initial ad content */
  protected restoreContent(): void {
    this.innerHTML = this._content;
  }

  /** Pushes ad to the DOM */
  protected pushAd(): void {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // Ignore errors
    }
  }

  /** Hides the ad */
  @bind
  protected hideAd(): void {
    this.status = 'hidden';
    this.innerHTML = '';
    this._retries = 0;
  }

  /** Refreshes the ad */
  @bind
  protected refreshAd(): void {
    this.status = 'pending';
    this._retries++;
    this.restoreContent();
    this.pushAd();
  }

  /** Handles resize of ad */
  @listen({
    event: 'resize',
    condition: ($this: SmartAdsenseElement) => $this.config.refreshOnResize ?? false,
    target: ESLResizeObserverTarget.for
  })
  @decorate(debounce, 1000)
  protected _onResize(event: ESLElementResizeEvent): void {
    const {contentRect} = event;
    if (this._lastWidth === contentRect.width) return;
    if (this._lastWidth > 0 && this.status === 'filled') {
      this._retries = 0;
      this._task.put(this.refreshAd, 0);
      this._log('Ad is refreshing on resize', this._lastWidth);
    }
    this._lastWidth = contentRect.width;
  }

  /** Handles adsense status change */
  @listen('adsense:status')
  protected _onAdsenseStatusChange(event: CustomEvent): void {
    this._log('Ad status:', event.detail);
    this.status = event.detail;
    if (event.detail === 'unfilled') {
      const {retryCount, retryDelay} = this.config;
      const canRetry = retryCount === 0 || this._retries < retryCount;
      if (retryDelay > 0 && canRetry) {
        this._task.put(this.refreshAd, retryDelay * 1000);
        this._log(`Ad unfilled will be reattempted in ${retryDelay}s (${this._retries})`);
      }
    } else {
      const {refreshInterval} = this.config;
      this._log('Refresh interval:', refreshInterval);
      if (refreshInterval > 0) {
        this._task.put(this.refreshAd, (refreshInterval + Math.random()) * 1000);
        this._log(`Ad filled will be refreshed in ${refreshInterval}s [${this._retries}]`);
      }
    }
  }

  /** Handles intersection event to initialize ad loading */
  @listen({
    event: ESLIntersectionEvent.IN,
    once: true,
    condition: (that: SmartAdsenseElement) => that.loading !== 'eager',
    target: (that: SmartAdsenseElement) => ESLIntersectionTarget.for(that, {
      rootMargin: that.rootMargin,
      threshold: that.INTERSECTION_THRESHOLD
    })
  })
  protected _onIntersect(e: ESLIntersectionEvent): void {
    this.inactive = false;
    this.init();
  }

  /** Handles display query change and processes reinitialization of ad */
  @listen({event: 'change', target: ($this: SmartAdsenseElement) => $this.displayQuery})
  protected _onDisplayChange(event?: ESLMediaChangeEvent): void {
    this.init();
  }

  /** Handles status changing */
  @decorate(microtask)
  protected _onStatusChange(): void {
    dispatchCustomEvent(this, 'smart-adsense:change', {bubbles: false});
  }

  /** Logs messages to the console if debug mode is enabled */
  protected _log(...args: unknown[]): void {
    if (!this.config.debug) return;
    console.log(...args);
  }
}

declare global {
  export interface HTMLElementTagNameMap {
    'smart-adsense': SmartAdsenseElement;
  }
  let adsbygoogle: {[key: string]: unknown}[];
  interface Window {
    adsbygoogle: {[key: string]: unknown}[];
  }
  interface Navigator extends NavigatorNetworkInformation {}
  interface NavigatorNetworkInformation {
    readonly connection?: {
      readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';};
  }
}
