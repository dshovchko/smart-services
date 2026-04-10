# smart-services

[![npm version (smart-adsense)](https://img.shields.io/npm/v/smart-adsense.svg?label=smart-adsense)](https://www.npmjs.com/package/smart-adsense)
[![npm version (smart-load-manager)](https://img.shields.io/npm/v/smart-load-manager.svg?label=smart-load-manager)](https://www.npmjs.com/package/smart-load-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A toolkit for loading third-party services (like AdSense) efficiently without hurting your Core Web Vitals.

## The Problem
Most vendor code snippets block rendering, cause layout shifts, and drag down your Lighthouse score. They load everything at once, regardless of whether the user actually sees the widget or ad.

## The Solution
This monorepo provides tools to control *when* and *how* these scripts load:

- **`smart-load-manager`**: Puts third-party scripts in a queue. You can defer them until the document is ready, the browser is idle, or the user interacts with the page.
- **`smart-adsense`**: A drop-in custom web component that lazy-loads AdSense blocks only when they enter the viewport. It handles responsive breakpoints and auto-retries unfilled units.

## Quick Start

### 1. Install

Both packages require [`@exadel/esl`](https://github.com/exadel-inc/esl) as a **peer dependency**. It is a lightweight library that provides essential async helpers, decorators, DOM utilities, and web component primitives used internally by this toolkit.

```bash
npm install smart-adsense smart-load-manager @exadel/esl
```

### 2. Setup

Configure the service with your AdSense URL and register the custom element:

```typescript
import { SmartAdsense, SmartAdsenseElement } from 'smart-adsense';
import 'smart-adsense/dist/smart-adsense.css';

// Configure the global service
SmartAdsense.config({
  url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX',
  retryDelay: 15, // Delay before retrying unfilled units (in seconds)
});

// Register the custom element
SmartAdsenseElement.register();
```

### 3. Use in HTML

Wrap your standard AdSense `<ins>` tag with the new custom element. It will automatically handle lazy loading (waiting until it's in the viewport) and can even be configured to load based on media queries:

```html
<!-- 
  loading="lazy": waits until the element is in the viewport
  display="...": ESL media query to only render the ad on specific breakpoints
-->
<smart-adsense loading="lazy" display="(min-width: 768px)">
  <ins class="adsbygoogle" 
       style="display:block"
       data-ad-client="ca-pub-XXXXXXXXXX" 
       data-ad-slot="1234567890"
       data-ad-format="auto"></ins>
</smart-adsense>
```

The component manages the script injection, handles retries if the ad doesn't fill, and prevents the initial page load from blocking.

## Packages

| Package | Description | NPM |
|---|---|---|
| [`smart-load-manager`](./packages/smart-load-manager) | Core utilities and service orchestrator | [npm](https://www.npmjs.com/package/smart-load-manager)
| [`smart-adsense`](./packages/smart-adsense) | Web component and helpers for AdSense blocks | [npm](https://www.npmjs.com/package/smart-adsense)

## License
MIT
