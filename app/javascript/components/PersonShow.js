import React, { useState, useEffect, useMemo } from 'react';
import PersonFormModal from './PersonFormModal';
import NoteCard, { NoteCardStyles } from './NoteCard';
import NoteFormModal from './NoteFormModal';
import { toTitleCase } from '../utils/titleCase';
import { getNodeTypeLabel } from '../config/nodeTypes';

// =====================================================================
// PersonShow
// Author profile page.  Hero identity card on top, then a 2-column body:
// notes in the main column; the right sidebar carries everything
// relational — sources (capped, with a "Browse all" link to the full
// /people/:id/sources view), concepts, tags, collections, related people.
// =====================================================================

export default function PersonShow({ personId: initialPersonId }) {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  // Notes belong to the person via person_notes; fetched separately so
  // PersonShow can refresh them without re-loading the whole identity.
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(null); // null | 'new' | <note>

  // Enrich (ORCID + OpenAlex pipeline; not Haiku — no sparkle icon)
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState('');

  const personId = initialPersonId;

  useEffect(() => { fetchPerson(); fetchNotes(); }, [personId]);

  const fetchPerson = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/people/${personId}.json`);
      if (!r.ok) throw new Error(`Load failed (${r.status})`);
      setPerson(await r.json());
    } catch (e) {
      console.error(e);
      setError('We could not load this person.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    setNotesLoading(true);
    try {
      const r = await fetch(`/notes.json?person_id=${personId}`);
      const data = r.ok ? await r.json() : [];
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching notes:', e);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleDeleteNote = async (note) => {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    try {
      const r = await fetch(`/notes/${note.id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content },
      });
      if (r.ok) fetchNotes();
      else alert('Could not delete the note.');
    } catch (e) {
      console.error('Delete note failed', e);
      alert('Could not delete the note.');
    }
  };

  const handleEnrich = async () => {
    if (!person?.id) return;
    setEnrichNote('Looking up ORCID.');
    setEnriching(true);

    // Snapshot the fields the job might fill so we can describe the diff.
    const before = {
      enriched_at: person.enriched_at || null,
      email:   (person.email   || '').trim(),
      summary: (person.summary || '').trim(),
      url:     (person.url     || '').trim(),
      orcid:   (person.orcid   || '').trim(),
      affiliation: (person.affiliation || '').trim(),
      links_count: (person.links || []).length,
    };

    try {
      const r = await fetch(`/people/${person.id}/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });
      const data = await r.json();
      if (!(r.ok && data.queued)) {
        setEnrichNote(data.error || 'Enrich failed.');
        setEnriching(false);
        return;
      }

      // Poll until enriched_at advances or we time out.
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, 1500));
        try {
          const pr = await fetch(`/people/${person.id}.json`);
          if (!pr.ok) continue;
          const fresh = await pr.json();
          const advanced = fresh.enriched_at && fresh.enriched_at !== before.enriched_at;
          if (!advanced) continue;

          // Job finished — figure out what (if anything) changed.
          setPerson(fresh);
          const changes = [];
          if (!before.email       && (fresh.email       || '').trim())   changes.push('email');
          if (!before.summary     && (fresh.summary     || '').trim())   changes.push('summary');
          if (!before.url         && (fresh.url         || '').trim())   changes.push('website');
          if (!before.orcid       && (fresh.orcid       || '').trim())   changes.push('ORCID');
          if (!before.affiliation && (fresh.affiliation || '').trim())   changes.push('affiliation');
          const newLinks = (fresh.links || []).length - before.links_count;
          if (newLinks > 0) changes.push(`${newLinks} profile link${newLinks === 1 ? '' : 's'}`);

          setEnrichNote(changes.length
            ? `Added ${changes.join(', ')}.`
            : 'ORCID had nothing new to add.');
          setEnriching(false);
          return;
        } catch (e) {
          // Soft fail and try again on the next tick.
          continue;
        }
      }

      setEnrichNote('Lookup is still running. Refresh in a moment to see the result.');
      setEnriching(false);
    } catch (e) {
      console.error(e);
      setEnrichNote('Enrich failed. Try again in a moment.');
      setEnriching(false);
    }
  };

  const handleDelete = async () => {
    if (!person?.id) return;
    if (!confirm(`Delete ${person.full_name}?  Linked sources and notes are kept; this only removes the Person record.`)) return;
    try {
      const r = await fetch(`/people/${person.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content },
      });
      if (r.ok) {
        window.location.href = '/people';
      } else {
        const data = await r.json();
        alert(data.error || 'Could not delete this person.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="ps-message">Loading.</div>;
  if (error) return <div className="ps-message ps-message-error">{error}</div>;
  if (!person) return null;

  return (
    <div className="ps">
      <PsStyles />
      <NoteCardStyles />

      <header className="ps-topbar">
        <a href="/people" className="ps-back">← All people</a>
        <div className="ps-topbar-actions">
          <button type="button" className="sp-action sp-action-quiet" onClick={handleEnrich} disabled={enriching}>
            {enriching ? 'Enriching.' : 'Enrich'}
          </button>
          <button type="button" className="sp-action sp-action-secondary" onClick={() => setShowEdit(true)}>
            Edit
          </button>
          <button type="button" className="sp-action sp-action-quiet sp-action-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </header>

      <PersonHero person={person} enrichNote={enrichNote} />

      <SummarySection person={person} />

      <div className="ps-body">
        <main className="ps-body-main">
          <NotesPanel
            notes={notes}
            loading={notesLoading}
            onCreateNew={() => setNoteModal('new')}
            onEditNote={(n) => setNoteModal(n)}
            onDeleteNote={handleDeleteNote}
          />
        </main>

        <aside className="ps-body-side">
          <PersonSidebar
            person={person}
            notesCount={notes.length}
          />
        </aside>
      </div>

      <PersonFormModal
        isOpen={showEdit}
        onClose={() => { setShowEdit(false); fetchPerson(); }}
        onSuccess={() => { setShowEdit(false); fetchPerson(); }}
        item={person}
      />

      <NoteFormModal
        isOpen={!!noteModal}
        onClose={() => setNoteModal(null)}
        item={noteModal === 'new' ? null : noteModal}
        prefill={noteModal === 'new' ? { person_ids: [person.id] } : undefined}
        onSuccess={() => { setNoteModal(null); fetchNotes(); }}
      />
    </div>
  );
}

// =====================================================================
// Hero — flat (no card chrome).  Mirrors /sources/:id: a top eyebrow
// row of meta, then the name as the focal element, then identity links
// and contextual chrome (affiliation, aka, profile links).  Avatar
// floats next to it for visual identity.
// =====================================================================
function PersonHero({ person, enrichNote }) {
  return (
    <section className="ps-hero">
      {person.role && (
        <span className="ps-hero-role">{toTitleCase(person.role)}</span>
      )}
      <h1 className="ps-hero-title">{toTitleCase(person.full_name)}</h1>

      <div className="ps-hero-meta">
        {person.orcid && (
          <a
            href={`https://orcid.org/${person.orcid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ps-orcid"
            title="View ORCID profile"
          >
            ORCID · {person.orcid}
          </a>
        )}
        {person.email && (
          <a href={`mailto:${person.email}`} className="ps-id-link">
            {person.email}
          </a>
        )}
        {person.url && (
          <a href={person.url} target="_blank" rel="noopener noreferrer" className="ps-id-link">
            {prettyHost(person.url)}
          </a>
        )}
      </div>

      {person.affiliation && (
        <div className="ps-affiliation-row">
          <span className="ps-affiliation">{person.affiliation}</span>
          {person.affiliation_as_of && (
            <span className="ps-affiliation-as-of">
              as of {formatAsOf(person.affiliation_as_of)}
            </span>
          )}
        </div>
      )}

      {person.aka && person.aka.length > 0 && (
        <div className="ps-aka-row">
          <span className="ps-aka-label">Also known as:</span>
          {person.aka.map((name, i) => (
            <span key={i} className="ps-aka-chip">{name}</span>
          ))}
        </div>
      )}

      {person.links && person.links.length > 0 && (
        <div className="ps-link-row">
          {person.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ps-profile-link"
            >
              {link.label || prettyHost(link.url)}
            </a>
          ))}
        </div>
      )}

      {enrichNote && <div className="ps-note">{enrichNote}</div>}
    </section>
  );
}

function prettyHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch { return url; }
}

function formatAsOf(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

// =====================================================================
// Summary — collapsible if long
// =====================================================================
function SummarySection({ person }) {
  const [expanded, setExpanded] = useState(false);
  const html = person.summary;

  if (!html) {
    return (
      <section className="ps-section">
        <h2 className="ps-h2">Summary</h2>
        <p className="ps-empty-text">No summary written yet.</p>
      </section>
    );
  }

  // Long if more than ~280 chars of plain text.
  const plain = html.replace(/<[^>]+>/g, '');
  const isLong = plain.length > 280;

  return (
    <section className="ps-section">
      <h2 className="ps-h2">Summary</h2>
      <div
        className={`ps-prose ${isLong && !expanded ? 'is-clamped' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isLong && (
        <button type="button" className="ps-toggle" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </section>
  );
}

// =====================================================================
// Notes panel — main-column workspace.  Empty state is a tall void CTA;
// populated state is a list of NoteCards with a "+ New Note" header.
// =====================================================================
function NotesPanel({ notes, loading, onCreateNew, onEditNote, onDeleteNote }) {
  if (loading) {
    return (
      <section className="ps-section">
        <p className="ps-empty-text">Loading notes.</p>
      </section>
    );
  }

  if (notes.length === 0) {
    return (
      <section className="ps-section">
        <button type="button" className="ps-notes-void" onClick={onCreateNew}>
          <span className="ps-notes-void-plus">+</span>
          <span className="ps-notes-void-label">Add a note about this person</span>
          <span className="ps-notes-void-hint">
            Observations, decisions, takeaways — anything tied to this person lives here.
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="ps-section">
      <div className="ps-section-head">
        <h2 className="ps-h2">Notes <span className="ps-count">{notes.length}</span></h2>
        <button type="button" className="sp-action sp-action-primary ps-notes-cta" onClick={onCreateNew}>
          <i className="fas fa-pen-fancy" /> New Note
        </button>
      </div>
      <ul className="nx-list nx-list-card">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onView={onEditNote}
            onEdit={onEditNote}
            onDelete={onDeleteNote}
            omitChips={['person']}
          />
        ))}
      </ul>
    </section>
  );
}

// =====================================================================
// Sidebar — stats + relationship blocks (concepts, tags, collections,
// related people).  Mirrors SourceSidebar / ConceptShow sidebar pattern.
// =====================================================================
function PersonSidebar({ person, notesCount }) {
  const stats = [
    { label: 'Sources',  value: (person.sources  || []).length },
    { label: 'Concepts', value: (person.concepts || []).length },
    { label: 'Notes',    value: notesCount },
  ];
  const sources  = person.sources  || [];
  const concepts = person.concepts || [];
  const tags     = person.tags     || [];
  const collections = person.collections || [];
  const related  = person.related_people || [];

  // Sources can balloon for prolific authors — chip up to this many in the
  // sidebar; the "Browse all" link below sends users to the full scoped
  // /people/:id/sources index.
  const SOURCES_VISIBLE = 10;
  const visibleSources = useMemo(() => {
    return [...sources]
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, SOURCES_VISIBLE);
  }, [sources]);

  return (
    <div className="ps-side">
      <div className="ps-side-stats">
        {stats.map((s) => (
          <div key={s.label} className="ps-side-stat">
            <span className="ps-side-stat-value">{s.value}</span>
            <span className="ps-side-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <SidebarBlock label="Sources" count={sources.length}>
        {sources.length === 0 ? (
          <p className="ps-side-empty-text">No sources linked yet.</p>
        ) : (
          <>
            <div className="ps-side-chips">
              {visibleSources.map((s) => (
                <a
                  key={s.id}
                  href={`/sources/${s.id}`}
                  className="nc-pill is-source"
                  title={s.year ? `${s.title} (${s.year})` : s.title}
                >
                  <i className="fas fa-book-open nc-pill-icon" aria-hidden="true" />
                  <span className="nc-pill-label">{s.title}</span>
                </a>
              ))}
            </div>
            <a href={`/people/${person.id}/sources`} className="ps-side-browse">
              {sources.length > SOURCES_VISIBLE
                ? `Browse all ${sources.length} of ${person.full_name.split(' ').slice(-1)[0]}'s sources`
                : `Browse ${person.full_name.split(' ').slice(-1)[0]}'s sources`} <i className="fas fa-arrow-right" />
            </a>
          </>
        )}
      </SidebarBlock>

      {concepts.length > 0 && (
        <SidebarBlock label="Concepts" count={concepts.length}>
          <div className="ps-side-chips">
            {concepts.map((c) => (
              <a
                key={c.id}
                href={`/concepts/${c.id}`}
                className="nc-pill is-concept"
                title={c.concept_type ? `${c.label} — ${getNodeTypeLabel(c.concept_type)}` : c.label}
              >
                <i className="fas fa-lightbulb nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{toTitleCase(c.label)}</span>
              </a>
            ))}
          </div>
        </SidebarBlock>
      )}

      {tags.length > 0 && (
        <SidebarBlock label="Tags" count={tags.length}>
          <div className="ps-side-chips">
            {tags.map((t, i) => (
              <a key={i} href={`/tags/${encodeURIComponent(t)}`} className="nc-pill is-tag">
                <i className="fas fa-tag nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{t}</span>
              </a>
            ))}
          </div>
        </SidebarBlock>
      )}

      {collections.length > 0 && (
        <SidebarBlock label="Collections" count={collections.length}>
          <div className="ps-side-chips">
            {collections.map((c) => (
              <a key={c.id} href={`/collections/${c.id}`} className="nc-pill is-collection">
                <i className="fas fa-folder nc-pill-icon" aria-hidden="true" />
                <span className="nc-pill-label">{c.name}</span>
              </a>
            ))}
          </div>
        </SidebarBlock>
      )}

      {related.length > 0 && (
        <SidebarBlock
          label="Related People"
          count={related.length}
          sub="Others in your library who share sources or concepts."
        >
          <ul className="ps-side-list">
            {related.map((p) => {
              const overlap = [];
              if (p.shared_sources_count > 0) overlap.push(`${p.shared_sources_count} source${p.shared_sources_count === 1 ? '' : 's'}`);
              if (p.shared_concepts_count > 0) overlap.push(`${p.shared_concepts_count} concept${p.shared_concepts_count === 1 ? '' : 's'}`);
              return (
                <li key={p.id} className="ps-side-row">
                  <a href={`/people/${p.id}`} className="ps-side-name">
                    {toTitleCase(p.full_name)}
                  </a>
                  {overlap.length > 0 && <span className="ps-side-meta">{overlap.join(' · ')}</span>}
                </li>
              );
            })}
          </ul>
        </SidebarBlock>
      )}
    </div>
  );
}

function SidebarBlock({ label, count, sub, children }) {
  return (
    <div className="ps-side-block">
      <div className="ps-side-head">
        <span className="ps-side-label">{label}</span>
        {count != null && <span className="ps-side-count">{count}</span>}
      </div>
      {sub && <p className="ps-side-sub">{sub}</p>}
      {children}
    </div>
  );
}

// =====================================================================
// Styles
// =====================================================================
function PsStyles() {
  return (
    <style>{`
      .ps {
        flex: 1;
        background: var(--paper);
        max-width: 1080px;
        margin: 0 auto;
        width: 100%;
        padding: 24px 32px 80px;
        font-family: var(--font-body);
        color: var(--ink);
      }

      .ps-message {
        padding: 64px 24px;
        text-align: center;
        font-size: 14px;
        color: var(--ink-3);
      }
      .ps-message-error { color: var(--error); }

      /* ---------- Topbar (back link + actions) ---------- */
      .ps-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .ps-back {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
      }
      .ps-back:hover { color: var(--ink); }
      .ps-topbar-actions { display: flex; gap: 6px; flex-wrap: wrap; }

      /* ---------- Hero (flat — no card, no avatar) ---------- */
      .ps-hero { margin-bottom: 28px; display: flex; flex-direction: column; gap: 8px; }
      .ps-hero-role {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .ps-hero-title {
        font-family: var(--font-display);
        font-size: 40px;
        font-weight: 600;
        color: var(--person);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
        text-wrap: balance;
      }
      .ps-hero-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
        font-size: 12.5px;
      }

      .ps-orcid {
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 600;
        background: var(--person-tint);
        color: var(--person-2);
        padding: 2px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
        letter-spacing: 0.02em;
      }
      .ps-orcid:hover {
        background: color-mix(in srgb, var(--person-tint) 60%, var(--person) 40%);
        color: var(--paper);
      }
      .ps-id-link {
        color: var(--ink-2);
        text-decoration: none;
        border-bottom: 1px solid var(--ink-line);
      }
      .ps-id-link:hover { color: var(--person-2); border-color: var(--person); }

      .ps-affiliation-row {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 2px;
      }
      .ps-affiliation {
        font-size: 13.5px;
        color: var(--ink-2);
        font-weight: 500;
      }
      .ps-affiliation-as-of {
        font-size: 11px;
        color: var(--ink-4);
        font-style: italic;
      }

      .ps-aka-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
      }
      .ps-aka-label {
        font-size: 11.5px;
        color: var(--ink-3);
        margin-right: 4px;
      }
      .ps-aka-chip {
        font-size: 12px;
        background: var(--paper-soft);
        color: var(--ink-2);
        padding: 1px 8px;
        border-radius: var(--r-sm);
        border: 1px solid var(--ink-line);
      }

      .ps-link-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .ps-profile-link {
        display: inline-block;
        font-size: 12px;
        background: var(--person-tint);
        color: var(--person-2);
        padding: 2px 10px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      .ps-profile-link:hover {
        background: color-mix(in srgb, var(--person-tint) 60%, var(--person) 40%);
        color: var(--paper);
      }
      .ps-note {
        margin-top: 6px;
        font-size: 12px;
        color: var(--ink-3);
        font-style: italic;
      }

      /* Action buttons in the topbar use the shared sp-action classes. */

      /* ---------- Section shell ---------- */
      .ps-section { margin-bottom: 36px; }
      .ps-section-rows { display: flex; flex-direction: column; gap: 14px; }
      .ps-section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .ps-h2 {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.005em;
        margin: 0 0 12px;
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
      }
      .ps-h2.is-source  { color: var(--source); }
      .ps-h2.is-concept { color: var(--concept); }
      .ps-count {
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-3);
      }
      .ps-section-hint {
        font-size: 12.5px;
        color: var(--ink-3);
        margin: -6px 0 12px;
      }
      .ps-empty-text {
        font-size: 13px;
        color: var(--ink-4);
        font-style: italic;
        margin: 0;
      }

      /* ---------- Summary prose ---------- */
      .ps-prose {
        font-size: 14px;
        line-height: 1.7;
        color: var(--ink-2);
      }
      .ps-prose p { margin: 0 0 10px; }
      .ps-prose.is-clamped {
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .ps-toggle {
        margin-top: 6px;
        background: none;
        border: none;
        padding: 0;
        font-size: 12.5px;
        color: var(--person-2);
        cursor: pointer;
        text-decoration: underline;
      }

      /* ---------- 2-col body: notes/sources main + relationships sidebar.
         Mirrors /sources/:id ss-row2.  The main column carries the
         workspace (notes + canonical sources tile grid); the sidebar
         carries pivot-style relationships. */
      .ps-body {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 40px;
        align-items: start;
      }
      .ps-body-main { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .ps-body-side {
        position: sticky;
        top: 24px;
        align-self: start;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        padding-left: 22px;
        border-left: 1px solid var(--ink-line);
      }

      /* ---------- Notes panel (main column) ---------- */
      .ps-notes-void {
        width: 100%;
        background: var(--paper);
        border: 2px dashed var(--ink-line);
        border-radius: var(--r-md);
        padding: 56px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
        cursor: pointer;
        font-family: inherit;
        color: var(--ink-3);
        transition: border-color 0.15s, background 0.15s, color 0.15s;
      }
      .ps-notes-void:hover {
        border-color: var(--person);
        background: color-mix(in srgb, var(--person) 4%, var(--paper));
        color: var(--ink-2);
      }
      .ps-notes-void-plus {
        font-family: var(--font-display);
        font-size: 36px;
        line-height: 1;
        color: var(--person);
      }
      .ps-notes-void-label {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
      }
      .ps-notes-void-hint {
        font-family: var(--font-body);
        font-size: 13px;
        max-width: 420px;
      }
      .ps-notes-cta {
        background: var(--person);
        border-color: var(--person);
        color: var(--paper);
      }
      .ps-notes-cta:hover {
        background: var(--person-2);
        border-color: var(--person-2);
      }

      /* ---------- Sidebar ---------- */
      .ps-side {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .ps-side-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
      }
      .ps-side-stat { display: flex; flex-direction: column; gap: 2px; }
      .ps-side-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--person);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
      }
      .ps-side-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .ps-side-block { display: flex; flex-direction: column; gap: 6px; }
      .ps-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .ps-side-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .ps-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .ps-side-sub {
        margin: 0;
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }
      .ps-side-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }
      .ps-side-empty-text {
        margin: 0;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-4);
        font-style: italic;
      }
      .ps-side-browse {
        align-self: flex-start;
        margin-top: 8px;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        color: var(--source);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: gap 0.15s;
      }
      .ps-side-browse:hover { gap: 10px; text-decoration: underline; text-underline-offset: 3px; }
      .ps-side-browse i { font-size: 10px; }
      .ps-side-list {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ps-side-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .ps-side-name {
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
      .ps-side-name:hover { color: var(--person); }
      .ps-side-meta {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        flex-shrink: 0;
      }

      /* ---------- Responsive ---------- */
      @media (max-width: 900px) {
        .ps-body { grid-template-columns: 1fr; gap: 28px; }
        .ps-body-side {
          position: static;
          max-height: none;
          padding-left: 0;
          border-left: none;
          border-top: 1px solid var(--ink-line);
          padding-top: 22px;
        }
      }
      @media (max-width: 760px) {
        .ps { padding: 16px 16px 64px; }
        .ps-hero-title { font-size: 28px; }
      }
    `}</style>
  );
}
