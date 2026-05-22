import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import Modal from './Modal';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

function humanizeKind(kind) {
  if (!kind) return '';
  return kind.replace(/_/g, ' ');
}

function metaLine(source) {
  return [source.authors, source.year, humanizeKind(source.kind)]
    .filter(Boolean)
    .join('  ·  ');
}

// Conventional annotated-bibliography ordering: by author byline (falling
// back to title), then year.
function sourceSort(a, b) {
  const ka = (a.authors || a.title || '').toLowerCase();
  const kb = (b.authors || b.title || '').toLowerCase();
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return (a.year || 0) - (b.year || 0);
}

export default function CollectionBibliography({ collectionId, collectionName, isOwner, sharePermission }) {
  const canEdit = isOwner || sharePermission === 'collaborator';

  const [entries, setEntries] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfSource, setPdfSource] = useState(null);
  const [newEntryId, setNewEntryId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/collections/${collectionId}/bibliography_entries.json`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setSources(data.sources || []);
        setError('');
      } else if (res.status === 403) {
        setError("You don't have access to this collection.");
      } else if (res.status === 404) {
        setError('Collection not found.');
      } else {
        setError('Failed to load the bibliography.');
      }
    } catch (e) {
      console.error('Failed to load bibliography', e);
      setError('Failed to load the bibliography.');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => { load(); }, [load]);

  const sourcesById = useMemo(
    () => Object.fromEntries(sources.map((s) => [s.id, s])),
    [sources]
  );
  const annotatedIds = useMemo(
    () => new Set(entries.map((e) => e.source_id)),
    [entries]
  );
  const sidebarSources = useMemo(
    () => sources.filter((s) => !annotatedIds.has(s.id)).sort(sourceSort),
    [sources, annotatedIds]
  );
  const orderedEntries = useMemo(
    () => entries
      .map((e) => ({ entry: e, source: sourcesById[e.source_id] }))
      .filter((x) => x.source)
      .sort((x, y) => sourceSort(x.source, y.source)),
    [entries, sourcesById]
  );

  const handleAnnotate = async (sourceId) => {
    try {
      const res = await fetch(`/collections/${collectionId}/bibliography_entries.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ source_id: sourceId }),
      });
      if (!res.ok) throw new Error(`create ${res.status}`);
      const entry = await res.json();
      setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [...prev, entry]));
      setNewEntryId(entry.id);
    } catch (e) {
      console.error('Could not start annotation', e);
      alert('Could not start an annotation for that source.');
    }
  };

  const handleEntrySaved = useCallback((data) => {
    setEntries((prev) => prev.map((e) => (e.id === data.id ? { ...e, ...data } : e)));
  }, []);

  const handleRemoveEntry = async (entry) => {
    if (!window.confirm('Remove this annotation? The source stays in the collection — only the annotation is deleted.')) return;
    try {
      const res = await fetch(`/collections/${collectionId}/bibliography_entries/${entry.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken(), Accept: 'application/json' },
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      } else {
        alert('Could not remove the annotation.');
      }
    } catch (e) {
      console.error('Remove annotation failed', e);
      alert('Could not remove the annotation.');
    }
  };

  if (loading) {
    return <div className="cb-loading"><CBStyles />Loading bibliography…</div>;
  }
  if (error) {
    return (
      <div className="cb-loading">
        <CBStyles />
        <p>{error}</p>
        <a href="/collections" className="cb-back">← Back to Collections</a>
      </div>
    );
  }

  return (
    <>
      <CBStyles />
      <div className="cb-page">
        <a href={`/collections/${collectionId}`} className="cb-back">← {collectionName || 'Collection'}</a>

        <header className="cb-head">
          <div className="cb-headtext">
            <p className="cb-eyebrow">Annotated Bibliography</p>
            <h1 className="cb-title">{collectionName}</h1>
          </div>
          <div className="cb-headright">
            <div className="cb-counts">
              <span><strong>{orderedEntries.length}</strong> annotated</span>
              <span className="cb-counts-sep">·</span>
              <span><strong>{sidebarSources.length}</strong> to go</span>
            </div>
            <a href={`/collections/${collectionId}/bibliography/export`} className="cb-export-btn">
              <i className="fas fa-file-export" /> Export
            </a>
          </div>
        </header>

        {sources.length === 0 ? (
          <div className="cb-empty-all">
            <p>This collection has no sources yet.</p>
            <a href={`/collections/${collectionId}`} className="cb-empty-link">Add sources to the collection →</a>
          </div>
        ) : (
          <div className="cb-2col">
            <main className="cb-main">
              {orderedEntries.length === 0 ? (
                <div className="cb-main-empty">
                  <i className="fas fa-feather-pointed" />
                  <p className="cb-main-empty-title">Nothing annotated yet</p>
                  <p className="cb-main-empty-hint">
                    {canEdit
                      ? 'Pick a source from the list on the right to start its annotation.'
                      : 'No annotations have been written for this collection yet.'}
                  </p>
                </div>
              ) : (
                orderedEntries.map(({ entry, source }) => (
                  <EntryCard
                    key={entry.id}
                    collectionId={collectionId}
                    entry={entry}
                    source={source}
                    canEdit={canEdit}
                    isOwner={isOwner}
                    isNew={entry.id === newEntryId}
                    onRemove={handleRemoveEntry}
                    onViewPdf={setPdfSource}
                    onSaved={handleEntrySaved}
                  />
                ))
              )}
            </main>

            <aside className="cb-side">
              <div className="cb-side-inner">
                <h2 className="cb-side-title">
                  Not yet annotated <span className="cb-side-count">{sidebarSources.length}</span>
                </h2>
                {sidebarSources.length === 0 ? (
                  <p className="cb-side-done">🎉 Every source has an annotation.</p>
                ) : (
                  <ul className="cb-side-list">
                    {sidebarSources.map((source) => (
                      <li key={source.id} className="cb-side-item">
                        <div className="cb-side-item-text">
                          <span className="cb-side-item-titlerow">
                            {source.pdf_url && (
                              <i className="fas fa-file-pdf cb-side-pdf" title="Has a PDF attached" aria-label="Has a PDF attached" />
                            )}
                            <a href={`/sources/${source.id}`} className="cb-side-item-title">{source.title}</a>
                          </span>
                          <span className="cb-side-item-meta">{metaLine(source)}</span>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            className="cb-annotate-btn"
                            onClick={() => handleAnnotate(source.id)}
                          >
                            <i className="fas fa-plus" /> Annotate
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      {pdfSource && <PdfModal source={pdfSource} onClose={() => setPdfSource(null)} />}
    </>
  );
}

// =====================================================================
// EntryCard — one source's header + its two annotation fields.
// Each field debounce-autosaves; pending edits accumulate so a quick
// edit to both fields in one window still saves both.
// =====================================================================
function EntryCard({ collectionId, entry, source, canEdit, isOwner, isNew, onRemove, onViewPdf, onSaved }) {
  const [internal, setInternal] = useState(entry.internal_annotation || '');
  const [formal, setFormal] = useState(entry.formal_annotation || '');
  const [status, setStatus] = useState('idle'); // idle | pending | saving | saved | error
  const [editingField, setEditingField] = useState(
    isNew ? (isOwner ? 'internal' : 'formal') : null
  );
  const timerRef = useRef(null);
  const pendingRef = useRef({});

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const save = useCallback(async (fields) => {
    if (!fields || Object.keys(fields).length === 0) return;
    setStatus('saving');
    try {
      const res = await fetch(`/collections/${collectionId}/bibliography_entries/${entry.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ bibliography_entry: fields }),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);
      const data = await res.json();
      onSaved?.(data);
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2200);
    } catch (e) {
      console.error('Annotation save failed', e);
      setStatus('error');
    }
  }, [collectionId, entry.id, onSaved]);

  const scheduleSave = useCallback((field, value) => {
    pendingRef.current[field] = value;
    setStatus('pending');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const fields = pendingRef.current;
      pendingRef.current = {};
      save(fields);
    }, 850);
  }, [save]);

  const flush = useCallback(() => {
    if (Object.keys(pendingRef.current).length === 0) return;
    clearTimeout(timerRef.current);
    const fields = pendingRef.current;
    pendingRef.current = {};
    save(fields);
  }, [save]);

  const deactivate = useCallback(() => {
    flush();
    setEditingField(null);
  }, [flush]);

  const statusLabel = {
    pending: 'Unsaved changes…',
    saving: 'Saving…',
    saved: 'Saved ✓',
    error: 'Save failed — keep typing to retry',
  }[status] || '';

  return (
    <article className={`cb-entry${isNew ? ' is-new' : ''}`}>
      <header className="cb-entry-head">
        <div className="cb-entry-id">
          <a href={`/sources/${source.id}`} className="cb-entry-title">{source.title}</a>
          <span className="cb-entry-meta">{metaLine(source)}</span>
        </div>
        <div className="cb-entry-actions">
          {statusLabel && <span className={`cb-status cb-status-${status}`}>{statusLabel}</span>}
          {source.pdf_url ? (
            <button type="button" className="cb-entry-btn" onClick={() => onViewPdf(source)}>
              <i className="fas fa-file-pdf" /> PDF
            </button>
          ) : (
            <span className="cb-entry-nopdf">No PDF</span>
          )}
          {canEdit && (
            <button
              type="button"
              className="cb-entry-btn cb-entry-btn-danger"
              onClick={() => onRemove(entry)}
              title="Remove this annotation"
              aria-label="Remove this annotation"
            >
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
      </header>

      <div className="cb-annos">
        {isOwner && (
          <AnnotationField
            variant="internal"
            label="Internal note"
            hint="only you ever see this"
            value={internal}
            placeholder="Your working notes on this source — first impressions, questions, things to revisit."
            emptyText="—"
            canEdit={canEdit}
            editing={editingField === 'internal'}
            onActivate={() => setEditingField('internal')}
            onDeactivate={deactivate}
            onChange={(v) => { setInternal(v); scheduleSave('internal_annotation', v); }}
          />
        )}

        <AnnotationField
          variant="formal"
          label="Formal annotation"
          hint="shown to everyone who can see the collection"
          value={formal}
          placeholder="The polished annotation — what a contributor or reader would see."
          emptyText="No formal annotation yet."
          canEdit={canEdit}
          editing={editingField === 'formal'}
          onActivate={() => setEditingField('formal')}
          onDeactivate={deactivate}
          onChange={(v) => { setFormal(v); scheduleSave('formal_annotation', v); }}
        />
      </div>
    </article>
  );
}

// Focus a freshly-mounted textarea and drop the caret at the end.
function focusEnd(el) {
  if (!el) return;
  el.focus();
  const len = el.value.length;
  el.setSelectionRange(len, len);
}

// =====================================================================
// AnnotationField — one annotation with an inactive (display) and an
// active (editing) state. Inactive: the formal annotation renders as a
// clean paragraph, the internal note as a pinned note card. Active: a
// textarea — clicking the display (or the empty-state prompt) switches
// it on, blurring switches it back.
// =====================================================================
function AnnotationField({ variant, label, hint, value, placeholder, emptyText, canEdit, editing, onActivate, onDeactivate, onChange }) {
  let field;
  if (editing) {
    field = (
      <textarea
        ref={focusEnd}
        className="cb-textarea"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onDeactivate}
        rows={4}
      />
    );
  } else if (value) {
    field = (
      <p
        className={`cb-display cb-display-${variant}${canEdit ? ' is-editable' : ''}`}
        onClick={canEdit ? onActivate : undefined}
        onKeyDown={canEdit ? (e) => { if (e.key === 'Enter') { e.preventDefault(); onActivate(); } } : undefined}
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        title={canEdit ? 'Click to edit' : undefined}
      >
        {value}
      </p>
    );
  } else if (canEdit) {
    field = (
      <button type="button" className={`cb-display-add cb-display-add-${variant}`} onClick={onActivate}>
        <i className="fas fa-plus" /> {placeholder}
      </button>
    );
  } else {
    field = <p className="cb-display cb-display-empty">{emptyText}</p>;
  }

  return (
    <div className={`cb-anno cb-anno-${variant}`}>
      <label className="cb-anno-label">
        {label}
        <span className="cb-anno-hint">{hint}</span>
      </label>
      {field}
    </div>
  );
}

// =====================================================================
// PdfModal — paginated PDF preview reusing the shared Modal shell.
// =====================================================================
function PdfModal({ source, onClose }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [errored, setErrored] = useState(false);

  return (
    <Modal isOpen onClose={onClose} size="xlarge">
      <div className="cb-pdf">
        <header className="cb-pdf-head">
          <div className="cb-pdf-titlewrap">
            <h3 className="cb-pdf-title">{source.title}</h3>
            <span className="cb-pdf-sub">{metaLine(source)}</span>
          </div>
          <div className="cb-pdf-headactions">
            <a
              href={source.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="cb-pdf-iconbtn"
              title="Open PDF in a new tab"
            >
              <i className="fas fa-arrow-up-right-from-square" />
            </a>
            <button type="button" className="cb-pdf-iconbtn" onClick={onClose} aria-label="Close">
              <i className="fas fa-xmark" />
            </button>
          </div>
        </header>

        <div className="cb-pdf-body">
          {errored ? (
            <div className="cb-pdf-error">
              <p>Couldn't render this PDF here.</p>
              <a href={source.pdf_url} target="_blank" rel="noopener noreferrer">Open it directly →</a>
            </div>
          ) : (
            <Document
              file={source.pdf_url}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              onLoadError={() => setErrored(true)}
              loading={<div className="cb-pdf-loading">Loading PDF…</div>}
            >
              <Page
                pageNumber={pageNumber}
                width={840}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onRenderError={() => setErrored(true)}
              />
            </Document>
          )}
        </div>

        {numPages > 1 && !errored && (
          <footer className="cb-pdf-foot">
            <button
              type="button"
              className="cb-pdf-pagebtn"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className="cb-pdf-pagecount">Page {pageNumber} of {numPages}</span>
            <button
              type="button"
              className="cb-pdf-pagebtn"
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            >
              Next →
            </button>
          </footer>
        )}
      </div>
    </Modal>
  );
}

function CBStyles() {
  return (
    <style>{`
      .cb-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        gap: 12px;
        font-family: var(--font-body);
        color: var(--ink-3);
      }

      .cb-page {
        max-width: 1180px;
        margin: 0 auto;
        padding: 16px 32px 80px;
      }

      .cb-back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
        margin-bottom: 12px;
        transition: color 0.12s;
      }
      .cb-back:hover { color: var(--primary); }

      .cb-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 22px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--ink-line);
      }
      .cb-eyebrow {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--source, var(--ink-3));
        margin: 0 0 4px;
      }
      .cb-title {
        font-family: var(--font-display);
        font-size: 30px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }
      .cb-counts {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        white-space: nowrap;
        display: inline-flex;
        gap: 8px;
        align-items: baseline;
      }
      .cb-counts strong {
        font-family: var(--font-display);
        font-size: 18px;
        color: var(--primary);
        font-variant-numeric: tabular-nums;
      }
      .cb-counts-sep { color: var(--ink-line); }
      .cb-headright {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-shrink: 0;
      }
      .cb-export-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 7px 13px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--ink-2);
        text-decoration: none;
        white-space: nowrap;
        transition: background 0.12s, border-color 0.12s, color 0.12s;
      }
      .cb-export-btn:hover {
        background: var(--paper-soft);
        border-color: var(--ink-3);
        color: var(--ink);
      }
      .cb-export-btn i { font-size: 11px; }

      .cb-2col {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 312px;
        gap: 32px;
        align-items: start;
      }
      .cb-main { min-width: 0; display: flex; flex-direction: column; gap: 18px; }

      .cb-main-empty {
        border: 2px dashed var(--ink-line);
        border-radius: var(--r-lg);
        padding: 56px 24px;
        text-align: center;
        color: var(--ink-3);
        font-family: var(--font-body);
      }
      .cb-main-empty i { font-size: 30px; color: var(--ink-line); }
      .cb-main-empty-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink-2);
        margin: 12px 0 4px;
      }
      .cb-main-empty-hint { font-size: 13px; margin: 0; }

      .cb-empty-all {
        border: 1px solid var(--ink-line);
        border-radius: var(--r-lg);
        background: var(--paper-soft);
        padding: 48px 24px;
        text-align: center;
        font-family: var(--font-body);
        color: var(--ink-3);
      }
      .cb-empty-link {
        font-weight: 600;
        color: var(--primary);
        text-decoration: none;
      }
      .cb-empty-link:hover { text-decoration: underline; text-underline-offset: 3px; }

      .cb-entry {
        border: 1px solid var(--ink-line);
        border-radius: var(--r-lg);
        background: var(--paper);
        padding: 18px 20px 20px;
      }
      .cb-entry.is-new { animation: cb-flash 1.8s ease; }
      @keyframes cb-flash {
        0%   { box-shadow: 0 0 0 3px color-mix(in srgb, var(--source, var(--primary)) 45%, transparent); }
        100% { box-shadow: 0 0 0 3px transparent; }
      }

      .cb-entry-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }
      .cb-entry-id { min-width: 0; }
      .cb-entry-title {
        font-family: var(--font-display);
        font-size: 17px;
        font-weight: 600;
        color: var(--primary);
        text-decoration: none;
        line-height: 1.3;
      }
      .cb-entry-title:hover { text-decoration: underline; text-underline-offset: 2px; }
      .cb-entry-meta {
        display: block;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        margin-top: 3px;
      }
      .cb-entry-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .cb-status {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
      }
      .cb-status-pending { color: var(--ink-3); }
      .cb-status-saving  { color: var(--ink-3); }
      .cb-status-saved   { color: var(--source, var(--primary)); }
      .cb-status-error   { color: var(--error); }

      .cb-entry-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 4px 9px;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 600;
        color: var(--ink-2);
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .cb-entry-btn:hover { background: var(--paper); border-color: var(--ink-3); color: var(--ink); }
      .cb-entry-btn-danger:hover { color: var(--error); border-color: var(--error); }
      .cb-entry-nopdf {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-4);
        font-style: italic;
      }

      .cb-annos { display: flex; flex-direction: column; gap: 16px; }
      .cb-anno { display: flex; flex-direction: column; gap: 7px; }
      .cb-anno-label {
        display: inline-flex;
        align-items: baseline;
        gap: 7px;
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--primary);
      }
      .cb-anno-hint {
        font-weight: 500;
        letter-spacing: 0.01em;
        text-transform: none;
        font-size: 11px;
        color: var(--ink-4);
      }
      .cb-textarea {
        width: 100%;
        box-sizing: border-box;
        font-family: var(--font-body);
        font-size: 13.5px;
        line-height: 1.6;
        color: var(--ink);
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 10px 12px;
        resize: vertical;
        transition: border-color 0.12s, box-shadow 0.12s;
      }
      .cb-textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
      }

      /* Inactive display — the annotation at rest */
      .cb-display {
        font-family: var(--font-body);
        font-size: 13.5px;
        line-height: 1.65;
        color: var(--ink);
        white-space: pre-wrap;
        margin: 0;
      }
      .cb-display.is-editable { cursor: text; }
      .cb-display.is-editable:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--primary) 40%, transparent);
        outline-offset: 2px;
      }

      /* Formal — a clean, official paragraph */
      .cb-display-formal {
        padding: 4px 2px;
        border-radius: var(--r-sm);
        transition: background 0.12s;
      }
      .cb-display-formal.is-editable:hover { background: var(--paper-soft); }

      /* Internal — a note card pinned in the margin */
      .cb-display-internal {
        background: color-mix(in srgb, var(--source, var(--primary)) 7%, var(--paper));
        border: 1px solid color-mix(in srgb, var(--source, var(--primary)) 22%, var(--ink-line));
        border-left: 3px solid var(--source, var(--primary));
        border-radius: var(--r-md);
        padding: 10px 13px;
        color: var(--ink-2);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        transition: box-shadow 0.12s;
      }
      .cb-display-internal.is-editable:hover { box-shadow: 0 2px 7px rgba(0, 0, 0, 0.1); }

      /* Empty-state prompt */
      .cb-display-add {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        box-sizing: border-box;
        text-align: left;
        background: transparent;
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-md);
        padding: 10px 12px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-4);
        cursor: pointer;
        transition: border-color 0.12s, color 0.12s, background 0.12s;
      }
      .cb-display-add:hover {
        border-color: var(--primary);
        color: var(--ink-2);
        background: var(--paper-soft);
      }
      .cb-display-add-internal:hover { border-color: var(--source, var(--primary)); }
      .cb-display-add i { font-size: 9px; }

      .cb-display-empty {
        color: var(--ink-4);
        font-style: italic;
        font-size: 13px;
      }

      .cb-side { position: sticky; top: 16px; }
      .cb-side-inner {
        border: 1px solid var(--ink-line);
        border-radius: var(--r-lg);
        background: var(--paper-soft);
        padding: 16px;
      }
      .cb-side-title {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin: 0 0 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cb-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        background: var(--ink-line);
        color: var(--ink-2);
        border-radius: var(--r-sm);
        padding: 1px 7px;
      }
      .cb-side-done {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        margin: 4px 0;
      }
      .cb-side-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cb-side-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        padding: 9px 8px;
        border-radius: var(--r-md);
        transition: background 0.12s;
      }
      .cb-side-item:hover { background: var(--paper); }
      .cb-side-item-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .cb-side-item-titlerow {
        display: flex;
        align-items: baseline;
        gap: 5px;
      }
      .cb-side-pdf {
        flex-shrink: 0;
        font-size: 11px;
        color: var(--source, var(--ink-3));
      }
      .cb-side-item-title {
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
        text-decoration: none;
        line-height: 1.35;
      }
      .cb-side-item-title:hover { color: var(--primary); }
      .cb-side-item-meta {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-4);
      }
      .cb-annotate-btn {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--primary);
        color: var(--paper);
        border: 1px solid var(--primary);
        border-radius: var(--r-sm);
        padding: 4px 9px;
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s;
      }
      .cb-annotate-btn:hover { background: var(--primary-dark); border-color: var(--primary-dark); }
      .cb-annotate-btn i { font-size: 9px; }

      .cb-pdf { display: flex; flex-direction: column; max-height: 90vh; }
      .cb-pdf-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        border-bottom: 1px solid var(--ink-line);
        background: var(--paper-soft);
      }
      .cb-pdf-titlewrap { min-width: 0; }
      .cb-pdf-title {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--primary);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cb-pdf-sub {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
      }
      .cb-pdf-headactions { display: inline-flex; gap: 6px; flex-shrink: 0; }
      .cb-pdf-iconbtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        background: var(--paper);
        color: var(--ink-2);
        cursor: pointer;
        text-decoration: none;
        transition: background 0.12s, color 0.12s;
      }
      .cb-pdf-iconbtn:hover { background: var(--paper-soft); color: var(--ink); }

      .cb-pdf-body {
        overflow: auto;
        padding: 18px;
        display: flex;
        justify-content: center;
        background: var(--paper-soft);
      }
      .cb-pdf-loading, .cb-pdf-error {
        padding: 60px 24px;
        text-align: center;
        font-family: var(--font-body);
        color: var(--ink-3);
      }
      .cb-pdf-error a { color: var(--primary); font-weight: 600; }

      .cb-pdf-foot {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 12px 18px;
        border-top: 1px solid var(--ink-line);
        background: var(--paper);
      }
      .cb-pdf-pagebtn {
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 5px 12px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--ink-2);
        cursor: pointer;
      }
      .cb-pdf-pagebtn:hover:not(:disabled) { background: var(--paper); color: var(--ink); }
      .cb-pdf-pagebtn:disabled { opacity: 0.4; cursor: default; }
      .cb-pdf-pagecount {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      @media (max-width: 920px) {
        .cb-2col { grid-template-columns: 1fr; gap: 22px; }
        .cb-side { position: static; order: -1; }
      }
      @media (max-width: 768px) {
        .cb-page { padding: 12px 16px 56px; }
        .cb-title { font-size: 23px; }
        .cb-head { flex-direction: column; align-items: flex-start; gap: 8px; }
      }
    `}</style>
  );
}
