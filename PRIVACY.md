# Privacy Policy — IFV (Improvements For Vortex)

IFV is a browser extension that adds optional quality-of-life features on top of playvortex.io. This extension does not collect, store, transmit, or sell any personal data.

## What the extension stores

All data used by the extension is saved locally on your own device using the browser's `chrome.storage.local` API, and never leaves your computer:

- Which games you've pinned
- Your own per-game playtime (a local estimate, based on when a Vortex tab regains focus after you launch a game)
- Your theme preference (light/dark/custom colors)
- Feature toggle settings (quick play, prefetch, live stats)

None of this data is sent to any server operated by the extension's developer or any third party.

## Network requests

The extension only communicates with playvortex.io itself, using the same public API endpoints the site's own pages already call (e.g. game lists, server lists, player search) — it does not introduce any new data collection or send data to any other destination.

## No remote code

The extension contains no remote or dynamically-loaded JavaScript. All code is bundled with the extension package and reviewed at install time.

## Contact

Questions about this policy can be raised via the extension's GitHub repository.
