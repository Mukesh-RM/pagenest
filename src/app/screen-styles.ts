/**
 * The design system keeps the screens' stylesheets (page frame `pn-screen`, page titles, cards,
 * sheets: about 6.6 kB gzip) out of its main entry so the first load stays under the 12 kB CSS
 * budget (`src/ui/screens/index.ts`). Every lazy route imports this module, so the styles travel in
 * that route's chunk. Never import it from the app shell or other first-paint code.
 */
import '@/ui/styles/screens.css';
import '@/ui/styles/surfaces.css';
