import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';
import CollectionSelector from './CollectionSelector';
import RichTextEditor from './RichTextEditor';

const ROLE_OPTIONS = [
  { value: 'theorist',   label: 'Theorist' },
  { value: 'clinician',  label: 'Clinician' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'peer',       label: 'Peer' },
  { value: 'client',     label: 'Client' },
];

const TABS = [
  { id: 'basics',   label: 'Basics' },
  { id: 'metadata', label: 'Connections' },
];

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  role: 'researcher',
  orcid: '',
  email: '',
  url: '',
  affiliation: '',
  summary: '',
  aka: [],
  links: [],
  concept_ids: [],
  source_ids: [],
  tags: [],
};

export default function PersonFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basics');
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // AKA + Links inputs
  const [akaInput, setAkaInput] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });

  // Collections (only for existing items)
  const [, setCollections] = useState([]);
  const [itemCollections, setItemCollections] = useState([]);

  // Enrich (ORCID/OpenAlex) state — not Haiku, so no sparkle icon.
  const [enriching, setEnriching] = useState(false);
  const [enrichNote, setEnrichNote] = useState('');

  // ====================================================================
  // Autosave
  // ====================================================================
  const performAutosave = useCallback(async (dataToSave) => {
    if (!item?.id) return;
    setSaveStatus('saving');
    try {
      const r = await fetch(`/people/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ person: dataToSave }),
      });
      if (r.ok) {
        lastSavedData.current = JSON.stringify(dataToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Autosave error:', e);
      setSaveStatus('error');
    }
  }, [item?.id]);

  const handleClose = useCallback(async () => {
    if (saveStatus === 'pending' && item?.id) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await performAutosave(formData);
    } else if (saveStatus === 'saving') {
      await new Promise(r => setTimeout(r, 500));
    }
    onClose();
  }, [saveStatus, item?.id, formData, performAutosave, onClose]);

  useEffect(() => {
    if (!isOpen || !item?.id) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedData.current = JSON.stringify(formData);
      return;
    }
    if (JSON.stringify(formData) === lastSavedData.current) return;
    setSaveStatus('pending');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => performAutosave(formData), 1000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [formData, isOpen, item?.id, performAutosave]);

  // ====================================================================
  // Init / reset on open
  // ====================================================================
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('basics');
    setSaveStatus('idle');
    isInitialMount.current = true;
    setEnrichNote('');
    setEnriching(false);
    setAkaInput('');
    setNewLink({ label: '', url: '' });
    fetchCollections();
    if (item) {
      fetchItemCollections(item.id);
      const combinedFirst = [item.first_name, item.middle_name].filter(Boolean).join(' ') || '';
      const next = {
        ...EMPTY_FORM,
        first_name: combinedFirst,
        last_name: item.last_name || '',
        role: item.role || 'researcher',
        orcid: item.orcid || '',
        email: item.email || '',
        url: item.url || '',
        affiliation: item.affiliation || '',
        summary: item.summary || '',
        aka: item.aka || [],
        links: item.links || [],
        concept_ids: item.concept_ids || [],
        source_ids: item.source_ids || [],
        tags: Array.isArray(item.tags) ? item.tags.map(t => typeof t === 'string' ? t : t.name) : [],
      };
      setFormData(next);
      lastSavedData.current = JSON.stringify(next);
    } else {
      setItemCollections([]);
      setFormData(EMPTY_FORM);
      lastSavedData.current = null;
    }
    setError('');
  }, [isOpen, item]);

  // ====================================================================
  // Save (new persons)
  // ====================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const url = item ? `/people/${item.id}` : '/people';
      const method = item ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ person: formData }),
      });
      if (r.ok) {
        const data = await r.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await r.json();
        setError((data.errors || []).join(', ') || 'Failed to save.');
      }
    } catch (e) {
      console.error(e);
      setError('An error occurred while saving the person.');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================================
  // AKA chips
  // ====================================================================
  const addAka = () => {
    const v = akaInput.trim();
    if (!v) return;
    if (!formData.aka.includes(v)) {
      setFormData({ ...formData, aka: [...formData.aka, v] });
    }
    setAkaInput('');
  };
  const removeAka = (idx) => {
    setFormData({ ...formData, aka: formData.aka.filter((_, i) => i !== idx) });
  };

  // ====================================================================
  // Profile links
  // ====================================================================
  const guessLabel = (url) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host.includes('scholar.google')) return 'Google Scholar';
      if (host.includes('orcid.org')) return 'ORCID';
      if (host.includes('researchgate')) return 'ResearchGate';
      if (host.includes('linkedin')) return 'LinkedIn';
      return host;
    } catch {
      return 'Link';
    }
  };
  const addLink = () => {
    const url = newLink.url.trim();
    if (!url) return;
    const label = newLink.label.trim() || guessLabel(url);
    setFormData({ ...formData, links: [...formData.links, { label, url }] });
    setNewLink({ label: '', url: '' });
  };
  const removeLink = (idx) => {
    setFormData({ ...formData, links: formData.links.filter((_, i) => i !== idx) });
  };

  // ====================================================================
  // Enrich from ORCID / OpenAlex (existing endpoint, not Haiku)
  // ====================================================================
  const handleEnrich = async () => {
    if (!item?.id) {
      setEnrichNote('Save the person first.');
      return;
    }
    setEnrichNote('');
    setEnriching(true);
    try {
      const r = await fetch(`/people/${item.id}/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });
      const data = await r.json();
      if (r.ok && data.queued) {
        setEnrichNote(data.step === 'enriching_from_orcid'
          ? 'Queued ORCID lookup.  Refresh in a moment.'
          : 'Queued ORCID backfill from linked sources.');
      } else {
        setEnrichNote(data.error || 'Enrich failed.');
      }
    } catch (e) {
      console.error(e);
      setEnrichNote('Enrich failed.  Try again in a moment.');
    } finally {
      setEnriching(false);
    }
  };

  // ====================================================================
  // Collections (existing person only)
  // ====================================================================
  const fetchCollections = async () => {
    try {
      const r = await fetch('/collections.json');
      setCollections(await r.json());
    } catch (e) { console.error(e); }
  };
  const fetchItemCollections = async (personId) => {
    try {
      const r = await fetch(`/people/${personId}.json`);
      const data = await r.json();
      setItemCollections(data.collections || []);
    } catch (e) { console.error(e); }
  };

  // ====================================================================
  // Render
  // ====================================================================
  return (
    <SlidePanel isOpen={isOpen} onClose={handleClose}>
      <PfmStyles />
      <form onSubmit={handleSubmit} className="pfm">
        {/* Header */}
        <header className="pfm-head">
          <div className="pfm-head-title">
            <h2>
              {item
                ? (`${formData.first_name} ${formData.last_name}`.trim() || item.full_name || 'Untitled Person')
                : 'New Person'}
            </h2>
          </div>
          <div className="pfm-head-actions">
            {item && <SaveStatus status={saveStatus} />}
            <button type="button" className="pfm-close" onClick={handleClose} aria-label="Close">×</button>
          </div>
        </header>

        {error && (
          <div className="pfm-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Sidebar + Content */}
        <div className="pfm-body">
          <nav className="pfm-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`pfm-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="pfm-content">
            {activeTab === 'basics' && (
              <BasicsTab
                formData={formData}
                setFormData={setFormData}
                item={item}
                akaInput={akaInput}
                setAkaInput={setAkaInput}
                onAddAka={addAka}
                onRemoveAka={removeAka}
                newLink={newLink}
                setNewLink={setNewLink}
                onAddLink={addLink}
                onRemoveLink={removeLink}
                onEnrich={handleEnrich}
                enriching={enriching}
                enrichNote={enrichNote}
              />
            )}

            {activeTab === 'metadata' && (
              <ConnectionsTab
                formData={formData}
                setFormData={setFormData}
                item={item}
                itemCollections={itemCollections}
                setItemCollections={setItemCollections}
              />
            )}
          </div>
        </div>

        {/* Footer — only on new */}
        {!item && (
          <footer className="pfm-foot">
            <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="sp-action sp-action-primary" disabled={submitting}>
              {submitting ? 'Saving.' : 'Create Person'}
            </button>
          </footer>
        )}
      </form>
    </SlidePanel>
  );
}

// =====================================================================
// Tab — Basics
// =====================================================================
function BasicsTab({
  formData, setFormData, item,
  akaInput, setAkaInput, onAddAka, onRemoveAka,
  newLink, setNewLink, onAddLink, onRemoveLink,
  onEnrich, enriching, enrichNote,
}) {
  return (
    <section className="pfm-section">
      <h3 className="pfm-h3">Basics</h3>

      <div className="pfm-grid-2">
        <Field label="First Name">
          <input
            type="text"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            className="form-input"
            placeholder="Jane"
          />
        </Field>
        <Field label="Last Name" required>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className="form-input"
            placeholder="Smith"
          />
        </Field>
      </div>

      <div className="pfm-grid-2">
        <Field label="Role">
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="form-input"
          >
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field
          label="ORCID"
          hint="Sixteen-digit researcher ID, e.g., 0000-0002-1825-0097."
          trailing={item && (
            <button
              type="button"
              className="pfm-enrich-btn"
              onClick={onEnrich}
              disabled={enriching}
              title="Pull profile data from ORCID and OpenAlex"
            >
              {enriching ? 'Enriching.' : 'Enrich'}
            </button>
          )}
        >
          <input
            type="text"
            value={formData.orcid}
            onChange={(e) => setFormData({ ...formData, orcid: e.target.value })}
            className="form-input"
            placeholder="0000-0000-0000-0000"
          />
          {enrichNote && <div className="pfm-note">{enrichNote}</div>}
        </Field>
      </div>

      <div className="pfm-grid-2">
        <Field label="Email">
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="form-input"
            placeholder="jane.smith@university.edu"
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            className="form-input"
            placeholder="https://."
          />
        </Field>
      </div>

      <Field label="Affiliation" hint="Current institution and role.  Auto-filled from ORCID; edit to override.">
        <input
          type="text"
          value={formData.affiliation}
          onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
          className="form-input"
          placeholder="Associate Professor, Stanford University"
        />
      </Field>

      <Field label="Also Known As" hint="Other names this person is published under.  Press Enter to add.">
        <div className="pfm-chip-input">
          {formData.aka.map((name, idx) => (
            <span key={idx} className="pfm-chip">
              {name}
              <button type="button" onClick={() => onRemoveAka(idx)} className="pfm-chip-x" aria-label={`Remove ${name}`}>×</button>
            </span>
          ))}
          <input
            type="text"
            className="pfm-chip-text"
            placeholder={formData.aka.length === 0 ? 'e.g., J. Smith, Jane S. Smith' : ''}
            value={akaInput}
            onChange={(e) => setAkaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                onAddAka();
              } else if (e.key === 'Backspace' && !akaInput && formData.aka.length > 0) {
                e.preventDefault();
                onRemoveAka(formData.aka.length - 1);
              }
            }}
          />
        </div>
      </Field>

      <Field label="Summary" hint="Short bio in your own words.">
        <RichTextEditor
          value={formData.summary}
          onChange={(html) => setFormData({ ...formData, summary: html })}
          placeholder="A few sentences about this person."
          rows={4}
          themeColor="var(--person)"
        />
      </Field>

      <Field label="Profile Links" hint="Google Scholar, ResearchGate, LinkedIn, lab pages — anywhere their work lives.">
        {formData.links.length > 0 && (
          <ul className="pfm-link-list">
            {formData.links.map((link, idx) => (
              <li key={idx} className="pfm-link-row">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="pfm-link-label">
                  {link.label}
                </a>
                <span className="pfm-link-url">{link.url}</span>
                <button type="button" className="pfm-link-remove" onClick={() => onRemoveLink(idx)} aria-label="Remove link">×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="pfm-link-add">
          <input
            type="text"
            className="form-input"
            placeholder="Label (optional)"
            value={newLink.label}
            onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
          />
          <input
            type="url"
            className="form-input"
            placeholder="https://."
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddLink(); } }}
          />
          <button type="button" className="sp-action sp-action-secondary" onClick={onAddLink}>Add</button>
        </div>
      </Field>
    </section>
  );
}

// =====================================================================
// Tab — Connections
// =====================================================================
function ConnectionsTab({ formData, setFormData, item, itemCollections, setItemCollections }) {
  return (
    <section className="pfm-section">
      <h3 className="pfm-h3">Connections</h3>

      <div className="pfm-grid-2">
        <Field label="Concepts">
          <div className="pfm-selector-frame">
            <ConceptSelector
              selectedConceptIds={formData.concept_ids}
              onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
              themeColor="var(--concept)"
            />
          </div>
        </Field>

        <Field label="Sources">
          <div className="pfm-selector-frame">
            <SourceSelector
              selectedSourceIds={formData.source_ids}
              onChange={(source_ids) => setFormData({ ...formData, source_ids })}
              themeColor="var(--source)"
            />
          </div>
        </Field>
      </div>

      <div className="pfm-grid-2">
        <Field label="Tags">
          <div className="pfm-selector-frame">
            <TagSelector
              selectedTags={formData.tags}
              onChange={(tags) => setFormData({ ...formData, tags })}
              themeColor="var(--ink-3)"
            />
          </div>
        </Field>

        <Field label="Collections">
          <div className="pfm-selector-frame">
            <CollectionSelector
              itemType="Person"
              itemId={item?.id}
              selectedCollectionIds={item ? itemCollections.map(c => c.id) : []}
              onChange={(ids, collections) => {
                if (item) setItemCollections(collections);
              }}
              themeColor="var(--ink-3)"
            />
          </div>
        </Field>
      </div>
    </section>
  );
}

// =====================================================================
// Field wrapper
// =====================================================================
function Field({ label, hint, required, trailing, children }) {
  return (
    <div className="pfm-field">
      <div className="pfm-field-head">
        <label className="form-label">
          {label}{required && <span className="pfm-req"> *</span>}
        </label>
        {trailing}
      </div>
      {hint && <p className="form-hint">{hint}</p>}
      {children}
    </div>
  );
}

// =====================================================================
// Save status pill
// =====================================================================
function SaveStatus({ status }) {
  if (status === 'pending') return <span className="pfm-save is-pending">Save Pending.</span>;
  if (status === 'saving')  return <span className="pfm-save is-saving">Saving.</span>;
  if (status === 'saved')   return <span className="pfm-save is-saved">Saved</span>;
  if (status === 'error')   return <span className="pfm-save is-error">Save Error</span>;
  return <span className="pfm-save is-idle">Auto-Save On</span>;
}

// =====================================================================
// Styles
// =====================================================================
function PfmStyles() {
  return (
    <style>{`
      .pfm {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--paper);
        font-family: var(--font-body);
        color: var(--ink);
      }

      .pfm-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 24px;
        background: var(--paper);
        border-bottom: 1px solid var(--ink-line);
        flex-shrink: 0;
        min-width: 0;
      }
      .pfm-head-title { min-width: 0; flex: 1; }
      .pfm-head-title h2 {
        margin: 0;
        font-family: var(--font-display);
        font-size: 20px;
        font-weight: 600;
        color: var(--person);
        letter-spacing: -0.005em;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pfm-head-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      .pfm-close {
        background: transparent;
        border: 1px solid transparent;
        color: var(--ink-3);
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--r-sm);
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .pfm-close:hover {
        background: var(--paper-soft);
        color: var(--ink);
        border-color: var(--ink-line);
      }

      /* Teal accents inside the modal — !important so the rule wins over
         the global .form-label color regardless of stylesheet load order. */
      .pfm .form-label,
      .pfm .pfm-field > .pfm-field-head > .form-label { color: var(--person) !important; }
      .pfm .sp-action-primary {
        background: var(--person);
        border-color: var(--person);
      }
      .pfm .sp-action-primary:hover:not(:disabled) {
        background: var(--person-2);
        border-color: var(--person-2);
      }
      .pfm .sp-checkbox:checked,
      .pfm .sp-checkbox:indeterminate {
        background: var(--person);
        border-color: var(--person);
      }

      .pfm-save {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: var(--r-sm);
        background: var(--paper-soft);
      }
      .pfm-save.is-pending { color: var(--ink-3); }
      .pfm-save.is-saving  { color: var(--person-2); }
      .pfm-save.is-saved   { color: var(--person); background: var(--person-tint); }
      .pfm-save.is-error   { color: var(--error); }
      .pfm-save.is-idle    { color: var(--ink-3); }

      .pfm-error {
        margin: 12px 24px 0;
        padding: 10px 14px;
        border-radius: var(--r-md);
        background: rgba(122, 46, 46, 0.06);
        border: 1px solid var(--error);
        color: var(--error);
        font-size: 13px;
      }

      .pfm-body {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }

      /* Sidebar nav */
      .pfm-nav {
        width: 200px;
        background: var(--paper-soft);
        padding: 14px 12px;
        flex-shrink: 0;
        border-right: 1px solid var(--ink-line);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .pfm-tab {
        display: flex;
        align-items: center;
        text-align: left;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-2);
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
      }
      .pfm-tab:hover { background: var(--hover); color: var(--ink); }
      .pfm-tab.is-active {
        background: var(--person-tint);
        color: var(--person-2);
        font-weight: 600;
      }

      /* Content */
      .pfm-content {
        flex: 1;
        overflow-y: auto;
        background: var(--paper);
        padding: 24px 32px;
        min-width: 0;
      }
      .pfm-section { display: flex; flex-direction: column; gap: 18px; }
      .pfm-h3 {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--person);
        margin: 0 0 6px;
        letter-spacing: -0.01em;
      }

      .pfm-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      /* Field — stretch to keep paired Connections boxes aligned */
      .pfm-field {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .pfm-field-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
      }
      .pfm-req { color: var(--person); font-weight: 700; }
      .pfm-field > .pfm-selector-frame { flex: 1; min-height: 0; }

      .pfm-selector-frame {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }

      .pfm-note {
        margin-top: 6px;
        font-size: 12px;
        color: var(--ink-3);
        font-style: italic;
      }

      /* Enrich button — automated lookup, NOT Haiku, so no sparkle */
      .pfm-enrich-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--person-2);
        background: var(--person-tint);
        border: 1px solid color-mix(in srgb, var(--person) 30%, transparent);
        border-radius: var(--r-sm);
        padding: 4px 10px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .pfm-enrich-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--person-tint) 60%, var(--person) 40%);
        color: var(--paper);
        border-color: var(--person);
      }
      .pfm-enrich-btn:disabled { opacity: 0.55; cursor: not-allowed; }

      /* AKA chip input */
      .pfm-chip-input {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        min-height: 40px;
      }
      .pfm-chip-input:focus-within { border-color: var(--person); }
      .pfm-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12.5px;
        background: var(--person-tint);
        color: var(--person-2);
        padding: 2px 4px 2px 10px;
        border-radius: var(--r-sm);
      }
      .pfm-chip-x {
        background: none;
        border: none;
        color: inherit;
        font-size: 14px;
        line-height: 1;
        padding: 0 4px;
        cursor: pointer;
        opacity: 0.7;
      }
      .pfm-chip-x:hover { opacity: 1; }
      .pfm-chip-text {
        flex: 1;
        min-width: 80px;
        background: transparent;
        border: none;
        outline: none;
        font: inherit;
        color: var(--ink);
        padding: 4px 0;
      }
      .pfm-chip-text::placeholder { color: var(--ink-3); }

      /* Profile links */
      .pfm-link-list {
        list-style: none;
        margin: 0 0 8px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pfm-link-row {
        display: grid;
        grid-template-columns: 140px 1fr auto;
        align-items: center;
        gap: 12px;
        padding: 6px 10px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-size: 12.5px;
      }
      .pfm-link-label {
        color: var(--person-2);
        font-weight: 500;
        text-decoration: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pfm-link-label:hover { text-decoration: underline; }
      .pfm-link-url {
        color: var(--ink-3);
        font-family: var(--font-mono);
        font-size: 11.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pfm-link-remove {
        background: none;
        border: none;
        color: var(--ink-3);
        font-size: 16px;
        line-height: 1;
        padding: 0 6px;
        cursor: pointer;
      }
      .pfm-link-remove:hover { color: var(--error); }

      .pfm-link-add {
        display: grid;
        grid-template-columns: 140px 1fr auto;
        gap: 8px;
      }

      /* Footer */
      .pfm-foot {
        border-top: 1px solid var(--ink-line);
        background: var(--paper);
        padding: 14px 24px;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-shrink: 0;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .pfm-nav {
          width: 56px;
          padding: 10px 6px;
        }
        .pfm-tab { font-size: 12px; padding: 6px 8px; justify-content: center; }
        .pfm-content { padding: 18px 16px; }
        .pfm-grid-2 { grid-template-columns: 1fr; gap: 12px; }
        .pfm-link-row, .pfm-link-add { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
