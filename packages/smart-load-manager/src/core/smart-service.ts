import {bind} from '@exadel/esl/modules/esl-utils/decorators';
import {loadScript, type LoadScriptAttributes, setAttr} from '@exadel/esl/modules/esl-utils/dom';

export interface SmartServiceOptions {
  name?: string;
  url?: string;
  attrs?: LoadScriptAttributes;
  debug?: boolean;
}

interface EarlyHintsAttributes {
  as?: string;
  crossorigin?: string | boolean | null;
}

interface EarlyHintsOptions {
  rel: 'dns-prefetch' | 'preconnect' | 'prefetch' | 'preload' | 'prerender';
  href: string;
  attrs?: EarlyHintsAttributes;
}

function applyEarlyHints(options: EarlyHintsOptions): void {
  const link = document.createElement('link');
  link.rel = options.rel;
  options.attrs && Object.entries(options.attrs).forEach(([name, value]) => setAttr(link, name, value));
  link.href = options.href;
  document.head.appendChild(link);
}

export class SmartService {
  protected static _config: SmartServiceOptions = {
    name: 'service',
    debug: false
  };
  protected static _instance: SmartService;

  public static config<T>(options?: T): T;
  public static config(options?: SmartServiceOptions): SmartServiceOptions {
    if (options) this._config = {...this._config, ...options};
    return this._config;
  }

  public static create(options: SmartServiceOptions): SmartService {
    return new this(options);
  }

  public static get instance(): SmartService {
    if (!this._instance) {
      this._instance = new this(this._config);
    }
    return this._instance;
  }

  public static get load(): () => Promise<boolean> {
    return this.instance.load;
  }

  public static setupEarlyHints(options: EarlyHintsOptions[]): () => Promise<void> {
    return () => {
      setTimeout(() => options.forEach(applyEarlyHints), 1);
      return Promise.resolve();
    };
  }

  public static get preload(): () => Promise<void> {
    return this.instance.preload;
  }

  protected _loaded: boolean = false;
  protected _mutex: Promise<void> = Promise.resolve();
  protected _state: Promise<boolean>;

  protected constructor(protected _config: SmartServiceOptions) {}

  public get isLoaded(): boolean {
    return this._loaded;
  }

  public get mutex(): Promise<void> {
    return this._mutex;
  }

  public set mutex(value: Promise<void>) {
    this._debug('new Mutex: ', this._config.name, value);
    this._mutex = value;
  }

  @bind
  public async load(): Promise<boolean> {
    this._debug('Service load() enter: ', this._config.name, this);
    if (!this._state) {
      this._state = this._loadTask();
    }
    return this._state;
  }

  @bind
  public async preload(): Promise<void> {
    this._debug('Service preload(): ', this._config.name);
    const {url, attrs} = this._config;
    if (url) setTimeout(applyEarlyHints.bind(null, {rel: 'preload', href: url, attrs: {as: 'script', ...attrs}}), 1);
    return Promise.resolve();
  }

  protected async _loadTask(): Promise<boolean> {
    this._debug('Service loadTask() enter: ', this._config.name);
    try {
      await this._mutex;
      this._debug('Sevice loading started: ', this._config.name);

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
