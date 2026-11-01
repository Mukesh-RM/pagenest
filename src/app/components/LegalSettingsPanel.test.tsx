import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LegalSettingsPanel } from './LegalSettingsPanel';
import { LanguageSettingsPanel } from './LanguageSettingsPanel';

describe('Phase 7 legal and language settings', () => {
  it('shows privacy and license sections', () => {
    render(<LegalSettingsPanel />);
    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByText(/no analytics, no ads/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open-source licenses' })).toBeInTheDocument();
  });

  it('documents English UI with localization note', () => {
    render(<LanguageSettingsPanel />);
    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByText(/English/i)).toBeInTheDocument();
  });
});
