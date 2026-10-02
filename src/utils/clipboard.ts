/**
 * Robust clipboard copy utility supporting modern navigator.clipboard
 * and legacy fallback (for iframes or older browsers).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Try modern Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // If blocked by iframe permissions policy, fall through to textarea fallback
    }
  }

  // Fallback using temporary textarea
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}
