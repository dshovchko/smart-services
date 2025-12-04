import {bind} from '@exadel/esl/modules/esl-utils/decorators';
import {loadScript, type LoadScriptAttributes, setAttr} from '@exadel/esl/modules/esl-utils/dom';

/** Configuration options for SmartService */
export interface SmartServiceOptions {
  /** Service name */
  name?: string;
  /** Service URL */
  url?: string;
  /** Attributes for the script element */
  attrs?: LoadScriptAttributes;
  /** Enable debug logging */
  debug?: boolean;
}

/** Attributes for Early Hints link elements */
export interface EarlyHintsAttributes {
  /** 'as' attribute value */
  as?: string;
  /** 'crossorigin' attribute value */
  crossorigin?: string | boolean | null;
}

/** Options for Early Hints link elements */
export interface EarlyHintsOptions {
  /** Link element relationship type */
  rel: 'dns-prefetch' | 'preconnect' | 'prefetch' | 'preload' | 'prerender';
  /** Link element href */
  href: string;
  /** Additional attributes for the link element */
  attrs?: EarlyHintsAttributes;
}

function applyEarlyHints(options: EarlyHintsOptions): void {
  const link = document.createElement('link');
  link.rel = options.rel;
  options.attrs && Object.entries(options.attrs).forEach(([name, value]) => setAttr(link, name, value));
  link.href = options.href;
  document.head.appendChild(link);
}

/** Base class for smart services that load external scripts */
export class SmartService {
  protected static _config: SmartServiceOptions = {
    name: 'service',
    debug: false
  };
  protected static _instance: SmartService;

  /** Get or set the service configuration */
  public static config<T>(options?: T): T;
  public static config(options?: SmartServiceOptions): SmartServiceOptions {
    if (options) this._config = {...this._config, ...options};
    return this._config;
  }

  /** Create a new instance of SmartService */
  public static create(options: SmartServiceOptions): SmartService {
    return new this(options);
  }

  /** Get the singleton instance of SmartService */
  public static get instance(): SmartService {
    if (!this._instance) {
      this._instance = new this(this._config);
    }
    return this._instance;
  }

  /** Get the load method of the singleton instance */
  public static get load(): () => Promise<boolean> {
    return this.instance.load;
  }

  /** Setup Early Hints for the service */
  public static setupEarlyHints(options: EarlyHintsOptions[]): () => Promise<void> {
    return () => {
      setTimeout(() => options.forEach(applyEarlyHints), 1);
      return Promise.resolve();
    };
  }

  /** Get the preload method of the singleton instance */
  public static get preload(): () => Promise<void> {
    return this.instance.preload;
  }

  protected _loaded: boolean = false;
  protected _mutex: Promise<void> = Promise.resolve();
  protected _state: Promise<boolean>;

  protected constructor(protected _config: SmartServiceOptions) {}

  /** Check if the service is loaded */
  public get isLoaded(): boolean {
    return this._loaded;
  }

  /** Get the current mutex promise */
  public get mutex(): Promise<void> {
    return this._mutex;
  }

  /** Set a new mutex promise */
  public set mutex(value: Promise<void>) {
    this._debug('new Mutex: ', this._config.name, value);
    this._mutex = value;
  }

  /** Load the service script */
  @bind
  public async load(): Promise<boolean> {
    this._debug('Service load() enter: ', this._config.name, this);
    if (!this._state) {
      this._state = this._loadTask();
    }
    return this._state;
  }

  /** Preload the service script using Early Hints */
  @bind
  public async preload(): Promise<void> {
    this._debug('Service preload(): ', this._config.name);
    const {url, attrs} = this._config;
    if (url) setTimeout(applyEarlyHints.bind(null, {rel: 'preload', href: url, attrs: {as: 'script', ...attrs}}), 1);
    return Promise.resolve();
  }

  protected async _loadTask(): Promise<boolean> {
    try {
      await this._mutex;
      this._debug('Service loading started: ', this._config.name);

      if (!this._config.name) throw new Error('Service name is not specified');
      if (!this._config.url) throw new Error('Service URL is not specified');
      const id = (this._config.name || '').replace(/\s+/g, '').toLowerCase();
      await loadScript(`smart-${id}-script`, this._config.url, this._config.attrs);
      this._onLoadScript();
      return true;
    } catch (e) {
      this._onFailedScript(e);
      return Promise.reject(false);
    }
  }

  protected _onLoadScript(): void {
    this._debug('Service script loaded: ', this._config.name);
    this._loaded = true;
  }

  protected _onFailedScript(e?: Error): void {
    console.error(`Failed to load ${this._config.name} script`, e instanceof Error ? `: ${e.message}` : '');
  }

  protected _debug(...args: unknown[]): void {
    if (!this._config.debug) return;
    console.log(...args);
  }
}
