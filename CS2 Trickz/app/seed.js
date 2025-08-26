/**
 * seed.js
 * Inserts a few demo posts for first run to showcase structure.
 */
import * as db from './db.js';

export async function loadDemo() {
  const demo = [
    {
      type: 'NADES',
      subtype: 'SMOKE',
      map: 'Mirage',
      mapOther: '',
      side: 'T',
      title: 'Mirage T SMOKE Window from T-spawn',
      notes: 'Line up with the right side of the T-spawn door, aim at the top-left of the antenna, jump-throw.',
      tags: ['mid', 'window', 'default'],
      youtubeUrl: 'https://youtu.be/8Z6XwXxXxXx', // replace with your favorite
      youtubeStart: 12,
      images: [],
      favorite: true,
    },
    {
      type: 'NADES',
      subtype: 'FLASH',
      map: 'Inferno',
      mapOther: '',
      side: 'CT',
      title: 'Inferno CT FLASH Banana Pop',
      notes: 'Stand CT car corner, aim above the wire, left-click throw. Blinds T banana rush.',
      tags: ['banana', 'popflash', 'ct'],
      youtubeUrl: '',
      youtubeStart: 0,
      images: [],
      favorite: false,
    },
    {
      type: 'PLAYS',
      subtype: 'Default A execute', // free text allowed for PLAYS
      map: 'Anubis',
      mapOther: '',
      side: 'T',
      title: 'Anubis A-site default execute',
      notes: 'Two smokes (CT, Heaven), one molly default, flashes over temple. Lurk mid late.',
      tags: ['execute', 'a-site', 'default'],
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtubeStart: 42,
      images: [],
      favorite: false,
    },
    {
      type: 'PLAYS',
      subtype: 'Retake B',
      map: 'Other',
      mapOther: 'Tuscan',
      side: 'CT',
      title: 'Tuscan B retake with late mid pinch',
      notes: 'Two push short late, one holds connector smoke fade. Save a flash for site cross.',
      tags: ['retake', 'mid', 'b-site'],
      youtubeUrl: '',
      youtubeStart: 0,
      images: [],
      favorite: false,
    },
  ];

  for (const p of demo) {
    await db.addPost(p);
  }
}