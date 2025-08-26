/**
 * export.js
 * Export/Import all posts (with embedded images) as a single JSON file.
 */
import * as db from './db.js';
import { formatDateForFile } from './utils.js';

/**
 * exportData()
 * Builds a JSON snapshot and triggers a browser download with an easy filename.
 */
export async function exportData() {
  const posts = await db.exportAllPosts();

  const snapshot = {
    app: 'cs2-trickz',
    version: 1,
    exportedAt: new Date().toISOString(),
    posts,
    // Future: add selected settings keys here if needed
    settings: {}
  };

  const fileName = `CS2Trickz-${formatDateForFile(new Date())}.json`;
  downloadJson(snapshot, fileName);
}

/**
 * importData(fileOrBlob, { strategy: 'merge' | 'replace' })
 * - strategy merge: upsert by id (default)
 * - strategy replace: clears store then imports
 */
export async function importData(fileOrBlob, opts = {}) {
  const { strategy = 'merge' } = opts;
  const text = await readAsText(fileOrBlob);
  let payload = null;

  try {
    payload = JSON.parse(text);
  } catch (e) {
    alert('Selected file is not valid JSON.');
    return;
  }

  if (!payload || typeof payload !== 'object') {
    alert('Selected file is not a valid export.');
    return;
  }
  if (payload.app !== 'cs2-trickz') {
    const ok = confirm('This file does not look like a CS2 Trickz export. Import anyway?');
    if (!ok) return;
  }
  if (typeof payload.version !== 'number' || payload.version < 1) {
    const ok = confirm('Unknown export version. Import anyway?');
    if (!ok) return;
  }

  const posts = Array.isArray(payload.posts) ? payload.posts : [];
  if (!posts.length) {
    const ok = confirm('Export contains 0 posts. Continue?');
    if (!ok) return;
  }

  if (strategy === 'replace') {
    await db.replaceAllPosts(posts);
  } else {
    await db.mergePosts(posts);
  }

  alert(`Imported ${posts.length} post(s) using strategy "${strategy}".`);
}

// Helpers
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function readAsText(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = reject;
    fr.readAsText(fileOrBlob);
  });
}