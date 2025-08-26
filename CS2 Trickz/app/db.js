/**
 * db.js
 * IndexedDB wrapper for CS2 Trickz (Option 1 - pure browser).
 *
 * Stores:
 *  - posts: keyPath 'id'
 *  - tags:  keyPath 'name'
 *  - settings: keyPath 'key'
 */

import { id as newId } from './utils.js';

export const DB_NAME = 'cs2trickz_v1';
export const DB_VERSION = 1;

let _dbPromise = null;

export function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // posts store
      if (!db.objectStoreNames.contains('posts')) {
        const posts = db.createObjectStore('posts', { keyPath: 'id' });
        posts.createIndex('by_type', 'type', { unique: false });
        posts.createIndex('by_subtype', 'subtype', { unique: false });
        posts.createIndex('by_map', 'map', { unique: false });
        posts.createIndex('by_side', 'side', { unique: false });
        posts.createIndex('by_favorite', 'favorite', { unique: false });
        posts.createIndex('by_createdAt', 'createdAt', { unique: false });
        posts.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        posts.createIndex('by_title_lower', 'title_lower', { unique: false });
        posts.createIndex('by_tags', 'tags', { unique: false, multiEntry: true });
        // Optional future: compound indexes
      }

      // tags store (for suggestions/autocomplete)
      if (!db.objectStoreNames.contains('tags')) {
        db.createObjectStore('tags', { keyPath: 'name' });
      }

      // settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });

  return _dbPromise;
}

// Transaction helper
async function tx(storeNames, mode = 'readonly') {
  const db = await openDB();
  const t = db.transaction(storeNames, mode);
  const stores = {};
  for (const name of Array.isArray(storeNames) ? storeNames : [storeNames]) {
    stores[name] = t.objectStore(name);
  }
  return { db, t, ...stores };
}

// Derived fields
export function deriveFields(post) {
  const p = { ...post };
  p.title_lower = (p.title || '').toLowerCase();
  p.tags = Array.isArray(p.tags) ? p.tags.map(s => String(s).trim()).filter(Boolean) : [];
  p.tags_lower = p.tags.map(s => s.toLowerCase());
  // Normalize subtype to uppercase for consistent storage
  p.subtype = String(p.subtype || '').trim().toUpperCase();
  if (!p.createdAt) p.createdAt = new Date().toISOString();
  p.updatedAt = new Date().toISOString();
  if (!p.id) p.id = newId();
  return p;
}

// Posts CRUD
export async function addPost(post) {
  const p = deriveFields(post);
  const { t, posts } = await tx('posts', 'readwrite');
  await requestToPromise(posts.add(p));
  await updateTagsWithPost(p);
  await complete(t);
  return p;
}

export async function putPost(post) {
  const p = deriveFields(post);
  const { t, posts } = await tx('posts', 'readwrite');
  await requestToPromise(posts.put(p));
  await updateTagsWithPost(p);
  await complete(t);
  return p;
}

export async function deletePost(id) {
  const { t, posts } = await tx('posts', 'readwrite');
  await requestToPromise(posts.delete(id));
  await complete(t);
}

export async function getPost(id) {
  const { t, posts } = await tx('posts', 'readonly');
  const val = await requestToPromise(posts.get(id));
  await complete(t);
  return val;
}

export async function getAllPosts() {
  const { t, posts } = await tx('posts', 'readonly');
  const val = await requestToPromise(posts.getAll());
  await complete(t);
  return val;
}

// Query in-memory for MVP
export async function queryPosts(filters = {}) {
  const all = await getAllPosts();
  const category = filters.category || '';
  const type = filters.type || '';
  const subtype = String(filters.subtype || '').trim();
  const map = String(filters.map || '').trim();
  const side = filters.side || '';
  const tagText = (filters.tags || '').toLowerCase();
  const search = (filters.search || '').toLowerCase();
  const favoriteMode = filters.favoriteMode || '';

  const tagList = tagText
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return all.filter(p => {
    // Category (top-level) filter
    if (category && String(p.category || '') !== category) return false;

    // Type and subtype filtering
    if (type && p.type !== type) return false;

    if (type === 'NADES') {
      if (subtype) {
        const ps = String(p.subtype || '').toUpperCase();
        const want = String(subtype || '').toUpperCase();
        const eq = (a, b) => {
          // Treat MOLLY and MOLLIE as the same
          const norm = (s) => (s === 'MOLLIE' ? 'MOLLY' : s);
          return norm(a) === norm(b);
        };
        if (!eq(ps, want)) return false;
      }
    } else if (type && type !== 'NADES') {
      // For non-NADES types: match subtype by equality (case-insensitive) when provided
      if (subtype) {
        const ps = String(p.subtype || '').toLowerCase();
        if (ps !== subtype.toLowerCase()) return false;
      }
    } else {
      // type not selected, allow all
    }

    // Map filtering (supports legacy 'Other' with mapOther)
    if (map) {
      const pm = String(p.map || '').trim();
      const pmOther = String(p.mapOther || '').trim();
      const want = map.toLowerCase();
      const candidateNames = new Set();
      if (pm) candidateNames.add(pm.toLowerCase());
      if (pm === 'Other' && pmOther) candidateNames.add(pmOther.toLowerCase());
      if (!candidateNames.has(want)) return false;
    }

    // Side filtering (exact match; excludes 'Both' when filtering by T/CT)
    if (side) {
      if ((p.side || 'Both') !== side) return false;
    }

    if (favoriteMode === 'only' && !p.favorite) return false;

    if (tagList.length) {
      const hasAll = tagList.every(tag => (p.tags_lower || []).includes(tag));
      if (!hasAll) return false;
    }

    if (search) {
      const hay = ((p.title || '') + ' ' + (p.notes || '')).toLowerCase();
      if (!hay.includes(search)) return false;
    }

    return true;
  });
}

// Export/import helpers
export async function exportAllPosts() {
  return await getAllPosts();
}

export async function replaceAllPosts(posts) {
  const { t, posts: store } = await tx('posts', 'readwrite');
  // Clear and repopulate
  await requestToPromise(store.clear());
  for (const p of posts) {
    const withDeriv = deriveFields(p);
    await requestToPromise(store.put(withDeriv));
  }
  await complete(t);
  await rebuildTags();
}

export async function mergePosts(posts) {
  const existing = await getAllPosts();
  const byId = new Map(existing.map(p => [p.id, p]));
  for (const p of posts) {
    const merged = { ...(byId.get(p.id) || {}), ...p };
    await putPost(merged);
  }
  await rebuildTags();
}

// Settings
export async function getSetting(key, defaultValue = null) {
  const { t, settings } = await tx('settings', 'readonly');
  const row = await requestToPromise(settings.get(key));
  await complete(t);
  return row ? row.value : defaultValue;
}

export async function setSetting(key, value) {
  const { t, settings } = await tx('settings', 'readwrite');
  await requestToPromise(settings.put({ key, value }));
  await complete(t);
}

// Tags maintenance (best-effort)
async function updateTagsWithPost(post) {
  const { t, tags } = await tx('tags', 'readwrite');
  const set = new Set((post.tags || []).map(s => s.trim()).filter(Boolean));
  for (const name of set) {
    await requestToPromise(tags.put({ name }));
  }
  await complete(t);
}

async function rebuildTags() {
  const posts = await getAllPosts();
  const names = new Set();
  for (const p of posts) {
    for (const tag of (p.tags || [])) {
      const nm = String(tag).trim();
      if (nm) names.add(nm);
    }
  }
  const { t, tags } = await tx('tags', 'readwrite');
  await requestToPromise(tags.clear());
  for (const name of names) {
    await requestToPromise(tags.put({ name }));
  }
  await complete(t);
}

export async function getAllTagNames() {
  const { t, tags } = await tx('tags', 'readonly');
  const all = await requestToPromise(tags.getAll());
  await complete(t);
  return all.map(r => r.name).sort((a,b) => a.localeCompare(b));
}

/**
 * getTagStats(limit = 10)
 * Returns [{ name, count }] sorted by usage across all posts.
 */
export async function getTagStats(limit = 10) {
  const posts = await getAllPosts();
  const counts = new Map();
  for (const p of posts) {
    for (const tag of (p.tags || [])) {
      const nm = String(tag).trim();
      if (!nm) continue;
      counts.set(nm, (counts.get(nm) || 0) + 1);
    }
  }
  const arr = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  arr.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return typeof limit === 'number' && limit > 0 ? arr.slice(0, limit) : arr;
}

// Low-level promise helpers
function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function complete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
  });
}