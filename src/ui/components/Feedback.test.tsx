import '../test/setup';
import { render, screen } from '@testing-library/react';
import userEvent from '../test/user';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { Skeleton, SkeletonCard, SkeletonGroup } from './Skeleton';

describe('Skeleton', () => {
  it('shapes are decorative (hidden from screen readers) with the requested size', () => {
    const { container } = render(<Skeleton variant="rect" width={120} height="2rem" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveClass('pn-skeleton', 'pn-skeleton--rect');
    expect(el).toHaveStyle({ width: '120px', height: '2rem' });
  });

  it('SkeletonGroup announces one polite "Loading" status and is busy', () => {
    render(
      <SkeletonGroup>
        <SkeletonCard />
        <SkeletonCard />
      </SkeletonGroup>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading');
    expect(document.querySelectorAll('.pn-skeleton-card')).toHaveLength(2);
  });

  it('the loading label can be changed', () => {
    render(<SkeletonGroup label="Loading your library" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your library');
  });
});

describe('EmptyState', () => {
  it('is a labelled region with a heading and description', () => {
    render(<EmptyState title="Add your first book" description="Choose a file from your phone." />);
    const region = screen.getByRole('region', { name: 'Add your first book' });
    expect(region).toHaveClass('pn-empty');
    expect(screen.getByRole('heading', { level: 2, name: 'Add your first book' })).toBeInTheDocument();
    expect(screen.getByText('Choose a file from your phone.')).toBeInTheDocument();
    expect(region.querySelector('.pn-empty__art')).toHaveAttribute('aria-hidden', 'true');
  });

  it('offers exactly one clear next step', async () => {
    const onClick = vi.fn();
    render(<EmptyState title="No books yet" action={{ label: 'Choose files', onClick, icon: 'plus' }} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Choose files' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('works without an action, with a custom heading level and custom art', () => {
    render(<EmptyState title="Nothing here" headingLevel={3} art={<span data-testid="art">:)</span>} />);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('art')).toBeInTheDocument();
  });
});
