import React, { useState, useEffect, useMemo, useRef } from 'react';
import ConceptFormModal from './ConceptFormModal';
import NoteFormModal from './NoteFormModal';
import PersonFormModal from './PersonFormModal';
import SourceFormModal from './SourceFormModal';
import { getNodeTypeLabel } from '../config/nodeTypes';
import { toTitleCase } from '../utils/titleCase';
import {
  RELATIONSHIP_CATEGORIES,
  getInverseRelType,
  groupConnectionsByCategory,
  getRelTypeText,
} from './InlineRelTypeSelect';
import MagicSparkles from './icons/MagicSparkles';

// =====================================================================
// ConceptShow
// Single concept detail page.  Hierarchy breadcrumb + children, inline
// relationship adding, generated definition + user content side-by-side,
// related sources/people/notes, and long-form fields.
// =====================================================================

// Flatten the categorized rel types into a list with category label.
const REL_TYPES_FLAT = RELATIONSHIP_CATEGORIES.flatMap((cat) =>
  cat.types.map((t) => ({ ...t, category: cat.label }))
);

const REL_TYPE_BY_VALUE = REL_TYPES_FLAT.reduce((acc, t) => {
  acc[t.value] = t;
  return acc;
}, {});

// Hierarchical rel_types only — positional and other categories no longer
// feed the breadcrumb.  outgoing in PARENT_OUTGOING means the focal is the
// PARENT of the other.
const PARENT_OUTGOING = new Set(['parent_of', 'categorizes']);
const CHILD_OUTGOING  = new Set(['child_of', 'is_a']);

const POLL_INTERVAL_MS = 5000;
// Generated-field truncation threshold.  Fields whose stripped text
// exceeds this collapse to ~12em with a "Show more" toggle.  Tuned for
// multi-paragraph fields like description; one-paragraph fields fall
// well below and render in full without a toggle.
const TRUNCATION_CHAR_THRESHOLD = 500;
// Slightly longer than the server's GENERATION_TIMEOUT_SECONDS (720s) so
// the client can detect a server-side timeout and show a clean error
// rather than racing it.
const POLL_TIMEOUT_MS  = 13 * 60 * 1000;

// A linked ConceptDefinition is "real" once it has at least one of the two
// long-form fields populated — bare-row definitions can exist transiently
// before the generation job lands the content.
const hasDefinitionContent = (d) => !!(d && (d.summary || d.description));

export default function ConceptShow({ conceptId }) {
  const [concept, setConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Used to power the inline relationship typeahead and breadcrumb.
  const [allConcepts, setAllConcepts] = useState([]);
  const [connections, setConnections] = useState([]);

  const [editing, setEditing] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [creatingSource, setCreatingSource] = useState(false);

  // Generate-definition flow: enqueues a background job, then polls
  // fetchConcept until concept.definition shows up.  revealKey bumps each
  // time a definition lands in this session — drives the staged-reveal
  // animation.  Page-load reads of pre-existing definitions don't bump it,
  // so users don't see the animation on revisits.
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [revealKey, setRevealKey] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const generationPollRef = useRef(null);

  useEffect(() => { fetchConcept(); fetchAllConcepts(); fetchConnections(); }, [conceptId]);
  useEffect(() => () => { if (generationPollRef.current) clearInterval(generationPollRef.current); }, []);

  const fetchConcept = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/concepts/${conceptId}.json`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setConcept(data);
    } catch (err) {
      console.error(err);
      setError('Could not load this concept.');
    } finally {
      setLoading(false);
    }
  };
  const fetchAllConcepts = async () => {
    try {
      const res = await fetch('/concepts.json');
      const data = await res.json();
      setAllConcepts(data);
    } catch (err) {
      console.error(err);
    }
  };
  const fetchConnections = async () => {
    try {
      const res = await fetch(`/connections.json?concept_id=${conceptId}`);
      const data = await res.json();
      setConnections(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!window.confirm('Delete this relationship.  This can’t be undone.')) return;
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch(`/connections/${connectionId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf, 'Accept': 'application/json' },
      });
      if (res.ok) setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateConnection = async (otherConceptId, relType) => {
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch('/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          connection: {
            src_concept_id: parseInt(conceptId),
            dst_concept_id: otherConceptId,
            rel_type: relType,
          },
        }),
      });
      if (res.ok) {
        await fetchConnections();
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const handleGenerateDefinition = async ({ forceFresh = false } = {}) => {
    setGenerationError(null);
    setGenerating(true);
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const url = `/concepts/${conceptId}/generate_definition${forceFresh ? '?force_fresh=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'Accept': 'application/json',
        },
      });
      if (res.status === 402) {
        const data = await res.json();
        setGenerationError({ kind: 'quota', message: data.message, upgradeUrl: data.upgrade_url });
        setGenerating(false);
        return;
      }
      if (!res.ok) throw new Error(`Failed (${res.status})`);

      const data = await res.json();

      // Cache-hit path: server linked an existing ConceptDefinition.  Skip
      // polling — fetch the full concept once and run the same staged
      // reveal as a fresh generation.  The user's experience is identical
      // either way; only the wait length differs.
      if (data.cache_hit) {
        const r = await fetch(`/concepts/${conceptId}.json`);
        if (r.ok) {
          const fresh = await r.json();
          setConcept(fresh);
        }
        setGenerating(false);
        setRevealKey((k) => k + 1);
        return;
      }

      // Poll for the generated definition.  Job typically finishes in
      // 30-60s; capped at POLL_TIMEOUT_MS.
      const startedAt = Date.now();
      generationPollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/concepts/${conceptId}.json`);
          if (!r.ok) return;
          const data = await r.json();
          if (hasDefinitionContent(data.definition)) {
            clearInterval(generationPollRef.current);
            generationPollRef.current = null;
            setConcept(data);
            setGenerating(false);
            setRevealKey((k) => k + 1);
            return;
          }
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            clearInterval(generationPollRef.current);
            generationPollRef.current = null;
            setGenerating(false);
            setGenerationError({ kind: 'timeout', message: 'This is taking longer than usual.  Refresh in a moment to see if it landed.' });
          }
        } catch (e) {
          // Soft-fail and try again on next tick.
        }
      }, POLL_INTERVAL_MS);
    } catch (e) {
      console.error(e);
      setGenerating(false);
      setGenerationError({ kind: 'error', message: "We couldn't add this to your library.  Try again in a moment." });
    }
  };

  // Wrong-sense rejection: user flags the linked definition as not what
  // they meant.  Server unlinks + bumps the rejection counter, then
  // optionally refunds the slot if it came from cache (we picked a bad
  // match so the user doesn't pay).  We immediately fire a fresh
  // generation with force_fresh, so the wrong cached row can't be picked
  // again.
  const handleRejectDefinition = async () => {
    if (rejecting || generating) return;
    setRejecting(true);
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch(`/concepts/${conceptId}/reject_definition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);

      // Optimistically clear the rejected definition from local state so
      // the UI swaps to the generating lede without a round-trip.
      setConcept((prev) => prev && { ...prev, definition: null, definition_acquired_via: null });
      setRejecting(false);
      await handleGenerateDefinition({ forceFresh: true });
    } catch (e) {
      console.error(e);
      setRejecting(false);
      setGenerationError({ kind: 'error', message: "We couldn't replace this definition.  Try again in a moment." });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${concept.label}".  This can’t be undone.  All notes and connections to this concept will be removed.`)) return;
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch(`/concepts/${conceptId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf },
      });
      if (res.ok) window.location.href = '/concepts';
    } catch (err) {
      console.error(err);
    }
  };

  // Derive parents and children from connections + hierarchy semantics.
  const { parents, children } = useMemo(() => {
    if (!concept) return { parents: [], children: [] };
    const myId = parseInt(conceptId);
    const parentList = [];
    const childList = [];
    connections.forEach((conn) => {
      const isSource = conn.src_concept?.id === myId;
      const other = isSource ? conn.dst_concept : conn.src_concept;
      if (!other) return;
      const t = conn.rel_type;
      if (isSource) {
        if (PARENT_OUTGOING.has(t)) childList.push(other);
        else if (CHILD_OUTGOING.has(t)) parentList.push(other);
      } else {
        if (PARENT_OUTGOING.has(t)) parentList.push(other);
        else if (CHILD_OUTGOING.has(t)) childList.push(other);
      }
    });
    // Dedupe by id
    const dedupe = (arr) => Array.from(new Map(arr.map((c) => [c.id, c])).values());
    return { parents: dedupe(parentList), children: dedupe(childList) };
  }, [concept, conceptId, connections]);

  if (loading) return (<div className="cs-loading"><CSStyles />Loading.</div>);
  if (error)   return (<div className="cs-loading cs-error"><CSStyles />{error}</div>);
  if (!concept) return null;

  const type = concept.effective_concept_type || concept.concept_type;
  const typeLabel = getNodeTypeLabel(type);
  const definition = concept.definition;

  return (
    <div className="cs-shell">
      <CSStyles />

      <header className="cs-header">
        <a href="/concepts" className="cs-back">← All concepts</a>
        <div className="cs-header-actions">
          <a
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(concept.label.replace(/ /g, '_'))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sp-action sp-action-quiet"
            title="Look up on Wikipedia"
          >
            Wikipedia →
          </a>
          <button type="button" className="sp-action sp-action-secondary" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="sp-action sp-action-quiet sp-action-danger" onClick={handleDelete}>Delete</button>
        </div>
      </header>

      {parents.length > 0 && <Breadcrumb parents={parents} current={concept.label} />}

      <section className="cs-hero">
        <div className="cs-hero-top">
          {type && <span className="cs-hero-type">{typeLabel}</span>}
        </div>
        <h1 className="cs-hero-title">{toTitleCase(concept.label)}</h1>
        {concept.summary && <p className="cs-hero-summary">{stripHtml(concept.summary)}</p>}
        {/* Pages with a definition move stats into the sidebar; bare pages
            keep them in the hero since they have no sidebar. */}
        {!hasDefinitionContent(definition) && <HeroStats concept={concept} />}
      </section>

      <ConceptBody
        concept={concept}
        conceptId={conceptId}
        connections={connections}
        allConcepts={allConcepts}
        definition={definition}
        onCreateConnection={handleCreateConnection}
        onDeleteConnection={handleDeleteConnection}
        onConceptCreated={fetchAllConcepts}
        onGenerateDefinition={handleGenerateDefinition}
        onRejectDefinition={handleRejectDefinition}
        generating={generating}
        rejecting={rejecting}
        generationError={generationError}
        generationQuota={concept.generation_quota}
        revealKey={revealKey}
        acquiredVia={concept.definition_acquired_via}
      />

      <ConceptFormModal
        isOpen={editing}
        onClose={() => { setEditing(false); fetchConcept(); fetchConnections(); }}
        onSuccess={() => { setEditing(false); fetchConcept(); fetchConnections(); }}
        item={concept}
      />
      <NoteFormModal     isOpen={creatingNote}    onClose={() => setCreatingNote(false)}   onSuccess={() => { setCreatingNote(false);   fetchConcept(); }} relatedConceptId={conceptId} />
      <PersonFormModal   isOpen={creatingPerson}  onClose={() => setCreatingPerson(false)} onSuccess={() => { setCreatingPerson(false); fetchConcept(); }} relatedConceptId={conceptId} />
      <SourceFormModal   isOpen={creatingSource}  onClose={() => setCreatingSource(false)} onSuccess={() => { setCreatingSource(false); fetchConcept(); }} relatedConceptId={conceptId} />
    </div>
  );
}

// =====================================================================
// Subcomponents
// =====================================================================

// =====================================================================
// Hero stats row — at-a-glance counts from the concept payload.
// =====================================================================
function HeroStats({ concept }) {
  const stats = [
    { label: 'Sources',     value: concept.sources?.length ?? concept.sources_count ?? 0 },
    { label: 'Notes',       value: concept.contextual_notes?.length ?? concept.notes_count ?? 0 },
    { label: 'Key Authors', value: concept.key_authors?.length ?? 0 },
    { label: 'Connections', value: (concept.outgoing_connections?.length || 0) + (concept.incoming_connections?.length || 0) },
  ].filter((s) => s.value > 0);

  if (stats.length === 0) return null;

  return (
    <dl className="cs-stats">
      {stats.map((s) => (
        <div key={s.label} className="cs-stat">
          <dt className="cs-stat-label">{s.label}</dt>
          <dd className="cs-stat-value">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// =====================================================================
// Key Authors — top researchers behind this concept's literature.
// =====================================================================
function KeyAuthors({ authors }) {
  return (
    <div className="cs-author-grid">
      {authors.map((a) => (
        <a key={a.id} href={`/people/${a.id}`} className="cs-author-card">
          <div className="cs-author-name">{toTitleCase(a.full_name)}</div>
          <div className="cs-author-meta">
            {a.role && <span className="cs-author-role">{toTitleCase(a.role)}</span>}
            {a.affiliation && <span className="cs-author-aff">{a.affiliation}</span>}
          </div>
          <div className="cs-author-count">
            {a.source_count} source{a.source_count === 1 ? '' : 's'}
          </div>
        </a>
      ))}
    </div>
  );
}

// =====================================================================
// Top Sources — Key Source markers first, then by note count.
// =====================================================================
function TopSources({ sources }) {
  const sorted = useMemo(() => {
    return [...sources].sort((a, b) => {
      if (a.is_key_source !== b.is_key_source) return a.is_key_source ? -1 : 1;
      const an = a.notes_count || 0;
      const bn = b.notes_count || 0;
      if (an !== bn) return bn - an;
      return (b.year || 0) - (a.year || 0);
    });
  }, [sources]);

  return (
    <ul className="cs-source-list">
      {sorted.map((s) => (
        <li key={s.id} className={`cs-source-row ${s.is_key_source ? 'is-key' : ''}`}>
          <a href={`/sources/${s.id}`} className="cs-source-title">{toTitleCase(s.title)}</a>
          <div className="cs-source-meta">
            {s.is_key_source && <span className="cs-source-key">Key Source</span>}
            {s.authors && <span>{s.authors}</span>}
            {s.year && <span className="cs-source-year">{s.year}</span>}
            {s.kind && <span className="cs-source-kind">{s.kind.replace(/_/g, ' ')}</span>}
            {s.journal_name && <span className="cs-source-journal">{s.journal_name}</span>}
            {s.notes_count > 0 && (
              <span className="cs-source-notes">
                {s.notes_count} note{s.notes_count === 1 ? '' : 's'}
              </span>
            )}
            {s.markers?.filter((m) => m !== 'Key Source').slice(0, 3).map((m) => (
              <span key={m} className="cs-source-marker">{m}</span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

// =====================================================================
// Contextual Notes — notes from sources tagged with this concept.
// =====================================================================
function ContextualNotes({ notes }) {
  return (
    <ul className="cs-note-list">
      {notes.map((n) => {
        const preview = stripHtml(n.body || '').slice(0, 220);
        return (
          <li key={n.id} className="cs-note-row">
            <div className="cs-note-head">
              <a href={`/notes/${n.id}`} className="cs-note-title">
                {n.title || preview.slice(0, 60) || 'Untitled note'}
              </a>
              {n.note_type && <span className="cs-note-type">{n.note_type}</span>}
            </div>
            {preview && <p className="cs-note-preview">{preview}</p>}
            {n.source && (
              <div className="cs-note-source">
                <span className="cs-list-dot is-source" />
                <a href={`/sources/${n.source.id}`}>{toTitleCase(n.source.title || 'Source')}</a>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// =====================================================================
// RelationshipsByCategory — splits connections into category-specific
// visualizations.  Each sub-section only renders when it has data.
// =====================================================================
function RelationshipsByCategory({ connections, focalConcept, focalId, onDelete }) {
  const buckets = useMemo(
    () => groupConnectionsByCategory(connections, focalId),
    [connections, focalId]
  );

  return (
    <div className="cs-rel-by-cat">
      {buckets.Hierarchical.length > 0 && (
        <HierarchyTree edges={buckets.Hierarchical} focalConcept={focalConcept} onDelete={onDelete} />
      )}
      {buckets.Lineage.length > 0 && (
        <RelGroup label="Lineage" edges={buckets.Lineage} onDelete={onDelete} />
      )}
      {buckets.Semantic.length > 0 && (
        <RelGroup label="Semantic" edges={buckets.Semantic} onDelete={onDelete} />
      )}
      {buckets.Clinical.length > 0 && (
        <RelGroup label="Clinical" edges={buckets.Clinical} onDelete={onDelete} />
      )}
      {buckets.Positional.length > 0 && (
        <PositionalBlock edges={buckets.Positional} focalConcept={focalConcept} onDelete={onDelete} />
      )}
      {buckets.Other.length > 0 && (
        <RelGroup label="Other" edges={buckets.Other} onDelete={onDelete} />
      )}
    </div>
  );
}

// ---------- Hierarchy: parents above, focal in middle, children below ----------
//
// Maps any of the four hierarchical rel_types onto the parent/child axis
// from the focal concept's perspective:
//   parent_of   outgoing → focal is parent (other is child)
//   parent_of   incoming → focal is child  (other is parent)
//   child_of    outgoing → focal is child  (other is parent)
//   child_of    incoming → focal is parent (other is child)
//   is_a        outgoing → focal is child  (other is the parent category)
//   is_a        incoming → focal is parent (categorizes other)
//   categorizes outgoing → focal is parent (categorizes other)
//   categorizes incoming → focal is child
function HierarchyTree({ edges, focalConcept, onDelete }) {
  // Each entry keeps the connection id so we can offer per-row delete.
  // First-write wins on dedupe so multiple connections to the same parent
  // collapse to a single visible node.
  const { parents, children } = useMemo(() => {
    const parentList = [];
    const childList = [];
    edges.forEach((e) => {
      const t = e.rel_type;
      const out = e.isOutgoing;
      let isParentSide = null;
      if (t === 'parent_of')   isParentSide = !out;
      if (t === 'child_of')    isParentSide = out;
      if (t === 'is_a')        isParentSide = out;
      if (t === 'categorizes') isParentSide = !out;
      const entry = { connection_id: e.id, concept: e.other };
      if (isParentSide === true) parentList.push(entry);
      else if (isParentSide === false) childList.push(entry);
    });
    const dedupe = (arr) => {
      const seen = new Map();
      arr.forEach((entry) => {
        if (!seen.has(entry.concept.id)) seen.set(entry.concept.id, entry);
      });
      return [...seen.values()];
    };
    return { parents: dedupe(parentList), children: dedupe(childList) };
  }, [edges]);

  const renderNode = (entry, role) => (
    <span key={entry.concept.id} className={`cs-tree-node-wrap`}>
      <a href={`/concepts/${entry.concept.id}`} className={`cs-tree-node is-${role}`}>
        {toTitleCase(entry.concept.label)}
      </a>
      {onDelete && (
        <button
          type="button"
          className="cs-rel-x"
          onClick={(e) => { e.preventDefault(); onDelete(entry.connection_id); }}
          aria-label="Remove this relationship"
          title="Remove this relationship"
        >
          ×
        </button>
      )}
    </span>
  );

  return (
    <div className="cs-rel-block">
      <h3 className="cs-rel-block-title">Hierarchy</h3>
      <div className="cs-tree">
        {parents.length > 0 && (
          <div className="cs-tree-row cs-tree-parents">
            {parents.map((p) => renderNode(p, 'parent'))}
          </div>
        )}
        <div className="cs-tree-axis" aria-hidden="true">
          <svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            {parents.length > 0 && <line x1="7" y1="0" x2="7" y2="22" />}
            {children.length > 0 && parents.length === 0 && <line x1="7" y1="0" x2="7" y2="22" />}
          </svg>
        </div>
        <div className="cs-tree-row cs-tree-focal">
          <span className="cs-tree-node is-focal" aria-current="page">
            {toTitleCase(focalConcept.label)}
          </span>
        </div>
        {children.length > 0 && (
          <>
            <div className="cs-tree-axis" aria-hidden="true">
              <svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <line x1="7" y1="0" x2="7" y2="22" />
              </svg>
            </div>
            <div className="cs-tree-row cs-tree-children">
              {children.map((c) => renderNode(c, 'child'))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Generic verb-grouped list (Lineage, Semantic, Clinical, Other) ----------
function RelGroup({ label, edges, onDelete }) {
  // Group by directional verb so "Authored: A, B" and "Authored by: C" are
  // separate bullets even though they're the same rel_type underneath.
  // Each entry keeps its connection id for inline delete.
  const groups = useMemo(() => {
    const map = new Map();
    edges.forEach((e) => {
      const key = e.verb;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ connection_id: e.id, concept: e.other });
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [edges]);

  return (
    <div className="cs-rel-block">
      <h3 className="cs-rel-block-title">{label}</h3>
      <ul className="cs-rel-list">
        {groups.map(([verb, entries]) => (
          <li key={verb} className="cs-rel-row">
            <span className="cs-rel-verb">{capitalizeVerb(verb)}:</span>
            <span className="cs-rel-others">
              {entries.map((entry, i) => (
                <span key={entry.connection_id} className="cs-rel-other">
                  {i > 0 && <span className="cs-rel-sep">, </span>}
                  <a href={`/concepts/${entry.concept.id}`} className="cs-rel-link">
                    {toTitleCase(entry.concept.label)}
                  </a>
                  {onDelete && (
                    <button
                      type="button"
                      className="cs-rel-x"
                      onClick={(e) => { e.preventDefault(); onDelete(entry.connection_id); }}
                      aria-label="Remove this relationship"
                      title="Remove this relationship"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function capitalizeVerb(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Positional: arrow-prefixed list, grouped by axis ----------
const POSITIONAL_AXIS_GLYPHS = {
  superior_to: '↑', inferior_to: '↓',
  is_above: '↑', is_below: '↓',
  dorsal_to: '↑', ventral_to: '↓',
  rostral_to: '↑', caudal_to: '↓',
  anterior_to: '↗', posterior_to: '↙',
  medial_to: '↤', lateral_to: '↦',
  proximal_to: '◉', distal_to: '◎',
  ipsilateral_to: '⤺', contralateral_to: '⤼',
  contains: '◯', is_inside: '⊙',
  faces: '⌒', faces_away_from: '⌐',
  is_near: '~',
};

function PositionalBlock({ edges, focalConcept, onDelete }) {
  const groups = useMemo(() => {
    const map = new Map();
    edges.forEach((e) => {
      const key = e.verb;
      if (!map.has(key)) map.set(key, { glyph: POSITIONAL_AXIS_GLYPHS[e.rel_type] || '·', verb: e.verb, entries: [] });
      map.get(key).entries.push({ connection_id: e.id, concept: e.other });
    });
    return [...map.values()].sort((a, b) => a.verb.localeCompare(b.verb));
  }, [edges]);

  return (
    <div className="cs-rel-block">
      <h3 className="cs-rel-block-title">Positional</h3>
      <p className="cs-rel-block-hint">Spatial relationships relative to <strong>{toTitleCase(focalConcept.label)}</strong>.</p>
      <ul className="cs-rel-list cs-pos-list">
        {groups.map((g) => (
          <li key={g.verb} className="cs-rel-row cs-pos-row">
            <span className="cs-pos-glyph" aria-hidden="true">{g.glyph}</span>
            <span className="cs-rel-verb">{capitalizeVerb(g.verb)}:</span>
            <span className="cs-rel-others">
              {g.entries.map((entry, i) => (
                <span key={entry.connection_id} className="cs-rel-other">
                  {i > 0 && <span className="cs-rel-sep">, </span>}
                  <a href={`/concepts/${entry.concept.id}`} className="cs-rel-link">
                    {toTitleCase(entry.concept.label)}
                  </a>
                  {onDelete && (
                    <button
                      type="button"
                      className="cs-rel-x"
                      onClick={(e) => { e.preventDefault(); onDelete(entry.connection_id); }}
                      aria-label="Remove this relationship"
                      title="Remove this relationship"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Breadcrumb({ parents, current }) {
  // Show up to 3 parents, last one closest.
  const display = parents.slice(0, 3);
  return (
    <nav className="cs-breadcrumb" aria-label="Concept hierarchy">
      <a href="/concepts" className="cs-breadcrumb-link">Concepts</a>
      <span className="cs-breadcrumb-sep">/</span>
      {display.map((p, i) => (
        <React.Fragment key={p.id}>
          <a href={`/concepts/${p.id}`} className="cs-breadcrumb-link">{toTitleCase(p.label)}</a>
          <span className="cs-breadcrumb-sep">/</span>
        </React.Fragment>
      ))}
      <span className="cs-breadcrumb-current">{toTitleCase(current)}</span>
    </nav>
  );
}

// =====================================================================
// ConceptBody — decides between two layouts:
//   1. WITH DEFINITION: 2-column.  Main = full encyclopedia article
//      (every field).  Sidebar = compact summaries linking out to the
//      full library data.  User annotations append per section.
//   2. NO DEFINITION: single-column flow with the Generate CTA on top.
// =====================================================================
function ConceptBody({
  concept, conceptId, connections, allConcepts, definition,
  onCreateConnection, onDeleteConnection, onConceptCreated,
  onGenerateDefinition, onRejectDefinition,
  generating, rejecting, generationError, generationQuota,
  revealKey, acquiredVia,
}) {
  const ownedDefinition = hasDefinitionContent(definition) ? definition : null;
  const focalId = parseInt(conceptId);

  if (ownedDefinition) {
    return (
      <div className="cs-2col">
        <main className="cs-2col-main">
          {/* key={revealKey} forces a remount when a new definition lands,
              which restarts the staged-reveal animation.  revealKey is 0
              on initial page load (no animation on revisits). */}
          <DefinitionRevealRegion key={revealKey} animate={revealKey > 0}>
            <DefinitionLede definition={ownedDefinition} />
            <IntegratedArticle concept={concept} definition={ownedDefinition} />
            <FurtherReading definition={ownedDefinition} />
            <DefinitionRejectPanel
              acquiredVia={acquiredVia}
              rejecting={rejecting}
              onReject={onRejectDefinition}
            />
          </DefinitionRevealRegion>
        </main>

        <aside className="cs-2col-side">
          <SidebarStats concept={concept} connections={connections} />
          <SidebarBlock label="Add Relationship" sub="Type to find any concept in your library.">
            <div className="cs-side-adder">
              <InlineRelationshipAdder
                allConcepts={allConcepts}
                currentConceptId={focalId}
                focalLabel={concept.label}
                existingConnections={connections}
                onCreate={onCreateConnection}
                onConceptCreated={onConceptCreated}
              />
              <SuggestPanel
                conceptId={conceptId}
                focalLabel={concept.label}
                onAccept={async (s) => { await onCreateConnection(s.target_id, s.rel_type); }}
              />
            </div>
          </SidebarBlock>
          {connections.length > 0 && (
            <SidebarBlock label="Relationships" count={connections.length}>
              <div className="cs-side-rel-charts">
                <RelationshipsByCategory
                  connections={connections}
                  focalConcept={concept}
                  focalId={focalId}
                  onDelete={onDeleteConnection}
                />
              </div>
            </SidebarBlock>
          )}
          <SidebarKeyAuthors authors={concept.key_authors || []} />
          <SidebarTopSources sources={concept.sources || []} />
          <SidebarNotes notes={concept.contextual_notes || []} />
          <SidebarPeople people={concept.people || []} />
          <SidebarChips
            label="Tags"
            items={(concept.tags || []).map((t, i) => ({ id: t, label: t, key: `t-${i}` }))}
          />
          <SidebarChips
            label="Collections"
            items={(concept.collections || []).map((c) => ({ id: c.id, label: c.name, href: `/collections/${c.id}`, key: `c-${c.id}` }))}
          />
        </aside>
      </div>
    );
  }

  // No definition yet — single-column flow with the Generate CTA on top
  return (
    <>
      <GenerateDefinitionLede
        onGenerate={onGenerateDefinition}
        generating={generating}
        error={generationError}
        quota={generationQuota}
      />

      <IntegratedArticle concept={concept} definition={null} />

      <Section
        title={`Relationships (${connections.length})`}
        sub="Grouped by relationship type.  Hover any concept to remove the connection.  To change a relationship type, remove and re-add it below."
      >
        {connections.length > 0 && (
          <RelationshipsByCategory
            connections={connections}
            focalConcept={concept}
            focalId={focalId}
            onDelete={onDeleteConnection}
          />
        )}
        <InlineRelationshipAdder
          allConcepts={allConcepts}
          currentConceptId={focalId}
          focalLabel={concept.label}
          existingConnections={connections}
          onCreate={onCreateConnection}
          onConceptCreated={onConceptCreated}
        />
        <SuggestPanel
          conceptId={conceptId}
          focalLabel={concept.label}
          onAccept={async (s) => { await onCreateConnection(s.target_id, s.rel_type); }}
        />
      </Section>

      {concept.key_authors && concept.key_authors.length > 0 && (
        <Section
          title={`Key Authors (${concept.key_authors.length})`}
          sub="Researchers behind this concept's literature, ranked by source count."
        >
          <KeyAuthors authors={concept.key_authors} />
        </Section>
      )}

      {concept.sources && concept.sources.length > 0 && (
        <Section title={`Sources (${concept.sources.length})`}>
          <TopSources sources={concept.sources} />
        </Section>
      )}

      {concept.people && concept.people.length > 0 && (
        <Section title={`People (${concept.people.length})`} sub="Manually linked people, distinct from Key Authors above.">
          <div className="cs-tile-grid">
            {concept.people.map((p) => (
              <a key={p.id} href={`/people/${p.id}`} className="cs-tile">
                <span className="cs-list-dot is-person" />
                <span className="cs-tile-text">
                  <span className="cs-tile-title">{p.full_name}</span>
                  {p.role && <span className="cs-tile-meta">{p.role}</span>}
                </span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {concept.contextual_notes && concept.contextual_notes.length > 0 && (
        <Section
          title={`Notes (${concept.contextual_notes.length})`}
          sub="Notes you've taken on sources tagged with this concept."
        >
          <ContextualNotes notes={concept.contextual_notes} />
        </Section>
      )}

      <FurtherReading definition={definition} />
    </>
  );
}

// =====================================================================
// FurtherReading — external links from the ConceptDefinition's
// external_refs field.  Sourced citations come first (stronger signal),
// search-result sources second.  Only renders when the definition has refs.
// =====================================================================
function FurtherReading({ definition }) {
  const refs = definition?.external_refs;
  if (!Array.isArray(refs) || refs.length === 0) return null;

  // Group: citations first, then sources, preserving order within each.
  const citations = refs.filter((r) => r.type === 'citation');
  const sources   = refs.filter((r) => r.type !== 'citation');
  const ordered   = [...citations, ...sources];

  return (
    <section className="cs-further">
      <h2 className="cs-integrated-heading">Further Reading</h2>
      <p className="cs-further-hint">
        Sources cited in the generated definition.  External links open in a new tab.
      </p>
      <ul className="cs-further-list">
        {ordered.map((r, i) => (
          <li key={`${r.url}-${i}`} className="cs-further-row">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="cs-further-link">
              {r.title || r.url}
            </a>
            <span className="cs-further-host">{prettyHost(r.url)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function prettyHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// =====================================================================
// Sidebar — compact summaries used by the with-definition 2-col layout.
// =====================================================================
function SidebarBlock({ label, count, sub, children }) {
  return (
    <div className="cs-side-block">
      <div className="cs-side-head">
        <span className="cs-side-label">{label}</span>
        {count != null && <span className="cs-side-count">{count}</span>}
      </div>
      {sub && <p className="cs-side-sub">{sub}</p>}
      {children}
    </div>
  );
}

// Compact at-a-glance counts at the very top of the sidebar.
function SidebarStats({ concept, connections }) {
  const stats = [
    { label: 'Connections', value: connections?.length || 0 },
    { label: 'Sources',     value: concept.sources?.length ?? concept.sources_count ?? 0 },
    { label: 'Notes',       value: concept.contextual_notes?.length ?? concept.notes_count ?? 0 },
    { label: 'People',      value: concept.people?.length ?? concept.people_count ?? 0 },
  ].filter((s) => s.value > 0);
  if (stats.length === 0) return null;
  return (
    <div className="cs-side-stats">
      {stats.map((s) => (
        <div key={s.label} className="cs-side-stat">
          <span className="cs-side-stat-value">{s.value}</span>
          <span className="cs-side-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// Old compact summary — superseded by RelationshipsByCategory rendered
// directly in the sidebar via cs-side-rel-charts overrides.  Kept removed
// to avoid double-rendering the same data.
function SidebarRelationships__unused({ connections, focalConcept, focalId, onDelete }) {
  return null;
}

function SidebarKeyAuthors({ authors }) {
  if (!authors || authors.length === 0) return null;
  return (
    <SidebarBlock label="Key Authors" count={authors.length}>
      <ul className="cs-side-list">
        {authors.slice(0, 5).map((a) => (
          <li key={a.id} className="cs-side-row">
            <a href={`/people/${a.id}`} className="cs-side-name">{toTitleCase(a.full_name)}</a>
            <span className="cs-side-meta">{a.source_count} src</span>
          </li>
        ))}
      </ul>
    </SidebarBlock>
  );
}

function SidebarTopSources({ sources }) {
  if (!sources || sources.length === 0) return null;
  const ranked = useMemo(() => {
    return [...sources].sort((a, b) => {
      if (a.is_key_source !== b.is_key_source) return a.is_key_source ? -1 : 1;
      return (b.notes_count || 0) - (a.notes_count || 0);
    }).slice(0, 5);
  }, [sources]);
  return (
    <SidebarBlock label="Top Sources" count={sources.length}>
      <ul className="cs-side-list">
        {ranked.map((s) => (
          <li key={s.id} className="cs-side-row">
            <a href={`/sources/${s.id}`} className="cs-side-name">
              {s.is_key_source && <span className="cs-side-key" title="Key source">★ </span>}
              {toTitleCase(s.title)}
            </a>
            {s.year && <span className="cs-side-meta">{s.year}</span>}
          </li>
        ))}
      </ul>
    </SidebarBlock>
  );
}

function SidebarNotes({ notes }) {
  if (!notes || notes.length === 0) return null;
  return (
    <SidebarBlock label="Notes" count={notes.length}>
      <ul className="cs-side-list">
        {notes.slice(0, 5).map((n) => {
          const title = n.title || stripHtml(n.body || '').slice(0, 60) || 'Untitled note';
          return (
            <li key={n.id} className="cs-side-row">
              <a href={`/notes/${n.id}`} className="cs-side-name">{title}</a>
              {n.note_type && <span className="cs-side-meta">{n.note_type}</span>}
            </li>
          );
        })}
      </ul>
    </SidebarBlock>
  );
}

function SidebarPeople({ people }) {
  if (!people || people.length === 0) return null;
  return (
    <SidebarBlock label="People" count={people.length} sub="Manually linked, distinct from Key Authors.">
      <ul className="cs-side-list">
        {people.slice(0, 5).map((p) => (
          <li key={p.id} className="cs-side-row">
            <a href={`/people/${p.id}`} className="cs-side-name">{toTitleCase(p.full_name)}</a>
            {p.role && <span className="cs-side-meta">{p.role}</span>}
          </li>
        ))}
      </ul>
    </SidebarBlock>
  );
}

function SidebarChips({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <SidebarBlock label={label} count={items.length}>
      <div className="cs-side-chips">
        {items.map((it) => (
          it.href
            ? <a key={it.key} href={it.href} className="cs-side-chip">{it.label}</a>
            : <span key={it.key} className="cs-side-chip">{it.label}</span>
        ))}
      </div>
    </SidebarBlock>
  );
}

// =====================================================================
// Definition lede — the "Definition" block beneath the hero.  Either the
// concept has a generated definition (DefinitionLede) or it doesn't, in
// which case the GenerateDefinitionLede CTA shows up.
// =====================================================================
function GenerateDefinitionLede({ onGenerate, generating, error, quota }) {
  if (generating) {
    return (
      <section className="cs-pack-lede is-generating">
        <header className="cs-pack-lede-head">
          <span className="cs-pack-lede-eyebrow is-generating-eyebrow">
            <MagicSparkles size={12} spinning /> Generating Definition
          </span>
        </header>
        <p className="cs-pack-lede-summary">
          Researching, drafting, fact-checking, and pulling sources.
          This usually takes a few minutes — we run a full pass before showing you anything.
        </p>
        <p className="cs-pack-lede-generating-hint">
          You can leave this page and come back — the entry will be waiting when it's ready.
        </p>
      </section>
    );
  }

  const unlimited = quota?.unlimited;
  const remaining = quota?.remaining ?? 0;
  const limit     = quota?.limit ?? 0;
  const tier      = quota?.tier  ?? 'free';
  const overQuota = !unlimited && (error?.kind === 'quota' || (quota && remaining <= 0));

  return (
    <section className="cs-pack-lede is-generate">
      <header className="cs-pack-lede-head">
        <span className="cs-pack-lede-eyebrow">No definition yet</span>
      </header>
      <p className="cs-pack-lede-summary">
        Generate a textbook-style entry for this concept — summary, examples,
        history, controversy, and more — with one click.
      </p>
      {error && error.kind !== 'quota' && (
        <div className="cs-pack-lede-generating-error">{error.message}</div>
      )}
      <div className="cs-pack-lede-cta">
        <div className="cs-pack-lede-cta-text">
          {unlimited ? (
            <>
              <strong>Unlimited Concept Library Additions</strong>
              <span className="cs-pack-lede-cta-meta"> · Unlimited tier</span>
            </>
          ) : overQuota ? (
            <>
              <strong>You've used all {limit} this month on the {tier} tier.</strong>
              <span className="cs-pack-lede-cta-meta"> · Upgrade for unlimited.</span>
            </>
          ) : (
            <>
              <strong>{remaining} of {limit} Concept Library Additions</strong>
              <span className="cs-pack-lede-cta-meta"> remaining this month</span>
            </>
          )}
        </div>
        {overQuota ? (
          <a href={error?.upgradeUrl || '/subscribe'} className="sp-action sp-action-primary cs-pack-lede-cta-btn">
            Upgrade →
          </a>
        ) : (
          <button
            type="button"
            className="sp-action sp-action-primary cs-pack-lede-cta-btn"
            onClick={onGenerate}
          >
            <MagicSparkles size={13} /> Generate Definition
          </button>
        )}
      </div>
    </section>
  );
}

function DefinitionLede({ definition }) {
  return (
    <section className="cs-pack-lede is-owned">
      <header className="cs-pack-lede-head">
        <span className="cs-pack-lede-eyebrow">Definition</span>
      </header>
      {definition.summary && (
        <p className="cs-pack-lede-summary">{definition.summary}</p>
      )}
    </section>
  );
}

// Wraps the definition rendering tree.  When `animate` is true, applies
// is-revealing — CSS handles the staggered fade-in of each sibling block.
// Parent passes a fresh React key on each new acquisition so the subtree
// remounts and the CSS animations replay.
function DefinitionRevealRegion({ animate, children }) {
  return (
    <div className={`cs-reveal ${animate ? 'is-revealing' : ''}`}>
      {children}
    </div>
  );
}

// "Not what you meant?" — wrong-sense rejection.  Single click to expand,
// inline confirm.  Copy explains the cost to the user up front: free if we
// served them a cache hit (we picked badly), else one Concept Library
// Addition.  Shown after the definition's full content so users can read
// before deciding.
function DefinitionRejectPanel({ acquiredVia, rejecting, onReject }) {
  const [confirming, setConfirming] = useState(false);

  if (rejecting) {
    return (
      <div className="cs-reject-panel cs-reject-panel-busy">
        <Spinner /> <span>Replacing this definition…</span>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="cs-reject-panel">
        <button
          type="button"
          className="cs-reject-trigger"
          onClick={() => setConfirming(true)}
        >
          Not what you meant?
        </button>
      </div>
    );
  }

  const wasCacheHit = acquiredVia === 'cache_hit';
  return (
    <div className="cs-reject-panel cs-reject-panel-confirm" role="alertdialog" aria-label="Replace definition">
      <p className="cs-reject-headline">Generate a fresh definition?</p>
      <p className="cs-reject-body">
        {wasCacheHit
          ? "We matched this to an existing entry — we'll regenerate a custom one for you.  Free, since this came from cache."
          : "This will replace the current definition and use one of your monthly Concept Library Additions."}
      </p>
      <div className="cs-reject-actions">
        <button type="button" className="sp-action sp-action-quiet" onClick={() => setConfirming(false)}>
          Cancel
        </button>
        <button type="button" className="sp-action sp-action-primary" onClick={onReject}>
          Generate fresh
        </button>
      </div>
    </div>
  );
}

// Renders a generated field's body, collapsing long content under a
// fade with a "Show more" toggle.  Below the threshold the toggle never
// renders, so short fields stay clean.  Length is measured against
// stripped text so HTML tags don't inflate the count.
function TruncatablePack({ value, rich }) {
  const [expanded, setExpanded] = useState(false);
  const raw = (rich ? stripHtml(value) : value || '').trim();
  const needsTruncation = raw.length > TRUNCATION_CHAR_THRESHOLD;
  const clampClass = needsTruncation && !expanded ? 'is-clamped' : '';

  return (
    <>
      <div className={`cs-pack-clamp ${clampClass}`}>
        {rich
          ? <RichTextBlock html={value} />
          : <p className="cs-integrated-text">{value}</p>}
      </div>
      {needsTruncation && (
        <button
          type="button"
          className="cs-pack-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}

// Long-form fields shared across user concepts and generated definitions.
const LONG_FORM_FIELDS = [
  { key: 'description',         label: 'Description',          rich: true },
  { key: 'mnemonic',            label: 'Mnemonic' },
  { key: 'examples',            label: 'Examples',             rich: true },
  { key: 'history',             label: 'History',              rich: true },
  { key: 'location',            label: 'Location' },
  { key: 'school_of_thought',   label: 'School of Thought' },
  { key: 'etymology',           label: 'Etymology' },
  { key: 'clinical_relevance',  label: 'Clinical Relevance' },
  { key: 'controversy',         label: 'Controversy' },
  { key: 'misconceptions',      label: 'Misconceptions' },
  { key: 'developmental_notes', label: 'Developmental Notes' },
  { key: 'measurement_notes',   label: 'Measurement Notes' },
];

// =====================================================================
// IntegratedArticle — per-field section with the user's content above
// (if present) and the generated definition's content boxed below (if
// present).  A field only renders if at least one side has content.
// =====================================================================
function IntegratedArticle({ concept, definition }) {
  const present = LONG_FORM_FIELDS.filter((f) => concept[f.key] || definition?.[f.key]);
  if (present.length === 0) return null;

  return (
    <section className="cs-integrated">
      {present.map((f) => {
        const userValue = concept[f.key];
        const generatedValue = definition?.[f.key];
        return (
          <article key={f.key} className="cs-integrated-section">
            <h2 className="cs-integrated-heading">{f.label}</h2>

            {userValue && (
              <div className="cs-integrated-user">
                {f.rich
                  ? <RichTextBlock html={userValue} />
                  : <p className="cs-integrated-text">{userValue}</p>}
              </div>
            )}

            {generatedValue && (
              <aside className="cs-integrated-pack">
                <TruncatablePack value={generatedValue} rich={f.rich} />
              </aside>
            )}
          </article>
        );
      })}
      {definition?.attribution && (
        <footer className="cs-integrated-attribution">{definition.attribution}</footer>
      )}
    </section>
  );
}

function truncateAt(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function Section({ title, sub, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`cs-section ${open ? 'is-open' : 'is-collapsed'}`}>
      <button
        type="button"
        className="cs-section-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="cs-section-caret" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5.5l4 4 4-4" />
          </svg>
        </span>
        <h2 className="cs-section-title">{title}</h2>
      </button>
      {open && (
        <>
          {sub && <p className="cs-section-sub">{sub}</p>}
          <div className="cs-section-body">{children}</div>
        </>
      )}
    </section>
  );
}

function RichTextBlock({ html }) {
  return <div className="cs-richtext" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---- Inline relationship adder ----

function InlineRelationshipAdder({ allConcepts, currentConceptId, focalLabel, existingConnections, onCreate, onConceptCreated }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [relType, setRelType] = useState('related_to');
  const [showRelMenu, setShowRelMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const wrapRef = useRef(null);

  // Concepts already directly connected to current — hide them from suggestions.
  const connectedIds = useMemo(() => {
    const s = new Set();
    existingConnections.forEach((conn) => {
      const a = conn.src_concept?.id;
      const b = conn.dst_concept?.id;
      if (a && a !== currentConceptId) s.add(a);
      if (b && b !== currentConceptId) s.add(b);
    });
    return s;
  }, [existingConnections, currentConceptId]);

  const trimmed = query.trim();
  const matches = useMemo(() => {
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    return allConcepts
      .filter((c) => c.id !== currentConceptId && !connectedIds.has(c.id) && c.label?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allConcepts, trimmed, currentConceptId, connectedIds]);

  // Show "Create new" affordance whenever the query doesn't exactly match
  // an existing concept (case-insensitive on label).
  const hasExactMatch = useMemo(() => {
    if (!trimmed) return false;
    const q = trimmed.toLowerCase();
    return allConcepts.some((c) => c.label?.toLowerCase() === q);
  }, [allConcepts, trimmed]);

  const showCreateRow = !!trimmed && !hasExactMatch;

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSuggest(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const createNewConcept = async (label) => {
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch('/concepts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ concept: { label } }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handlePickCreate = async () => {
    if (!trimmed || creatingNew) return;
    setCreatingNew(true);
    const created = await createNewConcept(trimmed);
    setCreatingNew(false);
    if (created) {
      setSelected(created);
      setQuery('');
      setShowSuggest(false);
      onConceptCreated?.(created); // give parent a chance to refresh allConcepts
    }
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    const ok = await onCreate(selected.id, relType);
    setBusy(false);
    if (ok) { setSelected(null); setQuery(''); setRelType('related_to'); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selected) {
        submit();
      } else if (matches.length > 0) {
        setSelected(matches[0]);
        setQuery('');
        setShowSuggest(false);
      } else if (showCreateRow) {
        handlePickCreate();
      }
    } else if (e.key === 'Escape') {
      setShowSuggest(false);
    }
  };

  const relTypeLabel = REL_TYPE_BY_VALUE[relType]?.text || relType;

  return (
    <div ref={wrapRef} className="cs-add-rel">
      <div className="cs-add-rel-row">
        {selected ? (
          <span className="cs-add-rel-selected">
            <span className="cs-list-dot is-concept" />
            {toTitleCase(selected.label)}
            <button type="button" className="cs-add-rel-x" onClick={() => setSelected(null)} aria-label="Remove">
              <Icon name="x" />
            </button>
          </span>
        ) : (
          <div className="cs-add-rel-search">
            <Icon name="search" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggest(true); }}
              onFocus={() => query && setShowSuggest(true)}
              onKeyDown={onKey}
              placeholder="Find a concept to relate"
              className="cs-add-rel-input"
            />
          </div>
        )}

        <RelTypePicker
          value={relType}
          onChange={setRelType}
          open={showRelMenu}
          setOpen={setShowRelMenu}
          focalLabel={focalLabel}
          targetLabel={selected?.label}
        />

        <button
          type="button"
          className="sp-action sp-action-primary"
          onClick={submit}
          disabled={!selected || busy}
        >
          {busy ? 'Adding…' : '+ Add'}
        </button>
      </div>

      {!selected && showSuggest && (matches.length > 0 || showCreateRow) && (
        <div className="cs-add-rel-results">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              className="cs-add-rel-result"
              onClick={() => { setSelected(c); setQuery(''); setShowSuggest(false); }}
            >
              <span className="cs-list-dot is-concept" />
              <span>
                <span className="cs-add-rel-result-label">{toTitleCase(c.label)}</span>
                {c.concept_type && <span className="cs-add-rel-result-type">{getNodeTypeLabel(c.concept_type)}</span>}
              </span>
            </button>
          ))}
          {showCreateRow && (
            <button
              type="button"
              className="cs-add-rel-result cs-add-rel-create"
              onClick={handlePickCreate}
              disabled={creatingNew}
            >
              <span className="cs-add-rel-create-icon" aria-hidden="true">+</span>
              <span>
                <span className="cs-add-rel-result-label">
                  {creatingNew ? 'Creating…' : <>Create new concept: <em>{trimmed}</em></>}
                </span>
                <span className="cs-add-rel-result-type">Hit Enter to add to your library and link.</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RelTypePicker({ value, onChange, open, setOpen, focalLabel, targetLabel }) {
  const ref = useRef(null);
  const verb = REL_TYPE_BY_VALUE[value]?.text || value;

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [setOpen]);

  // Trigger label reads as the full sentence when both ends are known so
  // users can scan-check the direction without opening the menu.
  const triggerContent = focalLabel && targetLabel ? (
    <>
      <strong>{toTitleCase(focalLabel)}</strong> {verb} <strong>{toTitleCase(targetLabel)}</strong>
    </>
  ) : focalLabel ? (
    <>
      <strong>{toTitleCase(focalLabel)}</strong> {verb} …
    </>
  ) : (
    verb
  );

  return (
    <div ref={ref} className="cs-reltype">
      <button
        type="button"
        className="cs-reltype-trigger"
        onClick={() => setOpen(!open)}
      >
        {triggerContent} <span className="cs-reltype-caret">▾</span>
      </button>
      {open && (
        <div className="cs-reltype-menu" role="listbox">
          <div className="cs-reltype-hint">
            Pick the relationship that reads correctly left-to-right —
            <strong> {toTitleCase(focalLabel || 'this concept')} </strong>
            is the subject of every sentence below.
          </div>
          {RELATIONSHIP_CATEGORIES.map((cat) => (
            <div key={cat.label} className="cs-reltype-group">
              <div className="cs-reltype-group-label">{cat.label}</div>
              {cat.types.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`cs-reltype-item ${value === t.value ? 'is-selected' : ''}`}
                  onClick={() => { onChange(t.value); setOpen(false); }}
                >
                  {focalLabel ? (
                    <>
                      <strong>{toTitleCase(focalLabel)}</strong>
                      <span className="cs-reltype-verb"> {t.text} </span>
                      <strong className="cs-reltype-target">
                        {targetLabel ? toTitleCase(targetLabel) : '…'}
                      </strong>
                    </>
                  ) : (
                    t.text
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Haiku-powered suggestions ----

function SuggestPanel({ conceptId, focalLabel, onAccept }) {
  const [state, setState] = useState('idle'); // idle | loading | ready | error | empty
  const [suggestions, setSuggestions] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [accepting, setAccepting] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState(null);

  const visible = useMemo(
    () => suggestions.filter((s) => !dismissed.has(s.target_id)),
    [suggestions, dismissed]
  );

  const requestSuggestions = async () => {
    setState('loading');
    setErrorMsg(null);
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch(`/concepts/${conceptId}/suggest_relationships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setDismissed(new Set());
      setState((data.suggestions || []).length === 0 ? 'empty' : 'ready');
    } catch (err) {
      console.error(err);
      setErrorMsg('Suggestions failed.  Try again in a moment.');
      setState('error');
    }
  };

  const accept = async (s) => {
    setAccepting((prev) => new Set(prev).add(s.target_id));
    await onAccept(s);
    setDismissed((prev) => new Set(prev).add(s.target_id));
    setAccepting((prev) => {
      const next = new Set(prev);
      next.delete(s.target_id);
      return next;
    });
  };

  const dismiss = (s) => {
    setDismissed((prev) => new Set(prev).add(s.target_id));
  };

  return (
    <div className="cs-suggest">
      <div className="cs-suggest-trigger-row">
        <button
          type="button"
          className="cs-suggest-trigger"
          onClick={requestSuggestions}
          disabled={state === 'loading'}
        >
          <SparkleIcon />
          {state === 'loading'
            ? 'Reading your library…'
            : state === 'ready' || state === 'empty' || state === 'error'
              ? 'Suggest more'
              : 'Suggest with Haiku'}
        </button>
        {(state === 'ready' || state === 'empty' || state === 'error') && (
          <span className="cs-suggest-status">
            {state === 'ready' && visible.length > 0 && <>{visible.length} suggestion{visible.length === 1 ? '' : 's'}</>}
            {state === 'ready' && visible.length === 0 && 'All cleared.'}
            {state === 'empty' && 'Nothing strong to propose right now.'}
            {state === 'error' && errorMsg}
          </span>
        )}
      </div>

      {state === 'ready' && visible.length > 0 && (
        <div className="cs-suggest-list">
          {visible.map((s) => (
            <div key={s.target_id} className="cs-suggest-card">
              <div className="cs-suggest-row">
                <div className="cs-suggest-sentence">
                  <span className="cs-suggest-focal">{toTitleCase(focalLabel)}</span>
                  <span className="cs-suggest-verb">
                    {REL_TYPE_BY_VALUE[s.rel_type]?.text || s.rel_type}
                  </span>
                  <a href={`/concepts/${s.target_id}`} className="cs-suggest-target-link" onClick={(e) => e.stopPropagation()}>
                    {toTitleCase(s.target_label)}
                  </a>
                  {s.target_type && (
                    <span className="cs-suggest-target-type">· {getNodeTypeLabel(s.target_type)}</span>
                  )}
                </div>
                <div className="cs-suggest-vote">
                  <button
                    type="button"
                    className="cs-vote-btn cs-vote-up"
                    onClick={() => accept(s)}
                    disabled={accepting.has(s.target_id)}
                    aria-label="Accept suggestion"
                    title="Accept"
                  >
                    {accepting.has(s.target_id) ? <Spinner /> : <ThumbsUpIcon />}
                  </button>
                  <button
                    type="button"
                    className="cs-vote-btn cs-vote-down"
                    onClick={() => dismiss(s)}
                    disabled={accepting.has(s.target_id)}
                    aria-label="Dismiss suggestion"
                    title="Dismiss"
                  >
                    <ThumbsDownIcon />
                  </button>
                </div>
              </div>
              {s.reasoning && <div className="cs-suggest-reason">{s.reasoning}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Re-exports the shared icon under the previous name so existing JSX inside
// this file ("<SparkleIcon />") still works without touching every callsite.
function SparkleIcon() {
  return <MagicSparkles size={13} />;
}

function ThumbsUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3z" />
      <path d="M7 11l3.5-7c.5-1 1.6-1.5 2.6-1 1 .5 1.4 1.6.9 2.6L13 9h6.2a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 13V4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3z" />
      <path d="M7 13l3.5 7c.5 1 1.6 1.5 2.6 1 1-.5 1.4-1.6.9-2.6L13 15h6.2a2 2 0 0 0 2-2.3l-1-6a2 2 0 0 0-2-1.7H7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ animation: 'cs-spin 0.7s linear infinite' }}>
      <path d="M12 4a8 8 0 0 1 8 8" />
    </svg>
  );
}

// ---- Existing relationships list ----

function RelationshipsList({ connections, currentConceptId, focalLabel, onDelete }) {
  if (connections.length === 0) {
    return (
      <div className="cs-rels-empty">
        No relationships yet.  Use the bar above to relate this concept to something else.
      </div>
    );
  }

  // Group by effective rel_type from this concept's perspective.
  const groups = {};
  connections.forEach((conn) => {
    const isSource = conn.src_concept?.id === currentConceptId;
    const effectiveType = isSource ? conn.rel_type : (getInverseRelType(conn.rel_type) || conn.rel_type);
    const groupLabel = conn.relationship_label || REL_TYPE_BY_VALUE[effectiveType]?.text || effectiveType;
    if (!groups[effectiveType]) groups[effectiveType] = { label: groupLabel, items: [] };
    groups[effectiveType].items.push(conn);
  });

  return (
    <div className="cs-rels">
      {Object.values(groups).map((group) => (
        <div key={group.label} className="cs-rel-group">
          <div className="cs-rel-group-label">
            <span className="cs-rel-group-focal">{toTitleCase(focalLabel)}</span>
            <span className="cs-rel-group-verb">{group.label}:</span>
          </div>
          <div className="cs-tile-grid">
            {group.items.map((conn) => {
              const isSource = conn.src_concept?.id === currentConceptId;
              const other = isSource ? conn.dst_concept : conn.src_concept;
              if (!other) return null;
              return (
                <a key={conn.id} href={`/concepts/${other.id}`} className="cs-tile cs-tile-rel">
                  <span className="cs-list-dot is-concept" />
                  <span className="cs-tile-text">
                    <span className="cs-tile-title">{toTitleCase(other.label)}</span>
                    {other.concept_type && <span className="cs-tile-meta">{getNodeTypeLabel(other.concept_type)}</span>}
                  </span>
                  <button
                    type="button"
                    className="cs-tile-delete"
                    onClick={(e) => { e.preventDefault(); onDelete(conn.id); }}
                    aria-label="Delete relationship"
                    title="Delete"
                  >
                    <Icon name="x" />
                  </button>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Helpers ----

function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function Icon({ name }) {
  const s = { width: 12, height: 12, flexShrink: 0 };
  if (name === 'x') return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
  if (name === 'search') return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" strokeLinecap="round" /></svg>;
  return <svg style={s} viewBox="0 0 16 16" />;
}

// =====================================================================
// Styles
// =====================================================================

function CSStyles() {
  return (
    <style>{`
      .cs-shell {
        flex: 1;
        background: var(--paper);
        max-width: 920px;
        margin: 0 auto;
        width: 100%;
        padding: 24px 24px 80px;
      }
      .cs-loading {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
        padding: 80px 24px;
      }
      .cs-error { color: var(--error); }

      /* Header bar */
      .cs-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .cs-back {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
      }
      .cs-back:hover { color: var(--ink); }
      .cs-header-actions { display: flex; gap: 6px; flex-wrap: wrap; }

      /* Breadcrumb */
      .cs-breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        margin-bottom: 18px;
      }
      .cs-breadcrumb-link {
        color: var(--ink-3);
        text-decoration: none;
      }
      .cs-breadcrumb-link:hover { color: var(--ink); border-bottom: 1px solid var(--ink-3); }
      .cs-breadcrumb-sep { color: var(--ink-4); }
      .cs-breadcrumb-current { color: var(--ink); font-weight: 500; }

      /* Hero */
      .cs-hero { margin-bottom: 28px; }
      .cs-hero-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
      .cs-hero-type {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-2);
        background: var(--paper-warm);
        padding: 3px 10px;
        border-radius: var(--r-sm);
        font-weight: 500;
      }
      .cs-hero-title {
        font-family: var(--font-display);
        font-size: 40px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.1;
        letter-spacing: -0.02em;
        margin: 0 0 12px;
        text-wrap: balance;
      }
      .cs-hero-summary {
        font-family: var(--font-body);
        font-size: 16px;
        color: var(--ink-2);
        line-height: 1.65;
        margin: 0;
        max-width: 720px;
      }

      /* ---------- Definition lede (with-definition + generate states) ---------- */
      .cs-pack-lede {
        position: relative;
        max-width: 720px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 20px 24px 22px;
        margin-bottom: 32px;
      }
      .cs-pack-lede.is-owned {
        background: var(--concept-tint);
        border-color: transparent;
        border-left: 3px solid var(--concept);
      }
      .cs-pack-lede.is-available {
        background: var(--paper-soft);
        border-color: color-mix(in srgb, var(--concept) 25%, var(--ink-line));
      }
      .cs-pack-lede.is-generate {
        background: var(--paper);
        border: 1px dashed color-mix(in srgb, var(--concept) 40%, var(--ink-line));
      }
      .cs-pack-lede.is-generating {
        background: color-mix(in srgb, var(--concept-tint) 60%, var(--paper));
        border-color: var(--concept);
      }
      .cs-pack-lede-eyebrow.is-generating-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--concept);
      }
      .cs-pack-lede-generating-hint {
        margin: 8px 0 0;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        font-style: italic;
      }
      .cs-pack-lede-generating-error {
        margin: 0 0 12px;
        padding: 8px 12px;
        background: rgba(122, 46, 46, 0.06);
        border: 1px solid var(--error);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--error);
      }
      .cs-pack-lede-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }
      .cs-pack-lede-eyebrow {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--concept);
      }
      .cs-pack-lede-eyebrow.is-preview {
        color: var(--concept-2);
      }
      .cs-pack-lede-byline {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        text-decoration: none;
      }
      .cs-pack-lede-byline em {
        font-style: italic;
        color: var(--ink-2);
        font-weight: 500;
      }
      a.cs-pack-lede-byline:hover em { color: var(--concept-2); border-bottom: 1px solid var(--concept); }
      .cs-pack-lede-summary {
        font-family: var(--font-body);
        font-size: 15px;
        line-height: 1.55;
        color: var(--ink);
        margin: 0;
        font-weight: 400;
      }
      .cs-pack-lede-body {
        font-family: var(--font-display);
        font-size: 15.5px;
        line-height: 1.7;
        color: var(--ink-2);
      }
      .cs-pack-lede-body p { margin: 0 0 12px; }
      .cs-pack-lede-body p:last-child { margin: 0; }

      /* ---------- Further Reading (external_refs from definition) ---------- */
      .cs-further {
        max-width: 720px;
        margin: 36px 0 0;
        padding-top: 24px;
        border-top: 1px solid var(--ink-line);
      }
      .cs-further-hint {
        font-size: 12.5px;
        color: var(--ink-3);
        margin: -6px 0 12px;
      }
      .cs-further-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cs-further-row {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 6px 0;
      }
      .cs-further-link {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink);
        text-decoration: none;
        border-bottom: 1px solid var(--ink-line);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color 0.12s, border-color 0.12s;
      }
      .cs-further-link:hover { color: var(--concept-2); border-color: var(--concept); }
      .cs-further-host {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        white-space: nowrap;
      }

      /* ---------- IntegratedArticle: per-field user + pack pattern ---------- */
      /* Staged-reveal animation.  Plays when a definition lands in this
         session (cache hit OR fresh-gen completion).  Page revisits don't
         set is-revealing, so users only see the animation when the
         definition was just acquired.  Total budget ~9.5s; integrated
         sections stagger between the lede and the further-reading rail. */
      .cs-reveal.is-revealing .cs-pack-lede.is-owned       { animation: csReveal 0.7s 0s    ease both; }
      .cs-reveal.is-revealing .cs-integrated-section:nth-child(1) { animation: csReveal 0.7s 1.2s ease both; }
      .cs-reveal.is-revealing .cs-integrated-section:nth-child(2) { animation: csReveal 0.7s 2.0s ease both; }
      .cs-reveal.is-revealing .cs-integrated-section:nth-child(3) { animation: csReveal 0.7s 2.8s ease both; }
      .cs-reveal.is-revealing .cs-integrated-section:nth-child(4) { animation: csReveal 0.7s 3.6s ease both; }
      .cs-reveal.is-revealing .cs-integrated-section:nth-child(5) { animation: csReveal 0.7s 4.4s ease both; }
      .cs-reveal.is-revealing .cs-integrated-section:nth-child(6) { animation: csReveal 0.7s 5.2s ease both; }
      .cs-reveal.is-revealing .cs-integrated-section:nth-child(n+7) { animation: csReveal 0.7s 6.0s ease both; }
      .cs-reveal.is-revealing .cs-integrated-attribution   { animation: csReveal 0.7s 7.0s  ease both; }
      .cs-reveal.is-revealing .cs-further                  { animation: csReveal 0.7s 7.6s  ease both; }
      .cs-reveal.is-revealing .cs-reject-panel             { animation: csReveal 0.7s 8.4s  ease both; }
      @keyframes csReveal {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .cs-reveal.is-revealing * { animation: none !important; }
      }

      /* Reject ("not what you meant") panel: subtle trigger button by
         default; expands inline to a confirm card so the user never leaves
         the page.  Color borrowed from the concept palette to match the
         rest of the definition surface. */
      .cs-reject-panel {
        margin: 32px 0 8px;
        max-width: 720px;
      }
      .cs-reject-trigger {
        appearance: none;
        background: transparent;
        border: none;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        cursor: pointer;
        padding: 4px 0;
        text-decoration: underline;
        text-decoration-color: var(--ink-line);
        text-underline-offset: 3px;
      }
      .cs-reject-trigger:hover { color: var(--ink-2); text-decoration-color: var(--ink-3); }

      .cs-reject-panel-confirm {
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 16px 18px;
      }
      .cs-reject-headline {
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .cs-reject-body {
        font-family: var(--font-body);
        font-size: 13px;
        line-height: 1.55;
        color: var(--ink-2);
        margin: 0 0 12px;
      }
      .cs-reject-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .cs-reject-panel-busy {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        padding: 8px 0;
      }

      .cs-integrated {
        max-width: 720px;
        margin: 28px 0;
      }
      .cs-integrated-section {
        margin-bottom: 24px;
      }
      .cs-integrated-section:last-of-type { margin-bottom: 0; }
      .cs-integrated-heading {
        font-family: var(--font-display);
        font-size: 19px;
        font-weight: 600;
        color: var(--concept);
        letter-spacing: -0.005em;
        line-height: 1.25;
        margin: 0 0 10px;
      }
      .cs-integrated-user {
        font-family: var(--font-body);
        font-size: 14.5px;
        line-height: 1.55;
        color: var(--ink);
      }
      .cs-integrated-user .cs-richtext { font-family: inherit; font-size: inherit; line-height: inherit; }
      .cs-integrated-text { margin: 0; white-space: pre-wrap; }

      .cs-integrated-pack {
        margin-top: 10px;
        padding: 14px 18px;
        background: var(--concept-tint);
        border-left: 3px solid var(--concept);
        border-radius: var(--r-md);
      }
      /* Show-more clamp on long generated fields (e.g. multi-paragraph
         description).  Threshold is char-length based — short fields skip
         the toggle entirely.  Fade gradient color matches the pack tint
         so the bottom of the clamped block dissolves cleanly. */
      .cs-pack-clamp.is-clamped {
        position: relative;
        max-height: 12em;
        overflow: hidden;
      }
      .cs-pack-clamp.is-clamped::after {
        content: '';
        position: absolute;
        inset: auto 0 0 0;
        height: 3em;
        background: linear-gradient(to bottom, rgba(232, 244, 238, 0), var(--concept-tint));
        pointer-events: none;
      }
      .cs-pack-toggle {
        margin-top: 8px;
        background: transparent;
        border: none;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--concept-2);
        cursor: pointer;
        padding: 2px 0;
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 3px;
        transition: text-decoration-color 120ms;
      }
      .cs-pack-toggle:hover { text-decoration-color: var(--concept); }
      .cs-integrated-pack .cs-richtext,
      .cs-integrated-pack .cs-integrated-text {
        font-family: var(--font-body);
        font-size: 14.5px;
        line-height: 1.55;
        color: var(--ink-2);
      }
      .cs-integrated-attribution {
        margin-top: 26px;
        padding-top: 14px;
        border-top: 1px solid var(--ink-line-soft);
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        font-style: italic;
      }

      /* Available-state teaser fade + CTA */
      .cs-pack-lede-summary-wrap {
        position: relative;
      }
      .cs-pack-lede.is-available .cs-pack-lede-summary {
        max-height: 200px;
        overflow: hidden;
      }
      .cs-pack-lede-fade {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 64px;
        background: linear-gradient(to bottom, transparent, var(--paper-soft) 80%);
        pointer-events: none;
      }
      .cs-pack-lede-cta {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid var(--ink-line-soft);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .cs-pack-lede-cta-text {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
      }
      .cs-pack-lede-cta-text strong {
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--ink);
      }
      .cs-pack-lede-cta-meta { color: var(--ink-3); }
      .cs-pack-lede-cta-btn {
        background: var(--concept);
        border-color: var(--concept);
        color: var(--paper);
        white-space: nowrap;
      }
      .cs-pack-lede-cta-btn:hover:not(:disabled) {
        background: var(--concept-2);
        border-color: var(--concept-2);
      }
      .cs-pack-lede-others {
        margin: 12px 0 0;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
      }
      .cs-pack-lede-others-link {
        color: var(--ink-2);
        text-decoration: none;
        border-bottom: 1px solid var(--ink-line);
      }
      .cs-pack-lede-others-link:hover { color: var(--concept-2); border-color: var(--concept); }

      /* Sections */
      .cs-section { margin-bottom: 36px; }
      .cs-section.is-collapsed { margin-bottom: 12px; }
      .cs-section-toggle {
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        background: transparent;
        border: none;
        padding: 4px 0;
        margin: 0 0 12px;
        cursor: pointer;
        text-align: left;
        color: inherit;
      }
      .cs-section.is-collapsed .cs-section-toggle { margin-bottom: 0; }
      .cs-section-toggle:hover .cs-section-title { color: var(--ink-2); }
      .cs-section-toggle:hover .cs-section-caret { color: var(--ink-2); }
      .cs-section-caret {
        color: var(--ink-3);
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s;
        width: 14px;
        height: 14px;
        margin-top: 2px;
      }
      .cs-section.is-collapsed .cs-section-caret { transform: rotate(-90deg); }
      .cs-section-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        letter-spacing: -0.005em;
        transition: color var(--transition-fast);
      }
      .cs-section-sub {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        margin: -6px 0 12px;
        padding-left: 22px;
        line-height: 1.55;
      }
      .cs-section-body { font-family: var(--font-body); }

      /* Rich text */
      .cs-richtext {
        font-family: var(--font-body);
        font-size: 14.5px;
        color: var(--ink);
        line-height: 1.7;
      }
      .cs-richtext p { margin: 0 0 12px; }
      .cs-richtext p:last-child { margin: 0; }
      .cs-richtext ul, .cs-richtext ol { margin: 0 0 12px; padding-left: 22px; }
      .cs-richtext li { margin-bottom: 4px; }
      .cs-richtext a { color: var(--ink); border-bottom: 1px solid var(--ink-3); }
      .cs-richtext code {
        font-family: var(--font-mono);
        font-size: 12.5px;
        background: var(--paper-warm);
        padding: 1px 5px;
        border-radius: 2px;
      }
      .cs-richtext blockquote {
        border-left: 2px solid var(--ink-line);
        padding-left: 16px;
        color: var(--ink-2);
        font-style: italic;
        margin: 0 0 12px;
      }

      /* Children grid */
      .cs-children-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
      .cs-child-card {
        display: block;
        padding: 12px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        text-decoration: none;
        color: inherit;
        transition: background var(--transition-fast), border-color var(--transition-fast);
      }
      .cs-child-card:hover { background: var(--paper-soft); border-color: var(--ink-3); }
      .cs-child-name {
        font-family: var(--font-body);
        font-size: 13.5px;
        font-weight: 600;
        color: var(--ink);
      }
      .cs-child-type {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
        margin-top: 2px;
      }

      /* Inline relationship adder */
      .cs-add-rel {
        position: relative;
        margin-bottom: 18px;
      }
      .cs-add-rel-row {
        display: flex;
        gap: 8px;
        align-items: stretch;
        flex-wrap: wrap;
      }
      .cs-add-rel-search {
        flex: 1;
        min-width: 220px;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 34px;
        padding: 0 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        color: var(--ink-3);
        transition: border-color var(--transition-fast);
      }
      .cs-add-rel-search:focus-within { border-color: var(--ink-2); color: var(--ink); }
      .cs-add-rel-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
        min-width: 0;
      }
      .cs-add-rel-input::placeholder { color: var(--ink-3); }
      .cs-add-rel-selected {
        flex: 1;
        min-width: 220px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 34px;
        padding: 0 10px;
        background: var(--concept-tint);
        color: var(--concept-2);
        border: 1px solid var(--concept);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 500;
      }
      .cs-add-rel-x {
        background: transparent;
        border: none;
        padding: 4px;
        color: inherit;
        opacity: 0.7;
        cursor: pointer;
        margin-left: auto;
        display: inline-flex;
        align-items: center;
      }
      .cs-add-rel-x:hover { opacity: 1; }

      .cs-add-rel-results {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        max-width: 480px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-md);
        max-height: 280px;
        overflow-y: auto;
        z-index: 20;
        padding: 4px 0;
      }
      .cs-add-rel-result {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        text-align: left;
        cursor: pointer;
        font-family: var(--font-body);
        color: var(--ink);
      }
      .cs-add-rel-result:hover { background: var(--paper-soft); }
      .cs-add-rel-result-label {
        display: block;
        font-size: 13px;
        font-weight: 500;
      }
      .cs-add-rel-result-type {
        display: block;
        font-size: 11px;
        color: var(--ink-3);
        margin-top: 1px;
      }
      .cs-add-rel-create {
        border-top: 1px solid var(--ink-line-soft);
        background: var(--paper-soft);
      }
      .cs-add-rel-create:hover { background: var(--paper-warm); }
      .cs-add-rel-create:disabled { opacity: 0.7; cursor: wait; }
      .cs-add-rel-create-icon {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--ink);
        color: var(--paper);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono);
        font-size: 12px;
        font-weight: 500;
        flex-shrink: 0;
      }
      .cs-add-rel-create em {
        font-family: var(--font-display);
        font-style: italic;
        color: var(--ink);
      }

      /* Rel type picker */
      .cs-reltype { position: relative; }
      .cs-reltype-trigger {
        min-height: 34px;
        max-width: 100%;
        padding: 6px 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        text-align: left;
        white-space: normal;
        line-height: 1.35;
      }
      .cs-reltype-trigger strong { color: var(--ink); font-weight: 600; }
      .cs-reltype-trigger:hover { border-color: var(--ink-3); }
      .cs-reltype-caret { color: var(--ink-3); margin-left: 6px; font-size: 9px; }
      .cs-reltype-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        min-width: 320px;
        max-width: 480px;
        max-height: 440px;
        overflow-y: auto;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-md, 0 12px 32px rgba(15, 23, 35, 0.14));
        z-index: 20;
        padding: 0 0 4px;
      }
      .cs-reltype-hint {
        font-family: var(--font-body);
        font-size: 11.5px;
        line-height: 1.5;
        color: var(--ink-3);
        background: var(--paper-soft);
        padding: 8px 14px;
        border-bottom: 1px solid var(--ink-line);
      }
      .cs-reltype-hint strong { color: var(--ink); font-weight: 600; }
      .cs-reltype-group + .cs-reltype-group { border-top: 1px solid var(--ink-line-soft); margin-top: 4px; padding-top: 4px; }
      .cs-reltype-group-label {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 8px 14px 4px;
      }
      .cs-reltype-item {
        display: block;
        width: 100%;
        text-align: left;
        padding: 6px 14px;
        background: transparent;
        border: none;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        white-space: normal;
        line-height: 1.45;
      }
      .cs-reltype-item strong { color: var(--ink); font-weight: 600; }
      .cs-reltype-item .cs-reltype-verb {
        color: var(--concept-2);
        font-style: italic;
      }
      .cs-reltype-item .cs-reltype-target {
        color: var(--ink);
      }
      .cs-reltype-item:hover { background: var(--paper-soft); color: var(--ink); }
      .cs-reltype-item:hover strong { color: var(--ink); }
      .cs-reltype-item.is-selected { background: var(--concept-tint); color: var(--ink); }
      .cs-reltype-item.is-selected strong { color: var(--concept); }

      /* Suggest panel */
      .cs-suggest {
        margin-bottom: 18px;
      }
      .cs-suggest-trigger-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .cs-suggest-trigger {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 32px;
        padding: 0 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink-2);
        cursor: pointer;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .cs-suggest-trigger:hover:not(:disabled) {
        background: var(--paper-warm);
        color: var(--ink);
        border-color: var(--ink-3);
      }
      .cs-suggest-trigger:disabled { opacity: 0.7; cursor: wait; }
      .cs-suggest-status {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
      }

      .cs-suggest-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 12px;
      }
      .cs-suggest-card {
        background: var(--concept-tint);
        border: 1px solid var(--concept);
        border-radius: var(--r-md);
        padding: 14px 16px;
      }
      .cs-suggest-sentence {
        font-family: var(--font-display);
        font-size: 16px;
        line-height: 1.45;
        color: var(--concept-2);
        margin-bottom: 4px;
        letter-spacing: -0.005em;
      }
      .cs-suggest-focal {
        font-weight: 400;
        opacity: 0.8;
      }
      .cs-suggest-target-link {
        font-weight: 600;
        color: var(--concept-2);
        text-decoration: none;
        border-bottom: 1px solid transparent;
      }
      .cs-suggest-target-link:hover { border-color: var(--concept-2); }
      .cs-suggest-verb {
        font-family: var(--font-body);
        font-size: 13.5px;
        font-weight: 400;
        color: var(--concept-2);
        opacity: 0.85;
        margin: 0 6px;
      }
      .cs-suggest-target-type {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--concept-2);
        opacity: 0.65;
        text-transform: capitalize;
        margin-left: 6px;
      }
      .cs-suggest-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .cs-suggest-row .cs-suggest-sentence { flex: 1; min-width: 0; margin-bottom: 0; }
      .cs-suggest-vote {
        display: inline-flex;
        gap: 2px;
        flex-shrink: 0;
        margin-top: -2px;
      }
      .cs-vote-btn {
        width: 28px;
        height: 28px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        color: var(--ink-3);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .cs-vote-btn:hover:not(:disabled) {
        background: var(--paper);
        border-color: var(--ink-line);
      }
      .cs-vote-btn:disabled { opacity: 0.6; cursor: wait; }
      .cs-vote-up:hover:not(:disabled) { color: var(--concept); }
      .cs-vote-down:hover:not(:disabled) { color: var(--ink); }
      .cs-suggest-reason {
        font-family: var(--font-display);
        font-size: 13px;
        font-style: italic;
        color: var(--concept-2);
        line-height: 1.55;
        margin: 4px 0 0;
        opacity: 0.85;
      }

      @keyframes cs-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

      /* Tile grid (used for relationships, sources, people, notes) */
      .cs-tile-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
      .cs-tile {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        text-decoration: none;
        color: inherit;
        min-width: 0;
        transition: background var(--transition-fast), border-color var(--transition-fast);
      }
      .cs-tile:hover { background: var(--paper-soft); border-color: var(--ink-3); }
      .cs-tile .cs-list-dot { margin-top: 5px; flex-shrink: 0; }
      .cs-tile-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
      .cs-tile-title {
        font-family: var(--font-body);
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink);
        line-height: 1.35;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cs-tile-meta {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        margin-top: 2px;
        text-transform: capitalize;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cs-tile-delete {
        background: transparent;
        border: none;
        padding: 4px;
        color: var(--ink-4);
        cursor: pointer;
        opacity: 0;
        flex-shrink: 0;
        align-self: center;
        border-radius: var(--r-sm);
      }
      .cs-tile:hover .cs-tile-delete { opacity: 1; }
      .cs-tile-delete:hover { color: var(--error); background: var(--paper); }

      /* Relationships group container */
      .cs-rels-empty {
        padding: 18px;
        text-align: center;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        background: var(--paper-soft);
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-md);
      }
      .cs-rels {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .cs-rel-group {
      }
      .cs-rel-group-label {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 10.5px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .cs-rel-group-focal,
      .cs-rel-group-verb {
        font-weight: 600;
        color: var(--ink-3);
      }
      /* Category dot (used in tiles + suggest cards) */
      .cs-list-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-3);
        flex-shrink: 0;
      }
      .cs-list-dot.is-concept { background: var(--concept); }
      .cs-list-dot.is-source  { background: var(--source); }
      .cs-list-dot.is-person  { background: var(--person); }

      /* ---------- 2-column layout for owned-pack pages ---------- */
      .cs-2col {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        gap: 40px;
        align-items: start;
        margin-top: 24px;
      }
      .cs-2col-main { min-width: 0; }
      .cs-2col-side {
        position: sticky;
        top: 24px;
        align-self: start;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding-left: 22px;
        border-left: 1px solid var(--ink-line);
      }
      /* Sidebar stats — compact 2x2 grid of at-a-glance counts. */
      .cs-side-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 16px;
        padding-bottom: 18px;
        border-bottom: 1px solid var(--ink-line);
      }
      .cs-side-stat { display: flex; flex-direction: column; gap: 2px; }
      .cs-side-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--concept);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
      }
      .cs-side-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      /* Compress the relationship category blocks when nested inside the
         sidebar's "Relationships" SidebarBlock — strip the outer card chrome
         (already provided by the parent) and tighten typography for the
         narrower 360px column. */
      .cs-side-rel-charts { margin-top: 8px; display: flex; flex-direction: column; gap: 14px; }
      .cs-side-rel-charts .cs-rel-block {
        background: transparent;
        border: none;
        padding: 0;
      }
      .cs-side-rel-charts .cs-rel-block-title {
        font-size: 10px;
        margin: 0 0 6px;
        color: var(--ink-3);
      }
      .cs-side-rel-charts .cs-rel-block-hint {
        font-size: 11px;
        margin: -2px 0 8px;
      }
      .cs-side-rel-charts .cs-rel-row { font-size: 12px; }
      .cs-side-rel-charts .cs-rel-verb { font-size: 12px; }
      .cs-side-rel-charts .cs-tree-node { font-size: 12px; padding: 4px 9px; }
      .cs-side-rel-charts .cs-pos-glyph { font-size: 12px; width: 14px; }

      /* When the inline adder lives in the narrow sidebar, force its row to
         wrap and let the full-sentence rel-type trigger break onto its own
         line so nothing gets clipped. */
      .cs-side-adder { display: flex; flex-direction: column; gap: 10px; }
      .cs-side-adder .cs-add-rel-row { flex-wrap: wrap; gap: 6px; }
      .cs-side-adder .cs-add-rel-search,
      .cs-side-adder .cs-add-rel-selected { flex: 1 1 100%; min-width: 0; }
      .cs-side-adder .cs-reltype { flex: 1 1 100%; }
      .cs-side-adder .cs-reltype-trigger { width: 100%; }
      .cs-side-adder .cs-reltype-menu {
        right: auto;
        left: 0;
        min-width: 280px;
        max-width: 320px;
      }
      .cs-side-adder .cs-add-rel-row > .sp-action,
      .cs-side-adder .cs-add-rel-row > button { width: 100%; }
      .cs-side-adder .cs-add-rel-results { left: 0; right: 0; }

      /* Sidebar blocks */
      .cs-side-block { display: flex; flex-direction: column; gap: 6px; }
      .cs-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .cs-side-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .cs-side-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .cs-side-sub {
        margin: 0;
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }
      .cs-side-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .cs-side-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .cs-side-name {
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink);
        text-decoration: none;
        line-height: 1.4;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cs-side-name:hover { color: var(--concept-2); }
      .cs-side-meta {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--ink-3);
        white-space: nowrap;
      }
      .cs-side-key { color: var(--source-2); }
      .cs-side-rel-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .cs-side-rel-cat {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .cs-side-rel-cat-label {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--concept-2);
      }
      .cs-side-rel-others {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-2);
        line-height: 1.4;
      }
      .cs-side-rel-more { color: var(--ink-3); }
      .cs-side-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .cs-side-chip {
        display: inline-block;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-2);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        padding: 1px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
      }
      a.cs-side-chip:hover { background: var(--concept-tint); color: var(--concept-2); border-color: var(--concept); }

      /* User annotations layered below the pack article */
      .cs-annotations {
        margin-top: 36px;
        padding-top: 28px;
        border-top: 1px solid var(--ink-line);
      }
      .cs-annotations-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 12px;
      }
      .cs-annotations-eyebrow {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .cs-annotations-sub {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-4);
        font-style: italic;
      }
      .cs-annotations .cs-article { margin-top: 0; }

      /* Pack article attribution at the foot */
      .cs-article-attribution {
        margin-top: 24px;
        padding-top: 14px;
        border-top: 1px solid var(--ink-line-soft);
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        font-style: italic;
      }

      @media (max-width: 980px) {
        .cs-2col { grid-template-columns: 1fr; gap: 28px; }
        .cs-2col-side {
          position: static;
          max-height: none;
          padding-left: 0;
          border-left: none;
          padding-top: 24px;
          border-top: 1px solid var(--ink-line);
        }
      }

      /* ---------- Wiki-style article (long-form fields + Description) ---------- */
      .cs-article {
        max-width: 720px;
        margin: 32px 0;
      }
      .cs-article-section {
        margin-bottom: 28px;
      }
      .cs-article-section:last-child { margin-bottom: 0; }
      .cs-article-section + .cs-article-section {
        padding-top: 22px;
        border-top: 1px solid var(--ink-line-soft);
      }
      .cs-article-heading {
        font-family: var(--font-display);
        font-size: 19px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.005em;
        line-height: 1.25;
        margin: 0 0 10px;
      }
      .cs-article-text {
        font-family: var(--font-display);
        font-size: 15.5px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 0;
        white-space: pre-wrap;
      }
      /* Rich-text inside article reads at the same scale */
      .cs-article-section .cs-richtext {
        font-family: var(--font-display);
        font-size: 15.5px;
        line-height: 1.7;
        color: var(--ink-2);
      }
      .cs-article-section .cs-richtext p {
        margin: 0 0 12px;
      }
      .cs-article-section .cs-richtext p:last-child { margin: 0; }

      /* ---------- Hero stats row ---------- */
      .cs-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 28px;
        margin: 18px 0 0;
        padding: 0;
      }
      .cs-stat { display: flex; flex-direction: column; gap: 2px; margin: 0; }
      .cs-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .cs-stat-value {
        font-family: var(--font-display);
        font-size: 24px;
        font-weight: 600;
        color: var(--concept);
        font-variant-numeric: tabular-nums;
        margin: 0;
      }

      /* ---------- Key Authors grid ---------- */
      .cs-author-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }
      .cs-author-card {
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
      .cs-author-card:hover {
        border-color: var(--person);
        transform: translateY(-1px);
      }
      .cs-author-name {
        font-family: var(--font-display);
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink);
      }
      .cs-author-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .cs-author-role {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--person-2);
        font-weight: 600;
      }
      .cs-author-aff {
        color: var(--ink-2);
      }
      .cs-author-count {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        margin-top: 4px;
      }

      /* ---------- Top Sources list ---------- */
      .cs-source-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .cs-source-row {
        padding: 10px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        transition: border-color 0.12s;
      }
      .cs-source-row:hover { border-color: var(--source); }
      .cs-source-row.is-key {
        border-color: color-mix(in srgb, var(--source) 50%, var(--ink-line));
        background: color-mix(in srgb, var(--source-tint) 35%, var(--paper));
      }
      .cs-source-title {
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 500;
        color: var(--ink);
        line-height: 1.35;
        text-decoration: none;
      }
      .cs-source-title:hover { color: var(--source-2); }
      .cs-source-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        margin-top: 4px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        align-items: baseline;
      }
      .cs-source-key {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
        color: var(--source);
        background: var(--source-tint);
        padding: 1px 8px;
        border-radius: var(--r-sm);
      }
      .cs-source-year {
        font-family: var(--font-mono);
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .cs-source-kind {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--source-2);
      }
      .cs-source-journal { font-style: italic; }
      .cs-source-notes { color: var(--ink-2); }
      .cs-source-marker {
        font-size: 11px;
        color: var(--ink-2);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        padding: 1px 8px;
        border-radius: var(--r-sm);
      }

      /* ---------- Contextual Notes list ---------- */
      .cs-note-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cs-note-row {
        padding: 12px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .cs-note-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }
      .cs-note-title {
        font-family: var(--font-display);
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink);
        text-decoration: none;
      }
      .cs-note-title:hover { color: var(--concept-2); }
      .cs-note-type {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--concept-2);
        font-weight: 600;
      }
      .cs-note-preview {
        margin: 6px 0 4px;
        font-size: 12.5px;
        line-height: 1.55;
        color: var(--ink-2);
      }
      .cs-note-source {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .cs-note-source a { color: var(--source-2); text-decoration: none; }
      .cs-note-source a:hover { text-decoration: underline; }

      /* ---------- Relationship category blocks ---------- */
      .cs-rel-by-cat {
        display: flex;
        flex-direction: column;
        gap: 22px;
        margin-bottom: 16px;
      }
      .cs-rel-block {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 14px 18px;
      }
      .cs-rel-block-title {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin: 0 0 10px;
      }
      .cs-rel-block-hint {
        font-size: 12.5px;
        color: var(--ink-3);
        margin: -6px 0 10px;
      }

      /* Verb-grouped lists used by Lineage / Semantic / Clinical / Other */
      .cs-rel-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cs-rel-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
        font-family: var(--font-body);
        font-size: 13.5px;
        line-height: 1.55;
      }
      .cs-rel-verb {
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--concept);
        white-space: nowrap;
      }
      .cs-rel-others {
        color: var(--ink-2);
        flex: 1;
        min-width: 0;
      }
      .cs-rel-link {
        color: var(--ink);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: color 0.12s, border-color 0.12s;
      }
      .cs-rel-link:hover {
        color: var(--concept-2);
        border-color: var(--concept);
      }
      .cs-rel-sep { color: var(--ink-3); }

      /* Inline delete affordance — shows on hover on desktop, always visible
         on touch devices.  One pattern for every category block. */
      .cs-rel-other {
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
      }
      .cs-rel-x {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-left: 2px;
        background: transparent;
        border: none;
        border-radius: 999px;
        color: var(--ink-3);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.12s, background 0.12s, color 0.12s;
      }
      .cs-rel-other:hover .cs-rel-x,
      .cs-rel-x:focus-visible {
        opacity: 1;
      }
      .cs-rel-x:hover {
        background: rgba(122, 46, 46, 0.08);
        color: var(--error);
      }
      @media (hover: none) {
        .cs-rel-x { opacity: 0.7; }
      }
      .cs-tree-node-wrap {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .cs-tree-node-wrap:hover .cs-rel-x { opacity: 1; }

      /* Hierarchy tree */
      .cs-tree {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
      }
      .cs-tree-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        max-width: 100%;
      }
      .cs-tree-axis {
        color: var(--ink-line);
        line-height: 0;
      }
      .cs-tree-node {
        display: inline-block;
        padding: 6px 12px;
        font-family: var(--font-display);
        font-size: 13.5px;
        font-weight: 500;
        color: var(--ink);
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        transition: border-color 0.12s, background 0.12s, color 0.12s;
        white-space: nowrap;
      }
      .cs-tree-node:hover { border-color: var(--concept); color: var(--concept-2); }
      .cs-tree-node.is-parent { background: var(--paper); }
      .cs-tree-node.is-focal {
        background: var(--concept);
        color: var(--paper);
        border-color: var(--concept);
        font-weight: 600;
      }
      .cs-tree-node.is-child { background: var(--paper); }

      /* Positional block — extra glyph column */
      .cs-pos-list { gap: 4px; }
      .cs-pos-row { gap: 10px; }
      .cs-pos-glyph {
        font-family: var(--font-mono);
        font-size: 14px;
        color: var(--concept-2);
        width: 18px;
        text-align: center;
        flex-shrink: 0;
      }

      /* ---------- Show-as-list collapsed area for Relationships ---------- */
      .cs-rel-list-toggle {
        margin-top: 14px;
        font-size: 12.5px;
      }
      .cs-rel-list-toggle > summary {
        cursor: pointer;
        color: var(--ink-3);
        font-family: var(--font-body);
        list-style: none;
        padding: 4px 0;
        user-select: none;
      }
      .cs-rel-list-toggle > summary::-webkit-details-marker { display: none; }
      .cs-rel-list-toggle > summary::before {
        content: '▸ ';
        color: var(--ink-3);
      }
      .cs-rel-list-toggle[open] > summary::before { content: '▾ '; }
      .cs-rel-list-toggle > summary:hover { color: var(--ink); }

      @media (max-width: 600px) {
        .cs-shell { padding: 18px 16px 56px; }
        .cs-hero-title { font-size: 30px; }
        .cs-hero-summary { font-size: 15px; }
        .cs-stats { gap: 18px; }
        .cs-stat-value { font-size: 20px; }
        .cs-add-rel-search, .cs-add-rel-selected { min-width: 0; flex: 1; }
        .cs-rel-delete { opacity: 1; }
        .cs-rel-block { padding: 12px 14px; }
        .cs-rel-row { font-size: 12.5px; }
        .cs-tree-node { font-size: 12.5px; padding: 5px 10px; }
      }
    `}</style>
  );
}
