import { Link } from 'react-router-dom';
import { resumeHeading } from '@/data/resume';
import type { ResumeInfo } from '@/data/resume';
import { useAudioController } from './PlayerProvider';
import { FullPlayerContent } from './FullPlayerContent';

/** Immersive `/listen/:id` player surface (no tab bar, no mini-player). */
export function FullPlayerView({ welcome }: { welcome?: ResumeInfo }) {
  const controller = useAudioController();
  const heading = welcome ? resumeHeading(welcome) : 'Now playing';

  return (
    <div className="flex min-h-dvh flex-col px-[var(--pn-margin)] pb-6 pt-[calc(1rem+var(--pn-safe-top))]">
      <Link to="/" className="inline-flex min-h-touch items-center text-accent">
        Back to Library
      </Link>
      <header className="mt-4">
        <h1 className="text-xl font-semibold">{heading}</h1>
        {welcome?.chapterTitle ? <p className="text-muted">{welcome.chapterTitle}</p> : null}
      </header>
      <div className="mt-6 flex-1">
        <FullPlayerContent controller={controller} />
      </div>
    </div>
  );
}
