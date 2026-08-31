/**
 * Offline fallback for the quote of the day: short, well-known lines from
 * long-dead authors and proverbs (public domain). The live source is
 * ZenQuotes (see services/quotes.ts); this list only covers days without
 * network, keyed by day-of-year so a given day always shows the same line.
 */
export type BundledQuote = { text: string; author: string };

export const FALLBACK_QUOTES: BundledQuote[] = [
  { text: 'Well begun is half done.', author: 'Aristotle' },
  {
    text: 'It does not matter how slowly you go as long as you do not stop.',
    author: 'Confucius',
  },
  {
    text: 'The journey of a thousand miles begins with a single step.',
    author: 'Lao Tzu',
  },
  { text: 'Great acts are made up of small deeds.', author: 'Lao Tzu' },
  {
    text: 'Waste no more time arguing what a good man should be. Be one.',
    author: 'Marcus Aurelius',
  },
  {
    text: 'Begin at once to live, and count each separate day as a separate life.',
    author: 'Seneca',
  },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  {
    text: 'First say to yourself what you would be; and then do what you have to do.',
    author: 'Epictetus',
  },
  {
    text: 'Do the thing and you will have the power.',
    author: 'Ralph Waldo Emerson',
  },
  {
    text: 'Energy and persistence conquer all things.',
    author: 'Benjamin Franklin',
  },
  { text: 'Little strokes fell great oaks.', author: 'Benjamin Franklin' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  {
    text: 'Go confidently in the direction of your dreams.',
    author: 'Henry David Thoreau',
  },
  {
    text: 'He who has a why to live can bear almost any how.',
    author: 'Friedrich Nietzsche',
  },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  {
    text: 'Dripping water hollows out stone, not through force but through persistence.',
    author: 'Ovid',
  },
  {
    text: 'Habit is a cable; we weave a thread of it each day, and at last we cannot break it.',
    author: 'Horace Mann',
  },
  {
    text: 'Nothing is so fatiguing as the eternal hanging on of an uncompleted task.',
    author: 'William James',
  },
  {
    text: 'The best time to plant a tree was twenty years ago. The second best time is now.',
    author: 'Chinese proverb',
  },
  {
    text: 'Our greatest glory is not in never falling, but in rising every time we fall.',
    author: 'Confucius',
  },
  {
    text: 'Do what you can, with what you have, where you are.',
    author: 'Theodore Roosevelt',
  },
  {
    text: 'Patience and perseverance have a magical effect before which difficulties disappear and obstacles vanish.',
    author: 'John Quincy Adams',
  },
  {
    text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.',
    author: 'Will Durant',
  },
  {
    text: 'What we achieve inwardly will change outer reality.',
    author: 'Plutarch',
  },
  {
    text: 'Knowing is not enough; we must apply. Willing is not enough; we must do.',
    author: 'Johann Wolfgang von Goethe',
  },
  {
    text: 'It always seems impossible until it is done.',
    author: 'Nelson Mandela',
  },
  {
    text: 'Start where you are. Use what you have. Do what you can.',
    author: 'Arthur Ashe',
  },
  { text: 'Make each day your masterpiece.', author: 'John Wooden' },
];
