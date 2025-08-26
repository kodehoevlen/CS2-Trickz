# CS2 Trickz — Browser MVP (Option 1)

A fast in-game-friendly browser app to save and recall CS2 tips: Nades and Plays with images, notes, tags, and YouTube embeds. Data is stored locally in your browser (IndexedDB). One-click Export/Import produces a single JSON file including embedded images.

## Folder structure

- app files
  - [app/index.html](app/index.html)
  - [app/styles.css](app/styles.css)
  - [app/app.js](app/app.js)
  - [app/db.js](app/db.js)
  - [app/ui.js](app/ui.js)
  - [app/utils.js](app/utils.js)
  - [app/filters.js](app/filters.js)
  - [app/export.js](app/export.js)
  - [app/seed.js](app/seed.js)
- backups (recommended export location)
  - [Backups/](Backups/)

Recommended absolute path for backups on your machine:
- c:/Lasse/Dropbox/Kodning/CS2 Trickz/Backups

## Run locally

1) Easiest (double-click)
- Open [app/index.html](app/index.html) in Chrome or Edge.
- No server required.

2) Optional (Live Server)
- If you prefer, use VSCode Live Server and open [app/index.html](app/index.html).

Note: This MVP uses only client-side browser APIs. No installation needed.

## Using the app

- Create: Click New Post (or press N).
- Filter fast:
  - Type: NADES or PLAYS (1 toggles NADES, 2 toggles PLAYS)
  - Subtype:
    - NADES: SMOKE, FLASH, MOLLIE (segmented buttons)
    - PLAYS: free-text category (input)
  - Map: fixed list + “Other” with a text field
  - Side: Both/T/CT
  - Tags: comma-separated
  - Search: matches title and notes
- View: Click View on a card for a focused modal (video/images/notes).
- Edit/Delete/Favorite from each card.

Keyboard shortcuts:
- N: New post
- F: Focus search
- 1: NADES
- 2: PLAYS
- E: Export
- I: Import
- Escape: Close modals

## Export and Import

Everything is stored locally in your browser (IndexedDB). Export/Import lets you move or back up your data.

- Export: Button Export (or press E)
  - A single JSON file is downloaded (images embedded as base64).
  - Suggested file name: CS2Trickz-YYYYMMDD.json
- Import: Button Import (or press I) and select a previously exported JSON
  - Merge strategy by default (upserts posts by id)

To ensure exports land in your chosen folder:
- Create [Backups/](Backups/) under CS2 Trickz
- In Chrome/Edge:
  - Settings → Downloads:
    - Enable “Ask where to save each file before downloading” and choose CS2 Trickz/Backups, or
    - Set default download folder to c:/Lasse/Dropbox/Kodning/CS2 Trickz/Backups

## Data model (per post)

- type: NADES | PLAYS
- subtype:
  - NADES: SMOKE | FLASH | MOLLIE
  - PLAYS: free-text category (e.g., Default A execute)
- map: Ancient | Anubis | Dust2 | Inferno | Mirage | Nuke | Overpass | Vertigo | Other
- mapOther: string (when map = Other)
- side: Both | T | CT
- title: string
- notes: string
- tags: string[]
- youtubeUrl: string (any YouTube URL or 11-char ID)
- youtubeStart: number (seconds)
- images: [{ id, dataUrl, caption }]
- favorite: boolean
- createdAt, updatedAt (auto)
- derived indexes for search/filter

Images are compressed on import (client-side) to maximum width 1200px at quality ~0.7 for fast viewing and small exports.

## Tech notes

- IndexedDB wrapper in [app/db.js](app/db.js)
  - Stores: posts, tags, settings
  - Indexes for type/subtype/map/side/favorite/createdAt/updatedAt/title/tags
- YouTube helpers in [app/utils.js](app/utils.js)
  - URL parsing, nocookie-embed builder, and thumbnail URL
- UI/editor in [app/ui.js](app/ui.js)
- Filter normalization in [app/filters.js](app/filters.js)
- Export/Import in [app/export.js](app/export.js)
  - Export JSON contains posts (with embedded images), version, exportedAt
  - Import merges or replaces by id
- First run demo data in [app/seed.js](app/seed.js)

## Known limitations (MVP)

- Browser-only: data lives in your browser profile unless you export.
- Large images increase JSON size; the app compresses added images to reduce size.
- No cloud sync (by design). Use exports to back up to Dropbox or another folder.

## Upgrade paths

- Option 2: keep this UI, add automatic on-disk saving using the File System Access API (Chromium), so no manual export needed.
- Option 3: make it an installable PWA + File System Access for a slicker app feel.
- Overlay: later integrate with Overwolf/Electron for an always-on-top overlay while playing.