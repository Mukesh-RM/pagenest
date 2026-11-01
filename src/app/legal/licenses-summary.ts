/** Short open-source attribution for Settings (full audit lives in docs/LICENSES.md in the repo). */
export const APP_LICENSE = 'InkQuiet is released under the MIT License.';

export const LICENSE_ATTRIBUTIONS = [
  { name: 'React & Vite', license: 'MIT' },
  { name: 'pdf.js (Mozilla)', license: 'Apache-2.0' },
  { name: 'foliate-js', license: 'MIT' },
  { name: 'Dexie (IndexedDB)', license: 'Apache-2.0' },
  { name: 'Workbox (PWA)', license: 'MIT' },
  { name: 'Piper voices (rhasspy/piper-voices)', license: 'Per voice; CC BY 4.0 and similar permissive sets only' },
  { name: 'Lucide icons', license: 'ISC' },
  { name: 'Self-hosted fonts', license: 'OFL-1.1 / permissive (see docs/LICENSES.md)' },
] as const;

export const LICENSES_FOOTNOTE =
  'Shipped builds exclude GPL phonemizers and any model marked NOT OK in the project license audit. Voice models download only after you choose them.';
