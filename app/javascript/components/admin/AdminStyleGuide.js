import React, { useState, useMemo } from 'react';
import { SPStyles } from '../SamplePage';
import MagicSparkles from '../icons/MagicSparkles';

// =====================================================================
// AdminStyleGuide
// Lives at /admin/docs/style-guide.  Documents the design system as
// expressed in production today.  The canonical exemplars are the Source
// and Concept show pages and the Sources index — everything else is
// being migrated toward them.
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

      <SGSection id="dots" eyebrow="Components" title="Category Dots & Eyebrows">
        <SGCategoryMarks />
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

      <SGSection id="card" eyebrow="Patterns" title="Entity Card">
        <SGEntityCard />
      </SGSection>

      <SGSection id="pullquote" eyebrow="Patterns" title="Pull-Quote & Highlights">
        <SGPullQuote />
      </SGSection>

      <SGSection id="doi" eyebrow="Patterns" title="DOI & Reference Pill">
        <SGDoiBadge />
      </SGSection>

      <SGSection id="void" eyebrow="Patterns" title="Empty Void Invitation">
        <SGEmptyVoid />
      </SGSection>

      <SGSection id="hero" eyebrow="Page Templates" title="Show-Page Hero">
        <SGShowHero />
      </SGSection>

      <SGSection id="twocol" eyebrow="Page Templates" title="Two-Column Show Layout">
        <SGTwoCol />
      </SGSection>

      <SGSection id="index" eyebrow="Page Templates" title="Index Page (Sources Model)">
        <SGIndexPage />
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
        The canonical exemplars in production are{' '}
        <a className="sg-link" href="/sources" target="_blank" rel="noopener noreferrer">/sources</a>{' '}(index),{' '}
        <a className="sg-link" href="#" onClick={(e) => e.preventDefault()}>/sources/:id</a>{' '}(source show), and{' '}
        <a className="sg-link" href="#" onClick={(e) => e.preventDefault()}>/concepts/:id</a>{' '}(concept show).
        The atomic system at <a className="sg-link" href="/samplepage" target="_blank" rel="noopener noreferrer">/samplepage</a>{' '}
        documents the underlying tokens.  When this guide and the show pages disagree, the show pages win.
      </p>
      <SGToc />
    </header>
  );
}

function SGToc() {
  const groups = [
    { label: 'Foundations',    items: [['principles', 'Principles'], ['color', 'Color'], ['typography', 'Typography'], ['space', 'Spacing & Radii']] },
    { label: 'Components',     items: [['actions', 'Actions'], ['inputs', 'Inputs'], ['chips', 'Chips & Status'], ['dots', 'Dots & Eyebrows'], ['banners', 'Banners & Empty States'], ['icons', 'Iconography']] },
    { label: 'Patterns',       items: [['kpi', 'KPI Cards'], ['filter', 'Type-to-Filter'], ['tree', 'Tree'], ['table', 'Tables'], ['charts', 'Charts'], ['card', 'Entity Card'], ['pullquote', 'Pull-Quote'], ['doi', 'DOI Pill'], ['void', 'Empty Void']] },
    { label: 'Page Templates', items: [['hero', 'Show-Page Hero'], ['twocol', 'Two-Column Show'], ['index', 'Index Page']] },
    { label: 'System',         items: [['theming', 'Theming'], ['migration', 'Migration Notes']] },
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
    ['Navy on paper.', 'White is the default surface.  Navy is the default chrome — primary actions, page titles, the dark side of every input.  Hairline borders, not shadows, do the structural work.'],
    ['Type does the heavy lifting.', 'Hierarchy is built with serif vs. sans, weight, and size — not color or boxes.'],
    ['Four colors, four meanings.', 'Concepts are teal, Sources are light blue, People are purple.  Everything else — notes, tags, collections, navigation chrome — uses Navy on white.  Color is the meaning, never decoration.'],
    ['Color lives in headings, badges, and numerals.', 'Body text, table cells, list rows, and filter labels are never colored — they read as Navy or the ink scale.  Color belongs on the page title, the section heading, the chip / pill / badge, and the big number above its grey label.  If you want something to read as colored, make it one of those.'],
    ['Density where it matters.', 'Sidebars, tables, and filters are dense.  Reading surfaces breathe.'],
    ['Restraint over animation.', 'Subtle transitions on hover.  Nothing pulses, bounces, or floats.'],
    ['Numerals are typeset.', 'Tabular figures in tables and counts.  Lining serif numerals in KPIs.  When a numeral and a label share a frame, the numeral takes the entity ink and the label stays grey.'],
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
  { label: 'Brand · Navy', swatches: [
    { name: 'Primary (Navy)',  token: '--primary',      light: '#1F3B73', dark: '#7B96C8' },
    { name: 'Primary Dark',    token: '--primary-dark', light: '#142A57', dark: '#7B96C8' },
    { name: 'Primary Light',   token: '--primary-light',light: '#7B96C8', dark: '#7B96C8' },
  ]},
  { label: 'Categorical · Teal · Light Blue · Purple', swatches: [
    { name: 'Concept (Teal)',       token: '--concept', light: '#48A27E', dark: '#7DC9A3' },
    { name: 'Source (Light Blue)',  token: '--source',  light: '#4976B1', dark: '#7FA5D1' },
    { name: 'Person (Purple)',      token: '--person',  light: '#614498', dark: '#9577C8' },
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
        Four colors carry the brand: <strong>Navy</strong> for the chrome and anything that isn't an entity, <strong>Teal</strong> for Concepts, <strong>Light Blue</strong> for Sources, <strong>Purple</strong> for People.  Everything else — notes, tags, collections, methodology, navigation, body type — renders in Navy or the ink scale.  Use the CSS variable on the token row, not the hex.
      </p>
      <p className="sg-prose">
        <strong>The three categorical inks are reserved.</strong>  When you see teal, you're looking at a Concept.  Light blue is always a Source.  Purple is always a Person.  This is the contract that makes the three primary entities parseable at a glance — never spend a categorical ink on something that isn't its entity.  In nav and chips that aren't entity-typed, that means <code className="sg-code-inline">--ink-2</code> on neutral surfaces, or the Navy <code className="sg-code-inline">--primary</code> for brand chrome.
      </p>
      <div className="sg-color-quad">
        <SGColorChip label="Concept" sub="Teal" bg="var(--concept-tint)" fg="var(--concept-2)" />
        <SGColorChip label="Source" sub="Light Blue" bg="var(--source-tint)" fg="var(--source-2)" />
        <SGColorChip label="Person" sub="Purple" bg="var(--person-tint)" fg="var(--person-2)" />
        <SGColorChip label="Everything else" sub="Navy" bg="var(--primary)" fg="var(--paper)" />
      </div>
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

function SGColorChip({ label, sub, bg, fg }) {
  return (
    <div className="sg-color-quad-cell" style={{ background: bg, color: fg }}>
      <div className="sg-color-quad-label">{label}</div>
      <div className="sg-color-quad-sub">{sub}</div>
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

function SGCategoryMarks() {
  return (
    <>
      <SGBlock
        title="Category Dot"
        classes={['sp-list-dot.is-concept|is-source|is-person']}
        notes="A 6px filled circle in the entity ink.  Use as a tiny prefix on rows where you can't spend a chip — filter labels, tile headers, hierarchy nodes, suggest results."
        dont="Use the dot to color a count or stand alone in a column.  It's a marker, not a status."
      >
        <div className="sg-row sg-row-vcenter" style={{ gap: 28 }}>
          <span className="sg-row sg-row-vcenter" style={{ gap: 8 }}>
            <span className="sg-list-dot is-concept" />
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Anxiety Disorders</span>
          </span>
          <span className="sg-row sg-row-vcenter" style={{ gap: 8 }}>
            <span className="sg-list-dot is-source" />
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Bowlby (1969)</span>
          </span>
          <span className="sg-row sg-row-vcenter" style={{ gap: 8 }}>
            <span className="sg-list-dot is-person" />
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Mary Ainsworth</span>
          </span>
          <span className="sg-row sg-row-vcenter" style={{ gap: 8 }}>
            <span className="sg-list-dot" />
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Note (neutral)</span>
          </span>
        </div>
      </SGBlock>

      <SGBlock
        title="Section Eyebrow in Entity Color"
        classes={['ss-section-eyebrow', 'cs-pack-lede-eyebrow', 'cs-integrated-pack-eyebrow']}
        notes="On a show page, the small uppercase eyebrow above a section heading takes the entity's ink (teal on Concept pages, light blue on Source pages, purple on Person pages).  This is the rare place an eyebrow leaves the ink scale — it ties every section back to the entity."
        dont="Repeat the entity color on the section heading itself unless the heading is the canonical 'Highlights' / 'Notes' / 'Further Reading' rail.  Two colored elements stacked is louder than the page warrants."
      >
        <div className="sg-eyebrow-demo-grid">
          <div className="sg-eyebrow-demo">
            <div className="sg-eyebrow-row" style={{ color: 'var(--concept)' }}>Definition · Concept</div>
            <div className="sg-eyebrow-body">Mentalization-based treatment is a structured approach to…</div>
          </div>
          <div className="sg-eyebrow-demo">
            <div className="sg-eyebrow-row" style={{ color: 'var(--source)' }}>Summary · Source</div>
            <div className="sg-eyebrow-body">A randomized controlled trial of 312 outpatients tested…</div>
          </div>
          <div className="sg-eyebrow-demo">
            <div className="sg-eyebrow-row" style={{ color: 'var(--person)' }}>Affiliation · Person</div>
            <div className="sg-eyebrow-body">Tavistock Centre, London (1969–1985).</div>
          </div>
        </div>
      </SGBlock>
    </>
  );
}

// =====================================================================
// Patterns
// =====================================================================

function SGKPI() {
  return (
    <SGBlock
      title="KPI Row"
      classes={['sp-kpi-row', 'sp-kpi', 'sp-kpi-value.is-concept|is-source|is-person|is-navy', 'sp-kpi-label', 'sp-kpi-delta']}
      notes="Up to four primary metrics.  Numeral is serif lining figures and takes the entity ink (teal / light blue / purple) — or Navy for any non-categorical metric.  Label stays grey, always.  Delta is one short clause in ink-3."
      dont="Color the label.  Color the numeral itself in two different inks within the same row when the metrics belong to different entities — that's fine.  Mix entity-colored values with non-categorical labels — also fine.  What you can't do is invert: a colored label with an ink numeral reads backwards."
    >
      <div className="sp-kpi-row">
        <div className="sp-kpi"><div className="sp-kpi-label">Sources</div><div className="sp-kpi-value is-source">61</div><div className="sp-kpi-delta">+4 this week</div></div>
        <div className="sp-kpi"><div className="sp-kpi-label">Concepts</div><div className="sp-kpi-value is-concept">18</div><div className="sp-kpi-delta">+2 this week</div></div>
        <div className="sp-kpi"><div className="sp-kpi-label">People</div><div className="sp-kpi-value is-person">27</div><div className="sp-kpi-delta">unchanged</div></div>
        <div className="sp-kpi"><div className="sp-kpi-label">Notes</div><div className="sp-kpi-value is-navy">142</div><div className="sp-kpi-delta">+11 this week</div></div>
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
      classes={['sp-ttf', 'sp-ttf-input', 'sp-ttf-list', 'sp-ttf-row', 'sp-checkbox.is-concept|is-source|is-person']}
      notes="The default for any 'pick from a known list' input where the list is longer than ~6 items.  Row text stays neutral — the only colored signals are the chips at top (when something is selected) and the checkbox itself, which takes the entity ink when checked.  Same pattern in sidebar filters and form fields."
      dont="Color the row labels by entity type.  The list reads as a wall of text when every label is its own ink — let the chips and checkboxes carry the meaning."
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
              <input type="checkbox" className="sp-checkbox is-concept" checked={selected.has(o)} onChange={() => toggle(o)} />
              <span className="sp-ttf-row-label">{o}</span>
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
      notes="Hairline rows, sortable headers, hover and selected states.  Numerals are mono and tabular.  DOIs and IDs are mono one size smaller than body.  Body cells stay neutral — when an author or concept should read as colored, render it as a chip in that cell, never as plain colored text."
      dont="Color the cell text directly.  Use vertical borders, zebra rows, or bold every other cell.  Restraint."
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
              <td>
                <a href="#" className="sp-chip is-person" onClick={(e) => e.preventDefault()}>Mikulincer, M.</a>{' '}
                <a href="#" className="sp-chip is-person" onClick={(e) => e.preventDefault()}>Shaver, P. R.</a>
              </td>
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
// Patterns — composed from /sources/:id, /concepts/:id, /sources
// =====================================================================

function SGEntityCard() {
  return (
    <SGBlock
      title="Entity Card"
      classes={['srx-row-card', 'is-selected', 'is-key']}
      notes="The canonical card chrome for any list of entity rows.  3px top accent in the entity ink, hairline border, soft drop shadow, hover lift.  Use for source lists, concept lists, person lists, and anything else that should read 'one of N entities of this type.'"
      dont="Outline the whole card in the entity color.  Stack two top-accent cards in different entity colors in one column — the chrome stops carrying meaning once you mix."
    >
      <div className="sg-card-stack">
        <article className="sg-entity-card" data-entity="source">
          <div className="sg-entity-card-pre">
            <span className="sg-entity-card-year">2007</span>
            <span className="sg-entity-card-kind">Journal Article</span>
            <span className="sg-entity-card-journal">Psychological Bulletin</span>
          </div>
          <div className="sg-entity-card-title">The Other Side of the Coin: Avoidant Attachment in Adulthood</div>
          <div className="sg-entity-card-meta">Mikulincer, M., Shaver, P. R.</div>
          <div className="sg-entity-card-tags">
            <span className="sp-chip is-concept">Attachment Theory</span>
            <span className="sp-chip is-concept">Avoidance</span>
            <span className="sp-chip is-neutral">Thesis Ch. 3</span>
          </div>
        </article>

        <article className="sg-entity-card" data-entity="concept">
          <div className="sg-entity-card-pre">
            <span className="sg-entity-card-kind">Intervention</span>
            <span className="sg-entity-card-meta-inline">14 sources · 22 notes</span>
          </div>
          <div className="sg-entity-card-title">Mentalization-Based Treatment</div>
          <div className="sg-entity-card-meta">A structured psychotherapy that develops the patient's capacity to understand mental states.</div>
        </article>

        <article className="sg-entity-card" data-entity="person">
          <div className="sg-entity-card-pre">
            <span className="sg-entity-card-kind">Author</span>
            <span className="sg-entity-card-meta-inline">8 sources · 3 collaborations</span>
          </div>
          <div className="sg-entity-card-title">John Bowlby</div>
          <div className="sg-entity-card-meta">Tavistock Centre, London.  Founder of attachment theory.</div>
        </article>
      </div>
    </SGBlock>
  );
}

function SGPullQuote() {
  return (
    <SGBlock
      title="Pull-Quote / Highlight"
      classes={['ss-highlights', 'ss-highlight', 'ss-highlight-quote']}
      notes="Quote text in system sans on a paper-soft tray, with a heavy 3px entity-ink border on the leading edge.  Tight line height — these are excerpts, not paragraphs.  Use for highlights pulled from a Source, key passages from a Concept definition, or any user-extracted quotation.  The eyebrow above is the only colored thing in the tray."
      dont="Set the body in italic serif — it ages a quote into a Victorian epigraph and pushes the line height too loose for the format.  Use system sans, tight."
    >
      <div className="sg-pullquote-tray">
        <div className="sg-pullquote-head">
          <span className="sg-pullquote-eyebrow">Highlights</span>
          <span className="sg-pullquote-count">3</span>
        </div>
        <ul className="sg-pullquote-list">
          <li className="sg-pullquote">
            <blockquote className="sg-pullquote-text">"Internal working models guide expectations of self and other, and they are revised, however reluctantly, by experience."</blockquote>
            <div className="sg-pullquote-meta">
              p. 88 · <a className="sg-pullquote-link" href="#" onClick={(e) => e.preventDefault()}>Open in study mode</a>
            </div>
          </li>
          <li className="sg-pullquote">
            <blockquote className="sg-pullquote-text">"What cannot be communicated to the mother cannot be communicated to the self."</blockquote>
            <div className="sg-pullquote-meta">p. 142</div>
          </li>
        </ul>
      </div>
    </SGBlock>
  );
}

function SGDoiBadge() {
  return (
    <SGBlock
      title="DOI / Reference Pill"
      classes={['ss-doi-badge', 'ss-doi-label', 'ss-doi-value', 'ss-doi-copy']}
      notes="Mono identifier on a tinted Source pill.  The pill links to doi.org; the inline icon copies the value.  Use for DOIs, ORCIDs, ISBNs, and any external persistent identifier."
      dont="Show a DOI without copy support.  These exist to be pasted."
    >
      <div className="sg-row" style={{ gap: 12 }}>
        <a className="sg-doi-badge" href="#" onClick={(e) => e.preventDefault()}>
          <span className="sg-doi-label">DOI</span>
          <span className="sg-doi-value">10.1037/0003-066X.46.4.333</span>
          <span className="sg-doi-copy" aria-label="Copy DOI">⎘</span>
        </a>
        <a className="sg-doi-badge" href="#" onClick={(e) => e.preventDefault()}>
          <span className="sg-doi-label">ORCID</span>
          <span className="sg-doi-value">0000-0002-1825-0097</span>
          <span className="sg-doi-copy" aria-label="Copy ORCID">⎘</span>
        </a>
      </div>
    </SGBlock>
  );
}

function SGEmptyVoid() {
  return (
    <SGBlock
      title="Empty Void Invitation"
      classes={['ss-notes-void', 'ss-notes-void-plus', 'ss-notes-void-label']}
      notes="A large dashed surface with a thin serif plus, a label, and one short hint.  Use as the first-time state for a creative slot — Notes, Highlights, Collections — where the right action is 'just start.'  Not for empty filtered lists."
      dont="Stack two voids on a page.  Pick the slot that matters most and give it the whole frame."
    >
      <a className="sg-void" href="#" onClick={(e) => e.preventDefault()}>
        <span className="sg-void-plus">+</span>
        <span className="sg-void-label">Your Notes Go Here</span>
        <span className="sg-void-hint">Highlight a passage in any source to start.  Notes are searchable across the library.</span>
      </a>
    </SGBlock>
  );
}

// =====================================================================
// Page Templates
// =====================================================================

function SGShowHero() {
  return (
    <>
      <p className="sg-prose">
        Every show page opens the same way: a tight band of categorical metadata, a balanced serif title, a one-line byline.  The eyebrow and any pills inside the band carry the entity color; the title stays in <code className="sg-code-inline">--ink</code>.  This is the moment the user lands on a page and confirms what kind of thing they're looking at.
      </p>

      <SGBlock
        title="Source Show Hero"
        classes={['ss-hero', 'ss-hero-top', 'ss-hero-type', 'ss-hero-meta', 'ss-hero-marker', 'ss-hero-title', 'ss-hero-authors']}
        notes="Used at /sources/:id.  Type pill in source-tint, mono year, italic serif journal name, optional uppercase markers (Reading List, Thesis Ch. 3) in paper-warm pills.  Title is balanced and tight."
      >
        <header className="sg-show-hero" data-entity="source">
          <div className="sg-show-hero-top">
            <span className="sg-show-hero-type">Journal Article</span>
            <span className="sg-show-hero-meta">2007</span>
            <span className="sg-show-hero-meta is-journal">Psychological Bulletin</span>
            <span className="sg-show-hero-marker">Reading List</span>
          </div>
          <h1 className="sg-show-hero-title">The Other Side of the Coin: Avoidant Attachment in Adulthood</h1>
          <p className="sg-show-hero-authors">Mikulincer, M., Shaver, P. R.</p>
        </header>
      </SGBlock>

      <SGBlock
        title="Concept Show Hero"
        classes={['cs-hero', 'cs-hero-type', 'cs-hero-title', 'cs-hero-summary']}
        notes="Used at /concepts/:id.  Quieter band — just a neutral type pill in paper-warm, then the title and an optional one-paragraph summary in body type.  The teal lives in the surrounding eyebrows and lede card, not in the hero band."
      >
        <header className="sg-show-hero" data-entity="concept">
          <div className="sg-show-hero-top">
            <span className="sg-show-hero-type is-quiet">Intervention</span>
          </div>
          <h1 className="sg-show-hero-title">Mentalization-Based Treatment</h1>
          <p className="sg-show-hero-summary">A structured psychotherapy that develops the patient's capacity to understand mental states in self and other, originally formulated for borderline personality disorder.</p>
        </header>
      </SGBlock>

      <SGBlock
        title="Header Bar Above the Hero"
        classes={['ss-header', 'ss-back', 'ss-header-actions']}
        notes="A small back link on the left, the action cluster on the right.  Edit, secondary actions, and one quiet danger.  Sits above the hero with 16px of breathing room."
        dont="Put the page title or breadcrumbs in this row.  The hero owns the title; this row is navigation and actions only."
      >
        <header className="sg-show-headerbar">
          <a href="#" className="sg-show-back" onClick={(e) => e.preventDefault()}>← All sources</a>
          <div className="sg-row" style={{ gap: 6 }}>
            <button className="sp-action sp-action-secondary">Edit</button>
            <button className="sp-action sp-action-quiet sp-action-danger">Delete</button>
          </div>
        </header>
      </SGBlock>
    </>
  );
}

function SGTwoCol() {
  return (
    <>
      <p className="sg-prose">
        Both show pages settle into the same skeleton once you scroll past the hero: a wide reading column on the left and a sticky 1/3-width sidebar on the right, separated by a hairline rule.  The sidebar holds at-a-glance counts and category lists; the main column holds the page's content.  On mobile the sidebar collapses above the main column and the rule turns into a top border.
      </p>

      <SGBlock
        title="Skeleton"
        classes={['cs-2col', 'cs-2col-main', 'cs-2col-side']}
        notes="2-column grid with a 360px sidebar (Concept Show) or a 1fr / 2fr split (Source Show, where the right column is the reading surface).  The side column is sticky from the top of the viewport and scrolls independently."
      >
        <div className="sg-twocol">
          <main className="sg-twocol-main">
            <div className="sg-twocol-placeholder">Main content (notes, definition, abstract.)</div>
            <div className="sg-twocol-placeholder">Long-form reading surface continues.</div>
          </main>
          <aside className="sg-twocol-side">
            <div className="sg-side-stats">
              <div className="sg-side-stat"><span className="sg-side-stat-value">14</span><span className="sg-side-stat-label">Sources</span></div>
              <div className="sg-side-stat"><span className="sg-side-stat-value">22</span><span className="sg-side-stat-label">Notes</span></div>
              <div className="sg-side-stat"><span className="sg-side-stat-value">7</span><span className="sg-side-stat-label">People</span></div>
            </div>
            <div className="sg-side-block">
              <div className="sg-side-head">
                <span className="sg-side-label">Concepts</span>
                <span className="sg-side-count">5</span>
              </div>
              <ul className="sg-side-list">
                <li className="sg-side-row">
                  <a href="#" className="sg-side-name" onClick={(e) => e.preventDefault()}>Attachment Theory</a>
                  <span className="sg-side-meta">3</span>
                </li>
                <li className="sg-side-row">
                  <a href="#" className="sg-side-name" onClick={(e) => e.preventDefault()}>Internal Working Models</a>
                  <span className="sg-side-meta">2</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </SGBlock>

      <SGBlock
        title="Sidebar Stats"
        classes={['ss-side-stats', 'ss-side-stat', 'ss-side-stat-value', 'ss-side-stat-label']}
        notes="2- or 3-column grid of at-a-glance counts.  Value is large serif lining figures in the entity color (teal on Concept pages, light blue on Source pages).  Label is the standard uppercase eyebrow.  Sits at the top of the sticky sidebar with a hairline divider underneath."
        dont="Use deltas, sparklines, or trend arrows here.  Stats in the show sidebar are the present-tense count, not a metric."
      >
        <div className="sg-side-stats" data-entity="concept">
          <div className="sg-side-stat"><span className="sg-side-stat-value">14</span><span className="sg-side-stat-label">Sources</span></div>
          <div className="sg-side-stat"><span className="sg-side-stat-value">22</span><span className="sg-side-stat-label">Notes</span></div>
          <div className="sg-side-stat"><span className="sg-side-stat-value">7</span><span className="sg-side-stat-label">People</span></div>
        </div>
      </SGBlock>

      <SGBlock
        title="Sidebar Block"
        classes={['ss-side-block', 'ss-side-head', 'ss-side-label', 'ss-side-count', 'ss-side-list', 'ss-side-row', 'ss-side-name', 'ss-side-meta']}
        notes="Uppercase label with a mono count on the same baseline.  The list rows below align name (left, ellipsized) and a single mono meta value (right).  Hover takes the name into the entity color."
      >
        <div className="sg-side-block">
          <div className="sg-side-head">
            <span className="sg-side-label">Co-cited Sources</span>
            <span className="sg-side-count">8</span>
          </div>
          <p className="sg-side-sub">Sources that cite this concept alongside another.</p>
          <ul className="sg-side-list">
            <li className="sg-side-row">
              <a href="#" className="sg-side-name" onClick={(e) => e.preventDefault()}>The Other Side of the Coin: Avoidant Attachment in Adulthood</a>
              <span className="sg-side-meta">2007</span>
            </li>
            <li className="sg-side-row">
              <a href="#" className="sg-side-name" onClick={(e) => e.preventDefault()}>Cognitive Therapy for Depression</a>
              <span className="sg-side-meta">1979</span>
            </li>
            <li className="sg-side-row">
              <a href="#" className="sg-side-name" onClick={(e) => e.preventDefault()}>The Strange Situation</a>
              <span className="sg-side-meta">1978</span>
            </li>
          </ul>
        </div>
      </SGBlock>
    </>
  );
}

function SGIndexPage() {
  const [open, setOpen] = useState({ kind: true, year: false });
  return (
    <>
      <p className="sg-prose">
        <strong>The /sources index is the model.</strong>  Every other index — Concepts, People, Notes, Tags, Collections — should mirror its skeleton: an entity-colored page title, a sticky filter sidebar with collapsible sections and dot-prefixed labels, a toolbar with search + sort + density, an active-filter chip bar, and a list of <code className="sg-code-inline">.srx-row-card</code>-style entity cards.  Color the chrome (page title, primary action, density toggle, card top accent) in the entity ink for that index.
      </p>

      <SGBlock
        title="Index Header"
        classes={['srx-header', 'srx-title', 'srx-subtitle', 'srx-header-actions']}
        notes="Title in serif 36px in the entity ink (light blue on Sources, teal on Concepts, purple on People).  Subtitle in body 13.5px ink-3.  Header actions cluster right; one primary uses the entity color, secondaries stay neutral."
        dont="Put a search input in the header row.  Search lives in the toolbar below — keep the header for identity and high-level actions only."
      >
        <header className="sg-index-header" data-entity="source">
          <div>
            <h1 className="sg-index-title">Sources</h1>
            <p className="sg-index-subtitle">61 in your library · <button type="button" className="sg-index-link">Clear 2 Filters</button></p>
          </div>
          <div className="sg-row" style={{ gap: 8 }}>
            <button className="sp-action sp-action-secondary">Bulk Upload</button>
            <button className="sp-action sp-action-primary sg-index-primary">+ Add Source</button>
          </div>
        </header>
      </SGBlock>

      <SGBlock
        title="Filter Sidebar"
        classes={['srx-sidebar', 'srx-filter-section', 'srx-filter-head-button', 'srx-filter-dot', 'srx-filter-label', 'srx-filter-caret', 'srx-filter-body', 'srx-row', 'srx-row-label', 'srx-row-count']}
        notes="Sticky 260px column.  Each section is a button-styled header with a category dot, an uppercase label, and a chevron that rotates when collapsed.  Rows inside are dense (5px·8px), with the label flexing and the count right-aligned in mono."
      >
        <aside className="sg-index-sidebar">
          <div className="sg-index-filter-section">
            <button type="button" className="sg-index-filter-head" onClick={() => setOpen((s) => ({ ...s, kind: !s.kind }))}>
              <span className="sg-list-dot is-source" />
              <span className="sg-index-filter-label">Type</span>
              <span className={`sg-index-filter-caret ${open.kind ? '' : 'is-closed'}`}><SGIcon name="caret-down" size={9} /></span>
            </button>
            {open.kind && (
              <div className="sg-index-filter-body">
                <label className="sg-index-row"><input type="checkbox" className="sp-checkbox" defaultChecked /><span className="sg-index-row-label">Journal Article</span><span className="sg-index-row-count">42</span></label>
                <label className="sg-index-row"><input type="checkbox" className="sp-checkbox" /><span className="sg-index-row-label">Book Chapter</span><span className="sg-index-row-count">11</span></label>
                <label className="sg-index-row"><input type="checkbox" className="sp-checkbox" /><span className="sg-index-row-label">Thesis</span><span className="sg-index-row-count">5</span></label>
                <label className="sg-index-row"><input type="checkbox" className="sp-checkbox" /><span className="sg-index-row-label">Working Paper</span><span className="sg-index-row-count">3</span></label>
              </div>
            )}
          </div>
          <div className="sg-index-filter-section">
            <button type="button" className="sg-index-filter-head" onClick={() => setOpen((s) => ({ ...s, year: !s.year }))}>
              <span className="sg-list-dot" />
              <span className="sg-index-filter-label">Year</span>
              <span className={`sg-index-filter-caret ${open.year ? '' : 'is-closed'}`}><SGIcon name="caret-down" size={9} /></span>
            </button>
            {open.year && (
              <div className="sg-index-filter-body">
                <div className="sg-index-year-row">
                  <input className="sg-index-year-input" placeholder="1969" />
                  <span className="sg-index-year-dash">–</span>
                  <input className="sg-index-year-input" placeholder="2024" />
                </div>
              </div>
            )}
          </div>
        </aside>
      </SGBlock>

      <SGBlock
        title="Toolbar"
        classes={['srx-toolbar', 'srx-search', 'srx-search-input', 'srx-sort', 'srx-density-toggle']}
        notes="Search field on the left at 480px max, sort select to its right, then a density toggle that lights up in the entity tint when active.  All three controls sit at the same 36px height."
      >
        <div className="sg-index-toolbar">
          <div className="sg-index-search">
            <SGIcon name="search" size={12} />
            <input className="sg-index-search-input" placeholder="Search title, author, abstract." />
          </div>
          <select className="sg-index-sort" defaultValue="recent">
            <option value="recent">Recent</option>
            <option value="title">Title A-Z</option>
            <option value="year">Year</option>
          </select>
          <button type="button" className="sg-index-density is-on">Show abstracts</button>
        </div>
      </SGBlock>

      <SGBlock
        title="Active-Filter Chip Bar"
        classes={['srx-chip-bar', 'srx-chip', 'srx-chip-x', 'srx-chip-clear']}
        notes="Horizontal row of removable chips above the list, in the entity tint.  Each chip removes its own filter; the trailing 'Clear All' resets the lot.  Hidden when no filters are active."
      >
        <div className="sg-index-chipbar">
          <button type="button" className="sg-index-chip">Journal Article<span className="sg-index-chip-x">×</span></button>
          <button type="button" className="sg-index-chip">2000 – 2024<span className="sg-index-chip-x">×</span></button>
          <button type="button" className="sg-index-chip">Has PDF<span className="sg-index-chip-x">×</span></button>
          <button type="button" className="sg-index-chip-clear">Clear All</button>
        </div>
      </SGBlock>

      <SGBlock
        title="Entity Row Card (in context)"
        classes={['srx-list', 'srx-row-card']}
        notes="The list itself is just a vertical stack of Entity Cards (above) at 18px gap.  The whole card is a click target leading to the show page; the hover state lifts on a soft shadow and switches the border to the entity color."
      >
        <div className="sg-card-stack" style={{ gap: 14 }}>
          <article className="sg-entity-card" data-entity="source">
            <div className="sg-entity-card-pre">
              <span className="sg-entity-card-year">1979</span>
              <span className="sg-entity-card-kind">Book</span>
              <span className="sg-entity-card-journal">Guilford</span>
            </div>
            <div className="sg-entity-card-title">Cognitive Therapy of Depression</div>
            <div className="sg-entity-card-meta">Beck, A. T., Rush, A. J., Shaw, B. F., Emery, G.</div>
            <div className="sg-entity-card-tags">
              <span className="sp-chip is-concept">CBT</span>
              <span className="sp-chip is-concept">Depression</span>
            </div>
          </article>
          <article className="sg-entity-card" data-entity="source">
            <div className="sg-entity-card-pre">
              <span className="sg-entity-card-year">2007</span>
              <span className="sg-entity-card-kind">Journal Article</span>
              <span className="sg-entity-card-journal">Psychological Bulletin</span>
            </div>
            <div className="sg-entity-card-title">The Other Side of the Coin: Avoidant Attachment in Adulthood</div>
            <div className="sg-entity-card-meta">Mikulincer, M., Shaver, P. R.</div>
          </article>
        </div>
      </SGBlock>
    </>
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
        The four-color brand system is fully expressed at <a className="sg-link" href="/sources" target="_blank" rel="noopener noreferrer">/sources</a>, <code className="sg-code-inline">/sources/:id</code>, and <code className="sg-code-inline">/concepts/:id</code>.  These three pages are the working source of truth — when an older page gets touched, pull from the patterns documented here (which were extracted from those three).  The atomic primitives at <a className="sg-link" href="/samplepage" target="_blank" rel="noopener noreferrer">/samplepage</a> back the system but don't show how to compose a full page.  Page-level migrations are tracked in <a className="sg-link" href="/admin/docs/page-audit">Page Audit</a>.
      </p>

      <h3 className="sg-h3">Lifting page-level CSS into the system</h3>
      <p className="sg-prose">
        The show pages each ship their own scoped <code className="sg-code-inline">ss-*</code> / <code className="sg-code-inline">cs-*</code> / <code className="sg-code-inline">srx-*</code> styles.  As we migrate more pages, lift the recurring rules out into <code className="sg-code-inline">design-system.css</code> under the <code className="sg-code-inline">sp-*</code> prefix — start with the highest-leverage patterns: Entity Card, Sidebar Stats, Sidebar Block, Show Hero band, Filter Sidebar.  Leave the page-specific rules in place until the third page would copy them.
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
        color: var(--primary);
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
        color: var(--primary);
        letter-spacing: -0.015em;
        line-height: 1.15;
      }
      .sg-section-body { display: flex; flex-direction: column; gap: 20px; }
      .sg-h3 {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--primary);
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
        color: var(--primary);
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
        background: var(--primary);
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

      /* ============================================================
         Color quad — the four-color story at the top of Color
         ============================================================ */
      .sg-color-quad {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin: 8px 0 28px;
      }
      .sg-color-quad-cell {
        padding: 18px 16px 16px;
        border-radius: var(--r-md);
        border: 1px solid var(--ink-line-soft);
      }
      .sg-color-quad-label {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .sg-color-quad-sub {
        font-family: var(--sans);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.8;
        margin-top: 2px;
      }

      /* ============================================================
         Category dots
         ============================================================ */
      .sg-list-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-3);
        flex-shrink: 0;
        display: inline-block;
      }
      .sg-list-dot.is-concept { background: var(--concept); }
      .sg-list-dot.is-source  { background: var(--source); }
      .sg-list-dot.is-person  { background: var(--person); }

      /* Eyebrow demo (entity-colored uppercase + body) */
      .sg-eyebrow-demo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .sg-eyebrow-demo {
        padding: 12px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
      }
      .sg-eyebrow-row {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .sg-eyebrow-body {
        font-family: var(--serif);
        font-size: 14px;
        line-height: 1.55;
        color: var(--ink);
      }

      /* ============================================================
         Entity Card
         ============================================================ */
      .sg-card-stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .sg-entity-card {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--ink-3);
        border-radius: var(--r-md);
        padding: 14px 16px;
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.04),
          0 12px 32px rgba(21, 25, 31, 0.06);
        transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s;
      }
      .sg-entity-card:hover { transform: translateY(-1px); }
      .sg-entity-card[data-entity="source"]  { border-top-color: var(--source); }
      .sg-entity-card[data-entity="source"]:hover  { border-color: var(--source); }
      .sg-entity-card[data-entity="concept"] { border-top-color: var(--concept); }
      .sg-entity-card[data-entity="concept"]:hover { border-color: var(--concept); }
      .sg-entity-card[data-entity="person"]  { border-top-color: var(--person); }
      .sg-entity-card[data-entity="person"]:hover  { border-color: var(--person); }
      .sg-entity-card-pre {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 10px;
        margin-bottom: 4px;
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-3);
      }
      .sg-entity-card-year {
        font-family: var(--mono);
        font-variant-numeric: tabular-nums;
      }
      .sg-entity-card-kind {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }
      .sg-entity-card[data-entity="source"]  .sg-entity-card-kind { color: var(--source-2); }
      .sg-entity-card[data-entity="concept"] .sg-entity-card-kind { color: var(--concept-2); }
      .sg-entity-card[data-entity="person"]  .sg-entity-card-kind { color: var(--person-2); }
      .sg-entity-card-journal { font-style: italic; color: var(--ink-3); }
      .sg-entity-card-meta-inline { color: var(--ink-3); }
      .sg-entity-card-title {
        font-family: var(--serif);
        font-size: 16px;
        font-weight: 600;
        line-height: 1.35;
      }
      .sg-entity-card[data-entity="source"]  .sg-entity-card-title { color: var(--source); }
      .sg-entity-card[data-entity="concept"] .sg-entity-card-title { color: var(--concept); }
      .sg-entity-card[data-entity="person"]  .sg-entity-card-title { color: var(--person); }
      .sg-entity-card-meta {
        margin-top: 4px;
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.5;
      }
      .sg-entity-card-tags {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 6px;
      }

      /* ============================================================
         Pull-quote / Highlights tray
         ============================================================ */
      .sg-pullquote-tray {
        padding: 18px 20px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-md);
      }
      .sg-pullquote-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 14px;
      }
      .sg-pullquote-eyebrow {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--source);
        letter-spacing: -0.005em;
      }
      .sg-pullquote-count {
        font-family: var(--mono);
        font-size: 13px;
        color: var(--ink-3);
      }
      .sg-pullquote-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .sg-pullquote {
        padding-left: 14px;
        border-left: 3px solid var(--source);
      }
      .sg-pullquote-text {
        font-family: var(--sans);
        font-size: 14px;
        line-height: 1.4;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .sg-pullquote-meta {
        font-family: var(--sans);
        font-size: 11px;
        color: var(--ink-3);
      }
      .sg-pullquote-link {
        color: var(--source);
        text-decoration: none;
      }
      .sg-pullquote-link:hover { text-decoration: underline; }

      /* ============================================================
         DOI badge
         ============================================================ */
      .sg-doi-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 6px 2px 8px;
        background: var(--source-tint);
        color: var(--source-2);
        border: 1px solid color-mix(in srgb, var(--source) 35%, transparent);
        border-radius: var(--r-sm);
        font-family: var(--mono);
        font-size: 11px;
        text-decoration: none;
        line-height: 1.5;
      }
      .sg-doi-badge:hover {
        background: color-mix(in srgb, var(--source) 15%, var(--source-tint));
        border-color: var(--source);
      }
      .sg-doi-label {
        font-family: var(--sans);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--source);
      }
      .sg-doi-value {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sg-doi-copy {
        font-size: 10.5px;
        color: var(--source);
        opacity: 0.8;
      }

      /* ============================================================
         Empty void invitation
         ============================================================ */
      .sg-void {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 240px;
        padding: 40px 32px;
        background: var(--paper);
        border: 2px dashed var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        text-align: center;
        transition: border-color 0.18s, background 0.18s, transform 0.18s;
      }
      .sg-void:hover {
        border-color: var(--source);
        background: var(--source-tint);
        transform: translateY(-1px);
      }
      .sg-void-plus {
        font-family: var(--serif);
        font-size: 64px;
        font-weight: 300;
        line-height: 1;
        color: var(--ink-line);
        transition: color 0.18s;
      }
      .sg-void:hover .sg-void-plus { color: var(--source); }
      .sg-void-label {
        font-family: var(--serif);
        font-size: 20px;
        font-weight: 500;
        color: var(--ink-2);
        letter-spacing: -0.01em;
      }
      .sg-void:hover .sg-void-label { color: var(--source-2); }
      .sg-void-hint {
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-3);
        max-width: 380px;
        line-height: 1.55;
      }

      /* ============================================================
         Show-page hero
         ============================================================ */
      .sg-show-hero { padding: 4px 0 8px; }
      .sg-show-hero-top {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .sg-show-hero-type {
        font-family: var(--sans);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--source-2);
        background: var(--source-tint);
        padding: 3px 10px;
        border-radius: var(--r-sm);
      }
      .sg-show-hero[data-entity="concept"] .sg-show-hero-type {
        color: var(--concept-2);
        background: var(--concept-tint);
      }
      .sg-show-hero[data-entity="person"] .sg-show-hero-type {
        color: var(--person-2);
        background: var(--person-tint);
      }
      .sg-show-hero-type.is-quiet {
        color: var(--ink-2) !important;
        background: var(--paper-warm) !important;
      }
      .sg-show-hero-meta {
        font-family: var(--mono);
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .sg-show-hero-meta.is-journal {
        font-family: var(--serif);
        font-style: italic;
        font-size: 13px;
        color: var(--ink-2);
      }
      .sg-show-hero-marker {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-2);
        background: var(--paper-warm);
        padding: 2px 8px;
        border-radius: var(--r-sm);
      }
      .sg-show-hero-title {
        font-family: var(--serif);
        font-size: 32px;
        font-weight: 600;
        color: var(--primary);
        line-height: 1.15;
        letter-spacing: -0.02em;
        margin: 0 0 10px;
        text-wrap: balance;
      }
      .sg-show-hero-authors {
        font-family: var(--sans);
        font-size: 14px;
        color: var(--ink-2);
        line-height: 1.5;
        margin: 0;
      }
      .sg-show-hero-summary {
        font-family: var(--sans);
        font-size: 15px;
        color: var(--ink-2);
        line-height: 1.6;
        margin: 0;
        max-width: 600px;
      }
      .sg-show-headerbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .sg-show-back {
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
      }
      .sg-show-back:hover { color: var(--ink); }

      /* ============================================================
         Two-column show layout
         ============================================================ */
      .sg-twocol {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 32px;
        align-items: start;
      }
      .sg-twocol-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .sg-twocol-placeholder {
        padding: 24px;
        background: var(--paper);
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-3);
        text-align: center;
      }
      .sg-twocol-side {
        padding-left: 22px;
        border-left: 1px solid var(--ink-line);
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .sg-side-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--ink-line);
      }
      .sg-side-stat { display: flex; flex-direction: column; gap: 2px; }
      .sg-side-stat-value {
        font-family: var(--serif);
        font-size: 22px;
        font-weight: 600;
        color: var(--source);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
      }
      .sg-side-stats[data-entity="concept"] .sg-side-stat-value { color: var(--concept); }
      .sg-side-stats[data-entity="person"]  .sg-side-stat-value { color: var(--person); }
      .sg-side-stat-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .sg-side-block { display: flex; flex-direction: column; gap: 6px; }
      .sg-side-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .sg-side-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .sg-side-count {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .sg-side-sub {
        margin: 0;
        font-size: 11.5px;
        color: var(--ink-4);
        font-style: italic;
      }
      .sg-side-list {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sg-side-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .sg-side-name {
        font-family: var(--sans);
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
      .sg-side-name:hover { color: var(--source); }
      .sg-side-meta {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        flex-shrink: 0;
      }

      /* ============================================================
         Index page
         ============================================================ */
      .sg-index-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .sg-index-title {
        font-family: var(--serif);
        font-size: 32px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin: 0;
        color: var(--source);
      }
      .sg-index-header[data-entity="concept"] .sg-index-title { color: var(--concept); }
      .sg-index-header[data-entity="person"]  .sg-index-title { color: var(--person); }
      .sg-index-subtitle {
        font-family: var(--sans);
        font-size: 13.5px;
        color: var(--ink-3);
        margin: 6px 0 0;
      }
      .sg-index-link {
        background: none;
        border: none;
        padding: 0;
        color: var(--source-2);
        cursor: pointer;
        font: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .sg-index-link:hover { color: var(--source); }
      .sg-index-primary {
        background: var(--source);
        border-color: var(--source);
      }
      .sg-index-primary:hover:not(:disabled) {
        background: var(--source-2);
        border-color: var(--source-2);
      }

      .sg-index-sidebar {
        max-width: 260px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 12px 14px;
      }
      .sg-index-filter-section + .sg-index-filter-section {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--ink-line-soft);
      }
      .sg-index-filter-head {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        background: transparent;
        border: none;
        padding: 6px 0;
        cursor: pointer;
        text-align: left;
        color: inherit;
      }
      .sg-index-filter-label {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        flex: 1;
      }
      .sg-index-filter-caret {
        display: inline-flex;
        color: var(--ink-3);
        transition: transform 0.18s;
      }
      .sg-index-filter-caret.is-closed { transform: rotate(-90deg); }
      .sg-index-filter-body { display: flex; flex-direction: column; gap: 1px; padding-top: 4px; }
      .sg-index-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 8px;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
      }
      .sg-index-row:hover { background: var(--paper-warm); color: var(--ink); }
      .sg-index-row-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sg-index-row-count {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .sg-index-year-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
      }
      .sg-index-year-input {
        flex: 1;
        height: 30px;
        padding: 0 8px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--mono);
        font-size: 12px;
        color: var(--ink);
      }
      .sg-index-year-input:focus { outline: none; border-color: var(--source); }
      .sg-index-year-dash { color: var(--ink-4); }

      .sg-index-toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .sg-index-search {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 36px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        color: var(--ink-3);
        max-width: 480px;
      }
      .sg-index-search:focus-within { border-color: var(--source); color: var(--ink); }
      .sg-index-search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
        min-width: 0;
      }
      .sg-index-sort {
        height: 36px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
        cursor: pointer;
      }
      .sg-index-density {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
      }
      .sg-index-density.is-on {
        background: var(--source-tint);
        border-color: var(--source);
        color: var(--source-2);
        font-weight: 600;
      }

      .sg-index-chipbar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sg-index-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--source-tint);
        color: var(--source-2);
        border: none;
        border-radius: var(--r-sm);
        padding: 3px 8px 3px 10px;
        font-family: var(--sans);
        font-size: 12px;
        cursor: pointer;
      }
      .sg-index-chip:hover {
        background: color-mix(in srgb, var(--source-tint) 70%, var(--source) 30%);
      }
      .sg-index-chip-x { font-size: 14px; line-height: 1; opacity: 0.7; }
      .sg-index-chip-clear {
        background: transparent;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 3px 10px;
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink-3);
        cursor: pointer;
      }
      .sg-index-chip-clear:hover { background: var(--paper-warm); color: var(--ink); }

      @media (max-width: 800px) {
        .sg-host { padding: 0 0 48px; }
        .sg-toc { grid-template-columns: repeat(2, 1fr); }
        .sg-two { grid-template-columns: 1fr; }
        .sg-hero-title { font-size: 32px; }
        .sg-color-quad { grid-template-columns: repeat(2, 1fr); }
        .sg-twocol { grid-template-columns: 1fr; }
        .sg-twocol-side {
          padding-left: 0;
          border-left: none;
          padding-top: 16px;
          border-top: 1px solid var(--ink-line);
        }
      }
    `}</style>
  );
}
