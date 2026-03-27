# Chrome Web Store Publishing Guide

> Step-by-step guide to publish the Kops Filter Exporter extension.

---

## Pre-requisites

- ✅ Extension code ready and tested
- ✅ Privacy policy created (`PRIVACY_POLICY.md`)
- ✅ Icons available (128×128)
- [ ] Chrome Developer account ($5 one-time fee)
- [ ] Screenshots (1280×800 or 640×400)

---

## Step 1 — Create a Developer Account

1. Go to **[Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)**
2. Sign in with a Google account (use your Kops business account)
3. Pay the **$5 one-time registration fee**
4. Fill in developer info (name, email, website: `https://getkops.com`)

---

## Step 2 — Prepare the ZIP Package

The GitHub Actions release workflow already generates the zip for you.
Download the latest `kops-filter-exporter-v*.zip` from the [Releases page](https://github.com/getkops/filters-exporter-chrome-ext/releases/latest).

> ⚠️ The zip must contain `manifest.json` at the root level, not inside a subfolder.

---

## Step 3 — Take Screenshots

Take **at least 1 screenshot** (up to 5 recommended) at **1280×800** resolution:

1. **Screenshot 1** — Extension popup showing captured filters (active state with the filter table visible)
2. **Screenshot 2** — Extension popup empty state (showing the instructions)
3. **Screenshot 3** — Extension badge visible in toolbar on a V-Tools page

> Tip: Use Chrome DevTools (Ctrl+Shift+I → Toggle device toolbar) to set the exact viewport size.

---

## Step 4 — Fill in the Store Listing

Use the text below — copy/paste directly into the Chrome Developer Dashboard.

### Extension Name

```
Kops Filter Exporter — V-Tools & Souk.to
```

### Short Description (132 chars max)

```
Export your V-Tools & Souk.to filters as CSV with Vinted IDs. Migrate your alerts to Kops in seconds. Free & open-source by Kops.
```

### Detailed Description

```
Kops Filter Exporter is a free, open-source Chrome extension that captures your V-Tools and Souk.to filter configurations and exports them as a clean CSV file, complete with Vinted IDs for easy import.

🔥 KEY FEATURES

• Automatic capture — Just visit your V-Tools or Souk.to filters page. The extension silently intercepts the API response. No clicks needed.

• Universal CSV export — One format for both services. Includes filter names, search text, price ranges, catalogs, brands, sizes, statuses, colors, materials, countries, and enabled state.

• Vinted IDs included — Every field (brands, catalogs, sizes, etc.) includes the corresponding Vinted IDs alongside human-readable names, ready for programmatic import into Kops or any other tool.

• Excel-compatible — UTF-8 BOM encoding ensures proper display of special characters, emojis, and accented text in Microsoft Excel.

• 100% private — All data stays on your local device. Nothing is ever sent to any server. Zero tracking, zero analytics.

📦 SUPPORTED SERVICES

• V-Tools — Intercepts filters from custom.v-tools.com
• Souk.to — Intercepts alerts from api.souk.to (all languages)

🚀 HOW TO USE

1. Install the extension
2. Navigate to your V-Tools or Souk.to filters page
3. The extension badge shows the number of captured filters
4. Click the extension icon → Export CSV
5. Import the CSV into Kops (getkops.com) to recreate your filters instantly

🔒 PRIVACY

This extension collects zero personal data. All processing happens locally in your browser. Filter data is stored temporarily using Chrome's local storage and can be cleared at any time. Full privacy policy available on GitHub.

📂 OPEN SOURCE

Kops Filter Exporter is fully open-source under the MIT license.
Source code: https://github.com/getkops/filters-exporter-chrome-ext

Built with ♥ by Kops — the fastest Vinted items monitor on the market.
https://getkops.com
```

### Category

```
Productivity
```

### Language

```
English
```

---

## Step 5 — Privacy Tab

1. **Single purpose description:**

```
This extension captures filter/alert configurations from V-Tools (v-tools.com) and Souk.to (souk.to) dashboards by intercepting their API responses, and exports them as CSV files for migration to other services.
```

2. **Permission justifications:**

| Permission                                  | Justification                                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                   | Used to temporarily cache captured filter data locally so it persists across popup opens until the user exports or clears it. |
| `activeTab`                                 | Used to detect when the user is on a supported site (V-Tools or Souk.to) and display the filter count badge.                  |
| Host permissions (`v-tools.com`, `souk.to`) | Content scripts run only on these specific domains to intercept filter API responses. No other sites are accessed.            |

3. **Data use disclosures:**
   - Does your extension collect personal data? → **No**
   - Does your extension transmit data to remote servers? → **No**
   - Privacy policy URL → Link to your hosted privacy policy (see Step 6)

---

## Step 6 — Host the Privacy Policy

The privacy policy needs to be accessible via a public URL. Options:

**Option A — GitHub (easiest):**
The `PRIVACY_POLICY.md` is already in the repo. Use this URL:

```
https://github.com/getkops/filters-exporter-chrome-ext/blob/main/PRIVACY_POLICY.md
```

**Option B — getkops.com:**
Add a `/privacy-filter-exporter` page on your website and paste the content of `PRIVACY_POLICY.md`.

---

## Step 7 — Upload & Submit

1. In the Chrome Developer Dashboard, click **"New item"**
2. Upload the `kops-filter-exporter-v*.zip`
3. Fill in all listing fields (from Step 4)
4. Upload screenshots (from Step 3)
5. Fill in the Privacy tab (from Step 5)
6. Set visibility to **Public**
7. Click **"Submit for review"**

---

## Step 8 — Wait for Review

- First submission typically takes **1–3 business days**
- You'll receive an email when approved (or if changes are requested)
- Once approved, the extension is live on the Chrome Web Store!

---

## After Publishing

- Future updates: bump `version` in `manifest.json`, create a new tag (e.g. `v1.1.0`), download the new zip from Releases, and upload it in the Developer Dashboard
- The review for updates is usually faster (< 24h)
