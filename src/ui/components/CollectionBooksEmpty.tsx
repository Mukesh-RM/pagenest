import { EmptyState, type EmptyStateAction } from './EmptyState';
import { Illustration } from './Illustration';

export interface CollectionBooksEmptyProps {
  /** The collection's name, shown in the sentence. */
  name: string;
  /** "Go to your library" or similar. Leave out for no button. */
  action?: EmptyStateAction;
  className?: string;
}

/** An opened collection with no books on it: one illustration, one calm sentence, one next step. */
export function CollectionBooksEmpty({ name, action, className }: CollectionBooksEmptyProps) {
  return (
    <EmptyState
      className={className}
      art={<Illustration name="books" />}
      title="Nothing in this collection yet"
      description={`Books you add to “${name}” will show up here.`}
      action={action}
      headingLevel={2}
    />
  );
}
