import '../test/setup';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Chip, ChipGroup } from './Chip';
import { Icon } from '../icons';

describe('Button', () => {
  it('renders a pill button with the primary variant and type=button by default', () => {
    render(<Button>Read</Button>);
    const button = screen.getByRole('button', { name: 'Read' });
    expect(button).toHaveClass('pn-btn', 'pn-btn--primary');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('supports every variant and the large size', () => {
    render(
      <>
        <Button variant="secondary">Two</Button>
        <Button variant="ghost">Three</Button>
        <Button variant="danger">Four</Button>
        <Button size="lg" block>
          Five
        </Button>
      </>,
    );
    expect(screen.getByText('Two')).toHaveClass('pn-btn--secondary');
    expect(screen.getByText('Three')).toHaveClass('pn-btn--ghost');
    expect(screen.getByText('Four')).toHaveClass('pn-btn--danger');
    expect(screen.getByText('Five')).toHaveClass('pn-btn--block')
    expect(screen.getByText('Five')).not.toHaveClass('pn-btn--lg');
  });

  it('icon-only buttons use the 44 px icon class and are named by aria-label', () => {
    render(<Button iconOnly icon="plus" aria-label="Add a book" />);
    const button = screen.getByRole('button', { name: 'Add a book' });
    expect(button).toHaveClass('pn-btn--icon');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('calls onClick, respects disabled, and forwards the ref', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <Button ref={ref} onClick={onClick}>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Go' }));
    rerender(
      <Button ref={ref} onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is reachable and activatable with the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Keyboard</Button>);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Keyboard' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('Chip', () => {
  it('is a plain action button when selected is undefined (no aria-pressed)', () => {
    render(<Chip>Speed</Chip>);
    const chip = screen.getByRole('button', { name: 'Speed' });
    expect(chip).toHaveClass('pn-chip');
    expect(chip).not.toHaveAttribute('aria-pressed');
  });

  it('exposes toggle state through aria-pressed', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Chip selected={false} onClick={onClick}>
        Favorites
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Favorites' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Chip selected onClick={onClick}>
        Favorites
      </Chip>,
    );
    expect(screen.getByRole('button', { name: 'Favorites' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Favorites' })).toHaveClass('pn-chip--selected');
  });

  it('ChipGroup is a labelled group', () => {
    render(
      <ChipGroup label="Filter library" scroll>
        <Chip>One</Chip>
      </ChipGroup>,
    );
    expect(screen.getByRole('group', { name: 'Filter library' })).toHaveClass('pn-chip-group--scroll');
  });
});

describe('Icon', () => {
  it('is hidden from assistive tech unless it has a label', () => {
    const { container, rerender } = render(<Icon name="play" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).toHaveAttribute('width', '24');
    rerender(<Icon name="play" label="Play" size={20} />);
    expect(screen.getByRole('img', { name: 'Play' })).toHaveAttribute('width', '20');
  });

  it('draws the vendored Lucide paths with currentColor outline styling', () => {
    const { container } = render(<Icon name="pause" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg.querySelectorAll('rect').length).toBe(2);
  });
});
