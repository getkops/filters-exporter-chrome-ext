/**
 * download.ts — browser side effects for saving a JSON string: a Blob download
 * and a best-effort clipboard copy. Both swallow failures and report via a
 * boolean so callers can choose the right localized toast.
 */
import { LOG_PREFIX } from './constants';

/** Trigger a file download of `json`. Returns false if the browser refused. */
export function downloadJson(json: string, filename: string): boolean {
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 200);
    return true;
  } catch (err) {
    console.error(LOG_PREFIX, 'download failed:', err);
    return false;
  }
}

/** Copy `text` to the clipboard. Best-effort: never throws, returns success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
