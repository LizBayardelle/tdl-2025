import React, { useState, useMemo, useRef, useEffect } from 'react';

// =====================================================================
// SamplePage
// A self-contained design exploration that demonstrates the brand voice
// in visual form: scholarly, clinical, ink-on-paper, hairline-driven.
// Independent of the rest of the app's chrome and design tokens.
// =====================================================================

export default function SamplePage() {
  const [theme, setTheme] = useState('light');

  return (
    <div className="sp-root" data-theme={theme}>
      <SPStyles />
      <SPTopNav theme={theme} onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
      <div className="sp-shell">
        <SPSidebar />
        <main className="sp-main">
          <SPPageHeader />
          <SPKPIRow />
          <SPSectionDivider label="Activity" />
          <SPChartRow />
          <SPSectionDivider label="Relationships" />
          <SPRelationshipChart />
          <SPSectionDivider label="Sources" />
          <SPTable />
          <SPSectionDivider label="Hierarchy & Capture" />
          <div className="sp-two-col">
            <SPHierarchicalList />
            <SPForm />
          </div>
          <SPSectionDivider label="Components" />
          <SPComponentLibrary />
          <SPSectionDivider label="Color System" />
          <SPColorSystem />
          <SPFooter />
        </main>
      </div>
    </div>
  );
}

// =====================================================================
// Top navigation
// =====================================================================

function SPTopNav({ theme, onToggleTheme }) {
  return (
    <header className="sp-topnav">
      <div className="sp-topnav-left">
        <a className="sp-brand" href="#" onClick={(e) => e.preventDefault()} aria-label="Map My Research home">
          <img src="/logo.png" alt="" className="sp-brand-logo sp-brand-logo-light" width="36" height="36" />
          <img src="/logo-white.png" alt="" className="sp-brand-logo sp-brand-logo-dark" width="36" height="36" />
          <span className="sp-wordmark">
            <span className="sp-wordmark-map">Map</span>
            <span className="sp-wordmark-small">my</span>
            <span className="sp-wordmark-research">Research</span>
          </span>
        </a>
      </div>
      <nav className="sp-topnav-center" aria-label="Primary">
        <a className="sp-topnav-link sp-topnav-link-active" href="#">Library</a>
        <a className="sp-topnav-link" href="#">Concepts</a>
        <a className="sp-topnav-link" href="#">Sources</a>
        <a className="sp-topnav-link" href="#">People</a>
        <a className="sp-topnav-link" href="#">Notes</a>
      </nav>
      <div className="sp-topnav-right">
        <div className="sp-search">
          <SPIcon name="search" size={14} />
          <input
            type="text"
            placeholder="Search the library"
            className="sp-search-input"
          />
          <kbd className="sp-kbd">⌘ K</kbd>
        </div>
        <button className="sp-icon-action" onClick={onToggleTheme} aria-label="Toggle theme">
          <SPIcon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
        </button>
        <div className="sp-avatar">EB</div>
      </div>
    </header>
  );
}

// =====================================================================
// Sidebar — workspace nav + filters with type-to-filter checkboxes
// =====================================================================

function SPSidebar() {
  return (
    <aside className="sp-sidebar">
      <SPSidebarSection label="Workspace">
        <SPSidebarLink icon="folder" label="All sources" count={1284} />
        <SPSidebarLink icon="bookmark" label="Reading list" count={47} />
        <SPSidebarLink icon="pin" label="Pinned" count={12} />
        <SPSidebarLink icon="clock" label="Recently added" count={28} />
      </SPSidebarSection>

      <SPSidebarSection label="Collections">
        <SPSidebarLink icon="dot" label="Thesis chapter 3" count={94} />
        <SPSidebarLink icon="dot" label="DSM-5 review" count={61} active />
        <SPSidebarLink icon="dot" label="Lab meeting · Apr" count={12} />
        <SPSidebarLink icon="plus" label="New collection" muted />
      </SPSidebarSection>

      <SPFilterSection
        label="Source Type"
        options={[
          { value: 'article', label: 'Journal article', count: 812 },
          { value: 'book', label: 'Book', count: 91 },
          { value: 'chapter', label: 'Book chapter', count: 134 },
          { value: 'thesis', label: 'Thesis', count: 22 },
          { value: 'report', label: 'Report', count: 38 },
          { value: 'conference', label: 'Conference paper', count: 67 },
          { value: 'review', label: 'Review article', count: 76 },
          { value: 'website', label: 'Website', count: 44 },
        ]}
        initialChecked={['article', 'review']}
      />

      <SPFilterSection
        label="Concept"
        category="concept"
        options={[
          { value: 'attachment', label: 'Attachment Theory', count: 142 },
          { value: 'cbt', label: 'Cognitive Behavioral Therapy', count: 218 },
          { value: 'anxiety', label: 'Anxiety Disorders', count: 187 },
          { value: 'object-relations', label: 'Object Relations', count: 73 },
          { value: 'iwm', label: 'Internal Working Models', count: 41 },
          { value: 'exposure', label: 'Exposure Therapy', count: 96 },
          { value: 'ssri', label: 'SSRI Treatment', count: 64 },
          { value: 'hpa', label: 'HPA Axis', count: 58 },
        ]}
        initialChecked={['attachment']}
      />
    </aside>
  );
}

function SPSidebarSection({ label, children }) {
  return (
    <div className="sp-sidebar-section">
      <div className="sp-eyebrow">{label}</div>
      <div className="sp-sidebar-list">{children}</div>
    </div>
  );
}

function SPSidebarLink({ icon, label, count, active, muted }) {
  return (
    <a
      href="#"
      className={`sp-sidebar-link ${active ? 'is-active' : ''} ${muted ? 'is-muted' : ''}`}
      onClick={(e) => e.preventDefault()}
    >
      <SPIcon name={icon} size={14} />
      <span className="sp-sidebar-link-label">{label}</span>
      {count != null && <span className="sp-sidebar-link-count">{count.toLocaleString()}</span>}
    </a>
  );
}

function SPFilterSection({ label, options, initialChecked = [], category }) {
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState(new Set(initialChecked));

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  const toggle = (value) => {
    const next = new Set(checked);
    next.has(value) ? next.delete(value) : next.add(value);
    setChecked(next);
  };

  return (
    <div className="sp-sidebar-section">
      <div className="sp-eyebrow sp-eyebrow-filter">
        <span>{label}</span>
        {checked.size > 0 && (
          <button className="sp-eyebrow-clear" onClick={() => setChecked(new Set())}>
            Clear ({checked.size})
          </button>
        )}
      </div>
      <div className="sp-filter-input-wrap">
        <SPIcon name="search" size={12} />
        <input
          type="text"
          className="sp-filter-input"
          placeholder={`Filter ${label.toLowerCase()}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="sp-filter-list">
        {filtered.length === 0 && (
          <div className="sp-filter-empty">No matches.</div>
        )}
        {filtered.map((o) => (
          <label key={o.value} className="sp-filter-row">
            <input
              type="checkbox"
              className="sp-checkbox"
              checked={checked.has(o.value)}
              onChange={() => toggle(o.value)}
            />
            <span className={`sp-filter-row-label ${category ? `is-${category}` : ''}`}>
              {o.label}
            </span>
            <span className="sp-filter-row-count">{o.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Page header
// =====================================================================

function SPPageHeader() {
  return (
    <div className="sp-page-header">
      <div className="sp-breadcrumb">
        <a href="#">Library</a>
        <SPIcon name="chev-right" size={10} />
        <a href="#">DSM-5 review</a>
        <SPIcon name="chev-right" size={10} />
        <span>Overview</span>
      </div>
      <div className="sp-page-header-row">
        <div>
          <h1 className="sp-page-title">DSM-5 Review</h1>
          <p className="sp-page-subtitle">
            61 sources, 18 concepts, 9 contributors.  Last reviewed 6 days ago.
          </p>
        </div>
        <div className="sp-page-actions">
          <button className="sp-action sp-action-secondary">
            <SPIcon name="share" size={13} /> Share
          </button>
          <button className="sp-action sp-action-primary">
            <SPIcon name="plus" size={13} /> Add Source
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// KPI row
// =====================================================================

function SPKPIRow() {
  const kpis = [
    { label: 'Sources', value: 61, delta: '+4 this week', category: 'source' },
    { label: 'Concepts', value: 18, delta: '+2 this week', category: 'concept' },
    { label: 'People', value: 27, delta: 'unchanged', category: 'person' },
    { label: 'Notes', value: 142, delta: '+11 this week', category: null },
  ];
  return (
    <div className="sp-kpi-row">
      {kpis.map((k) => (
        <div key={k.label} className="sp-kpi">
          <div className={`sp-kpi-label ${k.category ? `is-${k.category}` : ''}`}>
            {k.label}
          </div>
          <div className="sp-kpi-value">{k.value}</div>
          <div className="sp-kpi-delta">{k.delta}</div>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// Charts row — reading volume + concept type distribution
// =====================================================================

function SPChartRow() {
  return (
    <div className="sp-chart-row">
      <SPChartCard title="Reading volume" subtitle="Sources added per week, last 26 weeks">
        <SPVolumeChart />
      </SPChartCard>
      <SPChartCard title="Concept distribution" subtitle="By type, weighted by source count">
        <SPDistributionChart />
      </SPChartCard>
    </div>
  );
}

function SPChartCard({ title, subtitle, children }) {
  return (
    <section className="sp-chart-card">
      <div className="sp-chart-card-head">
        <div>
          <h2 className="sp-chart-title">{title}</h2>
          <p className="sp-chart-subtitle">{subtitle}</p>
        </div>
        <button className="sp-icon-action-quiet" aria-label="More">
          <SPIcon name="more" size={14} />
        </button>
      </div>
      <div className="sp-chart-body">{children}</div>
    </section>
  );
}

const VOLUME_DATA = [3, 4, 2, 5, 7, 6, 4, 8, 5, 3, 6, 9, 7, 5, 4, 8, 11, 9, 6, 7, 10, 8, 5, 6, 9, 4];

function SPVolumeChart() {
  const max = Math.max(...VOLUME_DATA);
  const W = 600;
  const H = 160;
  const PAD = { top: 16, right: 8, bottom: 24, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const barW = innerW / VOLUME_DATA.length - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sp-svg" preserveAspectRatio="none">
      {/* y-axis ticks */}
      {[0, max / 2, max].map((v, i) => {
        const y = PAD.top + innerH - (v / max) * innerH;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className="sp-svg-grid" />
            <text x={PAD.left - 6} y={y + 3} className="sp-svg-tick" textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        );
      })}
      {/* bars */}
      {VOLUME_DATA.map((v, i) => {
        const x = PAD.left + i * (innerW / VOLUME_DATA.length) + 2;
        const h = (v / max) * innerH;
        const y = PAD.top + innerH - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} className="sp-bar sp-bar-source" rx="0.5" />;
      })}
      {/* x-axis labels */}
      <text x={PAD.left} y={H - 6} className="sp-svg-tick">26w ago</text>
      <text x={W - PAD.right} y={H - 6} className="sp-svg-tick" textAnchor="end">today</text>
    </svg>
  );
}

const DISTRIBUTION_DATA = [
  { type: 'Intervention', count: 24, category: 'concept' },
  { type: 'Pathology', count: 18, category: 'concept' },
  { type: 'School of thought', count: 12, category: 'concept' },
  { type: 'Measurement', count: 9, category: 'concept' },
  { type: 'Physical entity', count: 6, category: 'concept' },
  { type: 'Symptom', count: 4, category: 'concept' },
];

function SPDistributionChart() {
  const max = Math.max(...DISTRIBUTION_DATA.map((d) => d.count));
  return (
    <div className="sp-bars-h">
      {DISTRIBUTION_DATA.map((d) => (
        <div key={d.type} className="sp-bars-h-row">
          <div className="sp-bars-h-label">{d.type}</div>
          <div className="sp-bars-h-track">
            <div
              className={`sp-bars-h-fill is-${d.category}`}
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <div className="sp-bars-h-value">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// Relationship chart — radial network around a central concept
// =====================================================================

function SPRelationshipChart() {
  const W = 760;
  const H = 460;
  const cx = W / 2;
  const cy = H / 2;

  const central = { label: 'Attachment Theory', type: 'concept' };

  // Inner ring (closely related concepts)
  const inner = [
    { label: 'Internal Working Models', type: 'concept', angle: -90 },
    { label: 'Strange Situation', type: 'concept', angle: -30 },
    { label: 'Bowlby (1969)', type: 'source', angle: 30 },
    { label: 'Ainsworth, M.', type: 'person', angle: 90 },
    { label: 'Mikulincer, M.', type: 'person', angle: 150 },
    { label: 'Object Relations', type: 'concept', angle: 210 },
  ];

  // Outer ring (looser connections)
  const outer = [
    { label: 'Anxious-Avoidant', type: 'concept', angle: -120, parent: 0 },
    { label: 'Secure Base', type: 'concept', angle: -60, parent: 1 },
    { label: 'Ainsworth (1978)', type: 'source', angle: 0, parent: 2 },
    { label: 'Shaver, P.', type: 'person', angle: 60, parent: 3 },
    { label: 'Fonagy, P.', type: 'person', angle: 120, parent: 4 },
    { label: 'Klein, M.', type: 'person', angle: 180, parent: 5 },
  ];

  const innerR = 120;
  const outerR = 200;

  const polar = (r, deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <section className="sp-relationship">
      <div className="sp-relationship-head">
        <div>
          <h2 className="sp-chart-title">Relationship Map</h2>
          <p className="sp-chart-subtitle">Direct and adjacent connections to <em>Attachment Theory</em>.</p>
        </div>
        <div className="sp-legend">
          <span className="sp-legend-item is-concept"><span className="sp-legend-dot" /> Concept</span>
          <span className="sp-legend-item is-source"><span className="sp-legend-dot" /> Source</span>
          <span className="sp-legend-item is-person"><span className="sp-legend-dot" /> Person</span>
        </div>
      </div>

      <div className="sp-relationship-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} className="sp-svg-net">
          {/* concentric guide rings */}
          <circle cx={cx} cy={cy} r={innerR} className="sp-net-ring" />
          <circle cx={cx} cy={cy} r={outerR} className="sp-net-ring" />

          {/* inner spokes */}
          {inner.map((n, i) => {
            const p = polar(innerR, n.angle);
            return (
              <line key={`is-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} className="sp-net-edge" />
            );
          })}

          {/* outer connectors (each outer node connects to its parent inner node) */}
          {outer.map((n, i) => {
            const p = polar(outerR, n.angle);
            const parent = inner[n.parent];
            const pp = polar(innerR, parent.angle);
            return (
              <line key={`os-${i}`} x1={pp.x} y1={pp.y} x2={p.x} y2={p.y} className="sp-net-edge sp-net-edge-faint" />
            );
          })}

          {/* outer nodes */}
          {outer.map((n, i) => {
            const p = polar(outerR, n.angle);
            return <NetNode key={`o-${i}`} x={p.x} y={p.y} type={n.type} label={n.label} size="sm" />;
          })}

          {/* inner nodes */}
          {inner.map((n, i) => {
            const p = polar(innerR, n.angle);
            return <NetNode key={`i-${i}`} x={p.x} y={p.y} type={n.type} label={n.label} size="md" />;
          })}

          {/* central node */}
          <NetNode x={cx} y={cy} type={central.type} label={central.label} size="lg" />
        </svg>
      </div>
    </section>
  );
}

function NetNode({ x, y, type, label, size }) {
  const r = size === 'lg' ? 8 : size === 'md' ? 6 : 4;
  const labelDy = size === 'lg' ? 26 : size === 'md' ? 20 : 16;
  return (
    <g>
      <circle cx={x} cy={y} r={r + 6} className={`sp-net-halo is-${type}`} />
      <circle cx={x} cy={y} r={r} className={`sp-net-node is-${type}`} />
      <text
        x={x}
        y={y + labelDy}
        textAnchor="middle"
        className={`sp-net-label sp-net-label-${size}`}
      >
        {label}
      </text>
    </g>
  );
}

// =====================================================================
// Sources table
// =====================================================================

const SOURCES = [
  { id: '10.1037/0033-2909.131.2.180', title: 'The Other Side of the Coin: Avoidant Attachment as a Buffer', authors: 'Mikulincer, M., & Shaver, P. R.', year: 2007, journal: 'Psychological Bulletin', concepts: ['Attachment Theory', 'Anxious-Avoidant'], notes: 8, status: 'read' },
  { id: '10.1001/jamapsychiatry.2012.0001', title: 'The Efficacy of Cognitive Behavioral Therapy: A Review of Meta-analyses', authors: 'Hofmann, S. G., Asnaani, A., Vonk, I. J. J.', year: 2012, journal: 'Cognitive Therapy and Research', concepts: ['CBT', 'Anxiety Disorders'], notes: 14, status: 'read' },
  { id: '10.1007/s10615-007-0111-7', title: 'Attachment Theory and Affect Regulation: The Dynamics, Development, and Cognitive Consequences', authors: 'Mikulincer, M., Shaver, P. R., Pereg, D.', year: 2003, journal: 'Motivation and Emotion', concepts: ['Attachment Theory', 'IWM'], notes: 6, status: 'reading' },
  { id: '10.1037/0003-066X.46.4.333', title: 'Attachments Beyond Infancy', authors: 'Ainsworth, M. D. S.', year: 1989, journal: 'American Psychologist', concepts: ['Attachment Theory'], notes: 11, status: 'read' },
  { id: '10.1093/oxfordjournals.bjp.bp.107.040907', title: 'Object Relations and the Theory of Mind', authors: 'Fonagy, P., & Target, M.', year: 1996, journal: 'British Journal of Psychiatry', concepts: ['Object Relations'], notes: 4, status: 'unread' },
  { id: '10.1016/S0140-6736(02)08259-3', title: 'Cognitive Therapy for Depression', authors: 'Beck, A. T.', year: 1979, journal: 'The Lancet', concepts: ['CBT'], notes: 9, status: 'read' },
  { id: '10.1177/1745691615590457', title: 'Reconsolidation: Updating the Memory', authors: 'Shaver, P. R., et al.', year: 2015, journal: 'Perspectives on Psychological Science', concepts: ['Exposure Therapy', 'Anxiety Disorders'], notes: 3, status: 'reading' },
];

const STATUS_LABEL = { read: 'Read', reading: 'In progress', unread: 'Unread' };

function SPTable() {
  const [sortKey, setSortKey] = useState('year');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());

  const sorted = useMemo(() => {
    const arr = [...SOURCES];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleRow = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const allChecked = selected.size === sorted.length;
  const someChecked = selected.size > 0 && !allChecked;

  return (
    <section className="sp-table-section">
      <div className="sp-table-head">
        <div>
          <h2 className="sp-chart-title">Sources in this Collection</h2>
          <p className="sp-chart-subtitle">
            {selected.size > 0 ? `${selected.size} selected` : `${sorted.length} sources, sorted by ${sortKey} (${sortDir})`}
          </p>
        </div>
        <div className="sp-table-actions">
          {selected.size > 0 && (
            <>
              <button className="sp-action sp-action-quiet">Tag</button>
              <button className="sp-action sp-action-quiet">Add to collection</button>
              <button className="sp-action sp-action-quiet sp-action-danger">Remove</button>
            </>
          )}
          <button className="sp-icon-action-quiet" aria-label="Filter"><SPIcon name="filter" size={14} /></button>
          <button className="sp-icon-action-quiet" aria-label="Export"><SPIcon name="download" size={14} /></button>
        </div>
      </div>

      <div className="sp-table-wrap">
        <table className="sp-table">
          <thead>
            <tr>
              <th className="sp-th-check">
                <input
                  type="checkbox"
                  className="sp-checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(sorted.map((s) => s.id)))}
                />
              </th>
              <SPTh label="Title" k="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SPTh label="Authors" k="authors" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SPTh label="Year" k="year" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} numeric />
              <SPTh label="Journal" k="journal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th>Concepts</th>
              <SPTh label="Notes" k="notes" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} numeric />
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className={selected.has(s.id) ? 'is-selected' : ''}>
                <td className="sp-td-check">
                  <input
                    type="checkbox"
                    className="sp-checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleRow(s.id)}
                  />
                </td>
                <td className="sp-td-title">
                  <a href="#" className="sp-link" onClick={(e) => e.preventDefault()}>{s.title}</a>
                  <div className="sp-td-doi">{s.id}</div>
                </td>
                <td className="sp-td-people"><span className="sp-text-person">{s.authors}</span></td>
                <td className="sp-td-num">{s.year}</td>
                <td><em className="sp-td-journal">{s.journal}</em></td>
                <td>
                  <div className="sp-chips">
                    {s.concepts.map((c) => (
                      <span key={c} className="sp-chip is-concept">{c}</span>
                    ))}
                  </div>
                </td>
                <td className="sp-td-num">{s.notes}</td>
                <td>
                  <SPStatus status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SPTh({ label, k, sortKey, sortDir, onSort, numeric }) {
  const active = sortKey === k;
  return (
    <th
      className={`sp-th ${numeric ? 'sp-th-num' : ''} ${active ? 'is-active' : ''}`}
      onClick={() => onSort(k)}
    >
      <span>{label}</span>
      {active && <SPIcon name={sortDir === 'asc' ? 'caret-up' : 'caret-down'} size={10} />}
    </th>
  );
}

function SPStatus({ status }) {
  return (
    <span className={`sp-status is-${status}`}>
      <span className="sp-status-dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}

// =====================================================================
// Hierarchical concept tree
// =====================================================================

const CONCEPT_TREE = [
  {
    label: 'Anxiety Disorders',
    type: 'concept',
    count: 187,
    children: [
      {
        label: 'Generalized Anxiety',
        type: 'concept',
        count: 64,
        children: [
          { label: 'Worry models', type: 'concept', count: 22 },
          { label: 'Cognitive avoidance', type: 'concept', count: 18 },
        ],
      },
      {
        label: 'Panic Disorder',
        type: 'concept',
        count: 41,
        children: [
          { label: 'Interoceptive exposure', type: 'concept', count: 14 },
          { label: 'Catastrophic misinterpretation', type: 'concept', count: 11 },
        ],
      },
      { label: 'Social Anxiety', type: 'concept', count: 38 },
      { label: 'Specific Phobia', type: 'concept', count: 19 },
    ],
  },
  {
    label: 'Attachment Theory',
    type: 'concept',
    count: 142,
    children: [
      { label: 'Internal Working Models', type: 'concept', count: 41 },
      { label: 'Strange Situation', type: 'concept', count: 28 },
      { label: 'Anxious-Avoidant', type: 'concept', count: 22 },
    ],
  },
];

function SPHierarchicalList() {
  return (
    <section className="sp-tree-section">
      <div className="sp-card-head">
        <div>
          <h2 className="sp-chart-title">Concept Hierarchy</h2>
          <p className="sp-chart-subtitle">Two top-level taxonomies, expand to see depth.</p>
        </div>
        <button className="sp-icon-action-quiet" aria-label="Expand all"><SPIcon name="more" size={14} /></button>
      </div>
      <div className="sp-tree">
        {CONCEPT_TREE.map((n, i) => <TreeNode key={i} node={n} depth={0} defaultOpen={i === 0} />)}
      </div>
    </section>
  );
}

function TreeNode({ node, depth, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div>
      <div
        className="sp-tree-row"
        style={{ paddingLeft: 12 + depth * 18 }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        <span className={`sp-tree-caret ${hasChildren ? '' : 'is-empty'}`}>
          {hasChildren && <SPIcon name={open ? 'caret-down' : 'caret-right'} size={9} />}
        </span>
        <span className={`sp-tree-dot is-${node.type}`} />
        <span className="sp-tree-label">{node.label}</span>
        <span className="sp-tree-count">{node.count}</span>
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((c, i) => (
            <TreeNode key={i} node={c} depth={depth + 1} defaultOpen={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Form (Add concept)
// =====================================================================

function SPForm() {
  const [type, setType] = useState('intervention');
  const [domains, setDomains] = useState(new Set(['Clinical psychology']));
  const [related, setRelated] = useState(new Set(['Attachment Theory']));

  const toggleSet = (set, setter, value) => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  };

  return (
    <section className="sp-form-section">
      <div className="sp-card-head">
        <div>
          <h2 className="sp-chart-title">Add a Concept</h2>
          <p className="sp-chart-subtitle">Capture a theory, treatment, or framework.</p>
        </div>
      </div>
      <form className="sp-form" onSubmit={(e) => e.preventDefault()}>
        <div className="sp-field">
          <label className="sp-label">Label</label>
          <input type="text" className="sp-input" placeholder="e.g. Mentalization-Based Treatment" defaultValue="" />
          <div className="sp-help">Required.  The canonical name as it appears in the literature.</div>
        </div>

        <div className="sp-field">
          <label className="sp-label">Type</label>
          <div className="sp-radio-grid">
            {[
              { value: 'intervention', label: 'Intervention' },
              { value: 'pathology', label: 'Pathology' },
              { value: 'measurement', label: 'Measurement' },
              { value: 'school', label: 'School of Thought' },
              { value: 'physical', label: 'Physical Entity' },
              { value: 'symptom', label: 'Symptom' },
            ].map((o) => (
              <label key={o.value} className={`sp-radio ${type === o.value ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="type"
                  checked={type === o.value}
                  onChange={() => setType(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="sp-field">
          <label className="sp-label">Domains</label>
          <SPTypeToFilter
            placeholder="Add a domain"
            options={[
              'Clinical psychology', 'Cognitive psychology', 'Developmental psychology',
              'Neuroscience', 'Psychiatry', 'Pharmacology', 'Behavioral economics',
            ]}
            selected={domains}
            onToggle={(v) => toggleSet(domains, setDomains, v)}
          />
        </div>

        <div className="sp-field">
          <label className="sp-label">Related Concepts</label>
          <SPTypeToFilter
            placeholder="Link a concept"
            category="concept"
            options={[
              'Attachment Theory', 'CBT', 'Object Relations', 'Anxiety Disorders',
              'Internal Working Models', 'Exposure Therapy', 'SSRI Treatment',
            ]}
            selected={related}
            onToggle={(v) => toggleSet(related, setRelated, v)}
          />
        </div>

        <div className="sp-field">
          <label className="sp-label">Definition</label>
          <textarea
            className="sp-textarea"
            rows="3"
            placeholder="A short, citable definition.  Plain language."
          />
        </div>

        <div className="sp-form-actions">
          <button type="button" className="sp-action sp-action-secondary">Cancel</button>
          <button type="submit" className="sp-action sp-action-primary">Save Concept</button>
        </div>
      </form>
    </section>
  );
}

function SPTypeToFilter({ placeholder, options, selected, onToggle, category }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query, options]);

  return (
    <div className="sp-ttf">
      {selected.size > 0 && (
        <div className="sp-ttf-selected">
          {Array.from(selected).map((v) => (
            <span key={v} className={`sp-chip ${category ? `is-${category}` : 'is-neutral'} sp-chip-removable`}>
              {v}
              <button type="button" className="sp-chip-x" onClick={() => onToggle(v)} aria-label={`Remove ${v}`}>
                <SPIcon name="x" size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="sp-ttf-input-wrap">
        <SPIcon name="search" size={12} />
        <input
          type="text"
          className="sp-ttf-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="sp-ttf-list">
        {filtered.length === 0 && <div className="sp-filter-empty">No matches.</div>}
        {filtered.map((o) => (
          <label key={o} className="sp-ttf-row">
            <input
              type="checkbox"
              className="sp-checkbox"
              checked={selected.has(o)}
              onChange={() => onToggle(o)}
            />
            <span className={`sp-ttf-row-label ${category ? `is-${category}` : ''}`}>{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Component library — buttons, banners, empty state, etc.
// =====================================================================

function SPComponentLibrary() {
  return (
    <div className="sp-lib">
      <SPLibBlock title="Buttons">
        <div className="sp-lib-row">
          <button className="sp-action sp-action-primary">Save Concept</button>
          <button className="sp-action sp-action-secondary">Cancel</button>
          <button className="sp-action sp-action-quiet">Tag</button>
          <button className="sp-action sp-action-quiet sp-action-danger">Remove</button>
          <button className="sp-action sp-action-primary" disabled>Disabled</button>
        </div>
      </SPLibBlock>

      <SPLibBlock title="Pills & chips">
        <p className="sp-lib-note">By category — pair the icon with the label to make the type readable at a glance.</p>
        <div className="sp-lib-row" style={{ marginBottom: 12 }}>
          <span className="nc-pill is-source"><i className="fas fa-book-open nc-pill-icon" /><span className="nc-pill-label">Bowlby (1969)</span></span>
          <span className="nc-pill is-concept"><i className="fas fa-lightbulb nc-pill-icon" /><span className="nc-pill-label">Attachment Theory</span></span>
          <span className="nc-pill is-person"><i className="fas fa-user nc-pill-icon" /><span className="nc-pill-label">Ainsworth, M.</span></span>
          <span className="nc-pill is-note"><i className="fas fa-note-sticky nc-pill-icon" /><span className="nc-pill-label">Strange Situation framing</span></span>
          <span className="nc-pill is-tag"><i className="fas fa-tag nc-pill-icon" /><span className="nc-pill-label">methodology</span></span>
          <span className="nc-pill is-collection"><i className="fas fa-folder nc-pill-icon" /><span className="nc-pill-label">Thesis Ch. 3</span></span>
          <span className="nc-pill is-research"><i className="fas fa-flask nc-pill-icon" /><span className="nc-pill-label">Longitudinal</span></span>
          <span className="nc-pill is-stat-test"><i className="fas fa-square-root-variable nc-pill-icon" /><span className="nc-pill-label">Mixed-effects model</span></span>
        </div>

        <p className="sp-lib-note">Removable — × button at the end. Used for active filters and multiselect chosen values.</p>
        <div className="sp-lib-row">
          <span className="nc-pill is-source is-removable">
            <i className="fas fa-book-open nc-pill-icon" />
            <span className="nc-pill-label">Bowlby (1969)</span>
            <button type="button" className="nc-pill-x" aria-label="Remove">
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </span>
          <span className="nc-pill is-concept is-removable">
            <i className="fas fa-lightbulb nc-pill-icon" />
            <span className="nc-pill-label">Attachment Theory</span>
            <button type="button" className="nc-pill-x" aria-label="Remove">
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </span>
          <span className="nc-pill is-tag is-removable">
            <i className="fas fa-tag nc-pill-icon" />
            <span className="nc-pill-label">methodology</span>
            <button type="button" className="nc-pill-x" aria-label="Remove">
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </span>
        </div>
      </SPLibBlock>

      <SPLibBlock title="Banner">
        <div className="sp-banner">
          <SPIcon name="info" size={14} />
          <div>
            <strong>3 sources have incomplete metadata.</strong> Most researchers fill these in before exporting a citation list.
          </div>
          <button className="sp-banner-action">Review</button>
        </div>
      </SPLibBlock>

      <SPLibBlock title="Empty state">
        <div className="sp-empty">
          <div className="sp-empty-art">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect x="6" y="10" width="32" height="26" rx="2" className="sp-empty-stroke" />
              <line x1="6" y1="18" x2="38" y2="18" className="sp-empty-stroke" />
              <line x1="12" y1="14" x2="14" y2="14" className="sp-empty-stroke" />
            </svg>
          </div>
          <h3 className="sp-empty-title">No notes yet</h3>
          <p className="sp-empty-sub">Highlight a passage in any source to start.  Notes are searchable across the library.</p>
        </div>
      </SPLibBlock>

      <SPLibBlock title="Toggle & switch">
        <div className="sp-lib-row sp-lib-row-vcenter">
          <SPSwitch defaultChecked label="Auto-import metadata from DOI" />
          <SPSwitch label="Suggest related concepts on save" />
        </div>
      </SPLibBlock>

      <SPLibBlock title="Inline read state">
        <div className="sp-lib-row sp-lib-row-vcenter">
          <SPStatus status="read" />
          <SPStatus status="reading" />
          <SPStatus status="unread" />
        </div>
      </SPLibBlock>
    </div>
  );
}

function SPLibBlock({ title, children }) {
  return (
    <div className="sp-lib-block">
      <div className="sp-lib-title">{title}</div>
      <div className="sp-lib-body">{children}</div>
    </div>
  );
}

function SPSwitch({ defaultChecked, label }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="sp-switch-wrap">
      <button
        type="button"
        className={`sp-switch ${on ? 'is-on' : ''}`}
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
      >
        <span className="sp-switch-thumb" />
      </button>
      <span className="sp-switch-label">{label}</span>
    </label>
  );
}

// =====================================================================
// Color system — swatches with light + dark siblings
// =====================================================================

const COLOR_GROUPS = [
  {
    label: 'Categorical',
    note: 'Pulled from the brand mark.  Concept is seaweed green, Source is sapphire sky blue, Person is rebecca purple.  Notes, tags, and collections deliberately use neutral ink, with navy reserved for non-categorical brand UI.',
    swatches: [
      { name: 'Concept', light: '#48A27E', dark: '#7DC9A3', role: 'Seaweed → light sage.  Concepts, theories, frameworks.  The structural anchor.' },
      { name: 'Source',  light: '#4976B1', dark: '#7FA5D1', role: 'Sapphire sky → softened sapphire.  Articles, books, papers, citations.' },
      { name: 'Person',  light: '#614498', dark: '#9577C8', role: 'Rebecca purple → light purple.  Authors, theorists, contributors.' },
    ],
  },
  {
    label: 'Categorical Tints',
    note: 'Used as backgrounds for chips, halos, banners.  Always paired with the matching ink for text.',
    swatches: [
      { name: 'Concept tint', light: '#E8F4EE', dark: '#1A2E25', role: 'Pairs with Concept ink.' },
      { name: 'Source tint',  light: '#EBF1F8', dark: '#1F2D40', role: 'Pairs with Source ink.' },
      { name: 'Person tint',  light: '#EEEAF5', dark: '#26203A', role: 'Pairs with Person ink.' },
    ],
  },
  {
    label: 'Surfaces',
    note: 'White-leaning hierarchy in a slightly cool grey.  Most of the app sits on Paper.',
    swatches: [
      { name: 'Paper',      light: '#FFFFFF', dark: '#0F1217', role: 'Page background.  The primary canvas.' },
      { name: 'Paper Soft', light: '#F7F8FA', dark: '#161A20', role: 'Subtle wash.  Inputs and quiet recesses.' },
      { name: 'Paper Warm', light: '#EEF0F3', dark: '#1B1F26', role: 'Selected, active, header chrome.  Name kept; value is now slightly cool.' },
    ],
  },
  {
    label: 'Ink',
    note: 'Cool grey scale with a slight blue undertone.  Step down by importance, not by decoration.',
    swatches: [
      { name: 'Ink',         light: '#15191F', dark: '#E8EBEF', role: 'Primary text.  Headings, body, UI labels.' },
      { name: 'Ink 2',       light: '#3F454E', dark: '#B5B9C0', role: 'Secondary text.  Long-form body, table cells.' },
      { name: 'Ink 3',       light: '#71777F', dark: '#888D95', role: 'Muted text.  Subtitles, metadata, eyebrows.' },
      { name: 'Ink 4',       light: '#A4A9B1', dark: '#565B63', role: 'Subtle.  Empty-state art, decorative marks.' },
      { name: 'Ink Line',    light: '#E1E4E8', dark: '#2A2F38', role: 'Hairline borders, dividers, table rules.' },
    ],
  },
  {
    label: 'State',
    note: 'Used sparingly.  Most state in the app is conveyed by ink and tone, not color.',
    swatches: [
      { name: 'Error',   light: '#7A2E2E', dark: '#C77676', role: 'Destructive actions, validation errors.' },
      { name: 'Warning', light: '#8B5A3C', dark: '#C99878', role: 'Sienna.  Visually distinct from the cool categorical palette.' },
    ],
  },
];

function SPColorSystem() {
  return (
    <section className="sp-color-system">
      <div className="sp-card-head">
        <div>
          <h2 className="sp-chart-title">Color System</h2>
          <p className="sp-chart-subtitle">
            Each token has a light and dark sibling.  Swatches render in their literal hex regardless of the active theme so both palettes are legible at once.
          </p>
        </div>
      </div>

      {COLOR_GROUPS.map((group) => (
        <div key={group.label} className="sp-swatch-group">
          <div className="sp-swatch-group-head">
            <div className="sp-eyebrow">{group.label}</div>
            <div className="sp-swatch-group-note">{group.note}</div>
          </div>
          <div className="sp-swatches">
            {group.swatches.map((s) => (
              <SPSwatchCard key={s.name} {...s} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function SPSwatchCard({ name, light, dark, role }) {
  return (
    <div className="sp-swatch-card">
      <div className="sp-swatch-strips">
        <div
          className="sp-swatch-strip"
          style={{ background: light, color: textOn(light) }}
        >
          <span className="sp-swatch-strip-tag">Light</span>
          <span className="sp-swatch-strip-hex">{light.toUpperCase()}</span>
        </div>
        <div
          className="sp-swatch-strip"
          style={{ background: dark, color: textOn(dark) }}
        >
          <span className="sp-swatch-strip-tag">Dark</span>
          <span className="sp-swatch-strip-hex">{dark.toUpperCase()}</span>
        </div>
      </div>
      <div className="sp-swatch-meta">
        <div className="sp-swatch-name">{name}</div>
        <div className="sp-swatch-role">{role}</div>
      </div>
    </div>
  );
}

function textOn(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? 'rgba(20, 20, 15, 0.78)' : 'rgba(255, 255, 250, 0.92)';
}

// =====================================================================
// Section divider, footer
// =====================================================================

function SPSectionDivider({ label }) {
  return (
    <div className="sp-divider">
      <span className="sp-divider-label">{label}</span>
      <span className="sp-divider-rule" />
    </div>
  );
}

function SPFooter() {
  return (
    <footer className="sp-footer">
      <div>Map My Research · Linchpin Industries</div>
      <div className="sp-footer-meta">
        Sample design surface · v0.1
      </div>
    </footer>
  );
}

// =====================================================================
// Icon — minimal inline SVG set
// =====================================================================

function SPIcon({ name, size = 16 }) {
  const s = { width: size, height: size, flexShrink: 0 };
  switch (name) {
    case 'search':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" strokeLinecap="round" /></svg>;
    case 'plus':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>;
    case 'x':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
    case 'chev-right':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>;
    case 'caret-down':
      return <svg style={s} viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4z" /></svg>;
    case 'caret-up':
      return <svg style={s} viewBox="0 0 16 16" fill="currentColor"><path d="M4 10l4-4 4 4z" /></svg>;
    case 'caret-right':
      return <svg style={s} viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4z" /></svg>;
    case 'folder':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4l1.6 1.5h5A1.5 1.5 0 0 1 14 6v5.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7z" /></svg>;
    case 'bookmark':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"><path d="M4 3h8v10l-4-3-4 3V3z" /></svg>;
    case 'pin':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2l4 4-3 1-2 4-4-4 4-2 1-3z" /><path d="M5 11l-3 3" /></svg>;
    case 'clock':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" /></svg>;
    case 'dot':
      return <svg style={s} viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="2" /></svg>;
    case 'share':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="4" cy="8" r="2" /><circle cx="12" cy="4" r="2" /><circle cx="12" cy="12" r="2" /><path d="M5.7 7.1L10.3 4.9M5.7 8.9L10.3 11.1" /></svg>;
    case 'more':
      return <svg style={s} viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="12.5" cy="8" r="1.2" /></svg>;
    case 'filter':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h12l-4.5 6V14L6.5 12.5V9L2 3z" /></svg>;
    case 'download':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7L8 10.5 11.5 7" /><path d="M3 13h10" /></svg>;
    case 'sun':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" /></svg>;
    case 'moon':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"><path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" /></svg>;
    case 'info':
      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 7v4" /><circle cx="8" cy="5" r="0.7" fill="currentColor" stroke="none" /></svg>;
    default:
      return <svg style={s} viewBox="0 0 16 16" />;
  }
}

// =====================================================================
// Styles — scoped to .sp-root
// =====================================================================

function SPStyles() {
  return (
    <style>{`
      /* ============ TOKENS ============ */
      .sp-root {
        --serif: "Source Serif 4", "Iowan Old Style", Georgia, serif;
        --sans: "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

        /* Light theme — cool grey paper + ink, harmonized with cool categorical palette */
        --paper: #FFFFFF;
        --paper-soft: #F7F8FA;
        --paper-warm: #EEF0F3;
        --ink: #15191F;
        --ink-2: #3F454E;
        --ink-3: #71777F;
        --ink-4: #A4A9B1;
        --ink-line: #E1E4E8;
        --ink-line-soft: #EBEDF0;
        --hover: rgba(21, 25, 31, 0.04);
        --selected: rgba(21, 25, 31, 0.06);

        --concept: #48A27E;
        --concept-2: #3A8568;
        --concept-tint: #E8F4EE;

        --source: #4976B1;
        --source-2: #3A5F8E;
        --source-tint: #EBF1F8;

        --person: #614498;
        --person-2: #4D3578;
        --person-tint: #EEEAF5;

        --error: #7A2E2E;
        --warning: #8B5A3C;

        --r-sm: 2px;
        --r-md: 4px;
        --r-lg: 6px;
        --r-pill: 999px;

        --shadow-card: 0 1px 0 rgba(20, 20, 15, 0.02);

        font-family: var(--sans);
        color: var(--ink);
        background: var(--paper);
        font-size: 15px;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .sp-root[data-theme="dark"] {
        --paper: #0F1217;
        --paper-soft: #161A20;
        --paper-warm: #1B1F26;
        --ink: #E8EBEF;
        --ink-2: #B5B9C0;
        --ink-3: #888D95;
        --ink-4: #565B63;
        --ink-line: #2A2F38;
        --ink-line-soft: #232830;
        --hover: rgba(255, 255, 255, 0.04);
        --selected: rgba(255, 255, 255, 0.06);

        --concept: #7DC9A3;
        --concept-2: #A8DDC1;
        --concept-tint: #1A2E25;

        --source: #7FA5D1;
        --source-2: #A8C2DD;
        --source-tint: #1F2D40;

        --person: #9577C8;
        --person-2: #B5A0DC;
        --person-tint: #26203A;

        --error: #C77676;
        --warning: #C99878;
      }

      /* ============ RESET-ISH ============ */
      /* :where() drops these to specificity 0,0,0 so named classes always win */
      .sp-root :where(*, *::before, *::after) { box-sizing: border-box; }
      .sp-root :where(button) {
        font-family: var(--sans);
        font-size: 13px;
        font-weight: 500;
        line-height: 1.5;
        color: inherit;
        background: transparent;
        border: none;
        margin: 0;
        padding: 0;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        text-align: inherit;
      }
      .sp-root :where(input, textarea, select) {
        font-family: var(--sans);
        font-size: inherit;
        color: inherit;
      }
      .sp-root :where(a) { color: inherit; text-decoration: none; }
      .sp-root :where(h1, h2, h3, h4) { margin: 0; font-weight: 600; }
      .sp-root :where(p) { margin: 0; }
      .sp-root :where(ul, ol) { margin: 0; padding: 0; list-style: none; }

      /* ============ SHELL ============ */
      .sp-shell {
        display: flex;
        align-items: stretch;
        max-width: 1440px;
        margin: 0 auto;
      }
      .sp-main {
        flex: 1;
        min-width: 0;
        padding: 32px 40px 64px;
      }

      /* ============ TOPNAV ============ */
      .sp-topnav {
        display: grid;
        grid-template-columns: 240px 1fr auto;
        align-items: center;
        gap: 32px;
        height: 64px;
        padding: 0 32px;
        border-bottom: 1px solid var(--ink-line);
        background: var(--paper);
        position: sticky;
        top: 0;
        z-index: 50;
      }
      .sp-topnav-left { display: flex; align-items: center; }
      .sp-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--ink);
      }
      .sp-brand-logo { width: 36px; height: 36px; display: block; flex-shrink: 0; }
      .sp-brand-logo-dark { display: none; }
      .sp-root[data-theme="dark"] .sp-brand-logo-light { display: none; }
      .sp-root[data-theme="dark"] .sp-brand-logo-dark { display: block; }
      .sp-wordmark {
        font-family: var(--serif);
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1;
        color: var(--ink);
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
      }
      .sp-wordmark-small {
        font-family: var(--serif);
        font-size: 13px;
        font-style: italic;
        font-weight: 400;
        color: var(--ink-3);
      }
      .sp-topnav-center { display: flex; gap: 4px; justify-content: center; }
      .sp-topnav-link {
        font-size: 14px;
        font-weight: 500;
        color: var(--ink-2);
        padding: 8px 14px;
        border-radius: var(--r-sm);
      }
      .sp-topnav-link:hover { background: var(--hover); color: var(--ink); }
      .sp-topnav-link-active {
        color: var(--ink);
        background: var(--paper-warm);
      }
      .sp-topnav-right { display: flex; align-items: center; gap: 12px; justify-self: end; }
      .sp-search {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 0 10px;
        height: 34px;
        width: 280px;
        color: var(--ink-3);
      }
      .sp-search:focus-within { border-color: var(--ink-2); color: var(--ink); }
      .sp-search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 13px;
        color: var(--ink);
      }
      .sp-search-input::placeholder { color: var(--ink-3); }
      .sp-kbd {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        background: var(--paper);
        border: 1px solid var(--ink-line);
        padding: 1px 5px;
        border-radius: 2px;
      }
      .sp-icon-action {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        height: 34px;
        width: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--ink-2);
        transition: background 0.12s, border-color 0.12s, color 0.12s;
      }
      .sp-icon-action:hover { background: var(--hover); color: var(--ink); border-color: var(--ink-3); }
      .sp-icon-action-quiet {
        background: transparent;
        border: 1px solid transparent;
        color: var(--ink-3);
        height: 28px;
        width: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        transition: background 0.12s, color 0.12s;
      }
      .sp-icon-action-quiet:hover { background: var(--hover); color: var(--ink); }
      .sp-avatar {
        height: 34px;
        width: 34px;
        border-radius: var(--r-pill);
        background: var(--ink);
        color: var(--paper);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: var(--serif);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      /* ============ SIDEBAR ============ */
      .sp-sidebar {
        flex-shrink: 0;
        width: 260px;
        padding: 32px 20px 64px 32px;
        border-right: 1px solid var(--ink-line);
        background: var(--paper);
        align-self: stretch;
      }
      .sp-sidebar-section { margin-bottom: 28px; }
      .sp-eyebrow {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 10px;
        padding: 0 8px;
      }
      .sp-eyebrow-filter {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .sp-eyebrow-clear {
        font-size: 10.5px;
        font-weight: 500;
        color: var(--ink-3);
        background: none;
        border: none;
        padding: 0;
        text-transform: none;
        letter-spacing: 0;
      }
      .sp-eyebrow-clear:hover { color: var(--ink); }
      .sp-sidebar-list { display: flex; flex-direction: column; gap: 1px; }
      .sp-sidebar-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        font-size: 13.5px;
        color: var(--ink-2);
        border-radius: var(--r-sm);
      }
      .sp-sidebar-link:hover { background: var(--hover); color: var(--ink); }
      .sp-sidebar-link.is-active {
        background: var(--paper-warm);
        color: var(--ink);
        font-weight: 600;
      }
      .sp-sidebar-link.is-muted { color: var(--ink-3); }
      .sp-sidebar-link-label { flex: 1; }
      .sp-sidebar-link-count {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      /* ============ FILTER (sidebar + form) ============ */
      .sp-filter-input-wrap, .sp-ttf-input-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 30px;
        padding: 0 8px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        background: var(--paper-soft);
        color: var(--ink-3);
        margin-bottom: 6px;
      }
      .sp-filter-input-wrap:focus-within, .sp-ttf-input-wrap:focus-within {
        border-color: var(--ink-2);
        background: var(--paper);
        color: var(--ink);
      }
      .sp-filter-input, .sp-ttf-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 12.5px;
        color: var(--ink);
      }
      .sp-filter-input::placeholder, .sp-ttf-input::placeholder { color: var(--ink-3); }
      .sp-filter-list {
        max-height: 200px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .sp-filter-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 8px;
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
      }
      .sp-filter-row:hover { background: var(--hover); }
      .sp-filter-row-label { flex: 1; line-height: 1.4; }
      .sp-filter-row-label.is-concept { color: var(--concept); font-weight: 500; }
      .sp-filter-row-label.is-source { color: var(--source); font-weight: 500; }
      .sp-filter-row-label.is-person { color: var(--person); font-weight: 500; }
      .sp-filter-row-count {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .sp-filter-empty {
        padding: 8px;
        font-size: 12.5px;
        color: var(--ink-3);
        font-style: italic;
      }

      /* ============ CHECKBOX ============ */
      .sp-checkbox {
        appearance: none;
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border: 1px solid var(--ink-3);
        border-radius: 2px;
        background: var(--paper);
        cursor: pointer;
        position: relative;
        flex-shrink: 0;
        transition: border-color 0.1s, background 0.1s;
      }
      .sp-checkbox:hover { border-color: var(--ink); }
      .sp-checkbox:checked {
        background: var(--primary);
        border-color: var(--primary);
      }
      .sp-checkbox.is-concept:checked { background: var(--concept); border-color: var(--concept); }
      .sp-checkbox.is-source:checked  { background: var(--source);  border-color: var(--source); }
      .sp-checkbox.is-person:checked  { background: var(--person);  border-color: var(--person); }
      .sp-checkbox:checked::after {
        content: '';
        position: absolute;
        left: 3px;
        top: 0px;
        width: 5px;
        height: 9px;
        border-right: 1.5px solid var(--paper);
        border-bottom: 1.5px solid var(--paper);
        transform: rotate(45deg);
      }
      .sp-checkbox:indeterminate {
        background: var(--primary);
        border-color: var(--primary);
      }
      .sp-checkbox.is-concept:indeterminate { background: var(--concept); border-color: var(--concept); }
      .sp-checkbox.is-source:indeterminate  { background: var(--source);  border-color: var(--source); }
      .sp-checkbox.is-person:indeterminate  { background: var(--person);  border-color: var(--person); }
      .sp-checkbox:indeterminate::after {
        content: '';
        position: absolute;
        left: 2px;
        top: 5px;
        width: 8px;
        height: 1.5px;
        background: var(--paper);
      }

      /* ============ PAGE HEADER ============ */
      .sp-page-header { margin-bottom: 32px; }
      .sp-breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--ink-3);
        margin-bottom: 14px;
      }
      .sp-breadcrumb a { color: var(--ink-3); }
      .sp-breadcrumb a:hover { color: var(--ink); text-decoration: underline; }
      .sp-breadcrumb span { color: var(--ink); font-weight: 500; }
      .sp-page-header-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .sp-page-title {
        font-family: var(--serif);
        font-size: 36px;
        font-weight: 600;
        line-height: 1.1;
        color: var(--ink);
        letter-spacing: -0.015em;
      }
      .sp-page-subtitle {
        font-size: 14px;
        color: var(--ink-3);
        margin-top: 6px;
      }
      .sp-page-actions { display: flex; gap: 8px; }

      /* ============ BUTTONS ============ */
      .sp-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 34px;
        padding: 0 14px;
        font-family: var(--sans);
        font-size: 13px;
        font-weight: 500;
        border-radius: var(--r-sm);
        border: 1px solid transparent;
        background: transparent;
        color: var(--ink);
        line-height: 1;
        white-space: nowrap;
        transition: background 0.12s, border-color 0.12s, color 0.12s;
      }
      .sp-action:disabled { opacity: 0.4; cursor: not-allowed; }
      .sp-action-primary {
        background: var(--primary);
        color: var(--paper);
        border: 1px solid var(--primary);
      }
      .sp-action-primary:hover:not(:disabled) { background: var(--primary-dark); border-color: var(--primary-dark); }
      .sp-action-secondary {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        color: var(--ink);
      }
      .sp-action-secondary:hover { background: var(--hover); border-color: var(--ink-3); }
      .sp-action-quiet {
        padding: 0 10px;
        height: 30px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--ink-2);
        font-size: 12.5px;
      }
      .sp-action-quiet:hover { background: var(--hover); color: var(--ink); }
      .sp-action-danger { color: var(--error); }
      .sp-action-danger:hover { background: rgba(122, 46, 46, 0.06); color: var(--error); }

      /* ============ KPI ============ */
      .sp-kpi-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        background: var(--paper);
        margin-bottom: 32px;
      }
      .sp-kpi {
        padding: 20px 24px;
        border-right: 1px solid var(--ink-line);
      }
      .sp-kpi:last-child { border-right: none; }
      .sp-kpi-label {
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 12px;
      }
      .sp-kpi-value {
        font-family: var(--serif);
        font-size: 38px;
        font-weight: 600;
        color: var(--primary);
        line-height: 1;
        font-variant-numeric: lining-nums;
        letter-spacing: -0.01em;
      }
      .sp-kpi-value.is-concept { color: var(--concept); }
      .sp-kpi-value.is-source  { color: var(--source); }
      .sp-kpi-value.is-person  { color: var(--person); }
      .sp-kpi-value.is-navy    { color: var(--primary); }
      .sp-kpi-delta {
        font-size: 12px;
        color: var(--ink-3);
        margin-top: 8px;
      }

      /* ============ SECTION DIVIDER ============ */
      .sp-divider {
        display: flex;
        align-items: center;
        gap: 16px;
        margin: 40px 0 20px;
      }
      .sp-divider-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        flex-shrink: 0;
      }
      .sp-divider-rule {
        flex: 1;
        height: 1px;
        background: var(--ink-line);
      }

      /* ============ CHART CARD ============ */
      .sp-chart-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 8px;
      }
      .sp-chart-card, .sp-relationship, .sp-table-section, .sp-tree-section, .sp-form-section {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 22px 24px;
      }
      .sp-chart-card-head, .sp-relationship-head, .sp-card-head, .sp-table-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 16px;
      }
      .sp-chart-title {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.2;
      }
      .sp-chart-subtitle {
        font-size: 12.5px;
        color: var(--ink-3);
        margin-top: 4px;
      }
      .sp-svg { width: 100%; height: auto; display: block; }
      .sp-svg-grid { stroke: var(--ink-line-soft); stroke-width: 1; }
      .sp-svg-tick {
        font-family: var(--mono);
        font-size: 9.5px;
        fill: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .sp-bar { fill: var(--ink-2); }
      .sp-bar-source { fill: var(--source); }
      .sp-bar-concept { fill: var(--concept); }
      .sp-bar-person { fill: var(--person); }

      /* ============ HORIZONTAL BARS ============ */
      .sp-bars-h { display: flex; flex-direction: column; gap: 10px; }
      .sp-bars-h-row {
        display: grid;
        grid-template-columns: 130px 1fr 32px;
        align-items: center;
        gap: 12px;
        font-size: 12.5px;
      }
      .sp-bars-h-label { color: var(--ink-2); }
      .sp-bars-h-track {
        height: 8px;
        background: var(--ink-line-soft);
        border-radius: 1px;
        overflow: hidden;
      }
      .sp-bars-h-fill {
        height: 100%;
        background: var(--ink-2);
        transition: width 0.3s;
      }
      .sp-bars-h-fill.is-concept { background: var(--concept); }
      .sp-bars-h-fill.is-source { background: var(--source); }
      .sp-bars-h-fill.is-person { background: var(--person); }
      .sp-bars-h-value {
        font-family: var(--mono);
        color: var(--ink-3);
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-size: 11.5px;
      }

      /* ============ RELATIONSHIP CHART ============ */
      .sp-relationship-canvas {
        background: var(--paper);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-md);
        padding: 12px;
      }
      .sp-svg-net { width: 100%; height: auto; display: block; }
      .sp-net-ring { fill: none; stroke: var(--ink-line); stroke-width: 1; stroke-dasharray: 2 4; }
      .sp-net-edge { stroke: var(--ink-line); stroke-width: 1; }
      .sp-net-edge-faint { stroke: var(--ink-line-soft); }
      .sp-net-node.is-concept { fill: var(--concept); }
      .sp-net-node.is-source { fill: var(--source); }
      .sp-net-node.is-person { fill: var(--person); }
      .sp-net-halo.is-concept { fill: var(--concept-tint); }
      .sp-net-halo.is-source { fill: var(--source-tint); }
      .sp-net-halo.is-person { fill: var(--person-tint); }
      .sp-net-label {
        font-family: var(--sans);
        font-weight: 500;
        fill: var(--ink-2);
      }
      .sp-net-label-lg { font-family: var(--serif); font-size: 14px; font-weight: 600; fill: var(--ink); }
      .sp-net-label-md { font-size: 11.5px; }
      .sp-net-label-sm { font-size: 10.5px; fill: var(--ink-3); }

      .sp-legend {
        display: flex;
        gap: 16px;
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .sp-legend-item { display: inline-flex; align-items: center; gap: 6px; }
      .sp-legend-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); }
      .sp-legend-item.is-concept .sp-legend-dot { background: var(--concept); }
      .sp-legend-item.is-source .sp-legend-dot { background: var(--source); }
      .sp-legend-item.is-person .sp-legend-dot { background: var(--person); }

      /* ============ TABLE ============ */
      .sp-table-actions { display: flex; align-items: center; gap: 4px; }
      .sp-table-wrap {
        border-top: 1px solid var(--ink-line);
        margin: 0 -24px -22px;
        overflow-x: auto;
      }
      .sp-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .sp-table thead { background: var(--paper); }
      .sp-table th {
        text-align: left;
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 12px 14px;
        border-bottom: 1px solid var(--ink-line);
        white-space: nowrap;
      }
      .sp-th { cursor: pointer; user-select: none; }
      .sp-th span { display: inline-block; margin-right: 4px; }
      .sp-th:hover { color: var(--ink); }
      .sp-th.is-active { color: var(--ink); }
      .sp-th-num, .sp-td-num { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--mono); }
      .sp-th-check { width: 32px; padding-left: 24px; }
      .sp-table td {
        padding: 12px 14px;
        border-bottom: 1px solid var(--ink-line-soft);
        vertical-align: top;
        line-height: 1.5;
      }
      .sp-table tbody tr:hover { background: var(--paper-soft); }
      .sp-table tbody tr.is-selected { background: var(--paper-warm); }
      .sp-td-check { padding-left: 24px; padding-top: 14px; }
      .sp-td-title { max-width: 360px; }
      .sp-td-doi {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        margin-top: 3px;
      }
      .sp-td-people { color: var(--ink-2); white-space: nowrap; }
      .sp-text-person { color: var(--ink-2); }
      .sp-td-journal { color: var(--ink-2); }
      .sp-td-num { color: var(--ink-2); font-size: 12.5px; }
      .sp-link { color: var(--ink); border-bottom: 1px solid transparent; }
      .sp-link:hover { border-color: var(--ink-3); }

      /* ============ CHIPS ============ */
      .sp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .sp-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        font-size: 11.5px;
        font-weight: 500;
        line-height: 1.5;
        border-radius: var(--r-sm);
        white-space: nowrap;
      }
      .sp-chip.is-concept { background: var(--concept-tint); color: var(--concept-2); }
      .sp-chip.is-source { background: var(--source-tint); color: var(--source-2); }
      .sp-chip.is-person { background: var(--person-tint); color: var(--person-2); }
      .sp-chip.is-neutral { background: var(--paper-warm); color: var(--ink-2); }
      .sp-chip-removable { padding-right: 4px; }
      .sp-chip-x {
        background: transparent;
        border: none;
        padding: 2px;
        color: inherit;
        opacity: 0.6;
        display: inline-flex;
        align-items: center;
        border-radius: 2px;
      }
      .sp-chip-x:hover { opacity: 1; background: rgba(0, 0, 0, 0.06); }

      /* ---------- nc-pill (icon pills) — production class also used by
         NoteCard chips and the /collections sidebar.  Mirrored here so
         the style guide stays self-contained. */
      .sp-lib-note {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        margin: 0 0 8px;
      }
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
        font-family: var(--font-body);
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
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 600;
        font-style: normal;
        letter-spacing: 0.02em;
        line-height: 1.5;
        text-transform: none;
      }
      button.nc-pill { background-image: none; }
      .nc-pill:hover { filter: brightness(0.96); }
      .nc-pill-icon { font-size: 10px; opacity: 0.9; flex-shrink: 0; line-height: 1; }
      .nc-pill-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        font: inherit;
      }
      .nc-pill.is-source     { --nc-pill-color: var(--source); }
      .nc-pill.is-concept    { --nc-pill-color: var(--concept); }
      .nc-pill.is-person     { --nc-pill-color: var(--person); }
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
      .nc-pill.is-removable  { padding-right: 4px; gap: 4px; }
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

      /* ============ STATUS ============ */
      .sp-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--ink-2);
        white-space: nowrap;
      }
      .sp-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); }
      .sp-status.is-read .sp-status-dot { background: var(--concept); }
      .sp-status.is-reading .sp-status-dot { background: var(--person); }
      .sp-status.is-unread .sp-status-dot { background: var(--ink-line); border: 1px solid var(--ink-3); width: 7px; height: 7px; }

      /* ============ TWO COL ============ */
      .sp-two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      /* ============ TREE ============ */
      .sp-tree {
        margin: 0 -24px -22px;
        border-top: 1px solid var(--ink-line);
      }
      .sp-tree-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 24px;
        font-size: 13.5px;
        color: var(--ink);
        border-bottom: 1px solid var(--ink-line-soft);
        cursor: pointer;
      }
      .sp-tree-row:hover { background: var(--paper-soft); }
      .sp-tree-caret {
        width: 12px;
        display: inline-flex;
        justify-content: center;
        color: var(--ink-3);
      }
      .sp-tree-caret.is-empty { visibility: hidden; }
      .sp-tree-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-3);
        flex-shrink: 0;
      }
      .sp-tree-dot.is-concept { background: var(--concept); }
      .sp-tree-dot.is-source { background: var(--source); }
      .sp-tree-dot.is-person { background: var(--person); }
      .sp-tree-label { flex: 1; }
      .sp-tree-count {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      /* ============ FORM ============ */
      .sp-form { display: flex; flex-direction: column; gap: 20px; }
      .sp-field { display: flex; flex-direction: column; gap: 6px; }
      .sp-label {
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: 0.01em;
      }
      .sp-help {
        font-size: 11.5px;
        color: var(--ink-3);
        line-height: 1.5;
      }
      .sp-input, .sp-textarea {
        width: 100%;
        height: 34px;
        padding: 0 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 13.5px;
        color: var(--ink);
        outline: none;
        transition: border-color 0.1s;
      }
      .sp-input:hover, .sp-textarea:hover { border-color: var(--ink-3); }
      .sp-input:focus, .sp-textarea:focus { border-color: var(--ink); }
      .sp-textarea { height: auto; padding: 8px 10px; resize: vertical; }
      .sp-radio-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .sp-radio {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        font-size: 13px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        cursor: pointer;
        background: var(--paper);
        color: var(--ink-2);
      }
      .sp-radio:hover { border-color: var(--ink-3); color: var(--ink); }
      .sp-radio.is-selected {
        border-color: var(--primary);
        background: var(--paper-warm);
        color: var(--primary);
        font-weight: 500;
      }
      .sp-radio input { accent-color: var(--primary); margin: 0; }
      .sp-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--ink-line-soft);
      }
      .sp-ttf {
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 8px;
        background: var(--paper);
      }
      .sp-ttf-selected {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--ink-line-soft);
        margin-bottom: 6px;
      }
      .sp-ttf-list {
        max-height: 140px;
        overflow-y: auto;
      }
      .sp-ttf-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 6px;
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
      }
      .sp-ttf-row:hover { background: var(--hover); }
      .sp-ttf-row-label.is-concept,
      .sp-ttf-row-label.is-source,
      .sp-ttf-row-label.is-person { color: var(--ink-2); font-weight: 400; }

      /* ============ COMPONENT LIBRARY ============ */
      .sp-lib {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }
      .sp-lib-block {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 20px 22px;
      }
      .sp-lib-title {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 14px;
      }
      .sp-lib-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
      .sp-lib-row-vcenter { align-items: center; gap: 20px; }

      /* ============ BANNER ============ */
      .sp-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        background: var(--source-tint);
        color: var(--source-2);
        border-left: 3px solid var(--source);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        font-size: 13px;
        line-height: 1.5;
      }
      .sp-banner > div { flex: 1; }
      .sp-banner-action {
        background: transparent;
        border: 1px solid var(--source);
        color: var(--source-2);
        font-size: 12px;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: var(--r-sm);
        white-space: nowrap;
      }
      .sp-banner-action:hover { background: var(--source); color: var(--paper); }

      /* ============ EMPTY ============ */
      .sp-empty {
        text-align: center;
        padding: 16px;
      }
      .sp-empty-art {
        color: var(--ink-4);
        margin-bottom: 12px;
        display: flex;
        justify-content: center;
      }
      .sp-empty-stroke { stroke: currentColor; stroke-width: 1.4; fill: none; stroke-linecap: round; }
      .sp-empty-title {
        font-family: var(--serif);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
        margin-bottom: 4px;
      }
      .sp-empty-sub {
        font-size: 12.5px;
        color: var(--ink-3);
        max-width: 320px;
        margin: 0 auto;
        line-height: 1.5;
      }

      /* ============ SWITCH ============ */
      .sp-switch-wrap {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
      }
      .sp-switch {
        width: 32px;
        height: 18px;
        border-radius: var(--r-pill);
        border: 1px solid var(--ink-line);
        background: var(--paper-soft);
        position: relative;
        padding: 0;
        transition: background 0.15s, border-color 0.15s;
      }
      .sp-switch.is-on { background: var(--primary); border-color: var(--primary); }
      .sp-switch-thumb {
        position: absolute;
        top: 1px;
        left: 1px;
        width: 14px;
        height: 14px;
        background: var(--paper);
        border-radius: 50%;
        transition: transform 0.15s;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }
      .sp-switch.is-on .sp-switch-thumb { transform: translateX(14px); }
      .sp-switch-label { font-size: 13px; color: var(--ink-2); }

      /* ============ COLOR SYSTEM ============ */
      .sp-color-system {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 22px 24px 28px;
      }
      .sp-swatch-group { margin-top: 24px; }
      .sp-swatch-group:first-of-type { margin-top: 8px; }
      .sp-swatch-group-head { margin-bottom: 12px; }
      .sp-swatch-group-note {
        font-size: 12px;
        color: var(--ink-3);
        line-height: 1.55;
        max-width: 640px;
        margin-top: 2px;
      }
      .sp-swatches {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
      }
      .sp-swatch-card {
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        overflow: hidden;
        background: var(--paper);
      }
      .sp-swatch-strips { display: flex; flex-direction: column; }
      .sp-swatch-strip {
        height: 52px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        padding: 8px 12px;
        position: relative;
      }
      .sp-swatch-strip-tag {
        position: absolute;
        top: 9px;
        left: 12px;
        font-family: var(--sans);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .sp-swatch-strip-hex {
        font-family: var(--mono);
        font-size: 10.5px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        opacity: 0.92;
      }
      .sp-swatch-meta {
        padding: 10px 12px 12px;
        border-top: 1px solid var(--ink-line);
        background: var(--paper);
      }
      .sp-swatch-name {
        font-family: var(--serif);
        font-size: 14px;
        font-weight: 600;
        color: var(--ink);
        margin-bottom: 3px;
        letter-spacing: -0.005em;
      }
      .sp-swatch-role {
        font-size: 11.5px;
        color: var(--ink-3);
        line-height: 1.5;
      }

      /* ============ FOOTER ============ */
      .sp-footer {
        display: flex;
        justify-content: space-between;
        font-family: var(--serif);
        font-size: 12px;
        font-style: italic;
        color: var(--ink-3);
        padding: 32px 0 16px;
        border-top: 1px solid var(--ink-line);
        margin-top: 48px;
      }
      .sp-footer-meta { font-style: normal; font-family: var(--mono); }

      /* ============ RESPONSIVE ============ */
      @media (max-width: 1100px) {
        .sp-chart-row, .sp-two-col, .sp-lib { grid-template-columns: 1fr; }
        .sp-kpi-row { grid-template-columns: repeat(2, 1fr); }
        .sp-kpi { border-right: none; border-bottom: 1px solid var(--ink-line); }
        .sp-kpi:nth-child(even) { border-left: 1px solid var(--ink-line); }
        .sp-kpi:nth-last-child(-n+2) { border-bottom: none; }
      }
      @media (max-width: 860px) {
        .sp-shell { flex-direction: column; }
        .sp-sidebar { width: auto; border-right: none; border-bottom: 1px solid var(--ink-line); }
        .sp-topnav { grid-template-columns: 1fr auto; }
        .sp-topnav-center { display: none; }
        .sp-search { width: 180px; }
        .sp-main { padding: 24px 20px 48px; }
        .sp-radio-grid { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  );
}

// SPStyles is re-used by AdminStyleGuide so the docs and the demo never drift.
export { SPStyles };

