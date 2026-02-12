<p align="center">
  <img src="icons/icon128.png" alt="Kops Filter Exporter" width="120" />
</p>

<h1 align="center">Kops Filter Exporter</h1>

<p align="center">
  <strong>Chrome extension to extract filters from V-Tools & Souk.to and export them as CSV</strong>
  <br />
  <em>Open-source tool by <a href="https://getkops.com">Kops</a> — the fastest Vinted items monitor on the market</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-brightgreen" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/chrome-extension-yellow" alt="Chrome Extension" />
</p>

---

## What it does

Kops Filter Exporter silently intercepts the filters/alerts API responses when you visit V-Tools or Souk.to dashboards, normalizes them into a universal format, and lets you download everything as a clean CSV file.

### Supported services

| Service     | Dashboard URL                       | Intercepted API                          |
| ----------- | ----------------------------------- | ---------------------------------------- |
| **V-Tools** | `app.v-tools.com/dashboard/filtres` | `custom.v-tools.com/v3/services/filters` |
| **Souk.to** | `souk.to/{lang}/app/alerts`         | `api.souk.to/api/v1/matching_alert/web`  |

> Souk.to language prefixes (`/en/`, `/fr/`, etc.) are handled automatically.

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. The Kops filter icon appears in your toolbar

## Usage

1. Navigate to a supported filter page (V-Tools or Souk.to)
2. The extension badge shows the number of captured filters
3. Click the extension icon to see the filter list
4. Click **Export CSV** to download

## CSV format

```
source,name,search_text,price_from,price_to,catalogs,catalog_ids,brands,brand_ids,sizes,size_ids,statuses,status_ids,colors,color_ids,materials,material_ids,countries,country_ids,enabled
```

- Each name column (e.g. `brands`) is paired with an `_ids` column (e.g. `brand_ids`) containing the Vinted IDs — ready for programmatic import into [Kops](https://getkops.com)
- Multi-value fields are separated with `|`
- UTF-8 BOM included for Excel compatibility
- Filename includes source and date: `v_tools_filters_2026-02-12.csv`

## How it works

The extension uses a **fetch/XHR monkey-patching** technique via content scripts — no `chrome.debugger` needed, so there's no yellow debugging banner.

```
inject.js (page context) → content.js (content script) → background.js (service worker) → popup.js
```

1. `inject.js` patches `window.fetch` and `XMLHttpRequest` to capture matching API responses
2. `content.js` bridges the page context to the extension via `window.postMessage`
3. `background.js` parses and normalizes the data, stores it in `chrome.storage.local`
4. `popup.js` displays the filters and handles CSV export

## Project structure

```
├── manifest.json           # Manifest V3 configuration
├── src/
│   ├── inject.js           # Fetch/XHR interception (page context)
│   ├── content.js          # Message bridge (content script)
│   ├── background.js       # Service worker, parsers, storage
│   ├── export.js           # CSV generation utilities
│   ├── parsers/
│   │   ├── vtools.js       # V-Tools response normalizer
│   │   └── souk.js         # Souk.to response normalizer
│   └── popup/
│       ├── popup.html      # Popup UI
│       ├── popup.js        # Popup logic
│       └── popup.css       # Dark-mode styles (raw CSS)
├── icons/                  # Extension icons (16/48/128px)
└── logo_rounded.png        # Source logo
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT — Made with ♥ by [Kops](https://getkops.com)
