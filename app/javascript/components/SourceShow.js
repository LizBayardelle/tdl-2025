import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import SourceFormModal from './SourceFormModal';
import AuthorsDisplay from './AuthorsDisplay';
import MethodologyTags from './MethodologyTags';
import StatisticalTestTags from './StatisticalTestTags';
import { toTitleCase } from '../utils/titleCase';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function relativeTime(input) {
  if (!input) return '';
  const ts = new Date(input).getTime();
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SourceShow({ sourceId }) {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [allSources, setAllSources] = useState([]);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [highlights, setHighlights] = useState([]);
  const [citing, setCiting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!source) return;
    const ok = window.confirm(
      `Delete "${source.title}"?\n\n` +
      `This removes the source, its PDF, and all its highlights.  ` +
      `Notes you've taken on it will keep their content but become unattached.  ` +
      `This can't be undone.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const r = await fetch(`/sources/${sourceId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]')?.content,
          'Accept': 'application/json',
        },
      });
      if (r.ok || r.status === 204) {
        window.location.href = '/sources';
      } else {
        const data = await r.json().catch(() => ({}));
        alert(`Could not delete: ${data.error || r.status}`);
        setDeleting(false);
      }
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Could not delete the source — check your connection and try again.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchSource();
    fetchAllSources();
    fetchNotes();
    fetchHighlights();
  }, [sourceId]);

  const fetchSource = async () => {
    try {
      const response = await fetch(`/sources/${sourceId}.json`);
      const data = await response.json();
      setSource(data);
    } catch (error) {
      console.error('Error fetching source:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSources = async () => {
    try {
      const response = await fetch('/sources.json');
      const data = await response.json();
      const sources = Array.isArray(data) ? data : (data.sources || []);
      setAllSources(sources);
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  const fetchNotes = async () => {
    try {
      const r = await fetch(`/notes.json?source_id=${sourceId}`);
      const data = await r.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching notes:', e);
    } finally {
      setNotesLoading(false);
    }
  };

  const fetchHighlights = async () => {
    try {
      const r = await fetch(`/highlights.json?source_id=${sourceId}`);
      if (!r.ok) return;
      const data = await r.json();
      setHighlights(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching highlights:', e);
    }
  };

  if (loading) {
    return (
      <div className="ss-loading"><SSStyles />Loading.</div>
    );
  }

  if (!source) {
    return (
      <div className="ss-loading"><SSStyles />Source not found.</div>
    );
  }

  return (
    <div className="ss-shell">
      <SSStyles />

      <header className="ss-header">
        <a href="/sources" className="ss-back">← All sources</a>
        <div className="ss-header-actions">
          <button type="button" className="sp-action sp-action-secondary" onClick={() => setEditing(true)}>Edit</button>
          <button
            type="button"
            className="sp-action sp-action-quiet sp-action-danger"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete this source"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </header>

      <SourceFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        item={source}
        onSuccess={(updatedSource) => {
          setSource(updatedSource);
          setEditing(false);
          fetchAllSources();
        }}
      />

      <SourceHero source={source} />

      <section className="ss-row1">
        <div className="ss-row1-pdf">
          <SourcePdfCard source={source} notes={notes} onCite={() => setCiting(true)} />
        </div>
        <div className="ss-row1-abstract">
          <SourceAbstract source={source} />
          <SourceMetaRow source={source} onSourceUpdate={setSource} />
        </div>
      </section>

      <section className="ss-row2">
        <div className="ss-row2-notes">
          <SourceHighlights highlights={highlights} sourceId={source.id} />
          <SourceNotes
            sourceId={source.id}
            notes={notes}
            loading={notesLoading}
          />
        </div>
        <aside className="ss-row2-side">
          <SourceSidebar
            source={source}
            allSources={allSources}
            notesCount={notes.length}
            onSourceUpdate={setSource}
            onSourceRefetch={fetchSource}
          />
        </aside>
      </section>

      <CitationModal isOpen={citing} onClose={() => setCiting(false)} source={source} />
    </div>
  );
}

// =====================================================================
// Hero — eyebrow + title + linked authors.  Lives above row 1.
// =====================================================================
function SourceHero({ source }) {
  return (
    <section className="ss-hero">
      <div className="ss-hero-top">
        {source.kind && (
          <span className="ss-hero-type">{source.kind.replace(/_/g, ' ')}</span>
        )}
        {source.doi && <DoiBadge doi={source.doi} />}
        {source.year && <span className="ss-hero-meta">{source.year}</span>}
        {source.journal_name && <span className="ss-hero-meta is-journal">{source.journal_name}</span>}
        {Array.isArray(source.markers) && source.markers.map((m) => (
          <span key={m} className="ss-hero-marker">{m}</span>
        ))}
      </div>
      <h1 className="ss-hero-title">{toTitleCase(source.title || '')}</h1>
      {source.authors && (
        <p className="ss-hero-authors">
          <AuthorsDisplay
            authors={source.authors}
            people={source.people}
            onPersonClick={(personId) => window.location.href = `/people/${personId}`}
          />
        </p>
      )}
    </section>
  );
}

// =====================================================================
// DOI badge — whole pill links to https://doi.org/<doi>; inline copy
// icon stops propagation and copies the bare DOI to clipboard.
// =====================================================================
function DoiBadge({ doi }) {
  const [copied, setCopied] = useState(false);
  const cleaned = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  const url = `https://doi.org/${cleaned}`;
  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(cleaned).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="ss-doi-badge"
      title="Open DOI in new tab"
    >
      <span className="ss-doi-label">DOI</span>
      <span className="ss-doi-value">{cleaned}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="ss-doi-copy"
        title={copied ? 'Copied' : 'Copy DOI'}
        aria-label={copied ? 'Copied' : 'Copy DOI'}
      >
        <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
      </button>
    </a>
  );
}

// =====================================================================
// PDF preview card — sits in row 1 left (1/3).  The "product photo".
// =====================================================================
function SourcePdfCard({ source, notes, onCite }) {
  const studyHref = `/sources/${source.id}/study`;
  const latestNote = notes && notes.length > 0
    ? notes.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b))
    : null;
  return (
    <div className="ss-pdf">
      <a href={studyHref} className={`ss-pdf-card${source.pdf_url ? '' : ' is-empty'}`}>
        {source.pdf_url ? (
          <PdfThumbnail url={source.pdf_url} filename={source.pdf_filename} />
        ) : (
          <div className="ss-pdf-cover ss-pdf-cover-empty">
            <i className="fas fa-book-open ss-pdf-icon" />
            <span className="ss-pdf-name ss-pdf-name-empty">No PDF attached</span>
          </div>
        )}
      </a>

      <a href={studyHref} className="ss-study-cta">
        <i className="fas fa-pen-fancy" /> Study this PDF →
      </a>

      <button type="button" className="ss-cite-btn" onClick={onCite}>
        <i className="fas fa-quote-right" /> Cite this
      </button>

      <p className="ss-engaged">
        {latestNote
          ? <>Last note <strong>{relativeTime(latestNote.created_at)}</strong> · {notes.length} note{notes.length === 1 ? '' : 's'}</>
          : <>Never opened in study mode</>}
      </p>
    </div>
  );
}

// =====================================================================
// PdfThumbnail — renders the first page of the PDF as the cover art.
// Falls back to a tinted icon while loading or on error.
// =====================================================================
function PdfThumbnail({ url, filename }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        // -2 for the 1px border on each side; cap at 360 to avoid
        // re-rendering at huge widths on wide viewports.
        const w = Math.min(360, Math.max(160, containerRef.current.clientWidth - 2));
        setWidth(w);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fallback = (
    <div className="ss-pdf-cover ss-pdf-cover-fallback">
      <i className="fas fa-file-pdf ss-pdf-icon" />
      {filename && <span className="ss-pdf-name">{filename}</span>}
    </div>
  );

  if (errored) return fallback;

  return (
    <div ref={containerRef} className="ss-pdf-thumb">
      <Document
        file={url}
        loading={fallback}
        error={fallback}
        onLoadError={() => setErrored(true)}
      >
        {width > 0 && (
          <Page
            pageNumber={1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onRenderError={() => setErrored(true)}
          />
        )}
      </Document>
      {filename && <span className="ss-pdf-name">{filename}</span>}
    </div>
  );
}

// =====================================================================
// Abstract column — summary (italic display) + abstract.  Row 1 right.
// =====================================================================
function SourceAbstract({ source }) {
  if (!source.summary && !source.abstract) {
    return (
      <p className="ss-abstract-empty">
        No summary or abstract yet — click <em>Edit</em> to add one.
      </p>
    );
  }
  return (
    <div className="ss-abstract">
      {source.summary && (
        <div className="ss-summary">
          <span className="ss-section-eyebrow">Summary</span>
          <div
            className="ss-summary-body"
            dangerouslySetInnerHTML={{ __html: source.summary }}
          />
        </div>
      )}
      {source.abstract && (
        <div className="ss-abstract-block">
          <span className="ss-section-eyebrow">Abstract</span>
          <div
            className="ss-richtext"
            dangerouslySetInnerHTML={{ __html: source.abstract }}
          />
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Meta row — Authors, Research Types, Concepts shown as a 3-up grid
// directly below the abstract.  Lifted out of the sidebar so users
// see provenance + classification with the source's prose.
// =====================================================================
function SourceMetaRow({ source, onSourceUpdate }) {
  const hasPeople   = source.people   && source.people.length   > 0;
  const hasConcepts = source.concepts && source.concepts.length > 0;
  // Research Types block always renders so the autodetect button is
  // available even on sources with no methodologies yet.
  return (
    <div className="ss-meta-row">
      <div className="ss-meta-block">
        <span className="ss-meta-label">
          Authors{hasPeople ? ` (${source.people.length})` : ''}
        </span>
        {hasPeople ? (
          <div className="ss-chip-row">
            {source.people.map((p) => (
              <a key={p.id} href={`/people/${p.id}`} className="ss-chip ss-chip-person">
                {toTitleCase(p.full_name)}
              </a>
            ))}
          </div>
        ) : (
          <span className="ss-meta-empty">None linked.</span>
        )}
      </div>

      <div className="ss-meta-block">
        <span className="ss-meta-label">Research Types</span>
        <MethodologyTags source={source} onUpdate={onSourceUpdate} />
        <span className="ss-meta-label" style={{ marginTop: 'var(--space-3)' }}>Statistical Tests</span>
        <StatisticalTestTags source={source} onUpdate={onSourceUpdate} />
      </div>

      <div className="ss-meta-block">
        <span className="ss-meta-label">
          Concepts{hasConcepts ? ` (${source.concepts.length})` : ''}
        </span>
        {hasConcepts ? (
          <div className="ss-chip-row">
            {source.concepts.map((c) => (
              <a key={c.id} href={`/concepts/${c.id}`} className="ss-chip ss-chip-concept">
                {c.label}
              </a>
            ))}
          </div>
        ) : (
          <span className="ss-meta-empty">None linked.</span>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Highlights — pull-quote section above Notes.  Shows count + first 3
// quotes; "Show N more" expands the rest.  Hidden when none exist.
// =====================================================================
function SourceHighlights({ highlights, sourceId }) {
  const [expanded, setExpanded] = useState(false);
  if (!highlights || highlights.length === 0) return null;
  const visible = expanded ? highlights : highlights.slice(0, 3);
  const studyHref = `/sources/${sourceId}/study`;
  return (
    <section className="ss-highlights">
      <header className="ss-highlights-head">
        <h2 className="ss-highlights-heading">
          Highlights <span className="ss-highlights-count">{highlights.length}</span>
        </h2>
      </header>
      <ul className="ss-highlights-list">
        {visible.map((h) => (
          <li key={h.id} className="ss-highlight">
            <blockquote className="ss-highlight-quote">"{h.text_content}"</blockquote>
            <div className="ss-highlight-meta">
              {h.page_number != null && <span>Page {h.page_number}</span>}
              <a href={studyHref} className="ss-highlight-link">
                Open in study mode →
              </a>
            </div>
          </li>
        ))}
      </ul>
      {highlights.length > 3 && (
        <button
          type="button"
          className="ss-highlights-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : `Show ${highlights.length - 3} more`}
        </button>
      )}
    </section>
  );
}

// =====================================================================
// Notes — empty void CTA when no notes; list with study-mode CTA when
// notes exist.  All note-taking is intentionally driven into study mode.
// =====================================================================
function SourceNotes({ sourceId, notes, loading }) {
  const studyHref = `/sources/${sourceId}/study`;

  if (loading) {
    return <div className="ss-notes-loading">Loading notes…</div>;
  }

  if (notes.length === 0) {
    return (
      <a href={studyHref} className="ss-notes-void">
        <span className="ss-notes-void-plus">+</span>
        <span className="ss-notes-void-label">Your Notes Go Here</span>
        <span className="ss-notes-void-hint">
          Open this source in study mode to highlight, annotate, and capture every insight.
        </span>
      </a>
    );
  }

  return (
    <section className="ss-notes">
      <header className="ss-notes-head">
        <h2 className="ss-notes-heading">
          Notes <span className="ss-notes-count">{notes.length}</span>
        </h2>
        <a href={studyHref} className="sp-action sp-action-primary ss-notes-cta">
          <i className="fas fa-pen-fancy" /> Open study mode
        </a>
      </header>

      <ul className="ss-note-list">
        {notes.map((note) => (
          <li key={note.id} className="ss-note-card">
            {note.title && <h4 className="ss-note-title">{note.title}</h4>}
            <div
              className="ss-note-body"
              dangerouslySetInnerHTML={{ __html: note.body || '' }}
            />
            {(note.concepts?.length > 0 || (Array.isArray(note.tags) && note.tags.length > 0)) && (
              <div className="ss-note-chips">
                {note.concepts?.map((c) => (
                  <span key={`c-${c.id}`} className="ss-chip ss-chip-concept">{c.label}</span>
                ))}
                {Array.isArray(note.tags) && note.tags.map((t, i) => (
                  <span key={`t-${i}`} className="ss-chip ss-chip-tag">
                    {typeof t === 'string' ? t : t.name}
                  </span>
                ))}
              </div>
            )}
            <div className="ss-note-meta">
              {note.page_number && <span>Page {note.page_number}</span>}
              <span>{new Date(note.created_at).toLocaleDateString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =====================================================================
// Sidebar — counts, related sources by shared concept, more by these
// authors, research types, tags, authors, concepts, collections.
// Row 2 right (1/3).  Mobile: renders above notes via order swap.
// =====================================================================
function SourceSidebar({ source, allSources, notesCount, onSourceUpdate, onSourceRefetch }) {
  const relatedByConcept = useMemo(() => {
    if (!source.concepts || source.concepts.length === 0 || !Array.isArray(allSources)) return [];
    const myConceptIds = new Set(source.concepts.map((c) => c.id));
    return allSources
      .filter((s) => s.id !== source.id && Array.isArray(s.concepts))
      .map((s) => ({
        source: s,
        shared: s.concepts.filter((c) => myConceptIds.has(c.id)).length,
      }))
      .filter((x) => x.shared > 0)
      .sort((a, b) => b.shared - a.shared)
      .slice(0, 6);
  }, [source.id, source.concepts, allSources]);

  const moreByAuthors = useMemo(() => {
    if (!source.people || source.people.length === 0 || !Array.isArray(allSources)) return [];
    const myPeopleIds = new Set(source.people.map((p) => p.id));
    return allSources
      .filter((s) => s.id !== source.id && Array.isArray(s.people))
      .filter((s) => s.people.some((p) => myPeopleIds.has(p.id)))
      .slice(0, 5);
  }, [source.id, source.people, allSources]);

  const stats = [
    { label: 'Notes',    value: notesCount ?? source.notes_count ?? 0 },
    { label: 'Concepts', value: source.concepts?.length ?? 0 },
    { label: 'Related',  value: relatedByConcept.length },
  ].filter((s) => s.value > 0);

  return (
    <div className="ss-side">
      {stats.length > 0 && (
        <div className="ss-side-stats">
          {stats.map((s) => (
            <div key={s.label} className="ss-side-stat">
              <span className="ss-side-stat-value">{s.value}</span>
              <span className="ss-side-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {source.statistical_tests && source.statistical_tests.length > 0 && (
        <SidebarBlock label="Statistical Tests" count={source.statistical_tests.length}>
          <div className="ss-side-chips">
            {source.statistical_tests.map((t) => (
              <a
                key={t.id}
                href={`/statistical_tests/${t.slug}`}
                className="ss-chip ss-chip-stat"
                title={t.detected_automatically ? 'Auto-detected from abstract' : 'Manually linked'}
                onClick={(e) => e.stopPropagation()}
              >
                {t.name}
              </a>
            ))}
          </div>
        </SidebarBlock>
      )}

      {source.tags && source.tags.length > 0 && (
        <SidebarBlock label="Tags" count={source.tags.length}>
          <div className="ss-side-chips">
            {source.tags.map((t, i) => (
              <a
                key={t.id ?? i}
                href={`/tags/${t.slug || t.name}`}
                className="ss-chip ss-chip-tag"
              >
                {t.name}
              </a>
            ))}
          </div>
        </SidebarBlock>
      )}

      {relatedByConcept.length > 0 && (
        <SidebarBlock
          label="Related Sources"
          count={relatedByConcept.length}
          sub="Sources sharing concepts with this one."
        >
          <ul className="ss-side-list">
            {relatedByConcept.map(({ source: s, shared }) => (
              <li key={s.id} className="ss-side-row">
                <a href={`/sources/${s.id}`} className="ss-side-name">
                  {toTitleCase(s.title || '')}
                </a>
                <span className="ss-side-meta">{shared} shared</span>
              </li>
            ))}
          </ul>
        </SidebarBlock>
      )}

      {moreByAuthors.length > 0 && (
        <SidebarBlock label="More by These Authors" count={moreByAuthors.length}>
          <ul className="ss-side-list">
            {moreByAuthors.map((s) => (
              <li key={s.id} className="ss-side-row">
                <a href={`/sources/${s.id}`} className="ss-side-name">
                  {toTitleCase(s.title || '')}
                </a>
                {s.year && <span className="ss-side-meta">{s.year}</span>}
              </li>
            ))}
          </ul>
        </SidebarBlock>
      )}

      <SidebarBlock
        label="Collections"
        count={source.collections?.length ?? 0}
      >
        {source.collections && source.collections.length > 0 && (
          <div className="ss-side-chips">
            {source.collections.map((c) => (
              <a key={c.id} href={`/collections/${c.id}`} className="ss-side-chip">
                {c.name}
              </a>
            ))}
          </div>
        )}
        <CollectionPicker
          source={source}
          onAdded={onSourceRefetch}
        />
      </SidebarBlock>
    </div>
  );
}

// =====================================================================
// CollectionPicker — small inline picker that fetches the user's
// collections, hides ones this source is already in, and POSTs to
// /collections/:id/add_item on selection.
// =====================================================================
function CollectionPicker({ source, onAdded }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const inIds = new Set((source.collections || []).map((c) => c.id));

  const load = async () => {
    if (collections != null) return;
    try {
      const r = await fetch('/collections.json');
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      setCollections(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Could not load collections:', e);
      setError('Could not load collections.');
    }
  };

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) load();
      return next;
    });
  };

  const handleAdd = async (collectionId) => {
    setBusyId(collectionId);
    setError(null);
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const r = await fetch(`/collections/${collectionId}/add_item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ item_type: 'Source', item_id: source.id }),
      });
      if (!r.ok) throw new Error(r.status);
      onAdded?.();
      setOpen(false);
    } catch (e) {
      console.error('Add to collection failed:', e);
      setError('Could not add to collection.');
    } finally {
      setBusyId(null);
    }
  };

  const available = (collections || []).filter((c) => !inIds.has(c.id));

  return (
    <div className="ss-cp">
      <button
        type="button"
        className="ss-cp-toggle"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <i className={`fas fa-${open ? 'minus' : 'plus'}`} /> Add to collection
      </button>
      {open && (
        <div className="ss-cp-panel">
          {collections == null ? (
            <p className="ss-cp-state">Loading…</p>
          ) : available.length === 0 ? (
            <p className="ss-cp-state">
              {collections.length === 0
                ? <>No collections yet. <a href="/collections">Create one →</a></>
                : <>This source is in every collection.</>}
            </p>
          ) : (
            <ul className="ss-cp-list">
              {available.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="ss-cp-item"
                    onClick={() => handleAdd(c.id)}
                    disabled={busyId === c.id}
                  >
                    <span className="ss-cp-item-name">{c.name}</span>
                    {c.items_count != null && (
                      <span className="ss-cp-item-meta">{c.items_count}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="ss-cp-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

function SidebarBlock({ label, count, sub, children }) {
  return (
    <div className="ss-side-block">
      <div className="ss-side-head">
        <span className="ss-side-label">{label}</span>
        {count != null && <span className="ss-side-count">{count}</span>}
      </div>
      {sub && <p className="ss-side-sub">{sub}</p>}
      {children}
    </div>
  );
}

// =====================================================================
// Citation modal — APA 7, Chicago author-date, BibTeX.  Pure client-side
// generation from the source fields — fields users haven't filled get
// graceful fallbacks ("n.d." for year, etc.).  Each format has its own
// copy button.
// =====================================================================
function buildCitations(source) {
  if (!source) return { apa: '', chicago: '', bibtex: '' };

  // Authors usually come in as a string ("Yang, X., Wang, L.") but
  // some sources return an array — normalize both shapes to a string.
  const authorsRaw = source.authors;
  const authors = (Array.isArray(authorsRaw)
    ? authorsRaw.filter(Boolean).join(', ')
    : (typeof authorsRaw === 'string' ? authorsRaw : '')
  ).trim() || 'Anonymous';
  const year = source.year || 'n.d.';
  const title = (typeof source.title === 'string' ? source.title : '').trim() || 'Untitled';
  const journal = (typeof source.journal_name === 'string' ? source.journal_name : '').trim();
  const doi = typeof source.doi === 'string'
    ? source.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    : null;
  const url = typeof source.url === 'string' ? source.url : null;

  const apaParts = [`${authors} (${year}).`, `${title}.`];
  if (journal) apaParts.push(`<i>${journal}</i>.`);
  if (doi)        apaParts.push(`https://doi.org/${doi}`);
  else if (url)   apaParts.push(url);
  const apa = apaParts.join(' ');

  const chicagoParts = [`${authors}.`, `${year}.`, `"${title}."`];
  if (journal) chicagoParts.push(`<i>${journal}</i>.`);
  if (doi)        chicagoParts.push(`https://doi.org/${doi}.`);
  else if (url)   chicagoParts.push(`${url}.`);
  const chicago = chicagoParts.join(' ');

  const lastName = authors.split(',')[0]?.trim().split(/\s+/)[0] || 'Anonymous';
  const key = `${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}${year}`.replace(/[^a-z0-9]/gi, '');
  const entryType =
    source.kind === 'book' ? 'book'
    : source.kind === 'book_chapter' ? 'incollection'
    : source.kind === 'thesis' ? 'phdthesis'
    : 'article';
  const bibLines = [`@${entryType}{${key},`];
  bibLines.push(`  author = {${authors}},`);
  bibLines.push(`  title  = {${title}},`);
  if (journal && entryType === 'article') bibLines.push(`  journal = {${journal}},`);
  bibLines.push(`  year   = {${year}},`);
  if (doi) bibLines.push(`  doi    = {${doi}},`);
  if (url && !doi) bibLines.push(`  url    = {${url}},`);
  bibLines.push('}');
  const bibtex = bibLines.join('\n');

  return { apa, chicago, bibtex };
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '');

function CitationModal({ isOpen, onClose, source }) {
  const [tab, setTab] = useState('apa');
  const [copiedTab, setCopiedTab] = useState(null);
  const cites = useMemo(() => buildCitations(source), [source]);

  if (!isOpen) return null;

  const formats = [
    { key: 'apa',     label: 'APA 7',     html: cites.apa,     plain: stripTags(cites.apa) },
    { key: 'chicago', label: 'Chicago',   html: cites.chicago, plain: stripTags(cites.chicago) },
    { key: 'bibtex',  label: 'BibTeX',    html: null,          plain: cites.bibtex },
  ];
  const active = formats.find((f) => f.key === tab) || formats[0];

  const handleCopy = () => {
    navigator.clipboard?.writeText(active.plain).then(() => {
      setCopiedTab(active.key);
      setTimeout(() => setCopiedTab(null), 1600);
    });
  };

  return (
    <div className="ss-cite-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ss-cite-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ss-cite-header">
          <h3 className="ss-cite-title">Cite this source</h3>
          <button type="button" className="ss-cite-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </header>

        <div className="ss-cite-tabs" role="tablist">
          {formats.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={tab === f.key}
              className={`ss-cite-tab${tab === f.key ? ' is-active' : ''}`}
              onClick={() => setTab(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ss-cite-body">
          {active.html != null ? (
            <p
              className="ss-cite-text"
              dangerouslySetInnerHTML={{ __html: active.html }}
            />
          ) : (
            <pre className="ss-cite-pre">{active.plain}</pre>
          )}
        </div>

        <footer className="ss-cite-footer">
          <span className="ss-cite-hint">
            Generated from your library data — review for accuracy before use.
          </span>
          <button type="button" className="sp-action sp-action-primary ss-cite-copy" onClick={handleCopy}>
            <i className={`fas ${copiedTab === active.key ? 'fa-check' : 'fa-copy'}`} />
            {copiedTab === active.key ? 'Copied' : 'Copy'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// Styles
// =====================================================================
function SSStyles() {
  return (
    <style>{`
      .ss-shell {
        max-width: 1100px;
        margin: 0 auto;
        width: 100%;
        padding: 24px 24px 80px;
        background: var(--paper);
      }
      .ss-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
        padding: 80px 24px;
      }

      /* Header bar */
      .ss-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .ss-back {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
      }
      .ss-back:hover { color: var(--ink); }
      .ss-header-actions { display: flex; gap: 6px; flex-wrap: wrap; }

      /* Hero */
      .ss-hero { margin-bottom: 28px; }
      .ss-hero-top {
        display: flex; flex-wrap: wrap; align-items: center;
        gap: 8px; margin-bottom: 12px;
      }
      .ss-hero-type {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--source-2);
        background: var(--source-tint);
        padding: 3px 10px;
        border-radius: var(--r-sm);
      }
      .ss-hero-meta {
        font-family: var(--font-mono);
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .ss-hero-meta.is-journal {
        font-family: var(--font-display);
        font-style: italic;
        font-size: 13px;
        color: var(--ink-2);
      }
      .ss-hero-marker {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-2);
        background: var(--paper-warm);
        padding: 2px 8px;
        border-radius: var(--r-sm);
      }

      /* DOI badge — pill links to doi.org; inline copy button copies value */
      .ss-doi-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 4px 2px 8px;
        background: var(--source-tint);
        color: var(--source-2);
        border: 1px solid color-mix(in srgb, var(--source) 35%, transparent);
        border-radius: var(--r-sm);
        font-family: var(--font-mono);
        font-size: 11px;
        text-decoration: none;
        line-height: 1.5;
        max-width: 320px;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .ss-doi-badge:hover {
        background: color-mix(in srgb, var(--source) 15%, var(--source-tint));
        border-color: var(--source);
      }
      .ss-doi-label {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--source);
      }
      .ss-doi-value {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .ss-doi-copy {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: 2px;
        color: var(--source);
        cursor: pointer;
        font-size: 10px;
        flex-shrink: 0;
        transition: background 0.15s ease;
      }
      .ss-doi-copy:hover { background: color-mix(in srgb, var(--source) 18%, transparent); }
      .ss-hero-title {
        font-family: var(--font-display);
        font-size: 38px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.15;
        letter-spacing: -0.02em;
        margin: 0 0 10px;
        text-wrap: balance;
      }
      .ss-hero-authors {
        font-family: var(--font-body);
        font-size: 15px;
        color: var(--ink-2);
        line-height: 1.5;
        margin: 0;
      }

      /* Row 1: 1/3 PDF | 2/3 abstract */
      .ss-row1 {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 40px;
        margin-bottom: 48px;
        align-items: start;
      }

      /* PDF card column */
      .ss-pdf {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .ss-pdf-card {
        display: block;
        text-decoration: none;
        color: inherit;
      }
      .ss-pdf-cover {
        aspect-ratio: 3 / 4;
        background: var(--source-tint);
        border: 1px solid var(--source);
        border-radius: var(--r-md);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 24px;
        color: var(--source);
        transition: transform 0.18s ease, box-shadow 0.18s ease;
        box-shadow: 0 1px 3px rgba(73, 118, 177, 0.15);
      }
      .ss-pdf-card:hover .ss-pdf-cover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(73, 118, 177, 0.22);
      }
      .ss-pdf-cover-empty {
        background: var(--paper-soft);
        border: 1px dashed var(--ink-line);
        color: var(--ink-3);
        box-shadow: none;
      }
      .ss-pdf-card.is-empty:hover .ss-pdf-cover {
        border-color: var(--source);
        color: var(--source);
        box-shadow: 0 4px 14px rgba(73, 118, 177, 0.15);
      }
      .ss-pdf-icon { font-size: 64px; opacity: 0.85; }
      .ss-pdf-name {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-2);
        text-align: center;
        word-break: break-word;
        line-height: 1.4;
      }
      .ss-pdf-name-empty { color: var(--ink-3); font-style: italic; }

      /* Rendered first-page thumbnail (replaces the icon block) */
      .ss-pdf-thumb {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .ss-pdf-thumb .react-pdf__Document {
        width: 100%;
        display: flex;
        justify-content: center;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
        background: var(--paper);
        box-shadow: 0 1px 3px rgba(15, 23, 35, 0.08);
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      }
      .ss-pdf-card:hover .ss-pdf-thumb .react-pdf__Document {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(73, 118, 177, 0.22);
        border-color: var(--source);
      }
      .ss-pdf-thumb .react-pdf__Page { background: transparent !important; }
      .ss-pdf-thumb .react-pdf__Page__canvas {
        display: block;
        max-width: 100% !important;
        height: auto !important;
      }
      /* Loading/error fallback inside the thumb */
      .ss-pdf-cover-fallback {
        width: 100%;
        background: var(--source-tint);
        border-color: var(--source);
      }

      .ss-study-cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 11px 14px;
        background: var(--source);
        color: var(--paper);
        border: 1px solid var(--source);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
        transition: background 0.15s ease, border-color 0.15s ease;
      }
      .ss-study-cta:hover {
        background: var(--source-2);
        border-color: var(--source-2);
        color: var(--paper);
      }

      .ss-engaged {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        margin: 0;
        text-align: center;
        line-height: 1.45;
      }
      .ss-engaged strong { color: var(--ink-2); font-weight: 600; }

      .ss-cite-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 9px 14px;
        background: var(--paper);
        color: var(--source);
        border: 1px solid var(--source);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .ss-cite-btn:hover { background: var(--source-tint); }

      /* Abstract column */
      .ss-row1-abstract { min-width: 0; }
      .ss-abstract {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .ss-abstract-empty {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        font-style: italic;
        margin: 0;
      }
      .ss-section-eyebrow {
        display: block;
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--source);
        margin-bottom: 8px;
      }
      .ss-summary-body {
        font-family: var(--font-display);
        font-size: 17px;
        line-height: 1.6;
        color: var(--ink);
        font-weight: 400;
      }
      .ss-summary-body p { margin: 0 0 10px; }
      .ss-summary-body p:last-child { margin: 0; }
      .ss-richtext {
        font-family: var(--font-body);
        font-size: 14.5px;
        color: var(--ink-2);
        line-height: 1.7;
      }
      .ss-richtext p { margin: 0 0 12px; }
      .ss-richtext p:last-child { margin: 0; }
      .ss-richtext ul, .ss-richtext ol { margin: 0 0 12px; padding-left: 22px; }
      .ss-richtext a { color: var(--source); border-bottom: 1px solid var(--source); }
      .ss-richtext a:hover { color: var(--source-2); border-color: var(--source-2); }

      /* Meta row — Authors / Research Types / Concepts under the abstract */
      .ss-meta-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px 24px;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--ink-line-soft);
      }
      .ss-meta-block { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .ss-meta-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .ss-meta-empty {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-4);
        font-style: italic;
      }
      /* Highlights — pull-quote section above Notes */
      .ss-highlights {
        margin-bottom: 28px;
        padding: 18px 20px 18px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-md);
      }
      .ss-highlights-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }
      .ss-highlights-heading {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--source);
        margin: 0;
        letter-spacing: -0.005em;
      }
      .ss-highlights-count {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--ink-3);
        margin-left: 6px;
      }
      .ss-highlights-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .ss-highlight {
        padding-left: 14px;
        border-left: 3px solid var(--source);
      }
      .ss-highlight-quote {
        font-family: var(--font-body);
        font-size: 14px;
        line-height: 1.4;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .ss-highlight-meta {
        display: flex;
        align-items: baseline;
        gap: 10px;
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
      }
      .ss-highlight-link {
        color: var(--source);
        text-decoration: none;
      }
      .ss-highlight-link:hover { color: var(--source-2); text-decoration: underline; }
      .ss-highlights-toggle {
        margin-top: 14px;
        background: transparent;
        border: none;
        padding: 4px 0;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        color: var(--source);
        cursor: pointer;
      }
      .ss-highlights-toggle:hover { color: var(--source-2); text-decoration: underline; }

      /* Citation modal */
      .ss-cite-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 35, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 24px;
      }
      .ss-cite-modal {
        width: 100%;
        max-width: 580px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: 0 20px 60px rgba(15, 23, 35, 0.25);
        display: flex;
        flex-direction: column;
        max-height: 85vh;
      }
      .ss-cite-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--ink-line-soft);
      }
      .ss-cite-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
      }
      .ss-cite-close {
        background: transparent;
        border: none;
        padding: 6px 8px;
        color: var(--ink-3);
        cursor: pointer;
        font-size: 14px;
      }
      .ss-cite-close:hover { color: var(--ink); }
      .ss-cite-tabs {
        display: flex;
        gap: 4px;
        padding: 12px 20px 0;
      }
      .ss-cite-tab {
        background: transparent;
        border: none;
        padding: 8px 14px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--ink-3);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s ease, border-color 0.15s ease;
      }
      .ss-cite-tab:hover { color: var(--ink-2); }
      .ss-cite-tab.is-active {
        color: var(--source);
        border-bottom-color: var(--source);
      }
      .ss-cite-body {
        flex: 1;
        overflow-y: auto;
        padding: 18px 20px;
      }
      .ss-cite-text {
        font-family: var(--font-body);
        font-size: 14px;
        line-height: 1.65;
        color: var(--ink);
        margin: 0;
      }
      .ss-cite-text i { font-style: italic; }
      .ss-cite-pre {
        font-family: var(--font-mono);
        font-size: 12.5px;
        line-height: 1.55;
        color: var(--ink);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-sm);
        padding: 12px 14px;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .ss-cite-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 20px;
        border-top: 1px solid var(--ink-line-soft);
        background: var(--paper-soft);
      }
      .ss-cite-hint {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        font-style: italic;
        flex: 1;
        min-width: 0;
      }
      .ss-cite-copy {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--source);
        border-color: var(--source);
        color: var(--paper);
        flex-shrink: 0;
      }
      .ss-cite-copy:hover { background: var(--source-2); border-color: var(--source-2); }

      /* Collection picker */
      .ss-cp { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
      .ss-cp-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: transparent;
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-2);
        cursor: pointer;
        transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        align-self: flex-start;
      }
      .ss-cp-toggle:hover {
        border-color: var(--source);
        color: var(--source);
        background: var(--source-tint);
      }
      .ss-cp-panel {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 6px;
        max-height: 240px;
        overflow-y: auto;
      }
      .ss-cp-state {
        margin: 0;
        padding: 8px 10px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
      }
      .ss-cp-state a { color: var(--source); }
      .ss-cp-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ss-cp-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 6px 10px;
        background: transparent;
        border: none;
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink);
        text-align: left;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .ss-cp-item:hover:not(:disabled) { background: var(--source-tint); color: var(--source-2); }
      .ss-cp-item:disabled { opacity: 0.6; cursor: wait; }
      .ss-cp-item-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ss-cp-item-meta {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        flex-shrink: 0;
      }
      .ss-cp-error {
        margin: 4px 10px 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--error, #a13838);
      }

      /* Row 2: 2/3 notes | 1/3 sidebar */
      .ss-row2 {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 40px;
        align-items: start;
      }
      .ss-row2-notes { min-width: 0; }
      .ss-row2-side {
        position: sticky;
        top: 24px;
        align-self: start;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        padding-left: 22px;
        border-left: 1px solid var(--ink-line);
      }

      /* Notes — empty void */
      .ss-notes-void {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 420px;
        padding: 56px 32px;
        background: var(--paper);
        border: 2px dashed var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        text-align: center;
        transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
      }
      .ss-notes-void:hover {
        border-color: var(--source);
        background: var(--source-tint);
        transform: translateY(-1px);
      }
      .ss-notes-void-plus {
        font-family: var(--font-display);
        font-size: 80px;
        font-weight: 300;
        line-height: 1;
        color: var(--ink-line);
        transition: color 0.18s ease;
      }
      .ss-notes-void:hover .ss-notes-void-plus { color: var(--source); }
      .ss-notes-void-label {
        font-family: var(--font-display);
        font-size: 24px;
        font-weight: 500;
        color: var(--ink-2);
        letter-spacing: -0.01em;
      }
      .ss-notes-void:hover .ss-notes-void-label { color: var(--source-2); }
      .ss-notes-void-hint {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        max-width: 380px;
        line-height: 1.55;
      }

      .ss-notes-loading {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        padding: 32px 0;
      }

      /* Notes — populated */
      .ss-notes { display: flex; flex-direction: column; gap: 16px; }
      .ss-notes-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .ss-notes-heading {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--source);
        margin: 0;
        letter-spacing: -0.01em;
      }
      .ss-notes-count {
        font-family: var(--font-mono);
        font-size: 14px;
        color: var(--ink-3);
        margin-left: 6px;
      }
      .ss-notes-cta {
        background: var(--source);
        border-color: var(--source);
        color: var(--paper);
      }
      .ss-notes-cta:hover {
        background: var(--source-2);
        border-color: var(--source-2);
      }

      .ss-note-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .ss-note-card {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-left: 3px solid var(--source);
        border-radius: var(--r-md);
        padding: 14px 18px;
      }
      .ss-note-title {
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .ss-note-body {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-2);
        line-height: 1.6;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ss-note-body p { margin: 0 0 6px; }
      .ss-note-body p:last-child { margin: 0; }
      .ss-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 8px;
      }
      .ss-note-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 8px;
        margin-top: 10px;
      }
      .ss-note-meta {
        display: flex;
        gap: 12px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid var(--ink-line-soft);
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
      }

      /* Sidebar */
      .ss-side {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .ss-side-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px 12px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
      }
      .ss-side-stat { display: flex; flex-direction: column; gap: 2px; }
      .ss-side-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--source);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
      }
      .ss-side-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      .ss-side-block { display: flex; flex-direction: column; gap: 6px; }
      .ss-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .ss-side-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .ss-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .ss-side-sub {
        margin: 0;
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }

      .ss-side-list {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ss-side-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .ss-side-name {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink);
        text-decoration: none;
        line-height: 1.4;
        flex: 1;
        min-width: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ss-side-name:hover { color: var(--source); }
      .ss-side-meta {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        flex-shrink: 0;
      }
      .ss-side-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 8px;
        margin-top: 4px;
      }
      .ss-side-chip {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-2);
        background: var(--paper-warm);
        padding: 2px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      .ss-side-chip:hover { background: var(--source-tint); color: var(--source-2); }

      /* Chips reused across sidebar + notes */
      .ss-chip {
        display: inline-flex;
        align-items: center;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 500;
        padding: 3px 10px;
        border-radius: var(--r-sm);
        text-decoration: none;
        line-height: 1.45;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .ss-chip-tag {
        background: var(--paper-warm);
        color: var(--ink-2);
      }
      .ss-chip-tag:hover { background: var(--ink-line); color: var(--ink); }
      .ss-chip-person {
        background: var(--accent-gold-light);
        color: var(--accent-gold);
      }
      .ss-chip-person:hover {
        background: var(--accent-gold);
        color: var(--paper);
      }
      .ss-chip-concept {
        background: var(--concept-tint);
        color: var(--concept-2);
      }
      .ss-chip-concept:hover {
        background: var(--concept);
        color: var(--paper);
      }
      .ss-chip-stat {
        background: color-mix(in srgb, #b88621 12%, transparent);
        color: #8a6418;
      }
      .ss-chip-stat:hover {
        background: #b88621;
        color: var(--paper);
      }

      /* Responsive */
      @media (max-width: 900px) {
        .ss-row1 {
          grid-template-columns: 1fr;
          gap: 24px;
        }
        .ss-row2 {
          grid-template-columns: 1fr;
          gap: 24px;
        }
        /* Mobile flip: sidebar above notes on row 2 */
        .ss-row2-notes { order: 2; }
        .ss-row2-side {
          order: 1;
          position: static;
          max-height: none;
          padding-left: 0;
          border-left: none;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--ink-line);
        }
        .ss-pdf-cover { aspect-ratio: 16 / 9; }
        .ss-pdf-icon { font-size: 48px; }
        .ss-meta-row { grid-template-columns: 1fr; gap: 16px; }
      }
      @media (max-width: 600px) {
        .ss-shell { padding: 18px 16px 56px; }
        .ss-hero-title { font-size: 28px; }
      }
    `}</style>
  );
}
