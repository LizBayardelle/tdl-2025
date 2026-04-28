// Convert a string to proper title case.
//
// Rules:
//   1. First word and last word always capitalized.
//   2. Articles, conjunctions, and short prepositions (≤ 4 letters) lowercase
//      when they fall in the middle.
//   3. Words that look like acronyms or already have intentional casing
//      (e.g. "DSM-5", "fMRI", "iPad") are left alone.
//   4. Hyphenated compounds capitalize each segment ("non-physical" → "Non-Physical").
//
// Use everywhere user-typed concept labels render as headings, list items,
// chips, etc.  Source data is unchanged — this is presentation only.

const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'from',
  'if', 'in', 'into', 'nor', 'of', 'off', 'on', 'onto', 'or', 'over',
  'per', 'the', 'to', 'up', 'upon', 'via', 'vs', 'with', 'yet',
]);

function looksIntentionallyCased(word) {
  // Strip punctuation for the test.
  const letters = word.replace(/[^A-Za-z]/g, '');
  if (letters.length < 2) return false;
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  if (upperCount === 0) return false;
  // 2+ uppercase letters anywhere → acronym (DSM, RCT, ADHD).
  if (upperCount >= 2) return true;
  // Lowercase first letter followed by uppercase later → "iPad", "fMRI".
  if (letters[0] === letters[0].toLowerCase() && letters.slice(1) !== letters.slice(1).toLowerCase()) {
    return true;
  }
  return false;
}

function capFirst(word) {
  if (!word) return word;
  return word[0].toUpperCase() + word.slice(1);
}

function transformWord(word) {
  if (!word) return word;
  if (looksIntentionallyCased(word)) return word;
  const lower = word.toLowerCase();
  if (word.includes('-')) {
    return lower.split('-').map(capFirst).join('-');
  }
  return capFirst(lower);
}

export function toTitleCase(input) {
  if (input == null) return '';
  const str = String(input).trim();
  if (!str) return '';

  const words = str.split(/(\s+)/); // keep whitespace tokens
  const lastWordIndex = words.reduce((acc, w, i) => (w.trim() ? i : acc), 0);
  const firstWordIndex = words.findIndex((w) => w.trim());

  return words.map((word, i) => {
    if (!word.trim()) return word; // whitespace passthrough
    if (looksIntentionallyCased(word)) return word;
    const lower = word.toLowerCase();
    if (i !== firstWordIndex && i !== lastWordIndex && SMALL_WORDS.has(lower.replace(/[^a-z]/g, ''))) {
      return lower;
    }
    return transformWord(word);
  }).join('');
}

// Convenience for React elements: <TitleCase>concept label</TitleCase>
export default function TitleCase({ children }) {
  if (typeof children !== 'string') return children;
  return toTitleCase(children);
}
