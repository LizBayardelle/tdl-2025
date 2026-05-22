import React, { useMemo, useState, useRef, useEffect } from 'react';

// =====================================================================
// NoteCard — the canonical note card used everywhere a note is rendered
// (NotesIndex, /tags hub, /sources/:id, /concepts/:id, /people/:id,
// Dashboard, Tabletop, PDF study mode).
//
// Optional features are opt-in via props: pass `onEdit` to show the edit
// button, `onTogglePin` to enable the pin, etc. Pass `omitChips` (e.g.
// `['source']`) to hide chip kinds that are redundant on the current
// surface (no point chipping the source on the source's own page).
//
// Helpers (`formatDate`, `highlightText`, `tagName`, etc.) and the
// reset stylesheet (`<NoteCardStyles />`) are exported alongside so any
// page that already builds a notes list can plug in without duplicating.
// =====================================================================

export const NOTE_TYPE_LABELS = {
  note:       'Note',
  question:   'Question',
  synthesis:  'Synthesis',
  connection: 'Connection',
  todo:       'To Do',
  highlight:  'Highlight',
};

export function tagName(t) { return typeof t === 'string' ? t : t?.name; }
export function tagKey(t)  { return typeof t === 'string' ? t : t?.name; }

export function plain(html) {
  if (!html) return '';
  const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!tmp) return String(html).replace(/<[^>]*>/g, ' ');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function highlightText(text, query) {
  if (!text) return text;
  const q = (query || '').trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegex(q)})`, 'gi');
  const parts = String(text).split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="nx-mark">{part}</mark> : part
  );
}

export function highlightHtml(html, query) {
  if (!html) return '';
  const q = (query || '').trim();
  if (!q || typeof document === 'undefined') return html;
  const escaped = escapeRegex(q);
  const re = new RegExp(`(${escaped})`, 'gi');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const walk = (node) => {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      const span = document.createElement('span');
      const safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(re, '<mark class="nx-mark">$1</mark>');
      span.innerHTML = safe;
      const parent = node.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, node);
      parent.removeChild(node);
    } else if (node.nodeType === 1 && node.nodeName !== 'MARK') {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(tmp.childNodes).forEach(walk);
  return tmp.innerHTML;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const ms = now - d;
  const day = 24 * 60 * 60 * 1000;
  if (ms < day && now.getDate() === d.getDate()) return 'Today';
  if (ms < 2 * day && now.getDate() - d.getDate() === 1) return 'Yesterday';
  if (now.getFullYear() === d.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Icons ----------
export function PinIcon({ filled, small }) {
  const s = small ? 14 : 17;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 2h6" />
      <path d="M6 2v4.5L4 8.5h8L10 6.5V2" />
      <path d="M8 8.5v5.5" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 2.5l2 2-7.5 7.5-2.5.5.5-2.5 7.5-7.5z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h10" />
      <path d="M5 4V2.5h6V4" />
      <path d="M4 4l.7 9.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L12 4" />
      <path d="M6.5 7v4M9.5 7v4" />
    </svg>
  );
}
function AddIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v6M5 8h6" />
    </svg>
  );
}
function DismissIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

// =====================================================================
// NoteCard
// =====================================================================
export default function NoteCard({
  note,
  query = '',
  onView,
  onEdit,
  onDelete,
  onTogglePin,
  onChipClick,
  selectMode = false,
  selected = false,
  onToggleSelect,
  // Stash-mode triage actions.  When either is set, the head shows
  // Add/Dismiss icons in place of edit/delete and the pin corner is
  // hidden (a stash note isn't "yours to pin" yet).  ConceptShow uses
  // this to render the "From related sources & people" rows.
  onAdd,
  onDismiss,
  // Hide chip kinds that are redundant on the current surface.
  // Values: 'source' | 'concept' | 'person' | 'tag' | 'collection'
  omitChips = [],
  // Hide *specific* items by id (e.g., the current concept on /concepts/:id).
  // Shape: { source: [1,2], concept: [3], person: [4], collection: [5] }
  omitChipIds = {},
  className = '',
}) {
  const isStashMode = !!(onAdd || onDismiss);
  const isOwner = note.is_owner !== false;
  const type = note.note_type || 'note';
  const stop = (e) => e.stopPropagation();
  const bodyHtml = useMemo(() => highlightHtml(note.body || '', query), [note.body, query]);

  // Show-more toggle — only appears when the clamped body actually overflows.
  // Measure once after render and again on body changes (post-edit autosave).
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    setHasOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [bodyHtml, expanded]);
  const onActivate = selectMode
    ? (() => onToggleSelect && onToggleSelect(note.id))
    : (() => onView && onView(note));
  const clickable = selectMode || !!onView;

  // Multi-source: prefer linked_sources, fall back to single source.
  const sourceChipsRaw = note.linked_sources?.length
    ? note.linked_sources
    : (note.source ? [note.source] : []);
  const omittedSourceIds = new Set(omitChipIds.source || []);
  const sourceChips = omitChips.includes('source')
    ? []
    : sourceChipsRaw.filter((s) => !omittedSourceIds.has(s.id));

  const omittedConceptIds = new Set(omitChipIds.concept || []);
  const conceptChips = omitChips.includes('concept')
    ? []
    : (note.concepts || []).filter((c) => !omittedConceptIds.has(c.id));

  const omittedPersonIds = new Set(omitChipIds.person || []);
  const personChips = omitChips.includes('person')
    ? []
    : (note.people || []).filter((p) => !omittedPersonIds.has(p.id));

  const tagChips = omitChips.includes('tag') ? [] : (note.tags || []);

  const omittedCollectionIds = new Set(omitChipIds.collection || []);
  const collectionChips = omitChips.includes('collection')
    ? []
    : (note.collections || []).filter((c) => !omittedCollectionIds.has(c.id));

  const hasChips =
    sourceChips.length || conceptChips.length || personChips.length ||
    tagChips.length || collectionChips.length;

  return (
    <li
      className={`nx-card ${note.pinned ? 'is-pinned' : ''} ${selectMode ? 'is-selectable' : ''} ${selected ? 'is-selected' : ''} ${clickable ? '' : 'is-static'} ${className}`}
      onClick={clickable ? onActivate : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={selectMode ? selected : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
      } : undefined}
    >
      {selectMode ? (
        <span className={`nx-card-check ${selected ? 'is-on' : ''}`} aria-hidden="true">
          {selected && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.5l2.5 2.5 4.5-5" />
            </svg>
          )}
        </span>
      ) : (onTogglePin && !isStashMode) ? (
        <button
          type="button"
          className={`nx-pin nx-pin-corner ${note.pinned ? 'is-on' : ''}`}
          onClick={(e) => { stop(e); onTogglePin(note); }}
          aria-pressed={!!note.pinned}
          title={note.pinned ? 'Unpin' : 'Pin'}
        >
          <PinIcon filled={!!note.pinned} />
        </button>
      ) : null}

      <header className="nx-card-head">
        <span className="nx-type-eyebrow">{NOTE_TYPE_LABELS[type] || type}</span>
        <div className="nx-card-head-right">
          {isStashMode ? (
            <div className="nx-card-actions nx-card-actions-stash">
              {onAdd && (
                <button
                  type="button"
                  className="sp-icon-action-quiet nx-icon-btn nx-icon-btn-add"
                  onClick={(e) => { stop(e); onAdd(note); }}
                  aria-label="Add to this concept"
                  title="Add to this concept"
                >
                  <AddIcon />
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  className="sp-icon-action-quiet nx-icon-btn"
                  onClick={(e) => { stop(e); onDismiss(note); }}
                  aria-label="Not applicable to this concept"
                  title="Not applicable to this concept"
                >
                  <DismissIcon />
                </button>
              )}
            </div>
          ) : isOwner && !selectMode && (onEdit || onDelete) && (
            <div className="nx-card-actions">
              {onEdit && (
                <button
                  type="button"
                  className="sp-icon-action-quiet nx-icon-btn"
                  onClick={(e) => { stop(e); onEdit(note); }}
                  aria-label="Edit note"
                  title="Edit"
                >
                  <EditIcon />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="sp-icon-action-quiet nx-icon-btn nx-icon-btn-danger"
                  onClick={(e) => { stop(e); onDelete(note); }}
                  aria-label="Delete note"
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          )}
          <time className="nx-card-date" dateTime={note.created_at}>
            {formatDate(note.noted_on || note.created_at)}
          </time>
        </div>
      </header>

      {note.title && <h3 className="nx-card-title">{highlightText(note.title, query)}</h3>}

      {note.quote_text && (
        <div className="sp-banner nx-quote-banner">
          <span className="nx-quote-glyph" aria-hidden="true">“</span>
          <div className="nx-quote-body">
            <span className="nx-quote-text">{highlightText(note.quote_text, query)}</span>
            {note.page_number && (
              note.source ? (
                <a
                  href={`/sources/${note.source.id}/study?page=${note.page_number}`}
                  className="nx-quote-page nx-quote-page-link"
                  onClick={stop}
                  title={`Open source in study mode at page ${note.page_number}`}
                >
                  Page {note.page_number} <span className="nx-quote-page-arrow" aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="nx-quote-page">Page {note.page_number}</span>
              )
            )}
          </div>
        </div>
      )}

      {note.body && (
        <>
          <div
            ref={bodyRef}
            className={`nx-card-body${expanded ? ' is-expanded' : ''}`}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
          {(hasOverflow || expanded) && (
            <button
              type="button"
              className="nx-card-more"
              onClick={(e) => { stop(e); setExpanded((v) => !v); }}
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}

      {note.context && (
        <div className="nx-card-context">
          <span className="nx-card-context-label">Context</span>
          <span>{note.context}</span>
        </div>
      )}

      {hasChips ? (
        <div className="nx-card-chips">
          {sourceChips.map((s) => (
            s.accessible === false ? (
              <span
                key={`s-${s.id}`}
                className="nc-pill is-source is-revoked"
                title="Access revoked — your note is preserved, the source is no longer available."
              >
                <i className="fas fa-book-open nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{s.title}</span>
                <span className="nc-pill-revoked-mark" aria-hidden="true">×</span>
              </span>
            ) : (
              <a
                key={`s-${s.id}`}
                href={`/sources/${s.id}`}
                className="nc-pill is-source"
                onClick={stop}
                title={s.title}
              >
                <i className="fas fa-book-open nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{s.title}</span>
              </a>
            )
          ))}
          {conceptChips.map((c) => (
            c.accessible === false ? (
              <span
                key={`c-${c.id}`}
                className="nc-pill is-concept is-revoked"
                title="Access revoked — your note is preserved, the concept is no longer available."
              >
                <i className="fas fa-lightbulb nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{c.label}</span>
                <span className="nc-pill-revoked-mark" aria-hidden="true">×</span>
              </span>
            ) : (
              <button
                key={`c-${c.id}`}
                type="button"
                className="nc-pill is-concept"
                onClick={(e) => { stop(e); onChipClick && onChipClick('concept', c.id); }}
                title={onChipClick ? `Filter by ${c.label}` : c.label}
              >
                <i className="fas fa-lightbulb nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{c.label}</span>
              </button>
            )
          ))}
          {personChips.map((p) => (
            p.accessible === false ? (
              <span
                key={`p-${p.id}`}
                className="nc-pill is-person is-revoked"
                title="Access revoked — your note is preserved, the person is no longer available."
              >
                <i className="fas fa-user nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{p.full_name}</span>
                <span className="nc-pill-revoked-mark" aria-hidden="true">×</span>
              </span>
            ) : (
              <button
                key={`p-${p.id}`}
                type="button"
                className="nc-pill is-person"
                onClick={(e) => { stop(e); onChipClick && onChipClick('person', p.id); }}
                title={onChipClick ? `Filter by ${p.full_name}` : p.full_name}
              >
                <i className="fas fa-user nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{p.full_name}</span>
              </button>
            )
          ))}
          {tagChips.map((t) => {
            const name = tagName(t);
            return (
              <button
                key={`t-${tagKey(t)}`}
                type="button"
                className="nc-pill is-tag"
                onClick={(e) => { stop(e); onChipClick && onChipClick('tag', name); }}
                title={onChipClick ? `Filter by #${name}` : `#${name}`}
              >
                <i className="fas fa-tag nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{name}</span>
              </button>
            );
          })}
          {collectionChips.map((c) => (
            <a
              key={`co-${c.id}`}
              href={`/collections/${c.id}`}
              className="nc-pill is-collection"
              onClick={stop}
              title={c.name}
            >
              <i className="fas fa-folder nc-pill-icon" aria-hidden="true" />
              <span className="nc-pill-label">{c.name}</span>
            </a>
          ))}
        </div>
      ) : null}
    </li>
  );
}

// =====================================================================
// Styles — inject once on any page that renders NoteCard. Idempotent
// (style tag carries a data-id so repeated mounts don't pile up).
// =====================================================================
export function NoteCardStyles() {
  return (
    <style data-nx-card-styles>{`
      .nx-list { list-style: none; margin: 0; padding: 0; }
      .nx-list-card { display: flex; flex-direction: column; gap: 16px; }

      .nx-card {
        position: relative;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--primary);
        border-radius: var(--r-lg);
        padding: 4px 28px 22px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        cursor: pointer;
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.04),
          0 12px 32px rgba(21, 25, 31, 0.06);
        transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s, background 0.12s;
      }
      .nx-card.is-static { cursor: default; }
      .nx-card:not(.is-static):hover {
        border-color: var(--primary);
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.05),
          0 18px 36px rgba(21, 25, 31, 0.10);
        transform: translateY(-1px);
      }
      .nx-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
      .nx-card.is-pinned { background: var(--paper-soft); }

      .nx-card-head {
        display: flex;
        align-items: center;
        gap: 12px;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .nx-card-head-right {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .nx-card-actions {
        display: inline-flex;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .nx-card:hover .nx-card-actions,
      .nx-card:focus-within .nx-card-actions { opacity: 1; }
      @media (hover: none) { .nx-card-actions { opacity: 1; } }
      .nx-icon-btn { height: 26px; width: 26px; }
      .nx-icon-btn-danger:hover { color: var(--error); background: rgba(122, 46, 46, 0.06); }
      /* Stash mode: Add/Dismiss are the primary affordances on a stash
         row, so they stay visible without hover (the card is asking for
         a decision).  Add picks up the concept color, dismiss stays
         neutral so the affirmative action is visually loudest. */
      .nx-card-actions-stash { opacity: 1; }
      .nx-icon-btn-add { color: var(--concept); }
      .nx-icon-btn-add:hover { color: var(--paper); background: var(--concept); }

      .nx-pin {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        color: var(--ink-4);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: var(--r-sm);
        flex-shrink: 0;
      }
      .nx-pin:hover { color: var(--ink-2); background: var(--hover); }
      .nx-pin.is-on { color: var(--primary); }
      .nx-pin.is-on:hover { background: var(--hover); }
      .nx-pin-corner {
        position: absolute;
        top: 4px;
        left: 2px;
        z-index: 1;
      }

      .nx-card-check {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 1;
        width: 18px;
        height: 18px;
        border: 1.5px solid var(--ink-3);
        border-radius: 3px;
        background: var(--paper);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--paper);
        transition: background 0.12s, border-color 0.12s;
      }
      .nx-card-check.is-on {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .nx-card.is-selectable { cursor: pointer; }
      .nx-card.is-selectable:hover { border-color: var(--primary); }
      .nx-card.is-selected {
        border-color: var(--primary);
        background: rgba(31, 59, 115, 0.04);
      }
      .nx-card.is-selected:hover { background: rgba(31, 59, 115, 0.06); }

      .nx-type-eyebrow {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--ink-3);
        flex-shrink: 0;
      }


      .nx-card-title {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 2px 0 0;
        line-height: 1.25;
        text-decoration: none;
      }
      .nx-card:hover .nx-card-title,
      .nx-card:focus-within .nx-card-title { text-decoration: none; }

      .nx-card-date {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
        letter-spacing: 0.04em;
      }

      .nx-quote-banner {
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
      }
      .nx-quote-glyph {
        font-family: var(--serif);
        font-size: 18px;
        line-height: 0.7;
        color: var(--source);
        opacity: 0.7;
        flex-shrink: 0;
      }
      .nx-quote-body {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }
      .nx-quote-text {
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
        color: var(--source-2);
        flex: 1;
        min-width: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nx-quote-page {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--source-2);
        opacity: 0.75;
        flex-shrink: 0;
        letter-spacing: 0.02em;
      }
      a.nx-quote-page-link {
        text-decoration: none;
        opacity: 0.8;
        cursor: pointer;
        transition: opacity 0.12s, color 0.12s;
      }
      a.nx-quote-page-link:hover { opacity: 1; color: var(--source); text-decoration: underline; }
      .nx-quote-page-arrow { margin-left: 1px; }

      .nx-mark {
        background: #FBE7A1;
        color: inherit;
        padding: 0 1px;
        border-radius: 1px;
      }

      .nx-card-body {
        font-family: var(--sans);
        font-size: 14.5px;
        color: var(--ink-2);
        line-height: 1.6;
        display: -webkit-box;
        -webkit-line-clamp: 5;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nx-card-body.is-expanded {
        display: block;
        -webkit-line-clamp: unset;
        overflow: visible;
      }
      .nx-card-more {
        align-self: flex-start;
        margin-top: -2px;
        padding: 2px 0;
        background: none;
        border: none;
        cursor: pointer;
        font-family: var(--sans);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--primary);
        opacity: 0.75;
        transition: opacity 0.12s;
      }
      .nx-card-more:hover { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
      .nx-card-body p { margin: 0 0 6px; }
      .nx-card-body p:last-child { margin: 0; }
      .nx-card-body ul { list-style: disc; padding-left: 18px; margin: 0 0 6px; }
      .nx-card-body ol { list-style: decimal; padding-left: 18px; margin: 0 0 6px; }
      .nx-card-body li { margin: 0; }
      .nx-card-body code {
        font-family: var(--mono);
        font-size: 12.5px;
        background: var(--paper-warm);
        padding: 1px 4px;
        border-radius: 2px;
      }
      .nx-card-body blockquote {
        margin: 0 0 6px;
        padding-left: 10px;
        border-left: 2px solid var(--ink-line);
        color: var(--ink-3);
      }
      .nx-card-body a {
        color: var(--primary);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .nx-card-body img { max-width: 100%; border-radius: var(--r-sm); }
      .nx-card-body strong { color: var(--ink); font-weight: 600; }

      .nx-card-context {
        display: flex;
        gap: 8px;
        align-items: baseline;
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-3);
        line-height: 1.5;
      }
      .nx-card-context-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
        flex-shrink: 0;
      }

      .nx-card-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }

      /* ---------- nc-pill: icon + label chips, used on NoteCard and
         shared with the /collections sidebar (NoteCardStyles is imported
         there too). One base style, color set per type via --nc-pill-color. */
      .nc-pill {
        --nc-pill-color: var(--ink-3);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 9px;
        background: color-mix(in srgb, var(--nc-pill-color) 12%, transparent);
        color: color-mix(in srgb, var(--nc-pill-color) 85%, var(--ink));
        border: 1px solid color-mix(in srgb, var(--nc-pill-color) 30%, transparent);
        border-radius: 999px;
        font-family: var(--sans, var(--font-body));
        font-size: 10.5px;
        font-weight: 600;
        font-style: normal;
        letter-spacing: 0.02em;
        line-height: 1.5;
        text-transform: none;
        max-width: 240px;
        min-width: 0;
        cursor: pointer;
        text-decoration: none;
        transition: filter 0.1s, background 0.12s;
      }
      button.nc-pill, a.nc-pill, span.nc-pill {
        font-family: var(--sans, var(--font-body));
        font-size: 10.5px;
        font-weight: 600;
        font-style: normal;
        letter-spacing: 0.02em;
        line-height: 1.5;
        text-transform: none;
      }
      button.nc-pill { background-image: none; }
      .nc-pill:hover { filter: brightness(0.96); }
      .nc-pill-icon {
        font-size: 10px;
        opacity: 0.9;
        flex-shrink: 0;
        line-height: 1;
      }
      .nc-pill-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        font: inherit;
      }
      .nc-pill.is-source     { --nc-pill-color: var(--source, #4976B1); }
      .nc-pill.is-concept    { --nc-pill-color: var(--concept, #48A27E); }
      .nc-pill.is-person     { --nc-pill-color: var(--person, #614498); }
      .nc-pill.is-collection { --nc-pill-color: var(--primary); }
      .nc-pill.is-note       { --nc-pill-color: var(--primary); }
      .nc-pill.is-tag        { --nc-pill-color: var(--primary); }
      .nc-pill.is-research   { --nc-pill-color: var(--ink-3); }
      .nc-pill.is-stat-test  { --nc-pill-color: var(--ink-3); }
      .nc-pill.is-marker {
        --nc-pill-color: var(--ink-3);
        background: var(--paper);
        color: var(--ink-3);
        border-color: var(--ink-line);
      }
      .nc-pill.is-marker:hover { background: var(--paper-soft); }

      /* Revoked pill — note's reference points at something no longer
         accessible (e.g., a shared collection was revoked).  Greyed out,
         no link, line-through label with a × glyph. Note itself survives. */
      .nc-pill.is-revoked {
        cursor: not-allowed;
        opacity: 0.55;
        filter: grayscale(0.7);
      }
      .nc-pill.is-revoked .nc-pill-label { text-decoration: line-through; text-decoration-thickness: 1px; }
      .nc-pill.is-revoked:hover { filter: grayscale(0.7); }
      .nc-pill-revoked-mark {
        font-weight: 700;
        opacity: 0.7;
        flex-shrink: 0;
      }

      /* Removable variant — adds a × button at the end for filter-style
         use (e.g., active filter row, multiselect chosen values). */
      .nc-pill.is-removable { padding-right: 4px; gap: 4px; }
      .nc-pill-x {
        background: transparent;
        border: none;
        padding: 0;
        margin-left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        color: inherit;
        opacity: 0.6;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 10px;
        line-height: 1;
        transition: opacity 0.12s, background 0.12s;
      }
      .nc-pill-x:hover { opacity: 1; background: rgba(0, 0, 0, 0.08); }
    `}</style>
  );
}
