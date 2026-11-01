/** User-facing privacy copy (blueprint section 17). Shown in Settings → Privacy. */
export const PRIVACY_SECTIONS = [
  {
    title: 'What InkQuiet collects',
    body: 'Nothing. InkQuiet has no account, no analytics, no ads, and no payments. Books, notes, voices, and settings stay on this device unless you export them yourself.',
  },
  {
    title: 'Network use',
    body: 'The app loads from the host you installed it from. Optional voice and dictionary models download only when you tap Download. Backup files are saved where you choose; InkQuiet does not upload them.',
  },
  {
    title: 'Voice cloning',
    body: 'Voice Studio records your own voice only after you read the live consent phrase. Clips stay local until you export a My Voice pack or delete the voice.',
  },
  {
    title: 'Your controls',
    body: 'You can delete books, voices, and cached models at any time. Use Backup and restore to keep a copy you control.',
  },
] as const;
