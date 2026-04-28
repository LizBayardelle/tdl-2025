import React, { useState, useMemo } from 'react';
import { SPStyles } from '../SamplePage';
import MagicSparkles from '../icons/MagicSparkles';

// =====================================================================
// AdminStyleGuide
// Lives at /admin/docs/style-guide.  Documents the design system used
// at /samplepage so the rest of the site can be migrated to it.
// Reuses the exact same CSS as SamplePage to stay in sync.
// =====================================================================

export default function AdminStyleGuide() {
  return (
    <div className="sp-root sg-host">
      <SPStyles />
      <SGLocalStyles />

      <SGHero />

      <SGSection id="principles" eyebrow="Foundations" title="Principles">
        <SGPrinciples />
      </SGSection>

      <SGSection id="color" eyebrow="Foundations" title="Color">
        <SGColor />
      </SGSection>

      <SGSection id="typography" eyebrow="Foundations" title="Typography">
        <SGTypography />
      </SGSection>

      <SGSection id="space" eyebrow="Foundations" title="Spacing & Radii">
        <SGSpacing />
      </SGSection>

      <SGSection id="actions" eyebrow="Components" title="Actions">
        <SGActions />
      </SGSection>

      <SGSection id="inputs" eyebrow="Components" title="Inputs & Form Fields">
        <SGInputs />
      </SGSection>

      <SGSection id="chips" eyebrow="Components" title="Chips & Status">
        <SGChips />
      </SGSection>

      <SGSection id="banners" eyebrow="Components" title="Banners & Empty States">
        <SGBannersEmpty />
      </SGSection>

      <SGSection id="icons" eyebrow="Components" title="Iconography">
        <SGIconography />
      </SGSection>

      <SGSection id="kpi" eyebrow="Patterns" title="KPI Cards">
        <SGKPI />
      </SGSection>

      <SGSection id="filter" eyebrow="Patterns" title="Type-to-Filter">
        <SGTypeToFilter />
      </SGSection>

      <SGSection id="tree" eyebrow="Patterns" title="Hierarchical Tree">
        <SGTree />
      </SGSection>

      <SGSection id="table" eyebrow="Patterns" title="Tables">
        <SGTable />
      </SGSection>

      <SGSection id="charts" eyebrow="Patterns" title="Charts & Relationship Map">
        <SGCharts />
      </SGSection>

      <SGSection id="theming" eyebrow="System" title="Light & Dark Theming">
        <SGTheming />
      </SGSection>

      <SGSection id="migration" eyebrow="System" title="Migration Notes">
        <SGMigration />
      </SGSection>
    </div>
  );
}

// =====================================================================
// Hero
// =====================================================================

function SGHero() {
  return (
    <header className="sg-hero">
      <div className="sg-hero-eyebrow">Linchpin Industries · Map My Research</div>
      <h1 className="sg-hero-title">Style Guide</h1>
      <p className="sg-hero-lead">
        The reference for every screen, component, and word the user encounters.
        It mirrors the system at <a className="sg-link" href="/samplepage" target="_blank" rel="noopener noreferrer">/samplepage</a>.
        If the demo and this document disagree, the demo is wrong.
      </p>
      <SGToc />
    </header>
  );
}

function SGToc() {
  const groups = [
    { label: 'Foundations', items: [['principles', 'Principles'], ['color', 'Color'], ['typography', 'Typography'], ['space', 'Spacing & Radii']] },
    { label: 'Components',  items: [['actions', 'Actions'], ['inputs', 'Inputs'], ['chips', 'Chips & Status'], ['banners', 'Banners & Empty States'], ['icons', 'Iconography']] },
    { label: 'Patterns',    items: [['kpi', 'KPI Cards'], ['filter', 'Type-to-Filter'], ['tree', 'Hierarchical Tree'], ['table', 'Tables'], ['charts', 'Charts']] },
    { label: 'System',      items: [['theming', 'Theming'], ['migration', 'Migration Notes']] },
  ];
  return (
    <nav className="sg-toc" aria-label="Table of contents">
      {groups.map((g) => (
        <div key={g.label} className="sg-toc-group">
          <div className="sg-toc-label">{g.label}</div>
          <ul className="sg-toc-list">
            {g.items.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="sg-toc-link">{label}</a></li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// =====================================================================
// Section wrapper
// =====================================================================

function SGSection({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="sg-section">
      <div className="sg-section-head">
        <div className="sg-eyebrow">{eyebrow}</div>
        <h2 className="sg-section-title">{title}</h2>
      </div>
      <div className="sg-section-body">{children}</div>
    </section>
  );
}

function SGBlock({ title, classes, notes, dont, children }) {
  return (
    <div className="sg-block">
      <div className="sg-block-head">
        <h3 className="sg-block-title">{title}</h3>
        {classes && (
          <div className="sg-classes">
            {classes.map((c) => <code key={c} className="sg-code-inline">.{c}</code>)}
          </div>
        )}
      </div>
      <div className="sg-block-preview">{children}</div>
      {(notes || dont) && (
        <div className="sg-block-notes">
          {notes && <div className="sg-note"><span className="sg-note-tag">Use</span> {notes}</div>}
          {dont && <div className="sg-note sg-note-dont"><span className="sg-note-tag">Don't</span> {dont}</div>}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Foundations
// =====================================================================

function SGPrinciples() {
  const list = [
    ['Ink on paper.', 'White is the default surface.  Hairline borders, not shadows, do the structural work.'],
    ['Type does the heavy lifting.', 'Hierarchy is built with serif vs. sans, weight, and size — not color or boxes.'],
    ['Color is categorical, not decorative.', 'Concept, Source, and Person each get one ink.  Everything else stays neutral.'],
    ['Density where it matters.', 'Sidebars, tables, and filters are dense.  Reading surfaces breathe.'],
    ['Restraint over animation.', 'Subtle transitions on hover.  Nothing pulses, bounces, or floats.'],
    ['Numerals are typeset.', 'Tabular figures in tables and counts.  Lining serif numerals in KPIs.'],
    ['Consequential copy is formal.', 'Destructive and irreversible actions name the consequence in full.'],
  ];
  return (
    <ol className="sg-principles">
      {list.map(([h, b], i) => (
        <li key={i} className="sg-principle">
          <span className="sg-principle-n">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <div className="sg-principle-h">{h}</div>
            <div className="sg-principle-b">{b}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const COLOR_GROUPS = [
  { label: 'Categorical', swatches: [
    { name: 'Concept',      token: '--concept',      light: '#48A27E', dark: '#7DC9A3' },
    { name: 'Source',       token: '--source',       light: '#4976B1', dark: '#7FA5D1' },
    { name: 'Person',       token: '--person',       light: '#614498', dark: '#9577C8' },
  ]},
  { label: 'Categorical Tints', swatches: [
    { name: 'Concept tint', token: '--concept-tint', light: '#E8F4EE', dark: '#1A2E25' },
    { name: 'Source tint',  token: '--source-tint',  light: '#EBF1F8', dark: '#1F2D40' },
    { name: 'Person tint',  token: '--person-tint',  light: '#EEEAF5', dark: '#26203A' },
  ]},
  { label: 'Surfaces', swatches: [
    { name: 'Paper',        token: '--paper',        light: '#FFFFFF', dark: '#0F1217' },
    { name: 'Paper Soft',   token: '--paper-soft',   light: '#F7F8FA', dark: '#161A20' },
    { name: 'Paper Warm',   token: '--paper-warm',   light: '#EEF0F3', dark: '#1B1F26' },
  ]},
  { label: 'Ink', swatches: [
    { name: 'Ink',          token: '--ink',          light: '#15191F', dark: '#E8EBEF' },
    { name: 'Ink 2',        token: '--ink-2',        light: '#3F454E', dark: '#B5B9C0' },
    { name: 'Ink 3',        token: '--ink-3',        light: '#71777F', dark: '#888D95' },
    { name: 'Ink 4',        token: '--ink-4',        light: '#A4A9B1', dark: '#565B63' },
    { name: 'Ink Line',     token: '--ink-line',     light: '#E1E4E8', dark: '#2A2F38' },
  ]},
  { label: 'State', swatches: [
    { name: 'Error',        token: '--error',        light: '#7A2E2E', dark: '#C77676' },
    { name: 'Warning',      token: '--warning',      light: '#8B5A3C', dark: '#C99878' },
  ]},
];

function SGColor() {
  return (
    <div>
      <p className="sg-prose">
        Each token has a light and dark sibling.  Use the CSS variable on the token row, not the hex.
        Reach for color only when the meaning is categorical (entity type) or signal (error, warning).  Everything else is ink.
      </p>
      <p className="sg-prose">
        <strong>Categorical color is reserved for Concept, Source, and Person.</strong>  Notes, tags, collections, and every other secondary entity render in the ink scale.  In nav and chips, that means <code className="sg-code-inline">--ink-2</code> text on neutral surfaces, never an accent color.  This keeps the three primary entities visually parseable at a glance.
      </p>
      {COLOR_GROUPS.map((g) => (
        <div key={g.label} className="sg-color-group">
          <div className="sg-color-group-label">{g.label}</div>
          <div className="sg-color-grid">
            {g.swatches.map((s) => <SGSwatch key={s.name} {...s} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SGSwatch({ name, token, light, dark }) {
  return (
    <div className="sg-swatch">
      <div className="sg-swatch-strips">
        <div className="sg-swatch-strip" style={{ background: light, color: textOn(light) }}>
          <span className="sg-swatch-tag">L</span>
          <span className="sg-swatch-hex">{light.toUpperCase()}</span>
        </div>
        <div className="sg-swatch-strip" style={{ background: dark, color: textOn(dark) }}>
          <span className="sg-swatch-tag">D</span>
          <span className="sg-swatch-hex">{dark.toUpperCase()}</span>
        </div>
      </div>
      <div className="sg-swatch-meta">
        <div className="sg-swatch-name">{name}</div>
        <code className="sg-swatch-token">{token}</code>
      </div>
    </div>
  );
}

function textOn(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? 'rgba(20, 20, 15, 0.78)' : 'rgba(255, 255, 250, 0.92)';
}

function SGTypography() {
  return (
    <div>
      <div className="sg-type-families">
        <div className="sg-type-family">
          <div className="sg-eyebrow">Display + Numerals</div>
          <div className="sg-type-name" style={{ fontFamily: 'var(--serif)' }}>Source Serif 4</div>
          <div className="sg-type-meta">Page titles, KPIs, accents.  <code className="sg-code-inline">var(--serif)</code></div>
          <div className="sg-type-specimen sg-type-specimen-serif">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
            abcdefghijklmnopqrstuvwxyz<br />
            0123456789 — &amp; ?
          </div>
        </div>
        <div className="sg-type-family">
          <div className="sg-eyebrow">Body + UI</div>
          <div className="sg-type-name" style={{ fontFamily: 'var(--sans)' }}>Source Sans 3</div>
          <div className="sg-type-meta">Body, labels, controls.  <code className="sg-code-inline">var(--sans)</code></div>
          <div className="sg-type-specimen sg-type-specimen-sans">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
            abcdefghijklmnopqrstuvwxyz<br />
            0123456789 — &amp; ?
          </div>
        </div>
        <div className="sg-type-family">
          <div className="sg-eyebrow">Tabular & Identifiers</div>
          <div className="sg-type-name" style={{ fontFamily: 'var(--mono)' }}>JetBrains Mono</div>
          <div className="sg-type-meta">DOIs, hex, counts.  <code className="sg-code-inline">var(--mono)</code></div>
          <div className="sg-type-specimen sg-type-specimen-mono">
            10.1037/0003-066X.46.4.333<br />
            #48A27E · 1,284 · 2026-04-26
          </div>
        </div>
      </div>

      <div className="sg-type-scale">
        <div className="sg-eyebrow">Scale</div>
        <table className="sg-mini-table">
          <thead>
            <tr><th>Role</th><th>Family</th><th>Size</th><th>Specimen</th></tr>
          </thead>
          <tbody>
            <tr><td>Page title</td><td>Serif 600</td><td>36 / 1.1</td><td className="sg-type-row" style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600 }}>Cross-reference Everything</td></tr>
            <tr><td>Section title</td><td>Serif 600</td><td>22 / 1.2</td><td className="sg-type-row" style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600 }}>Sources in This Collection</td></tr>
            <tr><td>Card title</td><td>Serif 600</td><td>18 / 1.2</td><td className="sg-type-row" style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600 }}>Reading Volume</td></tr>
            <tr><td>Body</td><td>Sans 400</td><td>15 / 1.55</td><td className="sg-type-row">A workspace for the work between sources.</td></tr>
            <tr><td>UI label</td><td>Sans 500</td><td>13 / 1.5</td><td className="sg-type-row" style={{ fontWeight: 500, fontSize: 13 }}>Add Source</td></tr>
            <tr><td>Eyebrow</td><td>Sans 700, tracked</td><td>10.5</td><td className="sg-type-row sg-type-row-eyebrow">CONCEPTS</td></tr>
            <tr><td>Mono / DOI</td><td>Mono 400</td><td>10.5</td><td className="sg-type-row" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>10.1037/0003-066X.46.4.333</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SGSpacing() {
  const radii = [
    ['--r-sm', '2px', 'Inputs, chips, action buttons'],
    ['--r-md', '4px', 'Cards, surface containers'],
    ['--r-lg', '6px', 'Larger surfaces (rare)'],
    ['--r-pill', '999px', 'Avatars, dots, full-rounded chips'],
  ];
  return (
    <div className="sg-two">
      <div>
        <div className="sg-eyebrow">Spacing scale</div>
        <p className="sg-prose">
          Use the literal pixel values until tokens are extracted.  Most surface padding is 20–24px; section gaps are 32–40px.
        </p>
        <div className="sg-spacing-row">
          {[4, 8, 12, 16, 20, 24, 32, 48, 64].map((n) => (
            <div key={n} className="sg-spacing-cell">
              <div className="sg-spacing-block" style={{ width: n, height: n }} />
              <div className="sg-spacing-num">{n}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="sg-eyebrow">Radii</div>
        <table className="sg-mini-table">
          <thead><tr><th>Token</th><th>Value</th><th>Use</th></tr></thead>
          <tbody>
            {radii.map(([t, v, u]) => (
              <tr key={t}><td><code className="sg-code-inline">{t}</code></td><td>{v}</td><td>{u}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================================
// Components
// =====================================================================

function SGActions() {
  return (
    <>
      <SGBlock
        title="Action Variants"
        classes={['sp-action', 'sp-action-primary', 'sp-action-secondary', 'sp-action-quiet', 'sp-action-danger']}
        notes="One primary action per screen.  Secondary handles the cancel / back direction.  Quiet for in-context actions inside a row or table.  Danger only for irreversible operations."
        dont="Stack two primary actions side by side.  If you have two important actions, one of them isn't important."
      >
        <div className="sg-row">
          <button className="sp-action sp-action-primary">Save Concept</button>
          <button className="sp-action sp-action-secondary">Cancel</button>
          <button className="sp-action sp-action-quiet">Tag</button>
          <button className="sp-action sp-action-quiet sp-action-danger">Remove</button>
          <button className="sp-action sp-action-primary" disabled>Disabled</button>
        </div>
      </SGBlock>

      <SGBlock
        title="Icon Actions"
        classes={['sp-icon-action', 'sp-icon-action-quiet']}
        notes="Always pair with aria-label.  The framed variant lives in chrome (top nav, toolbars).  The quiet variant lives inside cards or tables."
      >
        <div className="sg-row">
          <button className="sp-icon-action" aria-label="Filter"><SGIcon name="filter" /></button>
          <button className="sp-icon-action" aria-label="More"><SGIcon name="more" /></button>
          <button className="sp-icon-action-quiet" aria-label="More"><SGIcon name="more" /></button>
          <button className="sp-icon-action-quiet" aria-label="Download"><SGIcon name="download" /></button>
        </div>
      </SGBlock>
    </>
  );
}

function SGInputs() {
  const [type, setType] = useState('intervention');
  return (
    <>
      <SGBlock
        title="Text Input"
        classes={['sp-input', 'sp-label', 'sp-help']}
        notes="Always pair with a sentence-case label and, when the field needs context, a short help string."
      >
        <div className="sp-field" style={{ maxWidth: 360 }}>
          <label className="sp-label">Label</label>
          <input className="sp-input" placeholder="e.g. Mentalization-Based Treatment" />
          <div className="sp-help">Required.  The canonical name as it appears in the literature.</div>
        </div>
      </SGBlock>

      <SGBlock
        title="Textarea"
        classes={['sp-textarea']}
        notes="Auto-grows vertically.  Same border treatment as text input."
      >
        <div className="sp-field" style={{ maxWidth: 480 }}>
          <label className="sp-label">Definition</label>
          <textarea className="sp-textarea" rows="3" placeholder="A short, citable definition.  Plain language." />
        </div>
      </SGBlock>

      <SGBlock
        title="Radio Grid"
        classes={['sp-radio-grid', 'sp-radio']}
        notes="Use when the user picks one of a small, fixed set.  More than ~6 options, prefer a select or a type-to-filter."
      >
        <div className="sp-field" style={{ maxWidth: 540 }}>
          <label className="sp-label">Type</label>
          <div className="sp-radio-grid">
            {['intervention','pathology','measurement','school','physical','symptom'].map((v) => (
              <label key={v} className={`sp-radio ${type === v ? 'is-selected' : ''}`}>
                <input type="radio" name="sg-type" checked={type === v} onChange={() => setType(v)} />
                <span style={{ textTransform: 'capitalize' }}>{v}</span>
              </label>
            ))}
          </div>
        </div>
      </SGBlock>

      <SGBlock
        title="Checkbox"
        classes={['sp-checkbox']}
        notes="Custom-painted with the ink color.  Supports indeterminate via the DOM property."
      >
        <div className="sg-row sg-row-vcenter">
          <label className="sg-row sg-row-vcenter" style={{ gap: 8 }}>
            <input type="checkbox" className="sp-checkbox" defaultChecked /> <span>Auto-import metadata</span>
          </label>
          <label className="sg-row sg-row-vcenter" style={{ gap: 8 }}>
            <input type="checkbox" className="sp-checkbox" /> <span>Include unread</span>
          </label>
        </div>
      </SGBlock>

      <SGBlock
        title="Switch"
        classes={['sp-switch', 'sp-switch-wrap']}
        notes="Use for a setting that takes effect immediately.  Use a checkbox when the user is composing a form to be submitted."
      >
        <div className="sg-row sg-row-vcenter" style={{ gap: 24 }}>
          <SGMiniSwitch defaultChecked label="Auto-import metadata from DOI" />
          <SGMiniSwitch label="Suggest related concepts on save" />
        </div>
      </SGBlock>
    </>
  );
}

function SGMiniSwitch({ defaultChecked, label }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="sp-switch-wrap">
      <button type="button" className={`sp-switch ${on ? 'is-on' : ''}`} role="switch" aria-checked={on} onClick={() => setOn(!on)}>
        <span className="sp-switch-thumb" />
      </button>
      <span className="sp-switch-label">{label}</span>
    </label>
  );
}

function SGChips() {
  return (
    <>
      <SGBlock
        title="Chips by Category"
        classes={['sp-chip', 'sp-chip.is-concept', 'sp-chip.is-source', 'sp-chip.is-person', 'sp-chip.is-neutral']}
        notes="Color-coded for entity type.  Use neutral for tags, collections, and any category that isn't Concept / Source / Person."
        dont="Mix concept color with source data, or vice versa.  The color is the meaning."
      >
        <div className="sg-row">
          <span className="sp-chip is-concept">Attachment Theory</span>
          <span className="sp-chip is-source">Bowlby (1969)</span>
          <span className="sp-chip is-person">Ainsworth, M.</span>
          <span className="sp-chip is-neutral">Thesis Ch. 3</span>
        </div>
      </SGBlock>

      <SGBlock
        title="Removable Chips"
        classes={['sp-chip-removable', 'sp-chip-x']}
        notes="Inside type-to-filter selections, multi-select inputs, and active filter bars."
      >
        <div className="sg-row">
          <span className="sp-chip is-concept sp-chip-removable">
            Attachment Theory
            <button className="sp-chip-x" aria-label="Remove"><SGIcon name="x" size={9} /></button>
          </span>
          <span className="sp-chip is-source sp-chip-removable">
            Bowlby (1969)
            <button className="sp-chip-x" aria-label="Remove"><SGIcon name="x" size={9} /></button>
          </span>
        </div>
      </SGBlock>

      <SGBlock
        title="Status"
        classes={['sp-status', 'sp-status.is-read', 'sp-status.is-reading', 'sp-status.is-unread']}
        notes="A dot and a word.  Use for read state, processing state, and any tri-state that benefits from visual scanning."
      >
        <div className="sg-row sg-row-vcenter">
          <span className="sp-status is-read"><span className="sp-status-dot" /> Read</span>
          <span className="sp-status is-reading"><span className="sp-status-dot" /> In progress</span>
          <span className="sp-status is-unread"><span className="sp-status-dot" /> Unread</span>
        </div>
      </SGBlock>
    </>
  );
}

function SGBannersEmpty() {
  return (
    <>
      <SGBlock
        title="Banner"
        classes={['sp-banner', 'sp-banner-action']}
        notes="Inline notice, non-blocking.  Use when there's a discoverable problem or an opt-in action.  Keep the headline a full sentence; put the action in the button."
        dont="Stack multiple banners on a page.  Pick the most important one."
      >
        <div className="sp-banner">
          <SGIcon name="info" />
          <div>
            <strong>3 sources have incomplete metadata.</strong> Most researchers fill these in before exporting a citation list.
          </div>
          <button className="sp-banner-action">Review</button>
        </div>
      </SGBlock>

      <SGBlock
        title="Empty State"
        classes={['sp-empty', 'sp-empty-title', 'sp-empty-sub']}
        notes="Two lines, one quiet illustration.  Tell the user what's missing and the smallest first action that fills it."
        dont="Use cheery language ('No notes yet — let's add one!').  State the condition, then the action."
      >
        <div className="sp-empty" style={{ padding: 24 }}>
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
      </SGBlock>
    </>
  );
}

function SGIconography() {
  return (
    <SGBlock
      title="Magic Sparkles — AI-assisted actions"
      classes={['MagicSparkles', '.sfm-magic-btn']}
      notes={
        <>
          The four-point sparkle is the contract: it always means "Haiku does this for me."
          Pair it with the verb of the action ("Auto-tag", "Suggest with Haiku", "Enrich") and pulse it while the call is in flight.
          Use the source-tint chip treatment so the button reads as an offer, not a primary action.
        </>
      }
      dont="Use the sparkles for ornament, for non-AI actions, or for AI actions that just open a modal without doing the work.  If the user still has to make every choice, no sparkles."
    >
      <div className="sg-magic-row">
        <button type="button" className="sg-magic-btn">
          <MagicSparkles size={13} />
          Suggest with Haiku
        </button>
        <button type="button" className="sg-magic-btn">
          <MagicSparkles size={13} spinning />
          Tagging.
        </button>
        <button type="button" className="sg-magic-btn" disabled>
          <MagicSparkles size={13} />
          Auto-tag
        </button>
        <span className="sg-magic-hint">Idle · Working · Disabled (until prerequisite met)</span>
      </div>
    </SGBlock>
  );
}

// =====================================================================
// Patterns
// =====================================================================

function SGKPI() {
  return (
    <SGBlock
      title="KPI Row"
      classes={['sp-kpi-row', 'sp-kpi', 'sp-kpi-label.is-concept|is-source|is-person', 'sp-kpi-value', 'sp-kpi-delta']}
      notes="Up to four primary metrics.  Eyebrow uses the category color (or neutral).  Numeral is serif lining figures.  Delta is one short clause."
      dont="Use color on the numeral itself.  Reserve category color for the label."
    >
      <div className="sp-kpi-row">
        <div className="sp-kpi"><div className="sp-kpi-label is-source">Sources</div><div className="sp-kpi-value">61</div><div className="sp-kpi-delta">+4 this week</div></div>
        <div className="sp-kpi"><div className="sp-kpi-label is-concept">Concepts</div><div className="sp-kpi-value">18</div><div className="sp-kpi-delta">+2 this week</div></div>
        <div className="sp-kpi"><div className="sp-kpi-label is-person">People</div><div className="sp-kpi-value">27</div><div className="sp-kpi-delta">unchanged</div></div>
        <div className="sp-kpi"><div className="sp-kpi-label">Notes</div><div className="sp-kpi-value">142</div><div className="sp-kpi-delta">+11 this week</div></div>
      </div>
    </SGBlock>
  );
}

function SGTypeToFilter() {
  const options = ['Attachment Theory','CBT','Object Relations','Anxiety Disorders','Internal Working Models','Exposure Therapy','SSRI Treatment'];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set(['Attachment Theory']));
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [query]);
  const toggle = (v) => {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    setSelected(next);
  };
  return (
    <SGBlock
      title="Type-to-Filter with Self-Filtering Checkboxes"
      classes={['sp-ttf', 'sp-ttf-input', 'sp-ttf-list', 'sp-ttf-row']}
      notes="The default for any 'pick from a known list' input where the list is longer than ~6 items.  Selected chips render at top; the input narrows the list below.  Same pattern in sidebar filters and form fields."
    >
      <div className="sp-ttf" style={{ maxWidth: 360 }}>
        {selected.size > 0 && (
          <div className="sp-ttf-selected">
            {Array.from(selected).map((v) => (
              <span key={v} className="sp-chip is-concept sp-chip-removable">
                {v}
                <button className="sp-chip-x" aria-label="Remove" onClick={() => toggle(v)}><SGIcon name="x" size={9} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="sp-ttf-input-wrap">
          <SGIcon name="search" size={12} />
          <input className="sp-ttf-input" placeholder="Link a concept" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="sp-ttf-list">
          {filtered.length === 0 && <div className="sp-filter-empty">No matches.</div>}
          {filtered.map((o) => (
            <label key={o} className="sp-ttf-row">
              <input type="checkbox" className="sp-checkbox" checked={selected.has(o)} onChange={() => toggle(o)} />
              <span className="sp-ttf-row-label is-concept">{o}</span>
            </label>
          ))}
        </div>
      </div>
    </SGBlock>
  );
}

function SGTree() {
  return (
    <SGBlock
      title="Hierarchical Tree"
      classes={['sp-tree', 'sp-tree-row', 'sp-tree-caret', 'sp-tree-dot.is-concept|is-source|is-person', 'sp-tree-count']}
      notes="Use for taxonomies that have a true parent-child structure.  Don't fake hierarchy with indentation when items are independent."
    >
      <div className="sp-tree" style={{ margin: 0, border: '1px solid var(--ink-line)', borderRadius: 'var(--r-md)' }}>
        <div className="sp-tree-row" style={{ paddingLeft: 12 }}>
          <span className="sp-tree-caret"><SGIcon name="caret-down" size={9} /></span>
          <span className="sp-tree-dot is-concept" />
          <span className="sp-tree-label">Anxiety Disorders</span>
          <span className="sp-tree-count">187</span>
        </div>
        <div className="sp-tree-row" style={{ paddingLeft: 30 }}>
          <span className="sp-tree-caret is-empty" />
          <span className="sp-tree-dot is-concept" />
          <span className="sp-tree-label">Generalized Anxiety</span>
          <span className="sp-tree-count">64</span>
        </div>
        <div className="sp-tree-row" style={{ paddingLeft: 30 }}>
          <span className="sp-tree-caret is-empty" />
          <span className="sp-tree-dot is-concept" />
          <span className="sp-tree-label">Panic Disorder</span>
          <span className="sp-tree-count">41</span>
        </div>
      </div>
    </SGBlock>
  );
}

function SGTable() {
  return (
    <SGBlock
      title="Table"
      classes={['sp-table', 'sp-th', 'sp-th-num', 'sp-td-doi', 'sp-td-num', 'sp-link']}
      notes="Hairline rows, sortable headers, hover and selected states.  Numerals are mono and tabular.  DOIs and IDs are mono one size smaller than body."
      dont="Use vertical borders.  Zebra rows.  Bold every other cell.  Restraint."
    >
      <div style={{ border: '1px solid var(--ink-line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <table className="sp-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Authors</th>
              <th className="sp-th-num">Year</th>
              <th>Concepts</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a href="#" className="sp-link" onClick={(e) => e.preventDefault()}>The Other Side of the Coin</a>
                <div className="sp-td-doi">10.1037/0033-2909.131.2.180</div>
              </td>
              <td className="sp-td-people">Mikulincer, M., Shaver, P. R.</td>
              <td className="sp-td-num">2007</td>
              <td><span className="sp-chip is-concept">Attachment Theory</span></td>
            </tr>
            <tr>
              <td>
                <a href="#" className="sp-link" onClick={(e) => e.preventDefault()}>Cognitive Therapy for Depression</a>
                <div className="sp-td-doi">10.1016/S0140-6736(02)08259-3</div>
              </td>
              <td className="sp-td-people">Beck, A. T.</td>
              <td className="sp-td-num">1979</td>
              <td><span className="sp-chip is-concept">CBT</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </SGBlock>
  );
}

function SGCharts() {
  return (
    <div>
      <p className="sg-prose">
        Charts use the categorical inks for fills.  Grids are hairlines.  Tick labels are mono.  See <a className="sg-link" href="/samplepage" target="_blank" rel="noopener noreferrer">/samplepage</a> for live examples of the bar chart, distribution chart, and the radial relationship map.
      </p>
      <div className="sg-list">
        <div><strong>Bar / sparkline.</strong>  Color the bars with the category ink (concept/source/person) when the metric belongs to one entity type.  Otherwise <code className="sg-code-inline">--ink-2</code>.</div>
        <div><strong>Horizontal distribution.</strong>  Track in <code className="sg-code-inline">--ink-line-soft</code>; fill in the entity color.  Right-aligned tabular value.</div>
        <div><strong>Radial relationship map.</strong>  Center node at <code className="sg-code-inline">.sp-net-label-lg</code> (serif).  Two concentric guide rings, dashed.  Halos in <code className="sg-code-inline">--*-tint</code>; nodes in entity ink.  Edges hairline.</div>
      </div>
    </div>
  );
}

// =====================================================================
// System
// =====================================================================

function SGTheming() {
  return (
    <div>
      <p className="sg-prose">
        Light and dark are toggled by setting <code className="sg-code-inline">data-theme="dark"</code> on the design-system root element.  All component styles read from CSS custom properties, so no class changes are required when the theme flips.
      </p>
      <pre className="sg-code-block">
{`<div className="sp-root" data-theme={theme}>
  ...components...
</div>`}
      </pre>
      <p className="sg-prose">
        Persist the user's choice in <code className="sg-code-inline">localStorage</code>.  Default to system preference (<code className="sg-code-inline">prefers-color-scheme</code>) on first visit.
      </p>
    </div>
  );
}

function SGMigration() {
  return (
    <div>
      <p className="sg-prose">
        Today the new system lives only at <code className="sg-code-inline">/samplepage</code> and on this doc, scoped to <code className="sg-code-inline">.sp-root</code>.  The rest of the site still uses the old design tokens (Merriweather, army green, brass gold, etc.) loaded from <code className="sg-code-inline">design-system.css</code>.  We migrate page by page, tracked in <a className="sg-link" href="/admin/docs/page-audit">Page Audit</a>.
      </p>

      <h3 className="sg-h3">Order of operations</h3>
      <ol className="sg-numbered">
        <li><strong>Per page, refactor in place.</strong>  Replace old class names with the new <code className="sg-code-inline">sp-*</code> classes.  Wrap the page content in a <code className="sg-code-inline">.sp-root</code> so the new tokens take over for that surface only.</li>
        <li><strong>Strip old chrome opportunistically.</strong>  When a page is converted, remove its old inline styles and any orphaned class names.  Don't touch shared components (top nav, sidebar) until their own pass.</li>
        <li><strong>Convert shared chrome last.</strong>  Top nav, modal, and sidebar.  These are touched by every page; converting them last means we know the tokens have settled.</li>
        <li><strong>Hold the rename.</strong>  Keep <code className="sg-code-inline">sp-*</code> as the prefix throughout migration.  When the old system is fully removed, rename to a permanent prefix in one focused pass.</li>
      </ol>

      <h3 className="sg-h3">Priority order</h3>
      <ol className="sg-numbered">
        <li>Homepage hero (<code className="sg-code-inline">/</code>) — high-stakes copy, brand voice doc already flagged it for revision.</li>
        <li>Authenticated dashboard (<code className="sg-code-inline">/dashboard</code>).</li>
        <li>Concepts, Sources, People index pages — most-used surfaces.</li>
        <li>Concept, Source, Person show pages.</li>
        <li>Notes, Tags, Collections.</li>
        <li>Admin pages (already a quieter surface; converts well).</li>
        <li>Auth (Devise) views — last, lowest traffic.</li>
        <li>Shared chrome — top nav, modal base, sidebar.</li>
      </ol>

      <h3 className="sg-h3">Conventions while migrating</h3>
      <div className="sg-list">
        <div><strong>One surface at a time.</strong>  A PR per page, or per show/index pair.  No cross-cutting refactors.</div>
        <div><strong>No gradual color drift.</strong>  When a page is converted, every visible color comes from the new tokens.  Don't leave army green on one button.</div>
        <div><strong>Brand voice applies in parallel.</strong>  Use the migration as the moment to update the page's copy to match the brand voice.  Em dashes go.  Cheery microcopy goes.  Destructive confirms get formal.</div>
        <div><strong>Test in both themes.</strong>  Every converted page renders correctly in light and dark.</div>
      </div>

      <h3 className="sg-h3">What to delete (eventually)</h3>
      <div className="sg-list">
        <div><code className="sg-code-inline">app/assets/stylesheets/design-system.css</code> — once no page references it.</div>
        <div><code className="sg-code-inline">app/views/layouts/application.html.erb</code> Merriweather + Inter font loads — replaced with Source Serif 4 + Source Sans 3 + JetBrains Mono.</div>
        <div>The army green / brass / steel category colors.  All entity color is sourced from <code className="sg-code-inline">--concept</code>, <code className="sg-code-inline">--source</code>, <code className="sg-code-inline">--person</code>.</div>
      </div>
    </div>
  );
}

// =====================================================================
// Icons (subset, mirrored from SamplePage)
// =====================================================================

function SGIcon({ name, size = 14 }) {
  const s = { width: size, height: size, flexShrink: 0 };
  switch (name) {
    case 'search':    return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" strokeLinecap="round" /></svg>;
    case 'x':         return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
    case 'caret-down':return <svg style={s} viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4z" /></svg>;
    case 'more':      return <svg style={s} viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="12.5" cy="8" r="1.2" /></svg>;
    case 'filter':    return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h12l-4.5 6V14L6.5 12.5V9L2 3z" /></svg>;
    case 'download':  return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8M4.5 7L8 10.5 11.5 7" /><path d="M3 13h10" /></svg>;
    case 'info':      return <svg style={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 7v4" /><circle cx="8" cy="5" r="0.7" fill="currentColor" stroke="none" /></svg>;
    default:          return <svg style={s} viewBox="0 0 16 16" />;
  }
}

// =====================================================================
// Style guide local styles — wraps the SP system with doc-specific layout
// =====================================================================

function SGLocalStyles() {
  return (
    <style>{`
      .sg-host {
        max-width: 980px;
        margin: 0 auto;
        padding: 0 0 64px;
      }

      /* Magic-sparkles demo row */
      .sg-magic-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .sg-magic-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--sans);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--source-2);
        background: var(--source-tint);
        border: 1px solid color-mix(in srgb, var(--source) 30%, transparent);
        border-radius: var(--r-sm);
        padding: 4px 10px;
        cursor: pointer;
      }
      .sg-magic-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--source-tint) 60%, var(--source) 40%);
        color: var(--paper);
        border-color: var(--source);
      }
      .sg-magic-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      .sg-magic-hint {
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--ink-3);
        font-style: italic;
      }

      /* Hero */
      .sg-hero { padding-bottom: 32px; border-bottom: 1px solid var(--ink-line); margin-bottom: 32px; }
      .sg-hero-eyebrow {
        font-family: var(--sans);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 12px;
      }
      .sg-hero-title {
        font-family: var(--serif);
        font-size: 44px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.02em;
        line-height: 1.05;
        margin: 0;
      }
      .sg-hero-lead {
        font-family: var(--sans);
        font-size: 16px;
        color: var(--ink-2);
        line-height: 1.65;
        max-width: 680px;
        margin-top: 14px;
      }

      /* TOC */
      .sg-toc {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-top: 32px;
        padding: 20px 0 0;
        border-top: 1px solid var(--ink-line-soft);
      }
      .sg-toc-group {}
      .sg-toc-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 8px;
      }
      .sg-toc-list { display: flex; flex-direction: column; gap: 4px; }
      .sg-toc-link {
        font-size: 13px;
        color: var(--ink-2);
        line-height: 1.6;
        border-bottom: 1px solid transparent;
        display: inline-block;
      }
      .sg-toc-link:hover { color: var(--ink); border-color: var(--ink-3); }

      /* Section */
      .sg-section {
        padding: 32px 0;
        border-bottom: 1px solid var(--ink-line);
      }
      .sg-section:last-child { border-bottom: none; }
      .sg-section-head { margin-bottom: 24px; }
      .sg-eyebrow {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 8px;
      }
      .sg-section-title {
        font-family: var(--serif);
        font-size: 28px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.015em;
        line-height: 1.15;
      }
      .sg-section-body { display: flex; flex-direction: column; gap: 20px; }
      .sg-h3 {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 24px 0 10px;
      }

      /* Block */
      .sg-block {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 22px 24px;
      }
      .sg-block-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .sg-block-title {
        font-family: var(--serif);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
      }
      .sg-classes {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .sg-block-preview {
        padding: 18px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-sm);
      }
      .sg-block-notes {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sg-note {
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-2);
        line-height: 1.55;
      }
      .sg-note-tag {
        display: inline-block;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        background: var(--paper-warm);
        color: var(--ink-3);
        padding: 1px 6px;
        border-radius: 2px;
        margin-right: 8px;
        vertical-align: 1px;
      }
      .sg-note-dont .sg-note-tag {
        background: rgba(122, 46, 46, 0.10);
        color: var(--error);
      }

      /* Inline code + classes */
      .sg-code-inline {
        font-family: var(--mono);
        font-size: 11.5px;
        font-weight: 500;
        background: var(--paper-warm);
        border: 1px solid var(--ink-line);
        color: var(--ink-2);
        padding: 1px 6px;
        border-radius: 2px;
      }
      .sg-code-block {
        font-family: var(--mono);
        font-size: 12px;
        background: var(--paper-warm);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 12px 14px;
        color: var(--ink);
        overflow-x: auto;
        margin: 12px 0 16px;
        line-height: 1.55;
      }

      /* Prose */
      .sg-prose {
        font-family: var(--sans);
        font-size: 14.5px;
        line-height: 1.7;
        color: var(--ink-2);
        max-width: 720px;
      }
      .sg-list { display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.65; color: var(--ink-2); margin-top: 8px; }
      .sg-list strong { color: var(--ink); font-weight: 600; }
      .sg-numbered {
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
        counter-reset: sg;
      }
      .sg-numbered li {
        counter-increment: sg;
        padding-left: 36px;
        position: relative;
        font-size: 14px;
        line-height: 1.65;
        color: var(--ink-2);
        margin-bottom: 10px;
      }
      .sg-numbered li::before {
        content: counter(sg, decimal-leading-zero);
        position: absolute;
        left: 0;
        top: 0;
        font-family: var(--serif);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .sg-numbered strong { color: var(--ink); font-weight: 600; }

      /* Rows / utility */
      .sg-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start; }
      .sg-row-vcenter { align-items: center; }
      .sg-two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

      /* Principles */
      .sg-principles { display: flex; flex-direction: column; gap: 0; margin: 0; padding: 0; list-style: none; }
      .sg-principle {
        display: flex;
        gap: 16px;
        padding: 14px 0;
        border-top: 1px solid var(--ink-line);
      }
      .sg-principle:last-child { border-bottom: 1px solid var(--ink-line); }
      .sg-principle-n {
        flex-shrink: 0;
        width: 32px;
        font-family: var(--serif);
        font-size: 14px;
        font-weight: 600;
        color: var(--ink-4);
        font-variant-numeric: tabular-nums;
      }
      .sg-principle-h {
        font-family: var(--serif);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
        margin-bottom: 2px;
      }
      .sg-principle-b {
        font-family: var(--sans);
        font-size: 13.5px;
        color: var(--ink-2);
        line-height: 1.6;
      }

      /* Color */
      .sg-color-group { margin-bottom: 24px; }
      .sg-color-group:last-child { margin-bottom: 0; }
      .sg-color-group-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 10px;
      }
      .sg-color-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
      }
      .sg-swatch {
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        overflow: hidden;
      }
      .sg-swatch-strips { display: flex; flex-direction: column; }
      .sg-swatch-strip {
        height: 44px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        padding: 6px 10px;
        position: relative;
      }
      .sg-swatch-tag {
        position: absolute;
        top: 6px;
        left: 10px;
        font-family: var(--sans);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .sg-swatch-hex {
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        opacity: 0.92;
      }
      .sg-swatch-meta {
        padding: 8px 10px 9px;
        background: var(--paper);
        border-top: 1px solid var(--ink-line);
      }
      .sg-swatch-name {
        font-family: var(--serif);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
        margin-bottom: 1px;
      }
      .sg-swatch-token {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
      }

      /* Typography */
      .sg-type-families {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .sg-type-family {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 16px 18px;
      }
      .sg-type-name {
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        margin-top: 4px;
        margin-bottom: 4px;
      }
      .sg-type-meta {
        font-size: 12px;
        color: var(--ink-3);
        margin-bottom: 12px;
      }
      .sg-type-specimen {
        padding-top: 12px;
        border-top: 1px solid var(--ink-line-soft);
        font-size: 13px;
        line-height: 1.7;
        color: var(--ink);
      }
      .sg-type-specimen-serif { font-family: var(--serif); }
      .sg-type-specimen-sans { font-family: var(--sans); }
      .sg-type-specimen-mono { font-family: var(--mono); font-size: 12px; }
      .sg-type-row { color: var(--ink); }
      .sg-type-row-eyebrow {
        font-family: var(--sans);
        font-weight: 700;
        font-size: 10.5px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      /* Mini table */
      .sg-mini-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }
      .sg-mini-table th {
        text-align: left;
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
        padding: 10px 14px;
        border-bottom: 1px solid var(--ink-line);
      }
      .sg-mini-table td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--ink-line-soft);
        color: var(--ink-2);
        vertical-align: middle;
      }
      .sg-mini-table tr:last-child td { border-bottom: none; }

      /* Spacing */
      .sg-spacing-row {
        display: flex;
        gap: 20px;
        align-items: flex-end;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .sg-spacing-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; }
      .sg-spacing-block {
        background: var(--ink);
        border-radius: 1px;
      }
      .sg-spacing-num {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }

      .sg-link {
        color: var(--ink);
        border-bottom: 1px solid var(--ink-3);
      }
      .sg-link:hover { border-color: var(--ink); }

      @media (max-width: 800px) {
        .sg-host { padding: 0 0 48px; }
        .sg-toc { grid-template-columns: repeat(2, 1fr); }
        .sg-two { grid-template-columns: 1fr; }
        .sg-hero-title { font-size: 32px; }
      }
    `}</style>
  );
}
