import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

// Edits the groupings list for a single collection. All mutations round-trip
// to the server and the modal hands the canonical list back via onChange so
// every caller (bibliography, sources index, collection show) can refresh
// without re-fetching the whole page.
//
// Props:
//   isOpen, onClose      — standard modal control
//   collectionId         — the collection whose groupings we're editing
//   initialGroupings     — array of {id, name, position} from the parent
//   onChange(groupings)  — called after each successful mutation
//   canEdit              — collaborator gate; non-collaborators see read-only
export default function CollectionGroupingsModal({
  isOpen,
  onClose,
  collectionId,
  initialGroupings = [],
  onChange,
  canEdit = true,
}) {
  const [groupings, setGroupings] = useState(initialGroupings);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null); // 'new' for the create row, or grouping id
  const [renameDrafts, setRenameDrafts] = useState({}); // id → in-progress text

  useEffect(() => {
    if (isOpen) {
      setGroupings(initialGroupings);
      setRenameDrafts({});
      setNewName('');
      setError('');
    }
  }, [isOpen, initialGroupings]);

  const commit = (list) => {
    setGroupings(list);
    onChange?.(list);
  };

  const request = async (method, path, body) => {
    setError('');
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data.errors || []).join(', ') || `Request failed (${res.status})`);
    }
    return res.json();
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusyId('new');
    try {
      const list = await request('POST', `/collections/${collectionId}/groupings`, { name });
      commit(list);
      setNewName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRename = async (grouping) => {
    const draft = renameDrafts[grouping.id];
    if (draft == null || draft.trim() === grouping.name) {
      setRenameDrafts((d) => { const next = { ...d }; delete next[grouping.id]; return next; });
      return;
    }
    setBusyId(grouping.id);
    try {
      const list = await request('PATCH', `/collections/${collectionId}/groupings/${grouping.id}`, { name: draft.trim() });
      commit(list);
      setRenameDrafts((d) => { const next = { ...d }; delete next[grouping.id]; return next; });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (grouping, delta) => {
    const target = grouping.position + delta;
    if (target < 0 || target >= groupings.length) return;
    setBusyId(grouping.id);
    try {
      const list = await request('PATCH', `/collections/${collectionId}/groupings/${grouping.id}`, { position: target });
      commit(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (grouping) => {
    const count = grouping.source_count || 0;
    const tail = count > 0 ? ` Its ${count} source${count === 1 ? '' : 's'} will move to Unsorted.` : '';
    if (!window.confirm(`Delete the "${grouping.name}" grouping?${tail}`)) return;
    setBusyId(grouping.id);
    try {
      const list = await request('DELETE', `/collections/${collectionId}/groupings/${grouping.id}`);
      commit(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <CGMStyles />
      <div className="cgm">
        <header className="cgm-head">
          <h2 className="cgm-title">Manage groupings</h2>
          <p className="cgm-sub">
            Groupings let you sort this collection&#39;s sources into buckets — schools of
            thought, themes, importance levels, whatever fits the work.
          </p>
        </header>

        {error && <p className="cgm-error">{error}</p>}

        <ul className="cgm-list">
          {groupings.length === 0 && (
            <li className="cgm-empty">No groupings yet. Add one below.</li>
          )}
          {groupings.map((g) => {
            const draft = renameDrafts[g.id];
            const draftValue = draft != null ? draft : g.name;
            const busy = busyId === g.id;
            return (
              <li key={g.id} className="cgm-row">
                {canEdit ? (
                  <input
                    type="text"
                    className="cgm-input"
                    value={draftValue}
                    onChange={(e) => setRenameDrafts((d) => ({ ...d, [g.id]: e.target.value }))}
                    onBlur={() => handleRename(g)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                      if (e.key === 'Escape') { setRenameDrafts((d) => { const n = { ...d }; delete n[g.id]; return n; }); e.currentTarget.blur(); }
                    }}
                    disabled={busy}
                    aria-label="Grouping name"
                  />
                ) : (
                  <span className="cgm-name">{g.name}</span>
                )}
                <span className="cgm-count">
                  {g.source_count != null ? `${g.source_count} source${g.source_count === 1 ? '' : 's'}` : ''}
                </span>
                {canEdit && (
                  <div className="cgm-actions">
                    <button type="button" className="cgm-iconbtn" onClick={() => handleMove(g, -1)} disabled={busy || g.position === 0} aria-label="Move up" title="Move up">
                      <i className="fas fa-chevron-up" />
                    </button>
                    <button type="button" className="cgm-iconbtn" onClick={() => handleMove(g, +1)} disabled={busy || g.position === groupings.length - 1} aria-label="Move down" title="Move down">
                      <i className="fas fa-chevron-down" />
                    </button>
                    <button type="button" className="cgm-iconbtn cgm-iconbtn-danger" onClick={() => handleDelete(g)} disabled={busy} aria-label="Delete grouping" title="Delete">
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {canEdit && (
          <div className="cgm-add">
            <input
              type="text"
              className="cgm-input"
              placeholder="Add a grouping…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              disabled={busyId === 'new'}
            />
            <button type="button" className="cgm-add-btn" onClick={handleAdd} disabled={!newName.trim() || busyId === 'new'}>
              <i className="fas fa-plus" /> Add
            </button>
          </div>
        )}

        <footer className="cgm-foot">
          <button type="button" className="cgm-done" onClick={onClose}>Done</button>
        </footer>
      </div>
    </Modal>
  );
}

function CGMStyles() {
  return (
    <style>{`
      .cgm { padding: 20px 24px 18px; font-family: var(--font-body); color: var(--ink); }
      .cgm-head { margin-bottom: 14px; }
      .cgm-title {
        margin: 0 0 4px;
        font-family: var(--font-display);
        font-size: 20px;
        font-weight: 600;
        color: var(--primary);
      }
      .cgm-sub { margin: 0; font-size: 13px; color: var(--ink-3); line-height: 1.5; }
      .cgm-error {
        margin: 8px 0 12px;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--danger, #c0392b) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger, #c0392b) 35%, transparent);
        color: var(--danger, #c0392b);
        border-radius: var(--r-sm);
        font-size: 12.5px;
      }
      .cgm-list { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-direction: column; gap: 6px; }
      .cgm-empty { font-size: 13px; color: var(--ink-4); padding: 8px 0; }
      .cgm-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        border-radius: var(--r-sm);
        background: var(--paper);
      }
      .cgm-row:hover { background: var(--paper-soft); }
      .cgm-input {
        font-family: var(--font-body);
        font-size: 13px;
        padding: 6px 10px;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--ink);
        min-width: 0;
        width: 100%;
      }
      .cgm-input:hover { border-color: var(--ink-line); background: var(--paper); }
      .cgm-input:focus { outline: none; border-color: var(--primary); background: var(--paper); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 14%, transparent); }
      .cgm-name { font-size: 13px; }
      .cgm-count { font-size: 11.5px; color: var(--ink-4); white-space: nowrap; }
      .cgm-actions { display: inline-flex; gap: 2px; }
      .cgm-iconbtn {
        background: none; border: none; padding: 5px 7px;
        font-size: 12px; color: var(--ink-3); cursor: pointer; border-radius: var(--r-sm);
        transition: background 0.12s, color 0.12s;
      }
      .cgm-iconbtn:hover:not(:disabled) { background: var(--paper-soft); color: var(--ink); }
      .cgm-iconbtn:disabled { opacity: 0.35; cursor: not-allowed; }
      .cgm-iconbtn-danger:hover:not(:disabled) { color: var(--danger, #c0392b); }

      .cgm-add { display: flex; gap: 8px; align-items: center; margin-top: 14px; }
      .cgm-add .cgm-input { flex: 1; border: 1px solid var(--ink-line); background: var(--paper); }
      .cgm-add-btn {
        appearance: none;
        background: var(--primary); color: white; border: none;
        padding: 7px 14px; font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
        border-radius: var(--r-sm); cursor: pointer; white-space: nowrap;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .cgm-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .cgm-add-btn i { font-size: 10px; }

      .cgm-foot { display: flex; justify-content: flex-end; margin-top: 18px; }
      .cgm-done {
        background: var(--paper); border: 1px solid var(--ink-line);
        padding: 7px 16px; font-family: var(--font-body); font-size: 13px; font-weight: 600;
        color: var(--ink-2); border-radius: var(--r-sm); cursor: pointer;
      }
      .cgm-done:hover { background: var(--paper-soft); }
    `}</style>
  );
}
