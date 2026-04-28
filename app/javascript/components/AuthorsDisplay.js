import React from 'react';

/**
 * AuthorsDisplay - Renders an authors string with linked authors highlighted
 *
 * Takes the raw authors string (e.g., "Yang, X., Wang, L., Deng, X.")
 * and highlights portions that match linked people records.
 *
 * Props:
 * - authors: string - The raw authors string to display
 * - people: array - Linked Person records with id, full_name, last_name
 * - onPersonClick: function(personId) - Called when a linked author is clicked
 */
export default function AuthorsDisplay({ authors, people = [], onPersonClick }) {
  // The Source model has both an `authors` text column and a
  // `has_many :authors` association — depending on serialization path,
  // the prop can arrive as a string OR an array of Author records.
  // Normalize to a string before any regex / substring work below.
  const authorsString = Array.isArray(authors)
    ? authors
        .map((a) => (typeof a === 'string' ? a : (a?.full_name || a?.name || '')))
        .filter(Boolean)
        .join(', ')
    : (typeof authors === 'string' ? authors : '');

  if (!authorsString) return null;

  // If no linked people, just render the string
  if (!people || people.length === 0) {
    return (
      <span style={{ fontFamily: 'var(--font-body)' }}>
        {authorsString}
      </span>
    );
  }

  // Build a list of matches: { start, end, person }
  // We'll search for each person's last name in the authors string
  const matches = [];

  people.forEach(person => {
    // Try matching by last_name first, then by last word of full_name
    const lastName = person.last_name || person.full_name?.split(/\s+/).pop();
    if (!lastName) return;

    // Find all occurrences of this last name
    const regex = new RegExp(`\\b${escapeRegExp(lastName)}\\b`, 'gi');
    let match;
    while ((match = regex.exec(authorsString)) !== null) {
      // Check if this position overlaps with an existing match
      const overlaps = matches.some(m =>
        (match.index >= m.start && match.index < m.end) ||
        (match.index + match[0].length > m.start && match.index + match[0].length <= m.end)
      );

      if (!overlaps) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          person: person
        });
      }
    }
  });

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Build the rendered output
  const parts = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    // Add text before this match
    if (match.start > lastIndex) {
      parts.push(
        <span key={`text-${idx}`}>
          {authorsString.substring(lastIndex, match.start)}
        </span>
      );
    }

    // Add the highlighted match
    parts.push(
      <span
        key={`match-${idx}`}
        onClick={() => onPersonClick?.(match.person.id)}
        style={{
          color: 'var(--accent-gold)',
          fontWeight: 500,
          cursor: onPersonClick ? 'pointer' : 'inherit',
          textDecoration: 'none',
          borderBottom: '1px dotted var(--accent-gold)',
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => {
          if (onPersonClick) {
            e.currentTarget.style.background = 'var(--accent-gold-light)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
        title={`View ${match.person.full_name}`}
      >
        {authorsString.substring(match.start, match.end)}
      </span>
    );

    lastIndex = match.end;
  });

  // Add remaining text after last match
  if (lastIndex < authorsString.length) {
    parts.push(
      <span key="text-end">
        {authorsString.substring(lastIndex)}
      </span>
    );
  }

  return (
    <span style={{ fontFamily: 'var(--font-body)' }}>
      {parts}
    </span>
  );
}

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
