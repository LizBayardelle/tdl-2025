import React, { useState, useEffect, useMemo } from 'react';
import PersonFormModal from './PersonFormModal';
import { toTitleCase } from '../utils/titleCase';
import { getNodeTypeLabel } from '../config/nodeTypes';
import MagicSparkles from './icons/MagicSparkles';

// =====================================================================
// PersonShow
// Author profile page.  Identity card on top, summary, then their work
// (sources tile grid, concept tile grid), small chip rows for tags +
// collections, and an optional Related People rail at the bottom based
// on co-authorship + concept overlap.
// =====================================================================

export default function PersonShow({ personId: initialPersonId }) {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  // Enrich (ORCID + OpenAlex pipeline; not Haiku — no sparkle icon)
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState('');

  const personId = initialPersonId;

  useEffect(() => { fetchPerson(); }, [personId]);

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

      <a href="/people" className="ps-back">← All People</a>

      <PersonHeader
        person={person}
        onEdit={() => setShowEdit(true)}
        onEnrich={handleEnrich}
        enriching={enriching}
        enrichNote={enrichNote}
        onDelete={handleDelete}
      />

      <SummarySection person={person} />

      <SourcesSection sources={person.sources || []} />

      <ConceptsSection concepts={person.concepts || []} />

      <TagsCollectionsSection
        tags={person.tags || []}
        collections={person.collections || []}
      />

      <RelatedPeopleSection people={person.related_people || []} />

      <PersonFormModal
        isOpen={showEdit}
        onClose={() => { setShowEdit(false); fetchPerson(); }}
        onSuccess={() => { setShowEdit(false); fetchPerson(); }}
        item={person}
      />
    </div>
  );
}

// =====================================================================
// Header — identity card
// =====================================================================
function PersonHeader({ person, onEdit, onEnrich, enriching, enrichNote, onDelete }) {
  const initials = useMemo(() => {
    const f = (person.first_name || '').trim();
    const l = (person.last_name  || '').trim();
    if (f || l) return `${f[0] || ''}${l[0] || ''}`.toUpperCase();
    const parts = (person.full_name || '').trim().split(/\s+/);
    return parts.slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '·';
  }, [person]);

  return (
    <header className="ps-header">
      <div className="ps-avatar" aria-hidden="true">{initials}</div>
      <div className="ps-header-main">
        <h1 className="ps-title">{toTitleCase(person.full_name)}</h1>
        <div className="ps-id-row">
          {person.role && <span className="ps-role">{toTitleCase(person.role)}</span>}
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
      </div>

      <aside className="ps-header-actions">
        <button type="button" className="ps-action" onClick={onEnrich} disabled={enriching}>
          {enriching ? 'Enriching.' : 'Enrich'}
        </button>
        <button type="button" className="ps-action" onClick={onEdit}>
          Edit Person
        </button>
        <button type="button" className="ps-action ps-action-danger" onClick={onDelete}>
          Delete
        </button>
      </aside>
    </header>
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
// Sources — tile grid
// =====================================================================
function SourcesSection({ sources }) {
  const sorted = useMemo(() => {
    return [...sources].sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [sources]);

  return (
    <section className="ps-section">
      <div className="ps-section-head">
        <h2 className="ps-h2 is-source">Sources <span className="ps-count">{sources.length}</span></h2>
      </div>
      {sources.length === 0 ? (
        <p className="ps-empty-text">No sources linked yet.</p>
      ) : (
        <div className="ps-tile-grid">
          {sorted.map(s => (
            <a key={s.id} href={`/sources/${s.id}`} className="ps-tile">
              <div className="ps-tile-title">{toTitleCase(s.title)}</div>
              <div className="ps-tile-meta">
                {s.authors && <span className="ps-tile-authors">{s.authors}</span>}
                {s.year && <span className="ps-tile-year">{s.year}</span>}
                {s.doi && <span className="ps-tile-doi">DOI</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

// =====================================================================
// Concepts — tile grid
// =====================================================================
function ConceptsSection({ concepts }) {
  return (
    <section className="ps-section">
      <div className="ps-section-head">
        <h2 className="ps-h2 is-concept">Concepts <span className="ps-count">{concepts.length}</span></h2>
      </div>
      {concepts.length === 0 ? (
        <p className="ps-empty-text">No concepts linked yet.</p>
      ) : (
        <div className="ps-tile-grid">
          {concepts.map(c => (
            <a key={c.id} href={`/concepts/${c.id}`} className="ps-tile is-concept-tile">
              <div className="ps-tile-title">{toTitleCase(c.label)}</div>
              {c.concept_type && (
                <div className="ps-tile-type">{getNodeTypeLabel(c.concept_type)}</div>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

// =====================================================================
// Tags + Collections — chip rows
// =====================================================================
function TagsCollectionsSection({ tags, collections }) {
  if (tags.length === 0 && collections.length === 0) return null;

  return (
    <section className="ps-section ps-section-rows">
      {tags.length > 0 && (
        <div className="ps-row">
          <span className="ps-row-label">Tags</span>
          <div className="ps-chip-row">
            {tags.map((t, i) => (
              <span key={i} className="ps-tag-chip">{t}</span>
            ))}
          </div>
        </div>
      )}
      {collections.length > 0 && (
        <div className="ps-row">
          <span className="ps-row-label">Collections</span>
          <div className="ps-chip-row">
            {collections.map(c => (
              <a key={c.id} href={`/collections/${c.id}`} className="ps-collection-chip">{c.name}</a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// =====================================================================
// Related People — only renders when there's data
// =====================================================================
function RelatedPeopleSection({ people }) {
  if (!people || people.length === 0) return null;

  return (
    <section className="ps-section">
      <div className="ps-section-head">
        <h2 className="ps-h2">Related People</h2>
      </div>
      <p className="ps-section-hint">
        Other people in your library who share co-authored sources or research concepts.
      </p>
      <div className="ps-related-grid">
        {people.map(p => (
          <a key={p.id} href={`/people/${p.id}`} className="ps-related-card">
            <div className="ps-related-name">{toTitleCase(p.full_name)}</div>
            {p.role && <div className="ps-related-role">{toTitleCase(p.role)}</div>}
            <div className="ps-related-overlap">
              {p.shared_sources_count > 0 && (
                <span>
                  {p.shared_sources_count} shared source{p.shared_sources_count === 1 ? '' : 's'}
                </span>
              )}
              {p.shared_sources_count > 0 && p.shared_concepts_count > 0 && <span> · </span>}
              {p.shared_concepts_count > 0 && (
                <span>
                  {p.shared_concepts_count} shared concept{p.shared_concepts_count === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
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

      .ps-back {
        display: inline-block;
        margin-bottom: 14px;
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
      }
      .ps-back:hover { color: var(--person-2); }

      /* ---------- Header / identity card ---------- */
      .ps-header {
        display: grid;
        grid-template-columns: 88px minmax(0, 1fr) auto;
        gap: 20px;
        align-items: start;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-lg);
        padding: 24px;
        margin-bottom: 28px;
      }
      .ps-avatar {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        background: var(--person-tint);
        color: var(--person-2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-display);
        font-size: 32px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .ps-header-main { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .ps-title {
        font-family: var(--font-display);
        font-size: 32px;
        font-weight: 600;
        color: var(--person);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
      }
      .ps-id-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
        font-size: 12.5px;
      }
      .ps-role {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--person-2);
        font-weight: 600;
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

      .ps-header-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-shrink: 0;
      }
      .ps-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink-2);
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 6px 12px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .ps-action:hover:not(:disabled) {
        background: var(--person-tint);
        color: var(--person-2);
        border-color: var(--person);
      }
      .ps-action:disabled { opacity: 0.55; cursor: not-allowed; }
      .ps-action-danger { color: var(--ink-3); }
      .ps-action-danger:hover:not(:disabled) {
        background: rgba(122, 46, 46, 0.06);
        color: var(--error);
        border-color: var(--error);
      }

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

      /* ---------- Tile grids ---------- */
      .ps-tile-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }
      .ps-tile {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        transition: border-color 0.12s, transform 0.12s;
      }
      .ps-tile:hover {
        border-color: var(--source);
        transform: translateY(-1px);
      }
      .ps-tile.is-concept-tile:hover { border-color: var(--concept); }
      .ps-tile-title {
        font-family: var(--font-display);
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink);
        line-height: 1.35;
      }
      .ps-tile-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 8px;
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .ps-tile-authors {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ps-tile-year {
        font-family: var(--font-mono);
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .ps-tile-doi {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--source-2);
      }
      .ps-tile-type {
        font-size: 10.5px;
        text-transform: capitalize;
        color: var(--concept-2);
      }

      /* ---------- Tags + Collections rows ---------- */
      .ps-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .ps-row-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        flex-shrink: 0;
        min-width: 110px;
      }
      .ps-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 6px;
        flex: 1;
      }
      .ps-tag-chip {
        font-size: 11.5px;
        color: var(--ink-3);
        background: var(--paper-soft);
        padding: 1px 8px;
        border-radius: var(--r-sm);
      }
      .ps-collection-chip {
        font-size: 11.5px;
        color: var(--ink-2);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        padding: 1px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      .ps-collection-chip:hover { background: var(--hover); color: var(--ink); }

      /* ---------- Related People ---------- */
      .ps-related-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }
      .ps-related-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        transition: border-color 0.12s, transform 0.12s;
      }
      .ps-related-card:hover {
        border-color: var(--person);
        transform: translateY(-1px);
      }
      .ps-related-name {
        font-family: var(--font-display);
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink);
      }
      .ps-related-role {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--person-2);
        font-weight: 600;
      }
      .ps-related-overlap {
        font-size: 11.5px;
        color: var(--ink-3);
        margin-top: 4px;
      }

      /* ---------- Responsive ---------- */
      @media (max-width: 760px) {
        .ps { padding: 16px 16px 64px; }
        .ps-header {
          grid-template-columns: 64px minmax(0, 1fr);
          padding: 16px;
          gap: 14px;
        }
        .ps-avatar { width: 64px; height: 64px; font-size: 22px; }
        .ps-title { font-size: 24px; }
        .ps-header-actions {
          grid-column: 1 / -1;
          flex-direction: row;
          flex-wrap: wrap;
        }
        .ps-row { flex-direction: column; align-items: flex-start; gap: 4px; }
        .ps-row-label { min-width: 0; }
      }
    `}</style>
  );
}
