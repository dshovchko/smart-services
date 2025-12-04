# smart-load-manager

Queued loader and utility toolkit for third-party scripts. Provides a configurable `SmartService` base class, a cooperative `SmartLoad` queue, and tiny helpers for defer/idle orchestration.

## Features

- **SmartService** - declarative config, mutexed `load()`, `preload()` early hints, optional debug logging.
- **SmartLoad** - cooperative queue with `whenReady`/`onComplete` hooks and mutex binding out of the box.
- **Helpers** - `waitAny`, `waitTimeout`, `waitUserActivity`, `waitIdle`, `asyncSeries` to orchestrate retries, idle windows, or user-driven triggers.

## Install

```bash
npm install smart-load-manager @exadel/esl
```

`smart-load-manager` relies on `@exadel/esl` (peer dependency) for decorators and async helpers. Modern package managers will warn if a compatible ESL version is missing; if your project already includes ESL, you can omit it from the command.

## Quick start

```ts
import {
  SmartService,
  SmartLoad,
  waitAny,
  waitTimeout,
  waitUserActivity
} from 'smart-load-manager';

const consent = SmartService.create({name: 'Consent', url: 'https://cdn.example.com/consent.js'});
const analytics = SmartService.create({name: 'Analytics', url: 'https://cdn.example.com/analytics.js'});
const ads = SmartService.create({name: 'Ads', url: 'https://cdn.example.com/ads.js'});

const waitIntent = waitAny([
  waitUserActivity(),
  waitTimeout(2000)
]);

SmartLoad.queue(consent); // baseline dependency
SmartLoad.queue(analytics, consent.load); // analytics follows consent
SmartLoad.queue(ads, async () => {
  await waitIntent(); // ads wait for user activity or fallback timeout
});
SmartLoad.start();
```

You configure each service once, queue them behind the dependency (or helper) they care about, and let `SmartLoad` serialize the actual script injections. The helpers keep the orchestration declarative—here ads only load after either the user interacts or a timeout fires.

## Configuration

`SmartServiceOptions` accepted by `SmartService.config()` / `SmartLoad.create()`:

| Option | Type | Description |
| --- | --- | --- |
| `name` | `string` | Identifier used for logging + script element id. Required. |
| `url` | `string` | Remote script URL. Required for `load()`. |
| `attrs` | `LoadScriptAttributes` | Attributes passed to underlying `<script>` tag (e.g. `async`, `crossorigin`). |
| `debug` | `boolean` | Enables verbose console output for service lifecycle + mutex transitions. |

**Early hints**

```ts
SmartService.setupEarlyHints([
  {rel: 'preconnect', href: 'https://pagead2.googlesyndication.com'},
  {rel: 'dns-prefetch', href: 'https://googleads.g.doubleclick.net'}
]);
```

Call the returned function during application bootstrap to queue `<link rel="...">` elements with a minimal delay.

Each entry accepts:

| Field | Type | Notes |
| --- | --- | --- |
| `rel` | `'dns-prefetch' | 'preconnect' | 'prefetch' | 'preload' | 'prerender'` | Standard link relationship. |
| `href` | `string` | Target origin/asset. |
| `attrs.as` | `string` | Optional `as` value for preload/prefetch. |
| `attrs.crossorigin` | `string \| boolean \| null` | Mirrors the `<link crossorigin>` attribute.

### Preloading service scripts

`SmartService.preload()` drops a matching `<link rel="preload" as="script">` tag for the configured URL. Use it when you already know that a service will be needed, but you would like to defer `load()` until after user input, consent, or idle time:

```ts
const analytics = SmartService.create({
  name: 'Analytics',
  url: 'https://cdn.example.com/analytics.js',
  attrs: {crossorigin: 'anonymous'}
});

const registerHints = SmartService.setupEarlyHints([
  {rel: 'preconnect', href: 'https://cdn.example.com'},
  {rel: 'dns-prefetch', href: 'https://cdn.example.com'}
]);

await registerHints(); // schedule <link rel="preconnect"> tags during bootstrap
await analytics.preload(); // enqueue <link rel="preload" as="script">
// later you can await analytics.load() once prerequisites are met
```

Call `setupEarlyHints()` at application bootstrap (or server-side) so connections warm up while the rest of the UI initializes. Then call `preload()` close to the navigation or route transition that will eventually call `load()`. Both helpers execute quickly and are safe to reuse inside orchestrated queues.

## SmartLoad usage

This example adds consent loading to the queue of orchestration, which should start downloading immediately.

```ts
import {SmartLoad, SmartService} from 'smart-load-manager';

const consent = SmartService.create({name: 'Consent', url: 'https://cdn.example.com/consent.js'});
SmartLoad.queue(consent); // same as SmartLoad.queue(consent, SmartLoad.now())
SmartLoad.start();
```

This example adds consent loading to the orchestration queue, which should start downloading after the document is at least interactive.

```ts
import {SmartLoad, SmartService} from 'smart-load-manager';

const consent = SmartService.create({name: 'Consent', url: 'https://cdn.example.com/consent.js'});
SmartLoad.queue(consent, SmartLoad.onLoaded()); 
SmartLoad.start();
```

This example adds consent loading to the orchestration queue, which should start downloading after the document is fully loaded.

```ts
import {SmartLoad, SmartService} from 'smart-load-manager';

const consent = SmartService.create({name: 'Consent', url: 'https://cdn.example.com/consent.js'});
SmartLoad.queue(consent, SmartLoad.onComplete()); 
SmartLoad.start();
```

### Orchestrating several services

The core idea is to queue every third-party integration behind the dependency it needs. A typical flow:

```ts
import {SmartService, SmartLoad, asyncSeries, waitAny, waitTimeout, waitUserActivity} from 'smart-load-manager';

const consent = SmartService.create({name: 'Consent', url: 'https://cdn.example.com/consent.js'});
const tagManager = SmartService.create({name: 'TagManager', url: 'https://www.googletagmanager.com/gtag/js?id=G-XXXX'});
const analytics = SmartService.create({name: 'Analytics', url: '/analytics.js'});
const fallback = SmartService.create({name: 'FallbackAds'});

// Queue core services
SmartLoad.queue(consent, SmartLoad.onComplete()); // runs once the document is fully loaded
SmartLoad.queue(tagManager, consent.load); // runs once conset is loaded
SmartLoad.queue(analytics, tagManager.load); // runs once TagManager is loaded

// Compose richer logic via helpers
SmartLoad.queue(fallback, async () => await asyncSeries([
    analytics.load,
    waitAny([waitTimeout(2000), waitUserActivity()])
  ])
); // runs once seriesly completed analytics loading and pass 2s or user interacts with the page

SmartLoad.start();
```

- `SmartLoad.queue(service, after?)` links each service to a promise factory (`after`) returned from the previous ones. It can be either `otherService.load`, a custom async function, or helpers such as `SmartLoad.onComplete`.
- `SmartLoad.start()` resolves the internal deferred so the queue begins executing. Until then you can register every dependency declaratively.
- Each service still exposes `load()` for direct use if you need to branch on success/failure.

#### Advanced preload + idle pipeline

Pair `setupEarlyHints()`, `preload()`, and helper waits when you want to warm up the network aggressively but still defer execution to calmer windows. The example below preconnects to several vendors, issues preloads during the first idle slot, and only then loads marketing scripts once analytics settles (or a manual timeout elapses):

```ts
import {
  SmartService,
  SmartLoad,
  asyncSeries,
  waitIdle,
  waitAny,
  waitTimeout
} from 'smart-load-manager';

const analytics = SmartService.create({name: 'Analytics', url: 'https://cdn.analytics.example/app.js'});
const marketing = SmartService.create({name: 'Marketing', url: 'https://cdn.marketing.example/pixel.js'});
const ads = SmartService.create({name: 'Ads', url: 'https://ads.example.net/loader.js'});

SmartLoad.queue(analytics, async () => await asyncSeries([
    analytics.preload,
    SmartService.setupEarlyHints([
      {rel: 'preconnect', href: 'https://cdn.marketing.example'},
      {rel: 'preconnect', href: 'https://ads.example.net'}
    ]),
    waitAny([
      waitIdle({thresholds: {duration: 80}, timeout: 5000}),
      waitUserActivity()
    ])
  ])
);

SmartLoad.queue(marketing, async () => await asyncSeries([
    analytics.load,
    marketing.preload,
    waitTimeout(300)
  ])
);

SmartLoad.queue(ads, async () => await asyncSeries([
    marketing.load,
    ads.preload,
    SmartService.setupEarlyHints([
      {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
      {rel: 'preconnect', href: 'https://fonts.gstatic.com', attrs: {crossorigin: ''}}
    ])
  ])
);

SmartLoad.start();
marketing.load().catch(() => console.log('?> Marketing failed! Will do something else...'));
```

This example of load orchestration demonstrates the following. Three services are loaded: analytics, marketing, and ads. Analytics will start loading after the following chain of actions is completed:
 - preloading of analytics service
 - preconnecting to https://cdn.marketing.example and https://ads.example.net
 - waiting for user activity or browsers idle state (something that will happen first)
 - after that starts analytics service loading, evaluation and execution
Marketing will start loading after the following chain of actions is completed:
 - loading analytics service
 - preloading of marketing service
 - passing 300msec
Ads will start loading after the following chain of actions is completed:
 - loading marketing service
 - preloading of marketing service
 - preconnecting to Google Fonts

`SmartLoad.queue()` triggers the service's `load()` after your `after` hook resolves, so the hook should only coordinate prerequisites. Never call `load()` yourself until you have configured the queue and started it by calling `start()`. Otherwise, your orchestration will not work properly.
Once you have configured the queue and started it, you can monitor the loading results. Each `load()` for direct use if you need to branch on success/failure.

## Helper recipes

### `asyncSeries` helper

`asyncSeries(tasks)` executes a list of async factories one after another, ignoring individual rejections so the rest of the pipeline can continue. Handy when preparing services inside `SmartLoad.queue()` hooks:

```ts
import {asyncSeries, waitIdle, waitTimeout} from 'smart-load-manager';

await asyncSeries([
  service.preload,
  waitIdle({timeout: 4000}),
  waitTimeout(250)
]);
```

Each item is a function returning a promise, which keeps the helpers lazily evaluated and compatible with bound service methods.

### `waitAny` helper

`waitAny(tasks)` composes several wait tasks and resolves when the first one finishes. This is useful for racing user intent against timeouts or DOM readiness gates. Every task receives an `AbortSignal`, so the remaining ones cancel automatically:

```ts
import {waitAny, waitTimeout, waitUserActivity} from 'smart-load-manager';

const waitForIntent = waitAny([
  waitUserActivity(),
  waitTimeout(4000)
]);

await waitForIntent();
```

### `waitIdle` helper

`waitIdle(options)` uses `promisifyIdle` under the hood and exposes a wait task that resolves when the browser accumulates enough idle time. Drop it into `waitAny()` races or `asyncSeries()` steps whenever you need deterministic "browser is calm" checks before kicking off hydration, A/B scripts, etc.

| Option | Type | Description |
| --- | --- | --- |
| `thresholds.duration` | `number` | Desired sum of idle milliseconds across recent frames (default `46.6`). |
| `thresholds.ratio` | `number` | Ratio of idle time to frame time (default `0.9`). |
| `timeout` | `number` | Maximum wait before resolving/forcing idle (default `10000ms`). |
| `debug` | `boolean` | Dumps frame metrics and `performance.measure` markers. |
| `signal` | `AbortSignal` | Cancels idle waiting.

### `waitTimeout` helper

`waitTimeout(ms)` returns a wait task that resolves after the given milliseconds. Compose it with `waitAny()` or `asyncSeries()` when you need guardrails around long-running operations:

```ts
import {waitTimeout} from 'smart-load-manager';

await waitTimeout(2500)();
```

### `waitUserActivity` helper

`waitUserActivity()` listens for key, pointer, wheel, or mouse movement events and resolves once the user interacts with the page. The listener uses passive handlers and cleans up automatically via `AbortController`:

```ts
import {waitUserActivity, waitAny, waitTimeout} from 'smart-load-manager';

const waitForEngagement = waitAny([
  waitUserActivity(),
  waitTimeout(8000)
]);

await waitForEngagement();
```

### `promisifyIdle` helper

`promisifyIdle(options)` exposes the underlying idle detection primitive used by `waitIdle()`. It returns a promise that resolves once the recent frames accumulate enough idle budget (or rejects if an abort signal fires). Use it when you need bespoke coordination outside the wait-task helpers—for example, pausing until the browser sits idle before running custom logic:

```ts
import {promisifyIdle} from 'smart-load-manager';

await promisifyIdle({
  thresholds: {duration: 60, ratio: 0.85},
  timeout: 6000,
  debug: true
});

// safe to run heavier DOM work here
```

All option fields mirror those listed for `waitIdle()`, with `signal` allowing you to cancel the wait early via `AbortController`.

| Option | Type | Purpose |
| --- | --- | --- |
| `thresholds.duration` | `number` | Total milliseconds of "good" idle time the browser must accumulate across recent frames before resolving. Increase it when you want longer calm periods. |
| `thresholds.ratio` | `number` | Minimum ratio of idle time to total frame time (0-1). Lower this if your app runs heavier animation but you still want to treat short gaps as idle. |
| `timeout` | `number` | Hard stop in milliseconds; once reached, the promise resolves even if thresholds were not met. Useful to avoid blocking your queue forever. |
| `debug` | `boolean` | Prints a console table with per-frame metrics and creates `performance.measure` marks, helping you tune thresholds. |
| `signal` | `AbortSignal` | Abort the wait from the outside (e.g., when the user navigates away or you no longer need the service). |

## Compatibility & performance

- **Browser support**: Targets ES2019+ runtimes with native `Promise`, async/await, and `AbortController`. Helpers such as `waitIdle()` rely on `requestIdleCallback`/`performance` APIs; polyfill them (plus `AbortController` if needed) before calling `SmartService.setupEarlyHints()` or `SmartLoad.start()` when supporting legacy browsers.
- **Performance impact**: `SmartLoad.queue()` serializes third-party script injections, so only one network fetch and evaluation pipeline runs at a time. Pairing the queue with helpers like `waitIdle()`, `waitUserActivity()`, and `asyncSeries()` lets you gate each integration on idle frames or intent, cutting down layout shifts, main-thread contention, and aggregate blocking time.
