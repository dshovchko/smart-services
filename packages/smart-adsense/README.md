# smart-adsense

Drop-in AdSense service configuration with a `<smart-adsense>` custom element for retry, refresh, and status tracking.

## Features

- **Lazy loading element**: `loading="lazy"` + media-query `display` gate script execution until the slot is visible or matches a breakpoint.
- **Retry + refresh orchestration**: configurable delay/count for unfilled slots and interval-based refresh when filled.
- **Resize awareness**: if the `params` attribute sets `refreshOnResize=true`, a filled element re-renders whenever its width changes (attribute described in the Element API section).
- **Mutation-based status detection** via `MutationObserver`, emitting `adsense:status` (`filled`, `unfilled`, `pending`, etc.).
- **SSR/CSR safe service** built on `smart-load-manager` (mutexed script loading, early hints, debug logging support).

## Service vs. element

- **Service (`SmartAdsense`)** - extends `SmartService` to own script loading, retries, refresh timers, and early-hint helpers. You can call it directly (`SmartAdsense.load()`, `SmartAdsense.preload()`, `SmartAdsense.setupEarlyHints()`) or wire it into `SmartLoad.queue()`.
- **Element (`<smart-adsense>`)** - wraps the service so markup can express lazy/conditional activation (`loading`, `display`), resize awareness, and DOM events for status tracking.

Typical flow: configure the service once (`SmartAdsense.config()`), register the element, and sprinkle `<smart-adsense>` components throughout templates. When you need bespoke orchestration, trigger the same service instance via `SmartLoad` or manual calls while the element reacts to `SmartAdsense.instance.load()` resolution.

> ⚠️ `SmartAdsense.config()` mutates global defaults for the singleton service. Call it during bootstrap (before rendering elements) and avoid per-request overrides unless you intentionally change the global state.

> ℹ️ The custom element is not auto-registered. Call `SmartAdsenseElement.register()` once during app startup (before using `<smart-adsense>` in markup).

## Install

```bash
npm install smart-adsense smart-load-manager @exadel/esl
```

`smart-adsense` wraps `smart-load-manager` and re-exports pieces from it. Both packages expect `@exadel/esl` as a peer dependency. Your package manager will prompt if ESL is missing; if your project already ships a compatible ESL build, you can skip it from the install command above.

The CSS file `smart-adsense.css` ships in `dist/`; copy or import it wherever you register the element.

## Quick start

```ts
import {SmartAdsense, SmartAdsenseElement} from 'smart-adsense';
import 'smart-adsense/dist/smart-adsense.css';

SmartAdsense.config({
  url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX',
  retryDelay: 20,
  retryCount: 3,
  refreshInterval: 0,
  refreshOnResize: false,
});

SmartAdsenseElement.register(); // recommended after config so early instances see your defaults (safe to swap if needed)
```

```html
<smart-adsense
  display="(min-width: 768px)"
  loading="lazy"
  params='{"retryDelay":10,"refreshInterval":60}'
>
  <!-- your ins data-ad-code -->
</smart-adsense>
```

- `SmartAdsense.config()` merges defaults with global service options (delegates to `SmartService`).
- The custom element loads scripts lazily (using `SmartAdsense.instance.load()`), tracks mutations, and dispatches `smart-adsense:change` events whenever status updates.

### Coordinating with other services

Because `SmartAdsense` extends `SmartService`, it participates in the same orchestration primitives as any other loader:

```ts
import {SmartService, SmartLoad} from 'smart-load-manager';
import {SmartAdsense} from 'smart-adsense';

const consent = SmartService.create({name: 'Consent', url: 'https://cdn.example.com/consent.js'});
SmartAdsense.config({url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX'});

SmartLoad.queue(consent);
SmartLoad.queue(SmartAdsense, consent.load); // load AdSense only after the consent has been loaded
SmartLoad.start();
```

You can also call `SmartAdsense.load()` directly and branch on success/failure to attach fallbacks.

**Idle window orchestration**

```ts
import {SmartLoad, waitAny, waitIdle, waitUserActivity} from 'smart-load-manager';
import {SmartAdsense} from 'smart-adsense';

SmartAdsense.config({url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX'});

SmartLoad.queue(SmartAdsense, async () => waitAny([
  // Wait until the browser provides ~50ms of idle time
  waitIdle({thresholds: {duration: 50, ratio: 0.9}, timeout: 8000}),
  // or until the user interacts with the page
  waitUserActivity()
]));
SmartLoad.start();
SmartAdsense.load().catch(() => console.log('?> AdSense failed! Will do something else...'));
```

This pattern defers AdSense bootstrapping until the page settles (e.g., after above-the-fold work) or the user starts interacting with the page. Combine with other wait tasks to tailor the user journey.

## Configuration

`SmartAdsenseOptions` extend `SmartServiceOptions`:

| Option | Type | Description |
| --- | --- | --- |
| `retryDelay` | `number` | Seconds before retrying unfilled units (0 disables retries). |
| `retryCount` | `number` | Max number of retries; `0` = unlimited. |
| `refreshInterval` | `number` | Seconds before refreshing filled ads; `0` disables refresh. |
| `refreshOnResize` | `boolean` | Refresh when element width changes after a filled state. |
| `debug` | `boolean` | When true, element logs lifecycle events. |

Use `SmartAdsense.config()` globally and override per-element via the `params` attribute (JSON string merged over defaults).

> `retryCount = 0` means "retry indefinitely". This matches the legacy AdSense behavior where omitting the limit reattempts until a fill occurs. Set it to a positive integer to cap retries, or pair with `retryDelay = 0` to disable retries entirely.

## Element API

`<smart-adsense>` extends `SmartAdsenseElement` (an [`ESLBaseElement`](https://esl-ui.com/core/esl-base-element/)). It exposes declarative attributes, runtime properties, and status events so you can wire UI around AdSense lifecycles.

### Static helpers

| Member | Description |
| --- | --- |
| `SmartAdsenseElement.create()` | Creates an instance of the `SmartAdsenseElement`. |
| `SmartAdsenseElement.register()` | Defines the custom element (call once after configuring `SmartAdsense`). |

### Attributes

| Attribute | Default | Purpose |
| --- | --- | --- |
| `display` | `all` | `ESLMediaQuery` expression controlling visibility/lazy init. |
| `loading` | `lazy` | `lazy` waits for intersection, `eager` loads immediately. |
| `params` | `{}` | JSON encoded partial `SmartAdsenseOptions`. |
| `status` | `init` | Reflects current lifecycle (`init`, `pending`, `filled`, `unfilled`, `hidden`, `failed`). |

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `config` | `SmartAdsenseOptions` | Read-only view of the effective configuration (global `SmartAdsense.config()` merged with `params`). Use it to inspect retry/refresh values at runtime. |
| `status` | `string` | Getter/Setter for the current lifecycle (`init`, `pending`, etc.). Setting it manually forces a lifecycle update and dispatches `smart-adsense:change`. |
| `inactive` | `boolean` | Indicates whether the slot is gated (set to `false` when the element intersects or `loading="eager"`). |
| `params` | `Partial<SmartAdsenseOptions>` | Runtime getter/setter for JSON params; changing it re-merges config on the next load. |

### Events

- `adsense:status` - fires from the inner `<ins class="adsbygoogle">` created by Google. Listen when you need the raw AdSense signal (e.g., mirroring their exact payload or forwarding to analytics). It bubbles, so you can capture it at the document level.
- `smart-adsense:change` - emitted by the custom element whenever its `status` property updates (after debounce, including retries/refresh). Prefer this event for UI reactions, state machines, or whenever you only need the normalized status without touching Google's DOM.

### Usage notes

- **Slot content** - Provide at least one `<ins class="adsbygoogle" ...>` child. If the slot is empty the component stays `hidden` and never requests AdSense. Multiple `<ins>` tags are technically supported (the markup is restored verbatim for retries), but Google typically expects one ad per element—use separate wrappers for distinct placements.
- **Conditional loading** - Toggle the `display` media query or switch the `loading` attribute between `lazy`/`eager`. Prefer media queries powered by [ESL's `<esl-media-query>`](https://esl-ui.com/core/esl-media-query/) so breakpoints stay declarative. The `inactive` attribute is only a status flag controlled by the component; do not modify it directly.
- **Cleanup/re-mount** - Remove the element from the DOM to destroy it. `disconnectedCallback` restores the original markup automatically, so you can reattach the element later without losing the `<ins>` payload.

## Recipes

**Lazy + retry combo**

```html
<smart-adsense
  loading="lazy"
  params='{"retryDelay":5,"retryCount":5}'
>
  <ins class="adsbygoogle" data-ad-client="ca-pub-XXXX" data-ad-slot="123"></ins>
</smart-adsense>
```

**Always refresh on resize**

```html
<smart-adsense
  params='{"refreshOnResize":true,"refreshInterval":0}'
>
  <ins class="adsbygoogle" data-ad-client="ca-pub-XXXX" data-ad-slot="456"></ins>
</smart-adsense>
```

**Track status changes**

```ts
document.addEventListener('smart-adsense:change', (event) => {
  const {detail: status} = event as CustomEvent<string>;
  console.info('Ad status changed:', status);
});
```

**Create element programmatically**

```ts
const el = SmartAdsenseElement.create();
el.display = '(min-width: 1024px)';
el.params = {retryDelay: 15};
el.innerHTML = '<ins class="adsbygoogle" data-ad-slot="xxxxxxxxx"></ins>';
document.body.appendChild(el);
```

## Compatibility & performance

- **Browser support**: Requires ES2019+ syntax (async/await, optional chaining, nullish coalescing), Custom Elements, IntersectionObserver, ResizeObserver, and AbortController (same as `smart-load-manager`). Add polyfills before registering the element if you target legacy browsers (e.g., [@webcomponents/custom-elements](https://github.com/webcomponents/polyfills/tree/master/packages/custom-elements), [intersection-observer](https://github.com/w3c/IntersectionObserver/tree/main/polyfill)).
- **Performance impact**: The service defers AdSense execution via idle/interaction guards, reducing layout shifts and blocking time. Using `SmartLoad.queue()` serializes queued third-party script loads (not every resource), so only one ad/marketing script fetch runs at a time, which helps stabilize Core Web Vitals on ad-heavy pages.
