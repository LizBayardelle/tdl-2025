import React, { useState, useEffect, useMemo } from 'react';
import { SPStyles } from './SamplePage';

// =====================================================================
// TabletopsIndex
// Landing page for the user's tabletops — lifelong canvases for
// physically arranging notes, sources, and ideas.  Each card is a
// one-click into the canvas.  "+ New Tabletop" lives in the header.
// =====================================================================

export default function TabletopsIndex() {
  const [tabletops, setTabletops] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [filter, setFilter]       = useState('');

  useEffect(() => { fetchAll(); }, []);

  // Auto-open the create modal when arriving via the nav's "+ New Tabletop"
  // (which links to /tabletops?new=1).  Strip the param so a refresh doesn't
  // re-open the modal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setEditing(null);
      setShowForm(true);
      params.delete('new');
      const q = params.toString();
      window.history.replaceState(null, '', q ? `${window.location.pathname}?${q}` : window.location.pathname);
    }
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch('/tabletops.json');
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      setTabletops(await res.json());
    } catch (err) {
      console.error('Tabletops load failed', err);
      setError('Could not load tabletops.  Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }

  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  async function deleteTabletop(t) {
    if (!window.confirm(`Delete tabletop "${t.name}"?  Notes themselves are not deleted.`)) return;
    try {
      const res = await fetch(`/tabletops/${t.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf() },
      });
      if (res.ok) setTabletops(prev => prev.filter(x => x.id !== t.id));
    } catch (err) { console.error('Delete failed', err); }
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return tabletops;
    const q = filter.toLowerCase();
    return tabletops.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }, [tabletops, filter]);

  return (
    <div className="sp-root tx">
      <SPStyles />
      <TxStyles />

      <header className="tx-header">
        <div className="tx-header-text">
          <h1 className="tx-title">Tabletops</h1>
          <p className="tx-subtitle">
            Spatial canvases for arranging notes side by side, drafting comparisons, and finding shape in your library.
          </p>
        </div>
        <div className="tx-header-actions">
          <button type="button" className="sp-action sp-action-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <span aria-hidden="true">+</span> New Tabletop
          </button>
        </div>
      </header>

      {error && <div className="tx-error">{error}</div>}

      {tabletops.length > 6 && (
        <div className="tx-filterbar">
          <input
            type="text"
            className="tx-filter-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${tabletops.length} tabletop${tabletops.length === 1 ? '' : 's'}.`}
          />
        </div>
      )}

      {loading ? (
        <div className="tx-loading">Loading.</div>
      ) : tabletops.length === 0 ? (
        <EmptyState onCreate={() => { setEditing(null); setShowForm(true); }} />
      ) : filtered.length === 0 ? (
        <div className="tx-empty">
          <p className="sp-empty-sub">No tabletops match.</p>
        </div>
      ) : (
        <ul className="tx-grid">
          {filtered.map(t => (
            <TabletopCard
              key={t.id}
              tabletop={t}
              onEdit={() => { setEditing(t); setShowForm(true); }}
              onDelete={() => deleteTabletop(t)}
            />
          ))}
        </ul>
      )}

      {showForm && (
        <TabletopFormModal
          tabletop={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={(t) => {
            setShowForm(false); setEditing(null);
            // Replace if existed; otherwise prepend
            setTabletops(prev => {
              const ix = prev.findIndex(x => x.id === t.id);
              if (ix >= 0) { const next = [...prev]; next[ix] = { ...next[ix], ...t }; return next; }
              return [t, ...prev];
            });
            if (!editing) {
              // First-time create: jump straight into the canvas.
              window.location.href = `/tabletops/${t.id}`;
            }
          }}
        />
      )}
    </div>
  );
}

// =====================================================================
// Card
// =====================================================================
function TabletopCard({ tabletop, onEdit, onDelete }) {
  const stop = (e) => e.stopPropagation();
  const t = tabletop;
  return (
    <li className="tx-card">
      <a href={`/tabletops/${t.id}`} className="tx-card-link" aria-label={`Open ${t.name}`} />

      <div className="tx-card-actions">
        {t.is_owner && (
          <>
            <button type="button" className="sp-icon-action-quiet tx-icon-btn" onClick={(e) => { stop(e); onEdit(); }} aria-label="Rename" title="Rename / describe">
              <PencilIcon />
            </button>
            <button type="button" className="sp-icon-action-quiet tx-icon-btn tx-icon-btn-danger" onClick={(e) => { stop(e); onDelete(); }} aria-label="Delete" title="Delete tabletop">
              <TrashIcon />
            </button>
          </>
        )}
      </div>

      <div className="tx-card-thumb" aria-hidden="true">
        <ThumbPattern seed={t.id} />
      </div>

      <div className="tx-card-body">
        <h3 className="tx-card-title">{t.name}</h3>
        {t.description && <p className="tx-card-desc">{t.description}</p>}

        <div className="tx-card-meta">
          <span className="tx-meta-pill">
            <span className="tx-meta-dot" /> {t.items_count || 0} item{t.items_count === 1 ? '' : 's'}
          </span>
          {t.notes_count > 0 && (
            <span className="tx-meta-pill">{t.notes_count} note{t.notes_count === 1 ? '' : 's'}</span>
          )}
          {(t.items_count > 0 || t.notes_count > 0) && (
            <a
              href={`/tabletops/${t.id}/sources`}
              className="tx-meta-link"
              onClick={stop}
              title="Browse all sources on this tabletop"
            >
              <i className="fas fa-book-open" /> Sources →
            </a>
          )}
          {t.last_opened_at && (
            <span className="tx-meta-time">opened {timeAgo(t.last_opened_at)}</span>
          )}
        </div>

        {t.tags?.length > 0 && (
          <div className="tx-card-tags">
            {t.tags.map(tag => (
              <span key={tag} className="sp-chip is-neutral">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

// Simple decorative thumbnail — three offset cards.  We can swap for a
// real preview render later.
function ThumbPattern({ seed }) {
  const offsets = useMemo(() => {
    // Deterministic per-id so cards stay visually stable across reloads.
    const r = (n) => {
      const x = Math.sin(seed * 9301 + n * 49297) * 233280;
      return x - Math.floor(x);
    };
    return [
      { x: 8 + r(1) * 6,  y: 10 + r(2) * 6,  rot: -2 + r(3) * 4, w: 70 },
      { x: 36 + r(4) * 8, y: 24 + r(5) * 6,  rot: -1 + r(6) * 4, w: 64 },
      { x: 18 + r(7) * 6, y: 46 + r(8) * 6,  rot: 1 + r(9) * 4,  w: 70 },
    ];
  }, [seed]);
  return (
    <svg viewBox="0 0 130 90" preserveAspectRatio="xMidYMid slice" className="tx-thumb-svg">
      <rect x="0" y="0" width="130" height="90" fill="var(--paper-soft)" />
      {offsets.map((o, i) => (
        <g key={i} transform={`translate(${o.x}, ${o.y}) rotate(${o.rot})`}>
          <rect x="0" y="0" width={o.w} height="22" rx="2" fill="var(--paper)" stroke="var(--ink-line)" strokeWidth="0.6" />
          <rect x="0" y="0" width={o.w} height="2" fill="var(--primary)" />
          <rect x="6" y="8"  width={o.w * 0.65} height="3" fill="var(--ink-line)" rx="1" />
          <rect x="6" y="14" width={o.w * 0.45} height="2.5" fill="var(--ink-line-soft)" rx="1" />
        </g>
      ))}
    </svg>
  );
}

// =====================================================================
// Form modal (create / rename)
// =====================================================================
function TabletopFormModal({ tabletop, onClose, onSaved }) {
  const [name, setName]               = useState(tabletop?.name || '');
  const [description, setDescription] = useState(tabletop?.description || '');
  const [saving, setSaving]           = useState(false);
  const [errors, setErrors]           = useState([]);

  const isEdit = !!tabletop;
  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const url    = isEdit ? `/tabletops/${tabletop.id}` : '/tabletops';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ tabletop: { name, description } }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors || ['Save failed.']);
      } else {
        onSaved(data);
      }
    } catch (err) {
      setErrors(['Save failed.  Try again.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tx-modal-backdrop" onClick={onClose}>
      <div className="tx-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="tx-modal-head">
          <h2 className="tx-modal-title">{isEdit ? 'Edit Tabletop' : 'New Tabletop'}</h2>
          <button type="button" className="sp-icon-action-quiet" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="tx-modal-body" onSubmit={submit}>
          <div className="sp-field">
            <label className="sp-label" htmlFor="tx-name">Name</label>
            <input
              id="tx-name"
              className="sp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Attachment Theory Lit Review"
              autoFocus
              required
            />
          </div>

          <div className="sp-field">
            <label className="sp-label" htmlFor="tx-desc">Description (optional)</label>
            <textarea
              id="tx-desc"
              className="sp-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this canvas for?"
            />
          </div>

          {errors.length > 0 && (
            <ul className="tx-modal-errors">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}

          <div className="tx-modal-actions">
            <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="sp-action sp-action-primary" disabled={saving || !name.trim()}>
              {saving ? 'Saving.' : (isEdit ? 'Save' : 'Create & Open')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
// Empty
// =====================================================================
function EmptyState({ onCreate }) {
  return (
    <div className="sp-empty tx-empty-state">
      <div className="sp-empty-art" aria-hidden="true">
        <svg width="56" height="44" viewBox="0 0 56 44" fill="none">
          <rect x="3"  y="6"  width="22" height="14" rx="2" className="sp-empty-stroke" transform="rotate(-3 14 13)" />
          <rect x="20" y="14" width="22" height="14" rx="2" className="sp-empty-stroke" transform="rotate(2 31 21)" />
          <rect x="11" y="24" width="22" height="14" rx="2" className="sp-empty-stroke" transform="rotate(-1 22 31)" />
        </svg>
      </div>
      <h3 className="sp-empty-title">No tabletops yet</h3>
      <p className="sp-empty-sub">
        A tabletop is a spatial canvas — pull notes onto it, arrange, annotate, save.  Use it to compare sources, sketch a chapter, or lay out a model.
      </p>
      <div className="tx-empty-actions">
        <button type="button" className="sp-action sp-action-primary" onClick={onCreate}>+ First Tabletop</button>
      </div>
    </div>
  );
}

// =====================================================================
// Tiny helpers + icons
// =====================================================================
function timeAgo(iso) {
  if (!iso) return '';
  const d  = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5l2 2-7.5 7.5-2.5.5.5-2.5 7.5-7.5z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10 M5 4V2.5h6V4 M4 4l.7 9.2a.5.5 0 00.5.3h5.6a.5.5 0 00.5-.3L12 4 M6.5 7v4 M9.5 7v4" />
    </svg>
  );
}

// =====================================================================
// Styles
// =====================================================================
function TxStyles() {
  return (
    <style>{`
      .tx { background: var(--paper); min-height: calc(100vh - 64px); padding: 28px 32px 64px; }
      .tx-loading { padding: 96px 0; text-align: center; color: var(--ink-3); font-size: 13px; }
      .tx-error {
        margin-bottom: 18px;
        padding: 10px 14px;
        background: var(--source-tint);
        color: var(--source-2);
        border-left: 3px solid var(--source);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        font-size: 13px;
      }

      .tx-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
        margin-bottom: 24px;
      }
      .tx-title {
        font-family: var(--serif);
        font-size: 36px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0 0 6px;
      }
      .tx-subtitle {
        font-family: var(--sans);
        font-size: 13.5px;
        color: var(--ink-3);
        line-height: 1.5;
        max-width: 560px;
        margin: 0;
      }
      .tx-header-actions { display: flex; gap: 8px; }

      .tx-filterbar { margin-bottom: 16px; max-width: 360px; }
      .tx-filter-input {
        width: 100%;
        height: 36px;
        padding: 0 12px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
      }
      .tx-filter-input:focus {
        outline: none;
        border-color: var(--ink-2);
        background: var(--paper);
      }

      /* ============ GRID ============ */
      .tx-grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 18px;
      }

      .tx-card {
        position: relative;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--primary);
        border-radius: var(--r-lg);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.04),
          0 12px 32px rgba(21, 25, 31, 0.06);
        transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s;
      }
      .tx-card:hover {
        border-color: var(--primary);
        transform: translateY(-1px);
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.05),
          0 18px 36px rgba(21, 25, 31, 0.10);
      }
      .tx-card-link {
        position: absolute;
        inset: 0;
        z-index: 1;
        text-decoration: none;
      }
      .tx-card-actions {
        position: absolute;
        top: 6px;
        right: 6px;
        display: inline-flex;
        gap: 2px;
        z-index: 2;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .tx-card:hover .tx-card-actions,
      .tx-card:focus-within .tx-card-actions { opacity: 1; }
      @media (hover: none) { .tx-card-actions { opacity: 1; } }
      .tx-icon-btn { width: 26px; height: 26px; }
      .tx-icon-btn-danger:hover { color: var(--error); background: rgba(122, 46, 46, 0.06); }

      .tx-card-thumb {
        height: 110px;
        border-bottom: 1px solid var(--ink-line-soft);
        background: var(--paper-soft);
        position: relative;
      }
      .tx-thumb-svg { width: 100%; height: 100%; display: block; }

      .tx-card-body { padding: 14px 18px 18px; display: flex; flex-direction: column; gap: 8px; }
      .tx-card-title {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        line-height: 1.25;
      }
      .tx-card-desc {
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-3);
        line-height: 1.5;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tx-card-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 10px;
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--ink-3);
        margin-top: 2px;
      }
      .tx-meta-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: var(--paper-warm);
        border-radius: var(--r-sm);
        color: var(--ink-2);
      }
      .tx-meta-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--primary);
      }
      .tx-meta-time {
        font-family: var(--mono);
        font-size: 10.5px;
        letter-spacing: 0.02em;
      }
      .tx-meta-link {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border: 1px solid color-mix(in srgb, var(--source) 30%, transparent);
        border-radius: var(--r-sm);
        background: color-mix(in srgb, var(--source) 8%, transparent);
        color: var(--source);
        text-decoration: none;
        font-weight: 500;
        transition: background 0.12s, color 0.12s;
      }
      .tx-meta-link:hover {
        background: color-mix(in srgb, var(--source) 18%, transparent);
        color: var(--source-2, var(--source));
      }
      .tx-meta-link i { font-size: 9px; opacity: 0.85; }
      .tx-card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }

      /* ============ MODAL ============ */
      .tx-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 18, 23, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 500;
        padding: 24px;
      }
      .tx-modal {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-lg);
        box-shadow: 0 24px 60px rgba(21, 25, 31, 0.18);
        width: 100%;
        max-width: 480px;
      }
      .tx-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px 12px;
        border-bottom: 1px solid var(--ink-line-soft);
      }
      .tx-modal-title {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
      }
      .tx-modal-body { padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 14px; }
      .tx-modal-errors {
        margin: 0;
        padding: 10px 14px;
        list-style: none;
        background: rgba(122, 46, 46, 0.06);
        color: var(--error);
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 12.5px;
      }
      .tx-modal-errors li + li { margin-top: 4px; }
      .tx-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

      /* ============ EMPTY ============ */
      .tx-empty-state { max-width: 520px; margin: 80px auto 0; padding: 24px; }
      .tx-empty-state .sp-empty-title { font-size: 20px; }
      .tx-empty-state .sp-empty-sub  { font-size: 13.5px; max-width: 420px; }
      .tx-empty-actions { display: flex; gap: 8px; justify-content: center; margin-top: 18px; }

      .tx-empty {
        max-width: 480px;
        margin: 32px auto;
        padding: 24px;
        text-align: center;
      }

      @media (max-width: 720px) {
        .tx { padding: 22px 18px 48px; }
        .tx-title { font-size: 28px; }
        .tx-grid { gap: 14px; }
      }
    `}</style>
  );
}
