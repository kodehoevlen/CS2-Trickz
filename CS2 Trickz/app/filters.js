/**
 * filters.js
 * Normalize UI state into a query object used by db.queryPosts().
 */

export function apply(state) {
  const out = {
    category: state.category || '',
    type: state.type || '',
    subtype: (state.subtype || '').trim(),
    map: state.map || '',
    mapOther: (state.mapOther || '').trim(),
    side: state.side || '',
    favoriteMode: state.favoriteMode || '',
    tags: normalizeTags(state.tags || ''),
    search: (state.search || '').trim(),
  };

  if (out.type === 'NADES') {
    // When no subtype is chosen, do NOT force a default; show all under the selected Type
    out.subtype = state.subtype ? normalizeNadeSubtype(state.subtype) : '';
  } else {
    // For non-NADES types we keep the subtype as typed (scoped per Type)
    out.subtype = (state.subtype || '').trim();
  }

  return out;
}

function normalizeNadeSubtype(s) {
  const up = String(s || '').toUpperCase();
  if (up === 'SMOKE' || up === 'FLASH') return up;
  if (up === 'MOLLIE' || up === 'MOLLY') return 'MOLLIE'; // accept MOLLY as alias
  return 'SMOKE';
}

function normalizeTags(text) {
  return String(text || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(','); // keep as comma string; db.queryPosts splits again
}