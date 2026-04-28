import React, { useState, useEffect, useMemo } from 'react';
import ConceptRelationshipMap from './ConceptRelationshipMap';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import PersonFormModal from './PersonFormModal';
import NoteFormModal from './NoteFormModal';
import TagFormModal from './TagFormModal';

// =====================================================================
// Dashboard
// Authenticated landing surface.  Shows primary entity counts, secondary
// stats, quick add actions, and the concept relationship map.
// =====================================================================

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [conceptsRes, sourcesRes, peopleRes, connectionsRes, notesRes, tagsRes, collectionsRes, meRes] = await Promise.all([
        fetch('/concepts.json'),
        fetch('/sources.json'),
        fetch('/people.json'),
        fetch('/connections.json'),
        fetch('/notes.json'),
        fetch('/tags.json'),
        fetch('/collections.json'),
        fetch('/users/me.json'),
      ]);
      const [concepts, sourcesData, people, connections, notes, tags, collectionsData, me] = await Promise.all([
        conceptsRes.json(),
        sourcesRes.json(),
        peopleRes.json(),
        connectionsRes.json(),
        notesRes.json(),
        tagsRes.json(),
        collectionsRes.json(),
        meRes.json().catch(() => ({})),
      ]);

      const sources = Array.isArray(sourcesData) ? sourcesData : (sourcesData.sources || []);
      const sourcesTotal = sourcesData.pagination?.total_count ?? sources.length;
      const sourcesPdfCount = sourcesData.filters?.pdf_count ?? sources.filter((s) => s.pdf_url).length;
      const collections = Array.isArray(collectionsData) ? collectionsData : (collectionsData.collections || collectionsData || []);
      const generationsUnlimited = !!me?.concept_generations?.unlimited;
      const generationsRemaining = generationsUnlimited
        ? '∞'
        : (me?.concept_generations?.remaining ?? 0);
      const generationLimit = generationsUnlimited
        ? null
        : (me?.concept_generations?.limit ?? 0);

      // Sources with the most recently added note.  Group notes by source,
      // keep each source's latest note, sort sources by that timestamp.
      const sourcesById = new Map(sources.map((s) => [s.id, s]));
      const latestNoteBySource = new Map();
      notes.forEach((n) => {
        if (!n.source_id) return;
        const ts = n.created_at || n.updated_at;
        if (!ts) return;
        const existing = latestNoteBySource.get(n.source_id);
        if (!existing || new Date(ts) > new Date(existing.created_at || existing.updated_at)) {
          latestNoteBySource.set(n.source_id, n);
        }
      });
      const sourcesWithRecentNotes = Array.from(latestNoteBySource.entries())
        .map(([sourceId, note]) => ({ source: sourcesById.get(sourceId), note }))
        .filter((row) => row.source)
        .sort((a, b) =>
          new Date(b.note.created_at || b.note.updated_at) -
          new Date(a.note.created_at || a.note.updated_at)
        )
        .slice(0, 5);

      // Collections sorted by their most recent update.
      const recentCollections = (Array.isArray(collections) ? [...collections] : [])
        .sort((a, b) => {
          const ta = new Date(a.updated_at || a.created_at || 0);
          const tb = new Date(b.updated_at || b.created_at || 0);
          return tb - ta;
        })
        .slice(0, 5);

      // Sources sorted by import date (most recent first).
      const recentSources = [...sources]
        .sort((a, b) =>
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
        )
        .slice(0, 5);

      // To-do notes (note_type === 'todo'), pinned first, then most recent.
      const todoNotes = notes
        .filter((n) => (n.note_type || n.type) === 'todo')
        .sort((a, b) => {
          if (!!a.pinned !== !!b.pinned) return b.pinned ? 1 : -1;
          return (
            new Date(b.created_at || b.updated_at || 0) -
            new Date(a.created_at || a.updated_at || 0)
          );
        })
        .slice(0, 5)
        .map((n) => ({
          ...n,
          source: n.source_id ? sourcesById.get(n.source_id) : null,
        }));

      setStats({
        totalConcepts: concepts.length,
        totalSources: sourcesTotal,
        totalPeople: people.length,
        totalConnections: connections.length,
        totalNotes: notes.length,
        totalTags: tags.length,
        totalCollections: Array.isArray(collections) ? collections.length : 0,
        totalPdfs: sourcesPdfCount,
        generationsRemaining,
        generationLimit,
        generationsUnlimited,
        plan: me?.plan || 'free',
        pinnedNotes: notes.filter((n) => n.pinned).length,
        sourcesWithRecentNotes,
        recentSources,
        recentCollections,
        todoNotes,
      });
      setLoading(false);
    } catch (err) {
      console.error('Dashboard data error:', err);
      setError('We could not load your dashboard.  Try refreshing the page.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dash-loading">
        <DashStyles />
        Loading.
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-error">
        <DashStyles />
        {error}
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="dash">
      <DashStyles />

      <header className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">{formatLongDate(today)}</p>
        </div>
        <div className="dash-header-actions">
          <button type="button" className="sp-action sp-action-secondary" onClick={() => setShowSourceModal(true)}>
            <span className="dash-plus" aria-hidden="true">+</span> Source
          </button>
          <button type="button" className="sp-action sp-action-primary" onClick={() => setShowConceptModal(true)}>
            <span className="dash-plus" aria-hidden="true">+</span> Concept
          </button>
        </div>
      </header>

      <section className="dash-kpi-row">
        <DashKPI
          label="Sources"
          value={stats.totalSources}
          category="source"
          link="/sources"
          onAdd={() => setShowSourceModal(true)}
        />
        <DashKPI
          label="Concepts"
          value={stats.totalConcepts}
          category="concept"
          link="/concepts"
          onAdd={() => setShowConceptModal(true)}
        />
        <DashKPI
          label="People"
          value={stats.totalPeople}
          category="person"
          link="/people"
          onAdd={() => setShowPersonModal(true)}
        />
        <DashKPI
          label="Notes"
          value={stats.totalNotes}
          link="/notes"
          onAdd={() => setShowNoteModal(true)}
        />
      </section>

      <section className="dash-secondary">
        <DashStat label="Tags" value={stats.totalTags} link="/tags" onAdd={() => setShowTagModal(true)} />
        <DashStat label="Collections" value={stats.totalCollections} link="/collections" />
        <DashStat label="PDFs" value={stats.totalPdfs} link="/sources?has_pdf=1" />
        <DashStat label="Pinned notes" value={stats.pinnedNotes} link="/notes?pinned=1" />
        <DashStat label="Connections" value={stats.totalConnections} link="/connections" />
        <DashStat
          label="Generations left"
          value={stats.generationsUnlimited ? '∞' : stats.generationsRemaining}
          suffix={stats.generationsUnlimited ? 'unlimited' : (stats.generationLimit ? `/ ${stats.generationLimit}` : null)}
          link="/subscription"
        />
      </section>

      <section className="dash-recent">
        <div className="dash-recent-grid">
          <RecentPanel
            title="Recently added sources"
            empty="No sources yet.  Paste a DOI to import your first."
            items={stats.recentSources}
            renderItem={(s) => (
              <a key={s.id} href={`/sources/${s.id}`} className="dash-recent-row">
                <div className="dash-recent-row-head">
                  <span className="dash-recent-row-title">{s.title || 'Untitled source'}</span>
                  <span className="dash-recent-row-time">{timeAgo(s.created_at)}</span>
                </div>
                <div className="dash-recent-row-meta">{sourceByline(s)}</div>
              </a>
            )}
            footer={<a href="/sources" className="dash-recent-footer-link">All sources →</a>}
          />

          <RecentPanel
            title="Sources with recent notes"
            empty="No notes yet.  Highlight a passage in any source to start."
            items={stats.sourcesWithRecentNotes}
            renderItem={(row) => (
              <a key={row.source.id} href={`/sources/${row.source.id}`} className="dash-recent-row">
                <div className="dash-recent-row-head">
                  <span className="dash-recent-row-title">{row.source.title || 'Untitled source'}</span>
                  <span className="dash-recent-row-time">{timeAgo(row.note.created_at || row.note.updated_at)}</span>
                </div>
                <div className="dash-recent-row-meta">
                  {sourceByline(row.source)}
                </div>
                {noteSnippet(row.note) && (
                  <div className="dash-recent-row-snippet">{noteSnippet(row.note)}</div>
                )}
              </a>
            )}
            footer={<a href="/notes" className="dash-recent-footer-link">All notes →</a>}
          />

          <RecentPanel
            title="Recent collections"
            empty="No collections yet.  Group your sources into projects (Thesis Ch. 3, DSM-5 review)."
            items={stats.recentCollections}
            renderItem={(c) => (
              <a key={c.id} href={`/collections/${c.id}`} className="dash-recent-row">
                <div className="dash-recent-row-head">
                  <span className="dash-recent-row-title">{c.name || c.title || 'Untitled collection'}</span>
                  <span className="dash-recent-row-time">{timeAgo(c.updated_at || c.created_at)}</span>
                </div>
                <div className="dash-recent-row-meta">
                  {collectionMeta(c)}
                </div>
              </a>
            )}
            footer={<a href="/collections" className="dash-recent-footer-link">All collections →</a>}
          />

          <RecentPanel
            title="To-do notes"
            empty='No to-dos yet.  Set a note&rsquo;s type to "to-do" when you want to come back to it.'
            items={stats.todoNotes}
            renderItem={(n) => (
              <a key={n.id} href={`/notes/${n.id}`} className="dash-recent-row">
                <div className="dash-recent-row-head">
                  <span className="dash-recent-row-title">
                    {n.pinned && <span className="dash-recent-pin" aria-label="Pinned">●</span>}
                    {noteSnippet(n) || 'Untitled to-do'}
                  </span>
                  <span className="dash-recent-row-time">{timeAgo(n.created_at || n.updated_at)}</span>
                </div>
                {n.source && (
                  <div className="dash-recent-row-meta">on {n.source.title || 'a source'}</div>
                )}
              </a>
            )}
            footer={<a href="/notes?note_type=todo" className="dash-recent-footer-link">All to-dos →</a>}
          />
        </div>
      </section>

      <section className="dash-map">
        <ConceptRelationshipMap />
      </section>

      <ConceptFormModal isOpen={showConceptModal} onClose={() => setShowConceptModal(false)} onSuccess={() => { fetchDashboardData(); setShowConceptModal(false); }} />
      <SourceFormModal  isOpen={showSourceModal}  onClose={() => setShowSourceModal(false)}  onSuccess={() => { fetchDashboardData(); setShowSourceModal(false); }} />
      <PersonFormModal  isOpen={showPersonModal}  onClose={() => setShowPersonModal(false)}  onSuccess={() => { fetchDashboardData(); setShowPersonModal(false); }} />
      <NoteFormModal    isOpen={showNoteModal}    onClose={() => setShowNoteModal(false)}    onSuccess={() => { fetchDashboardData(); setShowNoteModal(false); }} />
      <TagFormModal     isOpen={showTagModal}     onClose={() => setShowTagModal(false)}     onSuccess={() => { fetchDashboardData(); setShowTagModal(false); }} />
    </div>
  );
}

// ---- Subcomponents ----

function DashKPI({ label, value, category, link, onAdd }) {
  const eyebrowClass = category ? `dash-kpi-eyebrow is-${category}` : 'dash-kpi-eyebrow';
  return (
    <div className="dash-kpi">
      <a href={link} className="dash-kpi-link">
        <div className={eyebrowClass}>{label}</div>
        <div className="dash-kpi-value">{Number(value).toLocaleString()}</div>
      </a>
      {onAdd && (
        <button
          type="button"
          className="dash-kpi-add"
          onClick={onAdd}
          aria-label={`Add ${singularize(label).toLowerCase()}`}
          title={`Add ${singularize(label).toLowerCase()}`}
        >
          +
        </button>
      )}
    </div>
  );
}

function DashStat({ label, value, suffix, link, onAdd }) {
  const content = (
    <>
      <span className="dash-stat-value">{Number(value).toLocaleString()}{suffix ? <span className="dash-stat-suffix"> {suffix}</span> : null}</span>
      <span className="dash-stat-label">{label}</span>
    </>
  );
  return (
    <div className="dash-stat">
      {link ? <a href={link} className="dash-stat-link">{content}</a> : <div className="dash-stat-link">{content}</div>}
      {onAdd && (
        <button
          type="button"
          className="dash-stat-add"
          onClick={onAdd}
          aria-label={`Add ${singularize(label).toLowerCase()}`}
        >
          +
        </button>
      )}
    </div>
  );
}

function RecentPanel({ title, items, renderItem, empty, footer }) {
  return (
    <div className="dash-recent-panel">
      <div className="dash-recent-head">
        <h2 className="dash-recent-title">{title}</h2>
      </div>
      {items && items.length > 0 ? (
        <div className="dash-recent-list">{items.map(renderItem)}</div>
      ) : (
        <div className="dash-recent-empty">{empty}</div>
      )}
      {items && items.length > 0 && footer && (
        <div className="dash-recent-footer">{footer}</div>
      )}
    </div>
  );
}

// ---- Helpers ----

function timeAgo(input) {
  if (!input) return '';
  const ts = new Date(input).getTime();
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 0) return 'just now';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sourceByline(source) {
  if (!source) return '';
  const parts = [];
  if (source.author_names) parts.push(source.author_names);
  else if (Array.isArray(source.authors) && source.authors.length > 0) {
    const names = source.authors.map((a) => a.full_name || a.name).filter(Boolean);
    if (names.length > 0) parts.push(names.slice(0, 2).join(', ') + (names.length > 2 ? ' et al.' : ''));
  }
  if (source.year) parts.push(source.year);
  if (source.journal_name) parts.push(source.journal_name);
  return parts.join(' · ') || (source.kind || '');
}

function noteSnippet(note) {
  if (!note) return '';
  const raw = note.body || note.content || note.text || '';
  if (!raw) return '';
  const stripped = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!stripped) return '';
  return stripped.length > 120 ? stripped.slice(0, 119) + '…' : stripped;
}

function collectionMeta(c) {
  const parts = [];
  const count = c.items_count ?? c.item_count ?? c.count ?? (Array.isArray(c.items) ? c.items.length : null);
  if (count != null) parts.push(`${count} item${count === 1 ? '' : 's'}`);
  if (c.description && parts.length === 0) parts.push(c.description.slice(0, 80));
  return parts.join(' · ') || ' ';
}

function singularize(word) {
  if (!word) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function formatLongDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---- Styles ----

function DashStyles() {
  return (
    <style>{`
      .dash {
        flex: 1;
        background: var(--paper);
        padding: 32px 24px 64px;
      }
      .dash > section { max-width: 1280px; margin-left: auto; margin-right: auto; }

      .dash-loading, .dash-error {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--ink-3);
        padding: 80px 24px;
      }
      .dash-error { color: var(--error); }

      /* Header */
      .dash-header {
        max-width: 1280px;
        margin: 0 auto 32px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .dash-title {
        font-family: var(--font-display);
        font-size: 36px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
      }
      .dash-subtitle {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-3);
        margin: 6px 0 0;
      }
      .dash-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .dash-plus { font-family: var(--font-mono); font-weight: 500; }

      /* KPI row — discrete cards in a 4-column grid */
      .dash-kpi-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        column-gap: 16px;
        row-gap: 20px;
        margin-bottom: 24px;
      }
      .dash-kpi {
        position: relative;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }
      .dash-kpi-link {
        display: block;
        padding: 22px 24px;
        text-decoration: none;
        color: inherit;
      }
      .dash-kpi-link:hover { background: var(--paper-soft); }
      .dash-kpi-eyebrow {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 12px;
      }
      .dash-kpi-eyebrow.is-concept { color: var(--concept); }
      .dash-kpi-eyebrow.is-source  { color: var(--source); }
      .dash-kpi-eyebrow.is-person  { color: var(--person); }
      .dash-kpi-value {
        font-family: var(--font-display);
        font-size: 38px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1;
        font-variant-numeric: lining-nums;
        letter-spacing: -0.01em;
      }
      .dash-kpi-add {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 26px;
        height: 26px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        color: var(--ink-4);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono);
        font-size: 16px;
        font-weight: 500;
        line-height: 1;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .dash-kpi-add:hover {
        background: var(--paper);
        border-color: var(--ink-line);
        color: var(--ink);
      }

      /* Secondary stats — discrete cards in a 6-column grid */
      .dash-secondary {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        column-gap: 12px;
        row-gap: 16px;
        margin-bottom: 32px;
      }
      .dash-stat {
        position: relative;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }
      .dash-stat-link {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 18px;
        text-decoration: none;
        color: inherit;
      }
      a.dash-stat-link:hover { background: var(--paper-soft); }
      .dash-stat-value {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1;
        font-variant-numeric: lining-nums;
        letter-spacing: -0.005em;
      }
      .dash-stat-suffix {
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 400;
        color: var(--ink-3);
      }
      .dash-stat-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .dash-stat-add {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 22px;
        height: 22px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        color: var(--ink-4);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono);
        font-size: 14px;
      }
      .dash-stat-add:hover { background: var(--paper); border-color: var(--ink-line); color: var(--ink); }

      /* Recent activity — locked 2-up so empty panels read evenly */
      .dash-recent { margin-bottom: 24px; }
      .dash-recent-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .dash-recent-panel {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        display: flex;
        flex-direction: column;
        min-height: 220px;
        min-width: 0;
      }
      .dash-recent-head {
        padding: 16px 20px 12px;
        border-bottom: 1px solid var(--ink-line-soft);
      }
      .dash-recent-title {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        letter-spacing: -0.005em;
      }
      .dash-recent-list {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .dash-recent-row {
        display: block;
        padding: 12px 20px;
        text-decoration: none;
        color: inherit;
        border-bottom: 1px solid var(--ink-line-soft);
        transition: background var(--transition-fast);
      }
      .dash-recent-row:last-child { border-bottom: none; }
      .dash-recent-row:hover { background: var(--paper-soft); }
      .dash-recent-row-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 3px;
      }
      .dash-recent-row-title {
        font-family: var(--font-body);
        font-size: 13.5px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.4;
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dash-recent-pin {
        color: var(--concept);
        font-size: 8px;
        margin-right: 6px;
        vertical-align: 2px;
      }
      .dash-recent-row-time {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }
      .dash-recent-row-meta {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        line-height: 1.5;
      }
      .dash-recent-row-snippet {
        font-family: var(--font-display);
        font-size: 12.5px;
        font-style: italic;
        color: var(--ink-2);
        line-height: 1.5;
        margin-top: 4px;
      }
      .dash-recent-empty {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        padding: 20px;
        line-height: 1.55;
      }
      .dash-recent-footer {
        padding: 10px 20px 12px;
        border-top: 1px solid var(--ink-line-soft);
        text-align: right;
      }
      .dash-recent-footer-link {
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-3);
        text-decoration: none;
      }
      .dash-recent-footer-link:hover { color: var(--ink); }

      /* Map panel — ConceptMapRadial brings its own .sp-relationship border */
      .dash-map { margin-top: 8px; }

      /* Responsive */
      @media (max-width: 1024px) {
        .dash-kpi-row { grid-template-columns: repeat(2, 1fr); }
        .dash-secondary { grid-template-columns: repeat(3, 1fr); }
      }
      @media (max-width: 760px) {
        .dash-recent-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 600px) {
        .dash { padding: 20px 16px 48px; }
        .dash-title { font-size: 28px; }
        .dash-kpi-row { grid-template-columns: 1fr; row-gap: 12px; column-gap: 12px; }
        .dash-secondary { grid-template-columns: repeat(2, 1fr); row-gap: 12px; column-gap: 10px; }
        .dash-kpi-value { font-size: 32px; }
      }
    `}</style>
  );
}
