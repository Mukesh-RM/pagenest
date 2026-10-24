import { useId, type CSSProperties, type ReactNode } from 'react';
import { EmptyState, type EmptyStateAction } from '../components/EmptyState';
import { Illustration } from '../components/Illustration';
import { Skeleton, SkeletonGroup } from '../components/Skeleton';
import { barShare, minutesLabel, weekFigures } from '../utils/stats';
import { cx } from '../utils/cx';
import '../styles/screens.css';
import '../styles/surfaces.css';

export interface StatsScreenProps {
  /** Skeleton instead of the numbers while the worker adds them up. */
  loading?: boolean;
  /** Minutes read or listened on each day, oldest first (the app passes 7). */
  minutesPerDay: readonly number[];
  /** Short label under each bar ("Mon"), same length as `minutesPerDay`. */
  dayLabels: readonly string[];
  /** Full names for screen readers and the "Most on" tile ("Monday"). Falls back to `dayLabels`. */
  dayNames?: readonly string[];
  /** Index of today's bar. Default: the last one. */
  todayIndex?: number;
  /** Number of sessions in that window. Zero shows the empty state. */
  sessionCount: number;
  /** Books marked finished. */
  finishedBooks: number;
  /** Plain-word error (see ErrorNotice). */
  notice?: ReactNode;
  /** The empty state's next step, for example "Open your library". Leave out for no button. */
  emptyAction?: EmptyStateAction;
}

/**
 * Stats (blueprint 5.6): what you read and listened to this week, calmly. Four plain numbers and one bar chart; no
 * streaks, no goals, no red. Bars scale with `transform` only, are named with their day and minutes for screen readers,
 * and today's label is bold and underlined, so color is never the only signal.
 * Presentational: the app passes the summary and the labels.
 */
export function StatsScreen({
  loading = false,
  minutesPerDay,
  dayLabels,
  dayNames,
  todayIndex,
  sessionCount,
  finishedBooks,
  notice,
  emptyAction,
}: StatsScreenProps) {
  const headingId = useId();
  const captionId = useId();
  const figures = weekFigures(minutesPerDay);
  const today = todayIndex ?? minutesPerDay.length - 1;
  const name = (i: number): string => dayNames?.[i] ?? dayLabels[i] ?? '';
  const empty = !loading && sessionCount === 0;
  return (
    <div className="pn-screen pn-stats">
      <header className="pn-screen__header">
        <h1 className="pn-screen__title">Stats</h1>
      </header>
      {notice}
      {loading ? (
        <SkeletonGroup label="Adding up your week" className="pn-stats__loading">
          <div className="pn-stats__tiles" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rect" className="pn-stats__tileskel" />
            ))}
          </div>
          <Skeleton variant="rect" className="pn-stats__chartskel" />
        </SkeletonGroup>
      ) : empty ? (
        <EmptyState
          art={<Illustration name="chart" />}
          title="Nothing to count yet"
          description="Your reading and listening time will show up here, a little each day. There is no pressure and no streak to keep."
          action={emptyAction}
        />
      ) : (
        <>
          <section aria-labelledby={headingId}>
            <h2 id={headingId} className="pn-section-title">
              This week
            </h2>
            <dl className="pn-stats__tiles">
              <div className="pn-stats__tile">
                <dt>Time</dt>
                <dd>{minutesLabel(figures.totalMinutes)}</dd>
              </div>
              <div className="pn-stats__tile">
                <dt>Days with reading or listening</dt>
                <dd>
                  {figures.activeDays} of {minutesPerDay.length}
                </dd>
              </div>
              <div className="pn-stats__tile">
                <dt>Most on</dt>
                <dd>{figures.bestDay >= 0 ? `${name(figures.bestDay)}, ${minutesLabel(figures.bestMinutes)}` : 'No day yet'}</dd>
              </div>
              <div className="pn-stats__tile">
                <dt>Books finished</dt>
                <dd>{finishedBooks}</dd>
              </div>
            </dl>
          </section>
          <figure className="pn-stats__figure" aria-labelledby={captionId}>
            <figcaption id={captionId} className="pn-stats__caption">
              Minutes per day, last {minutesPerDay.length} days
            </figcaption>
            <ul className="pn-stats__chart">
              {minutesPerDay.map((minutes, i) => {
                const share = barShare(minutes, figures.maxMinutes);
                const isToday = i === today;
                return (
                  <li
                    key={i}
                    className={cx('pn-stats__day', isToday && 'pn-stats__day--today')}
                    aria-current={isToday ? 'date' : undefined}
                    style={{ '--pn-bar-index': i } as CSSProperties}
                  >
                    <span className="pn-visually-hidden">{`${isToday ? 'Today' : name(i)}: ${minutesLabel(minutes)}`}</span>
                    <span className="pn-stats__value" aria-hidden="true">
                      {minutes > 0 ? Math.round(minutes) : ''}
                    </span>
                    <span className="pn-stats__track" aria-hidden="true">
                      <span
                        className={cx('pn-stats__bar', share === 0 && 'pn-stats__bar--none')}
                        style={{ '--pn-bar': share } as CSSProperties}
                      />
                    </span>
                    <span className="pn-stats__label" aria-hidden="true">
                      {dayLabels[i]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </figure>
        </>
      )}
    </div>
  );
}

export default StatsScreen;
