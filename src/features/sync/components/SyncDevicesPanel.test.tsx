import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SyncDevicesPanel } from './SyncDevicesPanel';

describe('SyncDevicesPanel', () => {
  it('shows pairing code and Sync devices heading', () => {
    render(
      <MemoryRouter>
        <SyncDevicesPanel />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Sync devices' })).toBeTruthy();
    expect(screen.getByTestId('sync-pairing-code').textContent).toMatch(/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}/);
    expect(screen.getByRole('button', { name: 'Save sync file' })).toBeTruthy();
  });
});
