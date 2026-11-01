import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { DictionaryPopup } from './DictionaryPopup';

describe('DictionaryPopup', () => {
  it('shows WordNet gloss and Hindi translation', () => {
    render(
      <ThemeProvider defaultMode="sepia">
        <DictionaryPopup
          word="rabbit"
          definition={{
            word: 'rabbit',
            source: 'wordnet',
            senses: [{ pos: 'n', glosses: ['any of various burrowing animals with long ears'] }],
          }}
          translation={{ text: 'rabbit', translation: 'खरगोश', sourceLang: 'en', targetLang: 'hi', engine: 'lexicon' }}
          onClose={() => undefined}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'rabbit' })).toBeInTheDocument();
    expect(screen.getByText(/burrowing animals/i)).toBeInTheDocument();
    expect(screen.getByText('खरगोश')).toBeInTheDocument();
  });
});
