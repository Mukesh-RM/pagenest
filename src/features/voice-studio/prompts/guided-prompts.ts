/** Short scripted lines for the guided “My Voice Pack” recording session. */
export const GUIDED_PROMPTS = [
  {
    id: 'intro-calm',
    title: 'Calm introduction',
    text: 'Hello, this is my voice for InkQuiet. I speak clearly and at a relaxed pace.',
  },
  {
    id: 'story-bit',
    title: 'A little story',
    text: 'On a quiet morning, the river moved slowly past the garden gate, carrying leaves toward the sea.',
  },
  {
    id: 'question',
    title: 'A question',
    text: 'Would you like to hear another chapter tonight, or save it for tomorrow morning?',
  },
  {
    id: 'numbers',
    title: 'Numbers and names',
    text: 'Chapter twelve begins on page one hundred four, near the old cedar bridge.',
  },
  {
    id: 'emotion',
    title: 'Warm emphasis',
    text: 'That was wonderful news! I am genuinely happy we finally reached the summit together.',
  },
] as const;

export type GuidedPrompt = (typeof GUIDED_PROMPTS)[number];
