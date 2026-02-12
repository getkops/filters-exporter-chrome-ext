# Privacy Policy — Kops Filter Exporter

**Last updated:** February 12, 2026

## Overview

Kops Filter Exporter is a Chrome extension developed by [Kops](https://getkops.com) that extracts filter configurations from V-Tools and Souk.to dashboards and exports them as CSV files.

## Data Collection

**We do not collect, transmit, or store any personal data.**

The extension operates entirely on your local device. Specifically:

- **No data is sent to any external server.** All processing happens locally within your browser.
- **No analytics or tracking** of any kind is used.
- **No cookies** are read, written, or transmitted.
- **No user accounts** are required or created.

## Data Storage

The extension uses Chrome's built-in `chrome.storage.local` API to temporarily cache intercepted filter data on your device. This data:

- Stays entirely on your local machine
- Is never transmitted anywhere
- Can be cleared at any time using the "Clear" button in the extension popup
- Is automatically removed when the extension is uninstalled

## Permissions

| Permission  | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `storage`   | Temporarily cache captured filter data locally   |
| `activeTab` | Access the current tab to detect supported sites |

The extension only activates on the following domains:

- `app.v-tools.com`
- `souk.to`

## Data Exported

When you click "Export CSV", a file is generated **locally** in your browser and downloaded to your device. No data is uploaded or shared.

## Third-Party Services

This extension does not integrate with, send data to, or receive data from any third-party services, APIs, or analytics platforms.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last updated" date above.

## Contact

If you have any questions about this privacy policy, please contact us at:

- Website: [https://getkops.com](https://getkops.com)
- GitHub: [https://github.com/getkops/filters-exporter-chrome-ext](https://github.com/getkops/filters-exporter-chrome-ext)
