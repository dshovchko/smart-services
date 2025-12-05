# smart-services

Monorepo with `smart-load-manager` and `smart-adsense` packages - toolkit for projects that need safer loading of third-party services without wrecking Core Web Vitals.

## Why this exists

Most vendor code snippets simply execute their own code, make network requests, and modify the DOM whenever they want, without giving priority to the main page. 

Result: layout shifts, blocked rendering, poor LCP, and an angry Google.

This toolkit fixes that.

**No more reckless script loading**: `smart-load-manager` puts every third-party script in a polite queue. It can wait for:
- document ready state (interactive or complete)
- loading another service
- user activity
- timeout
- browser idle time.

**Drop-in AdSense that actually works**: `smart-adsense` is a policy-compliant custom element that:
- lazily hydrates only when in viewport
- auto-retries unfilled or collapsed units
- respects your responsive breakpoints out of the box
- never triggers "blank ad" penalties again.

## Packages

| Package | Description |
|---|---|
| `smart-load-manager` | core utilities and service orchestrator |
| `smart-adsense`      | web component and helpers for AdSense blocks |

## Perfect for

- sites that care about 100 Lighthouse performance + AdSense revenue
- agencies that got tired of clients losing money because of empty ad units
