/**
 * app.js
 * Bootstraps CS2 Trickz MVP: state, event bindings, rendering, hotkeys.
 */

import { formatDateForFile } from './utils.js';
import * as utils from './utils.js';
import * as db from './db.js';
import * as ui from './ui.js';
import * as filters from './filters.js';
import { exportData, importData } from './export.js';
import * as seed from './seed.js';

const els = {
  grid: document.getElementById('grid'),
  modalRoot: document.getElementById('modal-root'),

  // Topbar actions
  btnNew: document.getElementById('btn-new'),
  btnExport: document.getElementById('btn-export'),
  btnImport: document.getElementById('btn-import'),
  btnClearFilters: document.getElementById('btn-clear-filters'),
  fileImport: document.getElementById('file-import'),

  // Filters
  // Types are built dynamically inside #type-segmented; use event delegation

  groupSubtype: document.getElementById('group-subtype'),
  subtypeNades: document.getElementById('subtype-nades'),

  filterCategory: document.getElementById('filter-category'),
  filterMap: document.getElementById('filter-map'),

  filterFavAll: document.getElementById('filter-fav-all'),
  filterFavOnly: document.getElementById('filter-fav-only'),
  filterSort: document.getElementById('filter-sort'),
 
  filterSideButtons: Array.from(document.querySelectorAll('[data-side]')),
  filterTags: document.getElementById('filter-tags'),
  filterSearch: document.getElementById('filter-search'),
  popularTags: document.getElementById('popular-tags'),

  // Add-new controls
  typeSegmented: document.getElementById('type-segmented'),
  btnAddType: document.getElementById('btn-add-type'),
  btnAddSubtype: document.getElementById('btn-add-subtype'),
  btnAddMap: document.getElementById('btn-add-map'),
};

const DEFAULT_STATE = {
  category: '',        // '' (All) | category name (e.g., CS2)
  type: '',            // '' (All) | type name
  subtype: '',         // '' (All) | subtype name (scoped per Type)
  map: '',             // '' (All) | map name
  side: '',            // '' (Both) | 'T' | 'CT'
  favoriteMode: '',    // '' (All) | 'only' (Favorites)
  sort: 'modified',    // 'modified' | 'created' | 'favorites' | 'alpha'
  tags: '',            // comma-separated
  search: '',          // free text
};

let state = { ...DEFAULT_STATE };

// Custom lists (persisted in settings)
let customTypes = [];
let customNadeSubtypes = [];
let customMaps = [];

// Init
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await db.openDB();

  // Ensure modal overlay starts hidden (prevents background blur if anything left over)
  if (els.modalRoot) els.modalRoot.hidden = true;

  // Load last state
  const saved = await db.getSetting('filters', null);
  if (saved && typeof saved === 'object') {
    state = { ...DEFAULT_STATE, ...saved };
  }

  bindUI();

  // Filters are built dynamically from existing posts (no custom-list boot here)

  applyStateToControls();
  await maybeSeedDemo();
  await render();

  bindHotkeys();
}

function bindUI() {
  // New post
  els.btnNew.addEventListener('click', () => {
    ui.showPostEditor({
      category: state.category,
      type: state.type,
      subtype: state.subtype,
      map: state.map,
      mapOther: state.mapOther,
      side: state.side || '',
      title: '',
      notes: '',
      tags: (state.tags || '').split(',').map(s => s.trim()).filter(Boolean),
      youtubeUrl: '',
      images: [],
      favorite: false,
    }, onPostSavedOrCancelled);
  });

  // Export
  els.btnExport.addEventListener('click', async () => {
    await exportData();
  });

  // Import
  els.btnImport.addEventListener('click', () => els.fileImport.click());
  els.fileImport.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      await importData(file, { strategy: 'merge' });
      await render();
      await renderPopularTags();
    } finally {
      e.target.value = '';
    }
  });

  // Clear filters
  if (els.btnClearFilters) {
    els.btnClearFilters.addEventListener('click', () => {
      state = { ...DEFAULT_STATE };
      applyStateToControls();
      scheduleRenderAndPersist(true);
    });
  }

  // Add new Type/Subtype/Map
  if (els.btnAddType) {
    els.btnAddType.addEventListener('click', async () => {
      const name = (prompt('Add new type name:') || '').trim();
      if (!name) return;
      const exists = ['NADES','PLAYS','TRICKZ', ...customTypes].some(t => t.toLowerCase() === name.toLowerCase());
      if (exists) { alert('Type already exists.'); return; }
      customTypes.push(name);
      await db.setSetting('custom_types', customTypes);
      rebuildTypeButtons();
    });
  }
  if (els.btnAddSubtype) {
    els.btnAddSubtype.addEventListener('click', async () => {
      // Context: if current type is NADES, extend segmented list; else fill free-text field
      const val = (prompt('Add new subtype:') || '').trim();
      if (!val) return;
      if (state.type === 'NADES') {
        const exists = ['SMOKE','FLASH','MOLLIE', ...customNadeSubtypes].some(s => s.toLowerCase() === val.toLowerCase());
        if (exists) { alert('Subtype already exists.'); return; }
        customNadeSubtypes.push(val);
        await db.setSetting('custom_nade_subtypes', customNadeSubtypes);
        rebuildSubtypeNades();
        setActiveSubtype(val);
      } else {
        els.subtypePlays.value = val;
        state.playsSubtypeText = val;
        scheduleRenderAndPersist();
      }
    });
  }
  if (els.btnAddMap) {
    els.btnAddMap.addEventListener('click', async () => {
      const val = (prompt('Add new map:') || '').trim();
      if (!val) return;
      const exists = Array.from(els.filterMap.options).some(o => (o.value || o.text).toLowerCase() === val.toLowerCase())
        || customMaps.some(m => m.toLowerCase() === val.toLowerCase());
      if (exists) { alert('Map already exists.'); return; }
      customMaps.push(val);
      await db.setSetting('custom_maps', customMaps);
      rebuildMapOptions();
      els.filterMap.value = val;
      state.map = val;
      els.filterMapOther.style.display = 'none';
      scheduleRenderAndPersist();
    });
  }

  // Type segmented (dynamic) — clicking an active type clears the filter (show all)
  if (els.typeSegmented) {
    els.typeSegmented.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-type]');
      if (!btn) return;
      const t = btn.getAttribute('data-type') || '';
      if (state.type === t) {
        setActiveType('', { persist: true });
      } else {
        setActiveType(t, { persist: true });
      }
    });
  }

  // Subtype (NADES segmented) — clicking active again clears filter (show all)
  els.subtypeNades.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-subtype]');
    if (!btn) return;
    const sub = btn.getAttribute('data-subtype') || 'SMOKE';
    if (state.subtype === sub) {
      setActiveSubtype('', { persist:true });
    } else {
      setActiveSubtype(sub);
    }
  });

  // Subtype is built dynamically from posts per selected Type (no free-text field in filters)

  // Category
  if (els.filterCategory) {
    els.filterCategory.addEventListener('change', () => {
      state.category = els.filterCategory.value || '';
      scheduleRenderAndPersist();
    });
  }

  // Map
  els.filterMap.addEventListener('change', () => {
    state.map = els.filterMap.value;
    scheduleRenderAndPersist();
  });

  // Side segmented
  for (const btn of els.filterSideButtons) {
    btn.addEventListener('click', () => {
      const side = btn.getAttribute('data-side') || '';
      setActiveSide(side);
    });
  }

  // Favorites segmented
  if (els.filterFavAll && els.filterFavOnly) {
    const setFavMode = (mode) => {
      state.favoriteMode = mode || '';
      els.filterFavAll.classList.toggle('active', state.favoriteMode === '');
      els.filterFavOnly.classList.toggle('active', state.favoriteMode === 'only');
      scheduleRenderAndPersist();
    };
    els.filterFavAll.addEventListener('click', () => setFavMode(''));
    els.filterFavOnly.addEventListener('click', () => setFavMode('only'));
  }

  // Sort select
  if (els.filterSort) {
    els.filterSort.addEventListener('change', () => {
      state.sort = els.filterSort.value || 'modified';
      scheduleRenderAndPersist();
    });
  }

  // Tags
  els.filterTags.addEventListener('input', () => {
    state.tags = els.filterTags.value;
    scheduleRenderAndPersist();
  });

  // Search
  els.filterSearch.addEventListener('input', () => {
    state.search = els.filterSearch.value;
    scheduleRenderAndPersist();
  });
}

function applyStateToControls() {
  // Type
  setActiveType(state.type || '', { renderNow:false, persist:false });

  // Subtype (set active button if present)
  for (const b of els.subtypeNades.querySelectorAll('button[data-subtype]')) {
    const isActive = (b.getAttribute('data-subtype') || '') === (state.subtype || '');
    b.classList.toggle('active', isActive && state.subtype !== '');
  }

  // Category
  if (els.filterCategory) {
    els.filterCategory.value = state.category || '';
  }

  // Map
  if (els.filterMap) {
    els.filterMap.value = state.map || '';
  }

  // Side
  setActiveSide(state.side || '', { renderNow:false, persist:false });

  // Favorites
  if (els.filterFavAll && els.filterFavOnly) {
    els.filterFavAll.classList.toggle('active', (state.favoriteMode || '') === '');
    els.filterFavOnly.classList.toggle('active', (state.favoriteMode || '') === 'only');
  }

  // Sort
  if (els.filterSort) {
    els.filterSort.value = state.sort || 'modified';
  }

  // Tags/Search
  els.filterTags.value = state.tags || '';
  els.filterSearch.value = state.search || '';
}

function swapSubtypeControls(mode) {
  // Show subtype segmented only when a Type is selected
  if (!els.groupSubtype) return;
  const show = !!(mode && String(mode).length);
  els.subtypeNades.style.display = show ? '' : 'none';
}

function setActiveType(t, opts = {}) {
  const prev = state.type || '';
  state.type = t || '';
  const seg = document.getElementById('type-segmented');
  if (seg) {
    for (const b of seg.querySelectorAll('button[data-type]')) {
      const val = b.getAttribute('data-type') || '';
      b.classList.toggle('active', val === state.type && state.type !== '');
    }
  }
  // Clear subtype when clearing Type OR switching to a different Type
  if (!state.type || prev.toLowerCase() !== state.type.toLowerCase()) {
    state.subtype = '';
  }
  swapSubtypeControls(state.type);
  if (opts.renderNow !== false) scheduleRenderAndPersist(opts.persist);
}

/**
 * toggleType(t)
 * Clicking an already active type clears the filter (no type selected => show all)
 */
function toggleType(t, opts = {}) {
  if (state.type === t) {
    setActiveType('', opts);
  } else {
    setActiveType(t, opts);
  }
}

function setActiveSubtype(sub, opts = {}) {
  state.subtype = sub || '';
  for (const b of els.subtypeNades.querySelectorAll('button[data-subtype]')) {
    const isActive = (b.getAttribute('data-subtype') || '') === state.subtype && state.subtype !== '';
    b.classList.toggle('active', isActive);
  }
  if (opts.renderNow !== false) scheduleRenderAndPersist(opts.persist);
}

function setActiveSide(side, opts = {}) {
  state.side = side || '';
  for (const b of els.filterSideButtons) {
    const s = b.getAttribute('data-side') || '';
    b.classList.toggle('active', s === state.side);
  }
  if (opts.renderNow !== false) scheduleRenderAndPersist(opts.persist);
}

let renderTimer = 0;
function scheduleRenderAndPersist(persist = true) {
  if (renderTimer) cancelAnimationFrame(renderTimer);
  renderTimer = requestAnimationFrame(async () => {
    await render();
    if (persist) await db.setSetting('filters', state);
  });
}

async function render() {
  const normalized = filters.apply(state);
  const posts = await db.queryPosts(normalized);

  // Build filter options from ALL posts (not the filtered subset)
  const allPosts = await db.getAllPosts();
  buildFilterCategories(allPosts);
  buildFilterTypes(allPosts);
  buildFilterSubtypes(allPosts);
  buildFilterMaps(allPosts);

  // Apply sorting
  const postsSorted = (() => {
    const arr = posts.slice();
    const mode = state.sort || 'modified';
    const getTime = (v) => (v ? new Date(v).getTime() : 0);
    switch (mode) {
      case 'created':
        arr.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
        break;
      case 'favorites':
        arr.sort((a, b) => (Number(!!b.favorite) - Number(!!a.favorite)) || (getTime(b.updatedAt) - getTime(a.updatedAt)));
        break;
      case 'alpha':
        arr.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
        break;
      case 'modified':
      default:
        arr.sort((a, b) => getTime(b.updatedAt) - getTime(a.updatedAt));
        break;
    }
    return arr;
  })();

  ui.renderGrid(els.grid, postsSorted, {
    onEdit: (post) => ui.showPostEditor(post, onPostSavedOrCancelled),
    onToggleFav: async (post) => {
      post.favorite = !post.favorite;
      await db.putPost(post);
      await render();
    },
    onDelete: async (post) => {
      const ok = await ui.confirm('Delete this post?');
      if (!ok) return;
      await db.deletePost(post.id);
      await render();
    },
  });

  // Show Category/Type filters only when there are any posts; show Subtype only when a Type is selected
  const categoryGroup = document.getElementById('group-category');
  const typeGroup = document.getElementById('group-type');
  const subtypeGroup = document.getElementById('group-subtype');
  const noData = allPosts.length === 0;
  if (categoryGroup) categoryGroup.classList.toggle('hidden', noData);
  if (typeGroup) typeGroup.classList.toggle('hidden', noData);
  if (subtypeGroup) {
    const shouldShow = !noData && !!state.type;
    subtypeGroup.classList.toggle('hidden', !shouldShow);
  }

  // Refresh popular tag chips
  await renderPopularTags();
}

async function onPostSavedOrCancelled(updated) {
  if (updated) {
    await db.putPost(updated);
  }
  await render();
}

/**
 * Load custom lists from settings store
 */
async function loadCustomLists() {
  customTypes = await db.getSetting('custom_types', []);
  customNadeSubtypes = await db.getSetting('custom_nade_subtypes', []);
  customMaps = await db.getSetting('custom_maps', []);
}

/**
 * Build/refresh segmented buttons for Types from customTypes
 */
function rebuildTypeButtons() {
  if (!els.typeSegmented) return;
  const existing = new Set(Array.from(els.typeSegmented.querySelectorAll('button[data-type]')).map(b => (b.getAttribute('data-type') || '').toLowerCase()));
  for (const name of customTypes) {
    if (existing.has(name.toLowerCase())) continue;
    const btn = document.createElement('button');
    btn.className = 'seg';
    btn.textContent = name.toUpperCase();
    btn.setAttribute('data-type', name);
    btn.addEventListener('click', () => toggleType(name));
    els.typeSegmented.appendChild(btn);
  }
}

/**
 * Build/refresh segmented buttons for NADES subtypes from customNadeSubtypes
 */
function rebuildSubtypeNades() {
  if (!els.subtypeNades) return;
  const existing = new Set(Array.from(els.subtypeNades.querySelectorAll('button[data-subtype]')).map(b => (b.getAttribute('data-subtype') || '').toLowerCase()));
  for (const name of customNadeSubtypes) {
    if (existing.has(name.toLowerCase())) continue;
    const btn = document.createElement('button');
    btn.className = 'seg';
    btn.textContent = name.toUpperCase();
    btn.setAttribute('data-subtype', name);
    els.subtypeNades.appendChild(btn);
  }
}

/**
 * Build/refresh map options from customMaps
 */
function rebuildMapOptions() {
  if (!els.filterMap) return;
  const opts = Array.from(els.filterMap.options);
  const existing = new Set(opts.map(o => (o.value || o.text).toLowerCase()));
  const otherOpt = opts.find(o => (o.value || o.text) === 'Other');
  for (const name of customMaps) {
    if (existing.has(name.toLowerCase())) continue;
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (otherOpt) els.filterMap.insertBefore(opt, otherOpt);
    else els.filterMap.appendChild(opt);
  }
}

function bindHotkeys() {
  window.addEventListener('keydown', async (e) => {
    // Skip if typing into input/textarea
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const editable = tag === 'INPUT' || tag === 'TEXTAREA';
    if (editable && e.key !== 'Escape') return;

    switch (e.key.toLowerCase()) {
      case 'n': // New
        e.preventDefault();
        els.btnNew.click();
        break;
      case 'f': // Focus search
        e.preventDefault();
        els.filterSearch.focus();
        break;
      case '1': // Quick toggle for NADES (if present)
        e.preventDefault();
        if (state.type === 'NADES') toggleType('NADES'); else setActiveType('NADES');
        break;
      case 'e': // Export
        e.preventDefault();
        await exportData();
        break;
      case 'i': // Import
        e.preventDefault();
        els.btnImport.click();
        break;
      case 'escape':
        ui.closeModal();
        break;
    }
  });
}

async function maybeSeedDemo() {
  const alreadySeeded = await db.getSetting('seeded_v1', false);
  const count = (await db.getAllPosts()).length;
  if (!alreadySeeded && count === 0) {
    await seed.loadDemo();
    await db.setSetting('seeded_v1', true);
  }
}
/**
 * Popular tag chips rendering
 * Shows most used tags under the Tags filter and lets user toggle them quickly.
 */
async function renderPopularTags() {
  if (!els.popularTags) return;

  const stats = await db.getTagStats(12);
  const current = String(els.filterTags.value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const currentSet = new Set(current.map(s => s.toLowerCase()));
  els.popularTags.textContent = '';

  for (const { name, count } of stats) {
    const chip = document.createElement('span');
    const active = currentSet.has(name.toLowerCase());
    chip.className = 'badge clickable' + (active ? ' accent' : '');
    chip.title = `#${name} (${count})`;
    chip.textContent = `#${name}`;
    chip.addEventListener('click', () => {
      // Toggle the tag in the input
      let list = String(els.filterTags.value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const idx = list.findIndex(t => t.toLowerCase() === name.toLowerCase());
      if (idx >= 0) list.splice(idx, 1);
      else list.push(name);

      els.filterTags.value = list.join(', ');
      state.tags = els.filterTags.value;
      scheduleRenderAndPersist();
    });

    els.popularTags.appendChild(chip);
  }
}

/**
 * Build filter UI (Categories/Types/Subtypes/Maps) from all posts
 */
function buildFilterCategories(allPosts) {
  const sel = document.getElementById('filter-category');
  if (!sel) return;
  const names = new Set();
  for (const p of allPosts) {
    const c = String(p.category || '').trim();
    if (c) names.add(c);
  }
  const sorted = Array.from(names).sort((a,b) => a.localeCompare(b));

  sel.textContent = '';
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = 'All';
  sel.appendChild(optAll);

  for (const nm of sorted) {
    const o = document.createElement('option');
    o.value = nm;
    o.textContent = nm;
    sel.appendChild(o);
  }

  if (state.category && !names.has(state.category)) {
    state.category = '';
  }
  sel.value = state.category || '';
}

/**
 * Build filter UI (Types/Subtypes/Maps) from all posts
 */
function buildFilterTypes(allPosts) {
  const container = document.getElementById('type-segmented');
  if (!container) return;
  const seen = new Set();
  const types = [];
  for (const p of allPosts) {
    const t = String(p.type || '').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (!seen.has(key)) { seen.add(key); types.push(t); }
  }
  types.sort((a,b) => a.localeCompare(b));
  container.textContent = '';
  for (const t of types) {
    const btn = document.createElement('button');
    btn.className = 'seg' + ((state.type && state.type.toLowerCase() === t.toLowerCase()) ? ' active' : '');
    btn.setAttribute('data-type', t);
    btn.textContent = t.toUpperCase();
    container.appendChild(btn);
  }
}

function buildFilterSubtypes(allPosts) {
  const box = document.getElementById('subtype-nades');
  if (!box) return;
  box.textContent = '';
  if (!state.type) return;
  const set = new Set();
  for (const p of allPosts) {
    if ((p.type || '') !== state.type) continue;
    const s = String(p.subtype || '').trim();
    if (!s) continue;
    const key = s.toUpperCase();
    if (!set.has(key)) set.add(key);
  }
  const arr = Array.from(set).sort((a,b) => a.localeCompare(b));
  for (const name of arr) {
    const btn = document.createElement('button');
    const isActive = state.subtype && name.toLowerCase() === state.subtype.toLowerCase();
    btn.className = 'seg' + (isActive ? ' active' : '');
    btn.setAttribute('data-subtype', name);
    btn.textContent = name;
    // No per-button handler here; we use the delegated handler on els.subtypeNades
    box.appendChild(btn);
  }
}

function buildFilterMaps(allPosts) {
  if (!els.filterMap) return;
  const names = new Set();
  for (const p of allPosts) {
    const base = (p.map === 'Other') ? String(p.mapOther || '').trim() : String(p.map || '').trim();
    if (base) names.add(base);
  }
  const sorted = Array.from(names).sort((a,b) => a.localeCompare(b));
  els.filterMap.textContent = '';
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = 'All';
  els.filterMap.appendChild(optAll);
  for (const nm of sorted) {
    const o = document.createElement('option');
    o.value = nm;
    o.textContent = nm;
    els.filterMap.appendChild(o);
  }
  if (state.map && !names.has(state.map)) {
    state.map = '';
  }
  els.filterMap.value = state.map || '';
}