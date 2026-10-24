import type { ReactNode } from 'react';
import { useId } from 'react';
import { Icon, type IconName } from '../icons';
import { cx } from '../utils/cx';
import { Button } from './Button';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: IconName;
}

export interface EmptyStateProps {
  /** What happened, in plain words ("No books yet"). */
  title: string;
  /** What to do next, one calm sentence. */
  description?: string;
  /** Lucide icon name, or your own illustration node. */
  art?: IconName | ReactNode;
  /** The one clear next step (blueprint 5.1: no dead ends). */
  action?: EmptyStateAction;
  /** Heading level of the title. Default 2. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/** Empty or error state with one clear next step. */
export function EmptyState({
  title,
  description,
  art = 'bookOpen',
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <section aria-labelledby={titleId} className={cx('pn-empty', className)}>
      <div className="pn-empty__art" aria-hidden="true">
        {typeof art === 'string' ? <Icon name={art as IconName} size={32} /> : art}
      </div>
      <Heading id={titleId} className="pn-empty__title">
        {title}
      </Heading>
      {description ? <p className="pn-empty__description">{description}</p> : null}
      {action ? (
        <Button className="pn-empty__action" icon={action.icon} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </section>
  );
}
