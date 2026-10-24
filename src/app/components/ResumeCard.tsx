import { Link } from 'react-router-dom';
import { resumeHeading, type ResumeInfo } from '@/data/resume';
import { Card, Icon, ProgressBar, Skeleton } from '@/ui';

/** Fixed height (a multiple of 4 px), so the card, its skeleton and the empty slot never differ. */
const HEIGHT = 'min-h-[88px]';

function describe(info: ResumeInfo): string {
  const verb = info.mode === 'read' ? 'Reading' : 'Listening to';
  return `${verb} ${info.title}${info.author ? ` by ${info.author}` : ''}, ${Math.round(info.percent)}% done`;
}

/**
 * The quiet "Welcome back, chapter 7" card. Information first: it names the book, the chapter
 * (when the book has chapter info) and how far along it is. It is a link only when `href` is
 * given, which must be a route that exists; with no `href` it is plain text with no control,
 * so there is never a button that does nothing.
 */
export function ResumeCard({ info, href }: { info: ResumeInfo; href?: string }) {
  const body = (
    <div className={`flex ${HEIGHT} items-center gap-3 p-4`}>
      <span aria-hidden="true" className="shrink-0 text-accent">
        <Icon name={info.mode === 'read' ? 'bookOpen' : 'headphones'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{resumeHeading(info)}</p>
        <p className="line-clamp-1 text-sm text-muted">
          {info.chapterTitle ? `${info.chapterTitle} · ` : ''}
          {info.title}
        </p>
        <div className="mt-2">
          <ProgressBar value={info.percent / 100} label={`Continue position in ${info.title}`} />
        </div>
      </div>
    </div>
  );
  return (
    <section aria-label="Welcome back" className="mb-4">
      <Card flush>
        {href ? (
          <Link to={href} aria-label={`${resumeHeading(info)}. ${describe(info)}. Continue`} className="block rounded-card">
            {body}
          </Link>
        ) : (
          body
        )}
      </Card>
    </section>
  );
}

/** Same size as {@link ResumeCard}, shown while the saved position is being read. */
export function ResumeCardSkeleton() {
  return (
    <div className={`mb-4 ${HEIGHT}`}>
      <Skeleton variant="rect" height="88px" className="w-full" />
    </div>
  );
}
