/**
 * ui.js
 * Rendering of grid, cards, and the post editor modal.
 */
import * as utils from './utils.js';
import * as db from './db.js';

let modalRoot = null;

export function renderGrid(container, posts, { onEdit, onToggleFav, onDelete } = {}) {
  modalRoot = modalRoot || document.getElementById('modal-root');
  container.textContent = '';

  if (!posts.length) {
    const empty = document.createElement('div');
    empty.style.color = '#96a0b5';
    empty.style.padding = '16px';
    empty.textContent = 'No posts match your filters. Press N to add one.';
    container.appendChild(empty);
    return;
  }

  for (const p of posts) {
    container.appendChild(renderCard(p, { onEdit, onToggleFav, onDelete }));
  }
}

function renderCard(post, { onEdit, onToggleFav, onDelete }) {
  const card = document.createElement('article');
  card.className = 'card';

  const thumb = document.createElement('img');
  thumb.className = 'thumb';
  thumb.alt = post.title || '';
  const explicitImg = Array.isArray(post.images) && post.images[0] && post.images[0].dataUrl;
  const ytThumb = utils.youtubeThumb(post.youtubeUrl || post.youtubeId);
  thumb.src = explicitImg || ytThumb || '';
  card.appendChild(thumb);

  const body = document.createElement('div');
  body.className = 'body';
  card.appendChild(body);

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = post.title || '(untitled)';
  body.appendChild(title);

  const badges = document.createElement('div');
  badges.className = 'badges';

  if (post.category) badges.appendChild(makeBadge(post.category));
  badges.appendChild(makeBadge(post.type, 'accent'));
  if (post.type === 'NADES') {
    if (post.subtype) badges.appendChild(makeBadge(post.subtype));
  } else if (post.type === 'PLAYS') {
    if (post.subtype) badges.appendChild(makeBadge(post.subtype));
  }
  if (post.map) badges.appendChild(makeBadge(post.map));
  if (post.map === 'Other' && post.mapOther) badges.appendChild(makeBadge(post.mapOther));
  if (post.side) badges.appendChild(makeBadge(post.side));

  const tagBadges = (post.tags || []).slice(0, 4);
  for (const t of tagBadges) badges.appendChild(makeBadge('#' + t));

  body.appendChild(badges);

  // Date stamps (created/modified)
  const meta = document.createElement('div');
  meta.className = 'meta';
  const created = (post.createdAt || '').slice(0,10);
  const modified = (post.updatedAt || '').slice(0,10);
  meta.textContent = `${created ? ('Created: ' + created) : ''}${created && modified ? ' • ' : ''}${modified ? ('Modified: ' + modified) : ''}`;
  body.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'actions';
  body.appendChild(actions);

  const btnView = document.createElement('button');
  btnView.textContent = 'View';
  btnView.addEventListener('click', (e) => { e.stopPropagation(); showPostViewer(post, { onEdit, onToggleFav, onDelete }); });
  actions.appendChild(btnView);

  const btnEdit = document.createElement('button');
  btnEdit.textContent = 'Edit';
  btnEdit.addEventListener('click', (e) => { e.stopPropagation(); onEdit && onEdit(post); });
  actions.appendChild(btnEdit);

  const btnFav = document.createElement('button');
  btnFav.className = 'btn-fav' + (post.favorite ? ' active' : '');
  btnFav.textContent = post.favorite ? '★ Fav' : '☆ Fav';
  btnFav.addEventListener('click', (e) => { e.stopPropagation(); onToggleFav && onToggleFav(post); });
  actions.appendChild(btnFav);

  const btnDel = document.createElement('button');
  btnDel.style.color = '#ffb0b0';
  btnDel.textContent = 'Delete';
  btnDel.addEventListener('click', (e) => { e.stopPropagation(); onDelete && onDelete(post); });
  actions.appendChild(btnDel);

  // Open viewer when clicking the card anywhere (thumb/background)
  card.addEventListener('click', () => showPostViewer(post, { onEdit, onToggleFav, onDelete }));

  return card;
}

function makeBadge(text, extraClass = '') {
  const b = document.createElement('span');
  b.className = 'badge' + (extraClass ? (' ' + extraClass) : '');
  b.textContent = text;
  return b;
}

/**
 * showPostEditor(initial, onDone(updatedOrNull))
 * - initial: existing post object or a partial for new
 */
export function showPostEditor(initial = {}, onDone) {
  modalRoot = modalRoot || document.getElementById('modal-root');
  modalRoot.innerHTML = '';
  modalRoot.hidden = false;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <header>
      <strong>${initial.id ? 'Edit Post' : 'New Post'}</strong>
      <button id="btn-close">Close</button>
    </header>
    <div class="content">
      <div class="form-col">
        <div class="form-col">
          <label>Category</label>
          <input id="f-category" class="input" type="text" placeholder="e.g., CS2" />
        </div>
        <div class="form-row">
          <div class="form-col" style="flex:1">
            <label>Type</label>
            <input id="f-type" class="input" type="text" list="dl-type" placeholder="Type (e.g., NADES, TRICKZ)" />
            <datalist id="dl-type"></datalist>
          </div>
          <div class="form-col" style="flex:1">
            <label>Subtype</label>
            <input id="f-subtype" class="input" type="text" list="dl-subtype" placeholder="Subtype (per type)" />
            <datalist id="dl-subtype"></datalist>
          </div>
        </div>

        <div class="form-row">
          <div class="form-col" style="flex:1">
            <label>Map</label>
            <input id="f-map" class="input" type="text" list="dl-map" placeholder="Map" />
            <datalist id="dl-map"></datalist>
          </div>
          <div class="form-col" style="flex:1">
            <label>Side</label>
            <select id="f-side" class="input">
              <option value=""></option>
              <option>Both</option>
              <option>T</option>
              <option>CT</option>
            </select>
          </div>
        </div>

        <div class="form-col">
          <label>Title</label>
          <input id="f-title" class="input" type="text" placeholder="E.g., Mirage T SMOKE Window from T-spawn" />
        </div>

        <div class="form-col">
          <label>Notes</label>
          <textarea id="f-notes" class="input" placeholder="Line-up notes, crosshair placement, positions..."></textarea>
        </div>

        <div class="form-col">
          <label>Tags (comma separated)</label>
          <input id="f-tags" class="input" type="text" placeholder="mid, window, execute" />
        </div>

        <div class="form-row">
          <div class="form-col" style="flex:2">
            <label>YouTube URL or ID</label>
            <input id="f-youtube" class="input" type="text" placeholder="https://youtu.be/XXXXXXXXXXX" />
          </div>
          <div class="form-col" style="flex:1">
            <label>Start (seconds)</label>
            <input id="f-youtube-start" class="input" type="number" min="0" step="1" />
          </div>
        </div>

        <div class="form-col">
          <label>Medal.tv embed or URL (optional)</label>
          <input id="f-medal" class="input" type="text" placeholder="Paste Medal.tv embed code or URL" />
        </div>

        <div class="form-row">
          <div class="form-col" style="flex:2">
            <label>WebM video URL (optional)</label>
            <input id="f-webm" class="input" type="url" placeholder="https://.../video.webm" />
          </div>
          <div class="form-col" style="flex:1">
            <label>External link (optional)</label>
            <input id="f-link" class="input" type="url" placeholder="https://example.com/resource" />
          </div>
        </div>

        <div class="form-col">
          <label>Images</label>
          <input id="f-images" class="input" type="file" multiple accept="image/*" />
          <div id="images-preview" class="badges" style="margin-top:8px"></div>
        </div>
      </div>

      <div class="form-col">
        <div>
          <label>Preview</label>
          <div id="preview-pane"></div>
        </div>
      </div>
    </div>
    <div class="footer">
      <button id="btn-save" class="primary">Save</button>
      <button id="btn-cancel">Cancel</button>
      <div style="flex:1"></div>
      <label style="display:flex; align-items:center; gap:6px; font-size:13px">
        <input id="f-fav" type="checkbox" />
        Favorite
      </label>
    </div>
  `;
  modalRoot.appendChild(modal);

  // Field refs
  const fCategory = modal.querySelector('#f-category');
  const fType = modal.querySelector('#f-type');
  const fSubtype = modal.querySelector('#f-subtype');
  const fMap = modal.querySelector('#f-map');
  const fSide = modal.querySelector('#f-side');
  const fTitle = modal.querySelector('#f-title');
  const fNotes = modal.querySelector('#f-notes');
  const fTags = modal.querySelector('#f-tags');
  const fYou = modal.querySelector('#f-youtube');
  const fYouStart = modal.querySelector('#f-youtube-start');
  const fMedal = modal.querySelector('#f-medal');
  const fWebm = modal.querySelector('#f-webm');
  const fLink = modal.querySelector('#f-link');
  const fImgs = modal.querySelector('#f-images');
  const imgsPreview = modal.querySelector('#images-preview');
  const fFav = modal.querySelector('#f-fav');
  const previewPane = modal.querySelector('#preview-pane');

  // State
  const working = structuredClone(sanitizeInitial(initial));

  // Initialize values
  fCategory.value = working.category || '';
  fType.value = working.type || '';
  fSubtype.value = working.subtype || '';
  fMap.value = working.map || '';
  fSide.value = working.side || '';
  fTitle.value = working.title || '';
  fNotes.value = working.notes || '';
  fTags.value = (working.tags || []).join(', ');
  fYou.value = working.youtubeUrl || working.youtubeId || '';
  fYouStart.value = working.youtubeStart ? String(working.youtubeStart) : '';
  fMedal.value = working.medalSrc || '';
  fWebm.value = working.webmUrl || '';
  fLink.value = working.linkUrl || '';
  fFav.checked = !!working.favorite;
  // Dynamic catalogs for editor (built-in + user-defined in settings)
  const BUILTIN_TYPES = ['NADES','TRICKZ'];
  const BUILTIN_SUBS_BY_TYPE = { 'NADES': ['SMOKE','FLASH','MOLLY'] };
  const BUILTIN_MAPS = ['Ancient','Anubis','Dust2','Inferno','Mirage','Nuke','Overpass','Vertigo'];

  let customTypes = [];
  let customSubtypesByType = {};
  let customMaps = [];

  // Hydrate from settings and build controls
  (async function hydrateEditorCatalogs(){
    try {
      customTypes = await db.getSetting('custom_types', []);
      customSubtypesByType = await db.getSetting('custom_subtypes_by_type', {});
      customMaps = await db.getSetting('custom_maps', []);
    } catch(e) {
      console.warn('Failed to load editor catalogs', e);
    } finally {
      buildTypeDatalist();
      await buildSubtypeDatalist(fType.value || '');
      buildMapDatalist();
    }
  })();

  function buildTypeDatalist() {
    const list = modal.querySelector('#dl-type');
    if (!list) return;
    list.textContent = '';
    const keep = new Set();
    const all = [...BUILTIN_TYPES, ...customTypes];
    for (const t of all) {
      const key = String(t || '').trim();
      if (!key || keep.has(key.toLowerCase())) continue;
      keep.add(key.toLowerCase());
      const opt = document.createElement('option');
      opt.value = key;
      list.appendChild(opt);
    }
  }

  async function buildSubtypeDatalist(type) {
    const list = modal.querySelector('#dl-subtype');
    if (!list) return;
    list.textContent = '';
    const t = String(type || '').trim();
    if (!t) return;

    // Build suggestions from existing posts only (case-insensitive, display/store as UPPERCASE)
    let posts = [];
    try {
      posts = await db.getAllPosts();
    } catch (_) {
      posts = [];
    }
    const set = new Set();
    for (const p of posts) {
      if (!p) continue;
      const pt = String(p.type || '').trim();
      if (!pt) continue;
      if (pt.toLowerCase() !== t.toLowerCase()) continue;
      let sub = String(p.subtype || '').trim();
      if (!sub) continue;
      sub = sub.toUpperCase();
      // Normalize MOLLIE -> MOLLY for consistency
      if (sub === 'MOLLIE') sub = 'MOLLY';
      if (!set.has(sub)) set.add(sub);
    }

    const arr = Array.from(set).sort((a,b) => a.localeCompare(b));
    for (const name of arr) {
      const opt = document.createElement('option');
      opt.value = name;
      list.appendChild(opt);
    }
  }

  function buildMapDatalist() {
    const list = modal.querySelector('#dl-map');
    if (!list) return;
    list.textContent = '';
    const keep = new Set();
    const all = [...BUILTIN_MAPS, ...customMaps];
    for (const m of all) {
      const key = String(m || '').trim();
      if (!key || keep.has(key.toLowerCase())) continue;
      keep.add(key.toLowerCase());
      const opt = document.createElement('option');
      opt.value = key;
      list.appendChild(opt);
    }
  }

  // Combo fields (datalists) are hydrated above; free typing is allowed and persisted on Save

  // Preview images existing
  renderImagesPreview(imgsPreview, working.images || []);

  // Preview pane
  renderPreview(previewPane, working);

  // Events
  modal.querySelector('#btn-close').addEventListener('click', () => closeModal(onDone, null));
  modal.querySelector('#btn-cancel').addEventListener('click', () => closeModal(onDone, null));
  modal.querySelector('#btn-save').addEventListener('click', async () => {
    const saved = await collectAndValidate();
    if (saved) closeModal(onDone, saved);
  });

  fType.addEventListener('input', () => {
    working.type = (fType.value || '').trim();
    buildSubtypeDatalist(working.type);
    renderPreview(previewPane, working);
  });

  fSubtype.addEventListener('input', () => {
    working.subtype = (fSubtype.value || '').trim().toUpperCase();
    fSubtype.value = working.subtype;
    renderPreview(previewPane, working);
  });

  fMap.addEventListener('input', () => {
    working.map = (fMap.value || '').trim();
    renderPreview(previewPane, working);
  });
  fSide.addEventListener('change', () => {
    working.side = fSide.value;
    renderPreview(previewPane, working);
  });
  fCategory.addEventListener('input', () => {
    working.category = (fCategory.value || '').trim();
    renderPreview(previewPane, working);
  });
  fTitle.addEventListener('input', () => {
    working.title = fTitle.value;
  });
  fNotes.addEventListener('input', () => {
    working.notes = fNotes.value;
  });
  fTags.addEventListener('input', () => {
    working.tags = parseTags(fTags.value);
  });
  fYou.addEventListener('input', () => {
    working.youtubeUrl = fYou.value;
    working.youtubeId = utils.getYoutubeId(working.youtubeUrl);
    renderPreview(previewPane, working);
  });
  fYouStart.addEventListener('input', () => {
    working.youtubeStart = Number(fYouStart.value) || 0;
    renderPreview(previewPane, working);
  });

  fMedal.addEventListener('input', () => {
    working.medalSrc = utils.extractMedalSrc(fMedal.value);
    renderPreview(previewPane, working);
  });

  fWebm.addEventListener('input', () => {
    working.webmUrl = (fWebm.value || '').trim();
    renderPreview(previewPane, working);
  });
  fLink.addEventListener('input', () => {
    working.linkUrl = (fLink.value || '').trim();
  });

  fFav.addEventListener('change', () => {
    working.favorite = fFav.checked;
  });

  fImgs.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const dataUrl = await utils.compressImage(file, { maxWidth: 1200, quality: 0.7 });
      (working.images ||= []).push({ id: utils.id(), dataUrl, caption: '' });
    }
    renderImagesPreview(imgsPreview, working.images);
    renderPreview(previewPane, working);
    fImgs.value = '';
  });

  // Datalist-based subtype suggestions are rebuilt on type changes (see buildSubtypeDatalist)

  async function collectAndValidate() {
    const category = (fCategory.value || '').trim();
    const type = (fType.value || '').trim();
    const subtype = (fSubtype.value || '').trim().toUpperCase();
    const map = (fMap.value || '').trim();
    const side = fSide.value || '';

    const title = (fTitle.value || '').trim();
    const notes = fNotes.value || '';
    const tags = parseTags(fTags.value);
    const youtubeUrl = fYou.value.trim();
    const youtubeId = utils.getYoutubeId(youtubeUrl);
    const youtubeStart = Number(fYouStart.value) || 0;
    const medalSrc = utils.extractMedalSrc(fMedal.value);
    const webmUrl = (fWebm.value || '').trim();
    const linkUrl = (fLink.value || '').trim();

    if (!title) {
      alert('Please enter a title.');
      return null;
    }

    const post = {
      ...initial,
      category,
      type,
      subtype,
      map,
      mapOther: '', // deprecated in editor (maps are stored by name)
      side,
      title,
      notes,
      tags,
      youtubeUrl,
      youtubeId,
      youtubeStart,
      medalSrc,
      webmUrl,
      linkUrl,
      images: working.images || [],
      favorite: fFav.checked,
    };

    await persistCombos(type, subtype, map);

    return post;
  }

  async function persistCombos(type, subtype, map) {
    // Types
    if (type) {
      const knownTypes = new Set([...BUILTIN_TYPES.map(s => s.toLowerCase()), ...customTypes.map(s => s.toLowerCase())]);
      if (!knownTypes.has(type.toLowerCase())) {
        customTypes.push(type);
        await db.setSetting('custom_types', customTypes);
        buildTypeDatalist();
      }
    }

    // Subtypes scoped per type (kept for backwards-compat; suggestions now come from saved posts)
    if (type && subtype) {
      const built = (BUILTIN_SUBS_BY_TYPE[(type || '').toUpperCase()] || []).map(s => s.toLowerCase());
      const current = (customSubtypesByType[type] || []);
      const currentSet = new Set(current.map(s => s.toLowerCase()));
      if (!built.includes(subtype.toLowerCase()) && !currentSet.has(subtype.toLowerCase())) {
        const next = [...current, subtype];
        customSubtypesByType[type] = next;
        await db.setSetting('custom_subtypes_by_type', customSubtypesByType);
        await buildSubtypeDatalist(type);
      }
    }

    // Maps
    if (map) {
      const knownMaps = new Set([...BUILTIN_MAPS.map(s => s.toLowerCase()), ...customMaps.map(s => s.toLowerCase())]);
      if (!knownMaps.has(map.toLowerCase())) {
        customMaps.push(map);
        await db.setSetting('custom_maps', customMaps);
        buildMapDatalist();
      }
    }
  }
}

function sanitizeInitial(initial) {
  const copy = { ...initial };
  copy.tags = Array.isArray(copy.tags) ? copy.tags : [];
  copy.images = Array.isArray(copy.images) ? copy.images : [];
  // Do not force default type; allow empty so user can choose or type
  // Do not force any default subtype; keep whatever user provides (free text)
  return copy;
}

function markActiveSubtype(seg, value) {
  for (const b of seg.querySelectorAll('button[data-sub]')) {
    b.classList.toggle('active', (b.getAttribute('data-sub') || '') === value);
  }
}
function activeSubtype(seg) {
  const b = seg.querySelector('button.active[data-sub]');
  return (b && b.getAttribute('data-sub')) || 'SMOKE';
}

function parseTags(text) {
  return String(text || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function renderImagesPreview(container, images) {
  container.textContent = '';
  (images || []).forEach((img) => {
    const wrap = document.createElement('div');
    wrap.className = 'badge';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '6px';

    const im = document.createElement('img');
    im.src = img.dataUrl;
    im.alt = img.caption || '';
    im.style.width = '56px';
    im.style.height = '36px';
    im.style.objectFit = 'cover';
    im.style.borderRadius = '6px';
    im.style.border = '1px solid #263044';

    const cap = document.createElement('input');
    cap.className = 'input';
    cap.placeholder = 'Caption';
    cap.value = img.caption || '';
    cap.style.width = '160px';
    cap.addEventListener('input', () => { img.caption = cap.value; });

    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.addEventListener('click', () => {
      const idx = images.findIndex(i => i.id === img.id);
      if (idx >= 0) {
        images.splice(idx, 1);
        renderImagesPreview(container, images);
      }
    });

    wrap.appendChild(im);
    wrap.appendChild(cap);
    wrap.appendChild(del);
    container.appendChild(wrap);
  });
}

function renderPreview(container, post, opts = {}) {
  const { compact = false, includeNotes = true, includeHeader = true } = opts;
  container.textContent = '';

  if (includeHeader) {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = post.title || '(untitled)';
    container.appendChild(title);

    const badges = document.createElement('div');
    badges.className = 'badges';
    if (post.category) badges.appendChild(makeBadge(post.category));
    badges.appendChild(makeBadge(post.type, 'accent'));
    if (post.subtype) badges.appendChild(makeBadge(post.subtype));
    if (post.map) badges.appendChild(makeBadge(post.map));
    if (post.map === 'Other' && post.mapOther) badges.appendChild(makeBadge(post.mapOther));
    if (post.side) badges.appendChild(makeBadge(post.side));
    (post.tags || []).forEach(t => badges.appendChild(makeBadge('#' + t)));
    container.appendChild(badges);
  }

  // Media
  const media = document.createElement('div');
  media.className = 'viewer-media';
  media.style.display = 'grid';
  media.style.gap = '8px';
  container.appendChild(media);

  const hasYt = !!utils.getYoutubeId(post.youtubeUrl || post.youtubeId);
  if (hasYt) {
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = compact ? '200' : '420';
    iframe.style.border = '0';
    iframe.style.background = '#0d1220';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    iframe.src = utils.buildYouTubeEmbed(post.youtubeUrl || post.youtubeId, post.youtubeStart || 0);
    media.appendChild(iframe);
  }

  if (post.medalSrc) {
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = compact ? '200' : '420';
    iframe.style.border = '0';
    iframe.style.background = '#0d1220';
    iframe.allow = 'autoplay';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    iframe.src = post.medalSrc;
    media.appendChild(iframe);
  }

  if (post.webmUrl) {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.muted = false;
    video.style.width = '100%';
    video.style.height = compact ? '200px' : '420px';
    video.style.border = '1px solid #263044';
    video.style.background = '#0d1220';
    video.style.borderRadius = '8px';
    const src = document.createElement('source');
    src.src = post.webmUrl;
    src.type = 'video/webm';
    video.appendChild(src);
    media.appendChild(video);
  }

  for (const img of (post.images || [])) {
    const im = document.createElement('img');
    im.src = img.dataUrl;
    im.alt = img.caption || '';
    im.style.width = '100%';
    im.style.maxHeight = compact ? '220px' : '520px';
    im.style.objectFit = 'contain'; // never crop; only scale down
    im.style.borderRadius = '8px';
    im.style.border = '1px solid #263044';
    // Open full size in new tab on click
    im.addEventListener('click', () => window.open(img.dataUrl, '_blank'));
    media.appendChild(im);
    // Add hover magnifier lens
    attachZoomLens(im, img.dataUrl);
    if (img.caption) {
      const c = document.createElement('div');
      c.style.color = '#96a0b5';
      c.style.fontSize = '12px';
      c.textContent = img.caption;
      media.appendChild(c);
    }
  }

  // external link is shown in the left pane under Notes (in viewer), not here

  if (includeNotes && post.notes) {
    const notes = document.createElement('div');
    notes.style.whiteSpace = 'pre-wrap';
    notes.style.color = '#cdd7ee';
    notes.textContent = post.notes;
    container.appendChild(notes);
  }
}

/**
 * showPostViewer(post)
 * A read-only modal focused on quick viewing while playing.
 */
function showPostViewer(post, { onEdit, onToggleFav, onDelete }) {
  modalRoot = modalRoot || document.getElementById('modal-root');
  modalRoot.innerHTML = '';
  modalRoot.hidden = false;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <header>
      <strong>${post.title || '(untitled)'}</strong>
      <div>
        <button id="btn-edit">Edit</button>
        <button id="btn-close">Close</button>
      </div>
    </header>
    <div class="content viewer-grid" style="grid-template-columns: 1fr 2fr">
      <div id="viewer-left" class="viewer-left">
        <div id="viewer-info"></div>
        <div id="viewer-notes" class="viewer-notes"></div>
      </div>
      <div id="viewer-right" class="viewer-right">
        <div id="viewer-media"></div>
      </div>
    </div>
  `;
  modalRoot.appendChild(modal);

  // Close on background click (click outside the post)
  modal.addEventListener('click', (e) => e.stopPropagation());
  modalRoot.addEventListener('click', (e) => { if (e.target === modalRoot) closeModal(); }, { once: true });

  modal.querySelector('#btn-close').addEventListener('click', () => closeModal());
  modal.querySelector('#btn-edit').addEventListener('click', () => {
    showPostEditor(post, (updated) => {
      if (updated && onEdit) onEdit(updated);
      else closeModal();
    });
  });

  // Right side: media (video/images)
  const mediaWrap = modal.querySelector('#viewer-media');
  // Do not repeat header/badges on the right media column
  renderPreview(mediaWrap, post, { compact: false, includeNotes: false, includeHeader: false });

  // Left side: meta (badges) and sticky notes
  const info = modal.querySelector('#viewer-info');
  const badges = document.createElement('div');
  badges.className = 'badges';
  if (post.category) badges.appendChild(makeBadge(post.category));
  badges.appendChild(makeBadge(post.type, 'accent'));
  if (post.subtype) badges.appendChild(makeBadge(post.subtype));
  if (post.map) badges.appendChild(makeBadge(post.map));
  if (post.map === 'Other' && post.mapOther) badges.appendChild(makeBadge(post.mapOther));
  if (post.side) badges.appendChild(makeBadge(post.side));
  (post.tags || []).forEach(t => badges.appendChild(makeBadge('#' + t)));
  info.appendChild(badges);

  // removed duplicate date meta at top; dates are shown at the very bottom

  const notesEl = modal.querySelector('#viewer-notes');
  notesEl.textContent = '';

  const hasNotes = (post.notes || '').trim().length > 0;
  if (hasNotes) {
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.style.marginBottom = '6px';
    title.textContent = 'Notes';
    const body = document.createElement('div');
    body.style.whiteSpace = 'pre-wrap';
    body.textContent = post.notes;
    notesEl.appendChild(title);
    notesEl.appendChild(body);
  }

  if (post.linkUrl) {
    const lt = document.createElement('div');
    lt.style.fontWeight = '600';
    lt.style.marginTop = hasNotes ? '22px' : '0';
    lt.style.marginBottom = '4px';
    lt.textContent = 'External links';

    const la = document.createElement('a');
    la.href = post.linkUrl;
    la.target = '_blank';
    la.rel = 'noopener';
    la.textContent = post.linkUrl;
    la.style.fontSize = '12px';
    la.style.color = '#96a0b5';

    notesEl.appendChild(lt);
    notesEl.appendChild(la);
  }

  // Hide notes panel only if neither notes nor link is present
  if (!hasNotes && !post.linkUrl) {
    notesEl.style.display = 'none';
  } else {
    notesEl.style.display = '';
  }

  // Footer with date stamps at the absolute bottom of the modal
  const contentEl = modal.querySelector('.content');
  if (contentEl) {
    const foot = document.createElement('div');
    foot.className = 'viewer-footer';
    const created = (post.createdAt || '').slice(0,10);
    const modified = (post.updatedAt || '').slice(0,10);
    foot.textContent = `${created ? ('Created: ' + created) : ''}${created && modified ? ' • ' : ''}${modified ? ('Modified: ' + modified) : ''}`;
    // Append footer directly to modal so sticky bottom aligns with modal viewport bottom
    modal.appendChild(foot);
  }
}

export function closeModal(onDone, payload = null) {
  modalRoot = modalRoot || document.getElementById('modal-root');
  modalRoot.hidden = true;
  modalRoot.innerHTML = '';
  if (typeof onDone === 'function') onDone(payload);
}
/**
 * Magnifier lens over images and custom confirm modal
 * - attachZoomLens(imgEl, src): shows circular lens at 1:1 scale on hover
 * - export function confirm(message): custom confirm dialog that avoids browser prompt text
 */
function attachZoomLens(imgEl, src) {
  if (!imgEl) return;

  // Ensure the container is positioned
  const container = imgEl.parentElement || document.body;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  let lens = null;
  let naturalW = 0, naturalH = 0;

  function createLens() {
    if (lens) return;
    lens = document.createElement('div');
    lens.className = 'zoom-lens';
    lens.style.position = 'absolute';
    lens.style.pointerEvents = 'none';
    lens.style.width = '140px';
    lens.style.height = '140px';
    lens.style.borderRadius = '50%';
    lens.style.border = '2px solid rgba(255,255,255,0.35)';
    lens.style.boxShadow = '0 6px 20px rgba(0,0,0,.45)';
    lens.style.backgroundImage = `url('${src}')`;
    lens.style.backgroundRepeat = 'no-repeat';
    lens.style.zIndex = '20';
    lens.style.display = 'none';
    container.appendChild(lens);

    // Precompute natural dimensions for precise 1:1 background-size
    const probe = new Image();
    probe.onload = () => {
      naturalW = probe.naturalWidth || imgEl.naturalWidth || 0;
      naturalH = probe.naturalHeight || imgEl.naturalHeight || 0;
      if (naturalW > 0 && naturalH > 0) {
        lens.style.backgroundSize = `${naturalW}px ${naturalH}px`;
      }
    };
    probe.src = src;
  }

  function showLens() {
    if (!lens) createLens();
    if (lens) lens.style.display = '';
  }
  function hideLens() {
    if (lens) lens.style.display = 'none';
  }

  function moveLens(e) {
    if (!lens) return;
    const rect = imgEl.getBoundingClientRect();
    const x = e.clientX - rect.left; // position within displayed image
    const y = e.clientY - rect.top;

    // Clamp to image bounds
    const cx = Math.max(0, Math.min(rect.width, x));
    const cy = Math.max(0, Math.min(rect.height, y));

    // Place lens centered at cursor
    const lw = lens.offsetWidth;
    const lh = lens.offsetHeight;
    const left = rect.left + cx - lw / 2 + window.scrollX;
    const top = rect.top + cy - lh / 2 + window.scrollY;
    lens.style.left = `${left - container.getBoundingClientRect().left + window.scrollX}px`;
    lens.style.top = `${top - container.getBoundingClientRect().top + window.scrollY}px`;

    // Calculate background position to match the exact pixel under cursor
    // Scale ratio: natural / displayed
    const scaleX = naturalW && rect.width ? (naturalW / rect.width) : 1;
    const scaleY = naturalH && rect.height ? (naturalH / rect.height) : 1;
    const bgX = -((cx * scaleX) - lw / 2);
    const bgY = -((cy * scaleY) - lh / 2);
    lens.style.backgroundPosition = `${bgX}px ${bgY}px`;
  }

  imgEl.addEventListener('mouseenter', () => {
    createLens(); showLens();
  });
  imgEl.addEventListener('mousemove', moveLens);
  imgEl.addEventListener('mouseleave', hideLens);
}

/**
 * ui.confirm(message)
 * Shows a small modal with message and Yes/No buttons. Returns Promise<boolean>.
 */
export function confirm(message = 'Are you sure?') {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    if (!root) {
      // Fallback if modal-root missing
      // eslint-disable-next-line no-alert
      const ok = window.confirm(message);
      resolve(ok);
      return;
    }

    const cleanup = (val) => {
      root.hidden = true;
      root.innerHTML = '';
      resolve(val);
    };

    root.hidden = false;
    const modal = document.createElement('div');
    modal.className = 'modal modal-confirm';
    modal.innerHTML = `
      <header><strong>Confirm</strong></header>
      <div class="content" style="grid-template-columns: 1fr">
        <div style="padding:6px 2px; color:#cdd7ee">${message}</div>
      </div>
      <div class="footer">
        <button id="c-yes" class="primary">Yes</button>
        <button id="c-no">No</button>
      </div>
    `;
    root.innerHTML = '';
    root.appendChild(modal);

    // Close when clicking outside
    const onBackdrop = (e) => { if (e.target === root) { root.removeEventListener('click', onBackdrop); cleanup(false); } };
    root.addEventListener('click', onBackdrop);

    modal.querySelector('#c-yes').addEventListener('click', () => {
      root.removeEventListener('click', onBackdrop);
      cleanup(true);
    });
    modal.querySelector('#c-no').addEventListener('click', () => {
      root.removeEventListener('click', onBackdrop);
      cleanup(false);
    });
  });
}