/**
 * Dev-only gallery entry. Open http://localhost:5173/src/ui/demo/gallery.html?screen=library&theme=dark&scale=1
 *   screen  one of GALLERY_SCREENS (omit for the index)
 *   theme   light | sepia | dark | black
 *   scale   text size, 1 to 2 (2 = 200 %)
 *   motion  "reduce" for reduced motion
 * It is a separate HTML entry that the production build does not include, and it refuses to run outside dev.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GALLERY_SCREENS, GalleryRoot, isGalleryScreen } from './ScreenGallery';
import { isThemeName, type ThemeName } from '../theme/themes';

const params = new URLSearchParams(window.location.search);
const container = document.getElementById('root');

if (!import.meta.env.DEV) {
  if (container) container.textContent = 'The gallery is only available in development.';
} else if (container) {
  const screen = params.get('screen');
  const themeParam = params.get('theme');
  const theme: ThemeName = isThemeName(themeParam) ? themeParam : 'light';
  const scale = Math.min(2, Math.max(1, Number(params.get('scale')) || 1));
  const reduceMotion = params.get('motion') === 'reduce';
  const root = createRoot(container);
  if (isGalleryScreen(screen)) {
    root.render(
      <StrictMode>
        <GalleryRoot screen={screen} theme={theme} scale={scale} reduceMotion={reduceMotion} />
      </StrictMode>,
    );
  } else {
    root.render(
      <ul style={{ fontFamily: 'system-ui', lineHeight: 2, padding: 24 }}>
        {GALLERY_SCREENS.map((name) => (
          <li key={name}>
            <a href={`?screen=${name}&theme=${theme}`}>{name}</a>
          </li>
        ))}
      </ul>,
    );
  }
}
