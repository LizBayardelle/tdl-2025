import React from 'react';

// Toggle — iOS-style pill switch.  Used for boolean attribute filters
// ("Has PDF", "Has Notes", "Has ORCID") to visually distinguish them
// from multi-select checkbox lists.  The accent color comes from the
// surrounding context via a CSS custom property `--toggle-on` so each
// page (sources-blue, people-teal, etc.) gets the right tint.
export default function Toggle({ checked, onChange, label, count, disabled }) {
  return (
    <label className={`tg-row ${disabled ? 'is-disabled' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); if (!disabled) onChange(); }}
        className={`tg-pill ${checked ? 'is-on' : ''}`}
        disabled={disabled}
      >
        <span className="tg-knob" aria-hidden="true" />
      </button>
      <span className="tg-label">{label}</span>
      {count != null && <span className="tg-count">{count}</span>}
      <ToggleStyles />
    </label>
  );
}

function ToggleStyles() {
  return (
    <style>{`
      .tg-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 8px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
      }
      .tg-row:hover { background: var(--hover); color: var(--ink); }
      .tg-row.is-disabled { opacity: 0.55; cursor: not-allowed; }
      .tg-row.is-disabled:hover { background: transparent; color: var(--ink-2); }

      .tg-pill {
        position: relative;
        width: 30px;
        height: 18px;
        border-radius: 999px;
        background: var(--ink-line);
        border: none;
        padding: 0;
        cursor: inherit;
        flex-shrink: 0;
        transition: background 0.18s;
      }
      .tg-pill.is-on {
        background: var(--toggle-on, var(--ink));
      }
      .tg-knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--paper);
        box-shadow: 0 1px 2px rgba(15, 23, 35, 0.25);
        transition: transform 0.18s;
      }
      .tg-pill.is-on .tg-knob { transform: translateX(12px); }
      .tg-pill:focus-visible { outline: 2px solid var(--toggle-on, var(--ink)); outline-offset: 2px; }

      .tg-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tg-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
    `}</style>
  );
}
