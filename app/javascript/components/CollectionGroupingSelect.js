import React from 'react';

// Per-collection groupings replace the old fixed tier ladder. The list is
// passed in by the caller (typically the parent page that already fetched the
// collection's groupings); this component just renders the dropdown / badge.

// Position-based color so the first grouping reads as most prominent. Falls
// back to neutral past position 4 — long lists get a quieter ladder rather
// than recycling colors.
const POSITION_COLORS = [
  'var(--primary)',
  'var(--source, var(--primary))',
  'var(--concept, var(--ink-2))',
  'var(--person, var(--ink-2))',
  'var(--ink-3)'
];

export const UNSORTED_LABEL = 'Unsorted';

export function colorForPosition(position) {
  if (position == null) return 'var(--ink-4)';
  return POSITION_COLORS[Math.min(position, POSITION_COLORS.length - 1)];
}

export function groupingLabel(groupings, groupingId) {
  if (groupingId == null) return UNSORTED_LABEL;
  const found = groupings.find((g) => g.id === groupingId);
  return found ? found.name : UNSORTED_LABEL;
}

// Small dropdown for assigning a source to a grouping within one collection.
// Read-only viewers get a badge with the current label instead.
export default function CollectionGroupingSelect({ value, groupings, canEdit, onChange, size }) {
  const currentGrouping = value == null ? null : groupings.find((g) => g.id === value);
  const color = colorForPosition(currentGrouping?.position);
  const sizeClass = size === 'sm' ? ' is-sm' : '';
  const styleColor = { color };

  if (!canEdit) {
    return (
      <span className={`cgs-badge${sizeClass}`} style={styleColor}>
        {currentGrouping ? currentGrouping.name : UNSORTED_LABEL}
      </span>
    );
  }
  return (
    <span className={`cgs-select${sizeClass}`} style={styleColor}>
      <select
        className="cgs-input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label="Grouping"
      >
        <option value="">Unsorted</option>
        {groupings.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </span>
  );
}

export function CollectionGroupingSelectStyles() {
  return (
    <style>{`
      .cgs-select {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .cgs-select::after {
        content: '\\f078';
        font-family: 'Font Awesome 6 Free';
        font-weight: 900;
        font-size: 9px;
        position: absolute;
        right: 8px;
        pointer-events: none;
        color: var(--ink-3);
      }
      .cgs-input {
        appearance: none;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        color: currentColor;
        padding: 5px 22px 5px 9px;
        cursor: pointer;
        max-width: 180px;
      }
      .cgs-select.is-sm .cgs-input {
        font-size: 11.5px;
        padding: 3px 20px 3px 8px;
      }
      .cgs-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 14%, transparent);
      }
      .cgs-badge {
        display: inline-flex;
        align-items: center;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 600;
        color: currentColor;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 3px 8px;
        white-space: nowrap;
      }
      .cgs-badge.is-sm { font-size: 11px; padding: 2px 7px; }
    `}</style>
  );
}
