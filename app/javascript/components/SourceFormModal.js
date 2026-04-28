import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import SlidePanel from './SlidePanel';
import TagSelector from './TagSelector';
import ConceptSelector from './ConceptSelector';
import PeopleSelector from './PeopleSelector';
import CollectionSelector from './CollectionSelector';
import AuthorDisambiguationModal from './AuthorDisambiguationModal';
import ConceptDisambiguationModal from './ConceptDisambiguationModal';
import RichTextEditor from './RichTextEditor';
import MagicSparkles from './icons/MagicSparkles';
import { RESEARCH_TYPES } from '../config/researchTypes';

// Suggested defaults — kept in sync with Source::SUGGESTED_MARKERS.
const SUGGESTED_MARKERS = ['To Read', 'Currently Reading', 'Read', 'Needs PDF', 'Key Source', 'Methods Reference', 'Outdated', 'Urgent'];

const SOURCE_TYPES = [
  { value: 'article',      label: 'Article' },
  { value: 'book',         label: 'Book' },
  { value: 'book_chapter', label: 'Book Chapter' },
  { value: 'conference',   label: 'Conference Paper' },
  { value: 'report',       label: 'Report' },
  { value: 'thesis',       label: 'Thesis' },
  { value: 'dissertation', label: 'Dissertation' },
  { value: 'website',      label: 'Website' },
  { value: 'video',        label: 'Video' },
  { value: 'podcast',      label: 'Podcast' },
  { value: 'other',        label: 'Other' },
];

const TABS = [
  { id: 'basics',   label: 'Basics' },
  { id: 'content',  label: 'Content' },
  { id: 'metadata', label: 'Connections' },
];

const EMPTY_FORM = {
  title: '', authors: '', year: '', kind: 'article', methodologies: [],
  publisher_or_venue: '', doi: '', url: '', citation: '', summary: '',
  tags: [], concept_ids: [], person_ids: [], journal_name: '',
  volume: '', issue: '', pages: '', publication_date: '', abstract: '',
  keywords: [], book_title: '', edition: '', isbn: '', chapter_number: '',
  website_name: '', access_date: '', collection_ids: [], markers: [],
};

export default function SourceFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basics');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [autosaveError, setAutosaveError] = useState('');
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [pdfFile, setPdfFile] = useState(null);
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Flesh Out Citation — free-form fragment → Crossref + Haiku resolution
  const [fleshFragment, setFleshFragment] = useState('');
  const [fleshing, setFleshing] = useState(false);
  const [fleshError, setFleshError] = useState('');
  const [fleshResult, setFleshResult] = useState(null); // { best, alternatives, confidence }

  // Authors disambiguation
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [authorModalMode, setAuthorModalMode] = useState('check');
  const [parsedAuthors, setParsedAuthors] = useState([]);
  const [authorsData, setAuthorsData] = useState(null);
  const [processedAuthorsData, setProcessedAuthorsData] = useState(null);
  const [suggestingAuthors, setSuggestingAuthors] = useState(false);
  const [authorSuggestNote, setAuthorSuggestNote] = useState('');

  // Duplicate detection
  const [titleDuplicate, setTitleDuplicate] = useState(null);
  const [urlDuplicate, setUrlDuplicate] = useState(null);

  // Concepts disambiguation (Haiku suggestion)
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [conceptSuggestions, setConceptSuggestions] = useState([]);
  const [processedConceptsData, setProcessedConceptsData] = useState(null);
  const [loadingConceptSuggestions, setLoadingConceptSuggestions] = useState(false);
  const [newlyCreatedConcepts, setNewlyCreatedConcepts] = useState([]);

  // Collections (when editing, we sync directly to collection_items)
  const [collections, setCollections] = useState([]);
  const [itemCollections, setItemCollections] = useState([]);

  // Markers editor state (collapsed by default)
  const [showMarkersEditor, setShowMarkersEditor] = useState(false);
  const [customMarker, setCustomMarker] = useState('');

  // Research-type auto-tagging (Haiku)
  const [taggingMethods, setTaggingMethods] = useState(false);
  const [methodsTagError, setMethodsTagError] = useState('');
  // Set by handleExtractMetadata; consumed by the useEffect below to fire
  // an auto-tag once formData has the freshly-extracted abstract.
  const pendingAutoTagRef = useRef(false);

  // ====================================================================
  // Duplicate check (debounced) — only for new sources
  // ====================================================================
  useEffect(() => {
    if (!isOpen || item) return;
    const checkDuplicates = async () => {
      if (formData.title && formData.title.length > 10) {
        try {
          const r = await fetch(`/sources.json?q=${encodeURIComponent(formData.title)}&per_page=5`);
          const data = await r.json();
          const sources = data.sources || [];
          const dup = sources.find(s => s.title?.toLowerCase().trim() === formData.title.toLowerCase().trim());
          setTitleDuplicate(dup || null);
        } catch (e) { /* ignore */ }
      } else {
        setTitleDuplicate(null);
      }

      if (formData.url && formData.url.length > 10) {
        try {
          const r = await fetch(`/sources.json?q=${encodeURIComponent(formData.url)}&per_page=5`);
          const data = await r.json();
          const sources = data.sources || [];
          const dup = sources.find(s => s.url && s.url.toLowerCase().trim() === formData.url.toLowerCase().trim());
          setUrlDuplicate(dup || null);
        } catch (e) { /* ignore */ }
      } else {
        setUrlDuplicate(null);
      }
    };
    const t = setTimeout(checkDuplicates, 500);
    return () => clearTimeout(t);
  }, [formData.title, formData.url, isOpen, item]);

  // ====================================================================
  // Autosave (existing items only)
  // ====================================================================
  const performAutosave = useCallback(async (dataToSave) => {
    if (!item?.id) return;
    setSaveStatus('saving');
    setAutosaveError('');
    try {
      const r = await fetch(`/sources/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ source: dataToSave }),
      });
      if (r.ok) {
        lastSavedData.current = JSON.stringify(dataToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        const data = await r.json().catch(() => ({}));
        const detail = (Array.isArray(data.errors) && data.errors.join(', ')) || data.error || `HTTP ${r.status}`;
        setAutosaveError(detail);
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Autosave error:', e);
      setAutosaveError(e.message || 'Network error');
      setSaveStatus('error');
    }
  }, [item?.id]);

  // Manual save — flushes any pending autosave timer and triggers the
  // PATCH immediately.  Useful when the autosave hit an error and the
  // user wants to retry, or when they want to force a flush before doing
  // something risky like running Flesh Out.
  const handleManualSave = useCallback(() => {
    if (!item?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    performAutosave(formData);
  }, [item?.id, formData, performAutosave]);

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

  // PDF upload (existing items)
  useEffect(() => {
    if (!isOpen || !item?.id || !pdfFile) return;
    const upload = async () => {
      setSaveStatus('saving');
      try {
        const fd = new FormData();
        fd.append('_method', 'PATCH');
        fd.append('source[pdf]', pdfFile);
        const r = await fetch(`/sources/${item.id}`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content },
          body: fd,
        });
        if (r.ok) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('error');
        }
      } catch (e) {
        console.error('PDF upload error:', e);
        setSaveStatus('error');
      }
    };
    upload();
  }, [pdfFile, isOpen, item?.id]);

  // ====================================================================
  // Init / reset on open
  // ====================================================================
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('basics');
    setSaveStatus('idle');
    isInitialMount.current = true;
    setTitleDuplicate(null);
    setUrlDuplicate(null);
    setProcessedAuthorsData(null);
    setProcessedConceptsData(null);
    setConceptSuggestions([]);
    setNewlyCreatedConcepts([]);
    setShowMarkersEditor(false);
    setCustomMarker('');
    // Flesh Out state — reset between opens / item swaps so the previous
    // source's fragment, result, and error don't bleed across.
    setFleshFragment('');
    setFleshing(false);
    setFleshError('');
    setFleshResult(null);
    setExtractUrl('');
    fetchCollections();
    if (item) {
      fetchItemCollections(item.id);
      const newData = {
        ...EMPTY_FORM,
        title: item.title || '',
        authors: item.authors || '',
        year: item.year || '',
        kind: item.kind || 'article',
        methodologies: item.methodologies || [],
        publisher_or_venue: item.publisher_or_venue || '',
        doi: item.doi || '',
        url: item.url || '',
        citation: item.citation || '',
        summary: item.summary || '',
        tags: Array.isArray(item.tags) ? item.tags.map(t => typeof t === 'string' ? t : t.name) : [],
        concept_ids: item.concept_ids || [],
        person_ids: item.people ? item.people.map(p => p.id) : [],
        journal_name: item.journal_name || '',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        publication_date: item.publication_date || '',
        abstract: item.abstract || '',
        keywords: item.keywords || [],
        book_title: item.book_title || '',
        edition: item.edition || '',
        isbn: item.isbn || '',
        chapter_number: item.chapter_number || '',
        website_name: item.website_name || '',
        access_date: item.access_date || '',
        markers: item.markers || [],
      };
      setFormData(newData);
      lastSavedData.current = JSON.stringify(newData);
    } else {
      setItemCollections([]);
      setFormData(EMPTY_FORM);
    }
    setError('');
    setPdfFile(null);
  }, [isOpen, item]);

  // ====================================================================
  // Author parsing & disambiguation
  // ====================================================================
  const parseAuthors = (str) => {
    if (!str || typeof str !== 'string' || str.trim() === '') return [];
    return str.split(/\.\s*,\s*(?=[A-Z])/).map(a => a.trim() + '.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const authors = parseAuthors(formData.authors);
    if (processedAuthorsData) {
      await performSave(processedAuthorsData);
      return;
    }
    if (authors.length > 0) {
      setParsedAuthors(authors);
      setAuthorModalMode('save');
      setShowAuthorModal(true);
    } else {
      await performSave();
    }
  };

  const handleAuthorConfirm = async (processed) => {
    setShowAuthorModal(false);
    const allPersonIds = [];
    const updated = [...processed];
    for (let i = 0; i < processed.length; i++) {
      const a = processed[i];
      if ((a.action === 'link' || a.action === 'link_and_update') && a.linkedPersonId) {
        allPersonIds.push(Number(a.linkedPersonId));
        if (a.action === 'link_and_update' && a.mergeOrcid) {
          try {
            await fetch(`/people/${a.linkedPersonId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
              },
              body: JSON.stringify({ person: { orcid: a.mergeOrcid } }),
            });
          } catch (e) { console.error(e); }
        }
      } else if (a.action === 'create') {
        try {
          const r = await fetch('/people', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({
              person: {
                first_name: [a.firstName, a.middleName].filter(Boolean).join(' ') || null,
                last_name: a.lastName,
                orcid: a.orcid || null,
                role: 'researcher',
              }
            }),
          });
          if (r.ok) {
            const np = await r.json();
            allPersonIds.push(Number(np.id));
            updated[i] = { ...a, action: 'link', linkedPersonId: np.id };
          }
        } catch (e) { console.error(e); }
      }
    }
    if (allPersonIds.length > 0) {
      const existing = (formData.person_ids || []).map(id => Number(id));
      const merged = [...new Set([...existing, ...allPersonIds])];
      setFormData(prev => ({ ...prev, person_ids: merged }));
    }
    if (authorModalMode === 'save') {
      await performSave(updated);
    } else {
      setProcessedAuthorsData(updated);
    }
  };

  const handleCheckAuthors = () => {
    const authors = parseAuthors(formData.authors);
    if (authors.length > 0) {
      setParsedAuthors(authors);
      setAuthorsData(null);
      setAuthorModalMode('check');
      setShowAuthorModal(true);
    }
  };

  // Magic People button — calls Haiku/CrossRef to propose authors and opens
  // the disambiguation modal.  Always available when there's a title.
  const handleSuggestAuthors = async () => {
    if (!formData.title) {
      setAuthorSuggestNote('Add a title first.');
      return;
    }
    setAuthorSuggestNote('');
    setSuggestingAuthors(true);
    try {
      const r = await fetch('/sources/suggest_authors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          title: formData.title,
          abstract: formData.abstract,
          doi: formData.doi,
        }),
      });
      const data = await r.json();
      const proposed = Array.isArray(data.authors) ? data.authors : [];
      if (proposed.length === 0) {
        setAuthorSuggestNote(
          formData.doi
            ? 'CrossRef had nothing for this DOI and the abstract did not name authors.'
            : 'No authors proposed.  Add a DOI to look them up directly.'
        );
        return;
      }
      // Build the parallel arrays AuthorDisambiguationModal expects.
      const displayStrings = proposed.map(a => {
        const given = (a.given || '').trim();
        const family = (a.family || '').trim();
        return given ? `${family}, ${given.charAt(0)}.` : family;
      });
      setParsedAuthors(displayStrings);
      setAuthorsData(proposed);
      setAuthorModalMode('check');
      setShowAuthorModal(true);
    } catch (e) {
      console.error(e);
      setAuthorSuggestNote('Suggestion failed.  Try again in a moment.');
    } finally {
      setSuggestingAuthors(false);
    }
  };

  // ====================================================================
  // Concept suggestion (Haiku)
  // ====================================================================
  const handleCheckConcepts = async () => {
    if (!formData.title) return;
    setLoadingConceptSuggestions(true);
    try {
      const r = await fetch('/concepts/suggest_from_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ title: formData.title, abstract: formData.abstract, keywords: formData.keywords }),
      });
      const data = await r.json();
      setConceptSuggestions(data.suggestions || []);
      setShowConceptModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConceptSuggestions(false);
    }
  };

  const handleConceptConfirm = async (processed) => {
    setShowConceptModal(false);
    const allConceptIds = [];
    const created = [];
    for (const c of processed) {
      if (c.action === 'skip') continue;
      if (c.action === 'link' && c.linkedConceptId) {
        allConceptIds.push(Number(c.linkedConceptId));
      } else if (c.action === 'create') {
        try {
          const r = await fetch('/concepts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({
              concept: { label: c.editedLabel, concept_type: c.editedConceptType || 'phenomenon' },
            }),
          });
          if (r.ok) {
            const nc = await r.json();
            allConceptIds.push(Number(nc.id));
            created.push(nc);
          }
        } catch (e) { console.error(e); }
      }
    }
    if (created.length > 0) setNewlyCreatedConcepts(p => [...p, ...created]);
    const existing = (formData.concept_ids || []).map(id => Number(id));
    const merged = [...new Set([...existing, ...allConceptIds])];
    setFormData(prev => ({ ...prev, concept_ids: merged }));
    setProcessedConceptsData(processed);
  };

  // ====================================================================
  // Save (new sources)
  // ====================================================================
  const performSave = async (processedAuthors = null) => {
    setSubmitting(true);
    try {
      const url = item ? `/sources/${item.id}` : '/sources';
      const method = item ? 'PATCH' : 'POST';
      const dataToSend = { ...formData };
      if (processedAuthors) {
        dataToSend.processed_authors = processedAuthors;
        dataToSend.override_authors = true;
      }
      let body, headers = { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content };
      if (pdfFile) {
        const fd = new FormData();
        if (method === 'PATCH') fd.append('_method', 'PATCH');
        Object.keys(dataToSend).forEach(k => {
          if (k === 'processed_authors') {
            fd.append(`source[processed_authors]`, JSON.stringify(dataToSend[k]));
          } else if (Array.isArray(dataToSend[k])) {
            dataToSend[k].forEach(v => fd.append(`source[${k}][]`, v));
          } else if (dataToSend[k] !== null && dataToSend[k] !== '') {
            fd.append(`source[${k}]`, dataToSend[k]);
          }
        });
        fd.append('source[pdf]', pdfFile);
        body = fd;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ source: dataToSend });
      }
      const r = await fetch(url, {
        method: pdfFile && method === 'PATCH' ? 'POST' : method,
        headers,
        body,
      });
      if (r.ok) {
        const data = await r.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await r.json();
        setError(data.errors?.join(', ') || data.error || 'An error occurred');
      }
    } catch (e) {
      console.error('Error saving source:', e);
      setError('An error occurred while saving the source');
    } finally {
      setSubmitting(false);
    }
  };

  // ====================================================================
  // Shared: merge a metadata payload into the form (used by both
  // extract_metadata and flesh_out_citation).
  // ====================================================================
  const applyMetadata = (m, fallbackUrl) => {
    setFormData(prev => ({
      ...prev,
      title:               m.title              || prev.title,
      authors:             m.authors            || prev.authors,
      year:                m.year               || prev.year,
      kind:                m.kind               || prev.kind,
      journal_name:        m.journal_name       || prev.journal_name,
      volume:              m.volume             || prev.volume,
      issue:               m.issue              || prev.issue,
      pages:               m.pages              || prev.pages,
      doi:                 m.doi                || prev.doi,
      url:                 m.url                || fallbackUrl || prev.url,
      abstract:            m.abstract           || prev.abstract,
      keywords:            m.keywords           || prev.keywords,
      publisher_or_venue:  m.publisher_or_venue || prev.publisher_or_venue,
      book_title:          m.book_title         || prev.book_title,
      edition:             m.edition            || prev.edition,
      isbn:                m.isbn               || prev.isbn,
      website_name:        m.website_name       || prev.website_name,
      summary:             m.summary || m.abstract || prev.summary,
    }));
    if (m.authors_data) setAuthorsData(m.authors_data);
    pendingAutoTagRef.current = true;
  };

  // ====================================================================
  // Flesh Out Citation — free-form fragment → Crossref candidate
  //
  // New-source mode (item == null): high/medium confidence auto-fills
  //   the form (nothing to clobber — the user just opened a blank form).
  // Edit mode (item present): NEVER auto-fill.  Always route through the
  //   diff picker so the user explicitly approves which fields to update,
  //   so we don't overwrite hand-edited values.
  // ====================================================================
  const isEdit = !!item;

  const handleFleshOut = async () => {
    const fragment = fleshFragment.trim();
    if (fragment.length < 4) {
      setFleshError('Add a few more characters to search for.');
      return;
    }
    setFleshing(true);
    setFleshError('');
    setFleshResult(null);
    try {
      const r = await fetch('/sources/flesh_out_citation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ fragment }),
      });
      const data = await r.json();
      if (!r.ok) {
        setFleshError(data.error || 'Lookup failed.');
        return;
      }
      // New-source flow: auto-apply high/medium confidence matches.
      // Edit flow: never auto-apply — show diff picker instead.
      if (!isEdit && data.confidence !== 'low' && data.best) {
        applyMetadata(data.best);
      }
      setFleshResult(data);
    } catch (e) {
      console.error('Flesh out error:', e);
      setFleshError('Lookup failed.  Try refining the citation.');
    } finally {
      setFleshing(false);
    }
  };

  // Background fill for missing abstract/etc. on a picked alt.  The
  // server-side resolver only enriches the best match — alternatives
  // come from Crossref unenriched.  When the user picks one, run the
  // existing /sources/extract_metadata flow against the DOI to pull in
  // the abstract (and any other missing scalar fields).
  const enrichAltViaDoi = async (alt) => {
    if (!alt?.doi || alt.abstract) return alt;
    try {
      const r = await fetch('/sources/extract_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ url: alt.doi }),
      });
      if (!r.ok) return alt;
      const m = await r.json();
      // Fill gaps only — never clobber the alt's existing fields.
      return {
        ...alt,
        abstract:           alt.abstract           || m.abstract,
        summary:            alt.summary            || m.abstract || m.summary,
        keywords:           (alt.keywords?.length ? alt.keywords : m.keywords) || alt.keywords,
        pages:              alt.pages              || m.pages,
        volume:             alt.volume             || m.volume,
        issue:              alt.issue              || m.issue,
        journal_name:       alt.journal_name       || m.journal_name,
        publisher_or_venue: alt.publisher_or_venue || m.publisher_or_venue,
      };
    } catch (e) {
      console.warn('Alt enrichment failed:', e);
      return alt;
    }
  };

  const applyFleshAlternative = async (alt) => {
    setFleshing(true);
    try {
      const enriched = await enrichAltViaDoi(alt);
      if (isEdit) {
        // Edit mode: stage the picked alt as the "best" for the diff
        // picker; don't apply yet.  The diff component handles the
        // per-field accept/reject UX.
        setFleshResult({ best: enriched, alternatives: [], confidence: 'medium' });
      } else {
        // New mode: apply directly and collapse to the success card.
        applyMetadata(enriched);
        setFleshResult({ best: enriched, alternatives: [], confidence: 'high' });
      }
    } finally {
      setFleshing(false);
    }
  };

  // Apply a diff selection from the diff picker.  selectedKeys is the
  // list of field names the user kept checked.  We merge those resolved
  // values into the existing form, preserving everything else.
  const applyFleshDiff = (resolved, selectedKeys) => {
    setFormData(prev => {
      const merged = { ...prev };
      selectedKeys.forEach((k) => {
        // summary defaults to abstract when not separately provided
        if (k === 'summary') {
          merged.summary = resolved.summary || resolved.abstract || prev.summary;
        } else {
          merged[k] = resolved[k];
        }
      });
      return merged;
    });
    if (resolved.authors_data) setAuthorsData(resolved.authors_data);
    pendingAutoTagRef.current = true;
    // Collapse to a success card.
    setFleshResult({ best: resolved, alternatives: [], confidence: 'high' });
  };

  // ====================================================================
  // URL/DOI extract
  // ====================================================================
  const handleExtractMetadata = async () => {
    if (!extractUrl) {
      setError('Please enter a URL or DOI to extract from');
      return;
    }
    setExtracting(true);
    setError('');
    try {
      const r = await fetch('/sources/extract_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ url: extractUrl }),
      });
      if (r.ok) {
        const m = await r.json();
        applyMetadata(m, extractUrl);
        setExtractUrl('');
      } else {
        const data = await r.json();
        setError(data.error || 'Failed to extract metadata');
      }
    } catch (e) {
      console.error(e);
      setError('An error occurred while extracting metadata');
    } finally {
      setExtracting(false);
    }
  };

  // ====================================================================
  // Collections
  // ====================================================================
  const fetchCollections = async () => {
    try {
      const r = await fetch('/collections.json');
      setCollections(await r.json());
    } catch (e) { console.error(e); }
  };
  const fetchItemCollections = async (sourceId) => {
    try {
      const r = await fetch(`/sources/${sourceId}.json`);
      const data = await r.json();
      setItemCollections(data.collections || []);
    } catch (e) { console.error(e); }
  };

  // ====================================================================
  // Markers
  // ====================================================================
  const allMarkerOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    [...SUGGESTED_MARKERS, ...formData.markers].forEach(m => {
      if (!seen.has(m)) { seen.add(m); out.push(m); }
    });
    return out;
  }, [formData.markers]);

  const toggleMarker = (m) => {
    setFormData(prev => ({
      ...prev,
      markers: prev.markers.includes(m) ? prev.markers.filter(x => x !== m) : [...prev.markers, m],
    }));
  };
  const addCustomMarker = () => {
    const v = customMarker.trim();
    if (!v) return;
    if (!formData.markers.includes(v)) {
      setFormData(prev => ({ ...prev, markers: [...prev.markers, v] }));
    }
    setCustomMarker('');
  };

  // ====================================================================
  // Research-type auto-tagging
  // ====================================================================
  const handleAutoTagMethods = async () => {
    if (!formData.title) {
      setMethodsTagError('Add a title first.');
      return;
    }
    setMethodsTagError('');
    setTaggingMethods(true);
    try {
      const r = await fetch('/sources/tag_research_types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          title: formData.title,
          abstract: formData.abstract,
          summary: formData.summary,
          kind: formData.kind,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMethodsTagError(data.error || 'Auto-tag failed.');
        return;
      }
      const suggested = Array.isArray(data.types) ? data.types : [];
      if (suggested.length === 0) {
        setMethodsTagError('Nothing strong to suggest from this abstract.');
        return;
      }
      // Merge with existing — preserves manual picks.
      setFormData(prev => ({
        ...prev,
        methodologies: Array.from(new Set([...(prev.methodologies || []), ...suggested])),
      }));
    } catch (e) {
      console.error(e);
      setMethodsTagError('Auto-tag failed.  Try again in a moment.');
    } finally {
      setTaggingMethods(false);
    }
  };

  // After Quick Extract finishes and setFormData has flushed, auto-fire the
  // research-type tagger.  Skips when methodologies are already populated.
  useEffect(() => {
    if (!pendingAutoTagRef.current) return;
    if (!formData.title) return;
    pendingAutoTagRef.current = false;
    if ((formData.methodologies || []).length > 0) return;
    handleAutoTagMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.title, formData.abstract]);

  // ====================================================================
  // Type-driven section toggles
  // ====================================================================
  const showArticleFields  = formData.kind === 'article' || formData.kind === 'conference';
  const showBookFields     = formData.kind === 'book';
  const showChapterFields  = formData.kind === 'book_chapter';
  const showWebsiteFields  = formData.kind === 'website' || formData.kind === 'video' || formData.kind === 'podcast';
  const showReportFields   = formData.kind === 'report' || formData.kind === 'thesis' || formData.kind === 'dissertation';

  // ====================================================================
  // Render
  // ====================================================================
  return (
    <>
      <SlidePanel isOpen={isOpen} onClose={handleClose}>
        <SfmStyles />
        <form onSubmit={handleSubmit} className="sfm">
          {/* Header */}
          <header className="sfm-head">
            <div className="sfm-head-title">
              <h2>{item ? (formData.title || item.title || 'Untitled Source') : 'New Source'}</h2>
            </div>
            <div className="sfm-head-actions">
              {item && (
                <>
                  <SaveStatus status={saveStatus} error={autosaveError} />
                  <button
                    type="button"
                    className={`sfm-save-now${saveStatus === 'error' ? ' is-error' : ''}`}
                    onClick={handleManualSave}
                    disabled={saveStatus === 'saving'}
                    title={saveStatus === 'error' ? 'Retry the save' : 'Save changes now'}
                  >
                    {saveStatus === 'saving'
                      ? 'Saving…'
                      : saveStatus === 'error'
                        ? 'Retry Save'
                        : 'Save Now'}
                  </button>
                </>
              )}
              <button type="button" className="sfm-close" onClick={handleClose} aria-label="Close">×</button>
            </div>
          </header>

          {error && (
            <div className="sfm-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Sidebar + Content */}
          <div className="sfm-body">
            <nav className="sfm-nav">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`sfm-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="sfm-content">
              {activeTab === 'basics' && (
                <BasicsTab
                  formData={formData}
                  setFormData={setFormData}
                  item={item}
                  pdfFile={pdfFile}
                  setPdfFile={setPdfFile}
                  extractUrl={extractUrl}
                  setExtractUrl={setExtractUrl}
                  extracting={extracting}
                  onExtract={handleExtractMetadata}
                  fleshFragment={fleshFragment}
                  setFleshFragment={setFleshFragment}
                  fleshing={fleshing}
                  fleshError={fleshError}
                  fleshResult={fleshResult}
                  onFleshOut={handleFleshOut}
                  onApplyAlternative={applyFleshAlternative}
                  onApplyDiff={applyFleshDiff}
                  onClearFleshResult={() => { setFleshResult(null); setFleshError(''); }}
                  titleDuplicate={titleDuplicate}
                  urlDuplicate={urlDuplicate}
                  parseAuthors={parseAuthors}
                  onCheckAuthors={handleCheckAuthors}
                  authorsChecked={!!processedAuthorsData}
                  setProcessedAuthorsData={setProcessedAuthorsData}
                  showMarkersEditor={showMarkersEditor}
                  setShowMarkersEditor={setShowMarkersEditor}
                  allMarkerOptions={allMarkerOptions}
                  toggleMarker={toggleMarker}
                  customMarker={customMarker}
                  setCustomMarker={setCustomMarker}
                  addCustomMarker={addCustomMarker}
                  showArticleFields={showArticleFields}
                  showBookFields={showBookFields}
                  showChapterFields={showChapterFields}
                  showWebsiteFields={showWebsiteFields}
                  showReportFields={showReportFields}
                />
              )}

              {activeTab === 'content' && (
                <ContentTab
                  formData={formData}
                  setFormData={setFormData}
                  onAutoTagMethods={handleAutoTagMethods}
                  taggingMethods={taggingMethods}
                  methodsTagError={methodsTagError}
                />
              )}

              {activeTab === 'metadata' && (
                <ConnectionsTab
                  formData={formData}
                  setFormData={setFormData}
                  item={item}
                  itemCollections={itemCollections}
                  setItemCollections={setItemCollections}
                  newlyCreatedConcepts={newlyCreatedConcepts}
                  loadingConceptSuggestions={loadingConceptSuggestions}
                  onCheckConcepts={handleCheckConcepts}
                  conceptsChecked={!!processedConceptsData}
                  onSuggestAuthors={handleSuggestAuthors}
                  suggestingAuthors={suggestingAuthors}
                  authorSuggestNote={authorSuggestNote}
                />
              )}
            </div>
          </div>

          {/* Footer — only on new */}
          {!item && (
            <footer className="sfm-foot">
              <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="sp-action sp-action-primary" disabled={submitting}>
                {submitting ? 'Saving.' : 'Create Source'}
              </button>
            </footer>
          )}
        </form>
      </SlidePanel>

      <AuthorDisambiguationModal
        isOpen={showAuthorModal}
        onClose={() => setShowAuthorModal(false)}
        authors={parsedAuthors}
        authorsData={authorsData}
        doi={formData.doi}
        onConfirm={handleAuthorConfirm}
      />

      <ConceptDisambiguationModal
        isOpen={showConceptModal}
        onClose={() => setShowConceptModal(false)}
        suggestions={conceptSuggestions}
        onConfirm={handleConceptConfirm}
      />
    </>
  );
}

// =====================================================================
// Flesh Out Citation — free-form fragment → resolved candidate
// =====================================================================
function FleshOutCitation({
  fragment, setFragment, fleshing, error, result, onSubmit, onApplyAlternative, onClear,
  isEdit, formData, onApplyDiff,
}) {
  const confidence = result?.confidence;
  const best = result?.best;
  const alternatives = result?.alternatives || [];
  const hasResult = !!best;
  const showAlternatives = hasResult && (confidence === 'low' || alternatives.length > 0);

  // Edit mode: when we have a best candidate (high/medium confidence,
  // or user picked from low-confidence alts), show the per-field diff
  // picker instead of the auto-applied success card.
  const showDiff = isEdit && hasResult && confidence !== 'low';

  return (
    <div className="sfm-flesh">
      <h4 className="sfm-flesh-title">
        <i className="fas fa-wand-magic-sparkles" /> Flesh Out Citation
      </h4>
      <p className="sfm-flesh-text">
        {isEdit
          ? "Paste a fragment to refresh this source's metadata.  You'll review every change before it's applied."
          : "Paste an in-text citation, partial title, or any reference fragment.  We'll search Crossref, parse it with Haiku, and fill in the rest."}
      </p>
      <div className="sfm-flesh-row">
        <textarea
          value={fragment}
          onChange={(e) => setFragment(e.target.value)}
          placeholder='e.g. "Vaswani et al., 2017, attention is all you need" or "10.48550/arXiv.1706.03762"'
          className="form-input sfm-flesh-input"
          rows={2}
          disabled={fleshing}
        />
        <button
          type="button"
          className="sp-action sp-action-primary sfm-flesh-btn"
          onClick={onSubmit}
          disabled={fleshing || fragment.trim().length < 4}
        >
          {fleshing ? (
            <><i className="fas fa-spinner fa-spin" /> Searching…</>
          ) : (
            <>Flesh Out →</>
          )}
        </button>
      </div>

      {error && <div className="sfm-flesh-error">{error}</div>}

      {hasResult && (
        <div className={`sfm-flesh-result is-${confidence}`}>
          <header className="sfm-flesh-result-head">
            <span className={`sfm-flesh-conf is-${confidence}`}>
              {confidence === 'high'   && !showDiff && <><i className="fas fa-check-circle" /> Match found</>}
              {confidence === 'high'   &&  showDiff && <><i className="fas fa-pen-to-square" /> Review changes</>}
              {confidence === 'medium' && !showDiff && <><i className="fas fa-circle-question" /> Best guess</>}
              {confidence === 'medium' &&  showDiff && <><i className="fas fa-pen-to-square" /> Review changes</>}
              {confidence === 'low'    && <><i className="fas fa-triangle-exclamation" /> Possible matches — pick one</>}
            </span>
            <button type="button" className="sfm-flesh-dismiss" onClick={onClear} aria-label="Dismiss">
              <i className="fas fa-times" />
            </button>
          </header>

          {showDiff ? (
            <FleshOutDiff
              current={formData}
              resolved={best}
              onApply={(selectedKeys) => onApplyDiff(best, selectedKeys)}
            />
          ) : (confidence !== 'low' && (
            <CitationCard candidate={best} applied />
          ))}

          {showAlternatives && !showDiff && (
            <div className="sfm-flesh-alts">
              {confidence !== 'low' && alternatives.length > 0 && (
                <p className="sfm-flesh-alts-label">
                  Not the right one?  Pick from {alternatives.length} alternative{alternatives.length === 1 ? '' : 's'}:
                </p>
              )}
              {confidence === 'low' && (
                <p className="sfm-flesh-alts-label">
                  Click a candidate to apply it to the form.
                </p>
              )}
              {(confidence === 'low' ? [best, ...alternatives] : alternatives).map((alt) => (
                <button
                  key={alt.doi || alt.title}
                  type="button"
                  className="sfm-flesh-alt"
                  onClick={() => onApplyAlternative(alt)}
                  disabled={fleshing}
                >
                  <CitationCard candidate={alt} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// FleshOutDiff — per-field diff picker for edit mode.  Shows fields
// where the resolved candidate differs from current form data, with
// checkboxes to toggle which to accept.  Default: all checked.
// =====================================================================
const FLESH_DIFF_FIELDS = [
  { key: 'title',              label: 'Title' },
  { key: 'authors',            label: 'Authors' },
  { key: 'year',               label: 'Year' },
  { key: 'kind',               label: 'Type' },
  { key: 'journal_name',       label: 'Journal' },
  { key: 'volume',             label: 'Volume' },
  { key: 'issue',              label: 'Issue' },
  { key: 'pages',              label: 'Pages' },
  { key: 'doi',                label: 'DOI' },
  { key: 'url',                label: 'URL' },
  { key: 'publisher_or_venue', label: 'Publisher' },
  { key: 'abstract',           label: 'Abstract', truncate: 160 },
  { key: 'keywords',           label: 'Keywords', isArray: true },
];

function FleshOutDiff({ current, resolved, onApply }) {
  // Compute changes: for each diffable field, classify as "adding"
  // (current empty, resolved has value) or "changing" (both differ).
  const changes = useMemo(() => {
    const out = [];
    FLESH_DIFF_FIELDS.forEach((f) => {
      const cur = current?.[f.key];
      const res = resolved?.[f.key];
      const curHas = f.isArray ? Array.isArray(cur) && cur.length > 0 : !!String(cur ?? '').trim();
      const resHas = f.isArray ? Array.isArray(res) && res.length > 0 : !!String(res ?? '').trim();
      if (!resHas) return;
      const curStr = f.isArray ? Array(cur || []).join(', ') : String(cur ?? '').trim();
      const resStr = f.isArray ? Array(res || []).join(', ') : String(res ?? '').trim();
      if (curHas && curStr === resStr) return; // unchanged
      out.push({
        ...f,
        kind: curHas ? 'changing' : 'adding',
        currentValue: curStr,
        resolvedValue: resStr,
      });
    });
    return out;
  }, [current, resolved]);

  // Selection state — default all checked.
  const [selected, setSelected] = useState(() =>
    Object.fromEntries(changes.map((c) => [c.key, true]))
  );

  // If the resolved candidate changes (user picked a different alt),
  // reset selections to default-checked for the new diff set.
  useEffect(() => {
    setSelected(Object.fromEntries(changes.map((c) => [c.key, true])));
  }, [resolved?.doi]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  const setAll = (val) =>
    setSelected(Object.fromEntries(changes.map((c) => [c.key, val])));

  const checkedKeys = changes.filter((c) => selected[c.key]).map((c) => c.key);

  if (changes.length === 0) {
    return (
      <div className="sfm-fd-empty">
        Already up to date — no changes from this match.
      </div>
    );
  }

  return (
    <div className="sfm-fd">
      <CitationCard candidate={resolved} />
      <div className="sfm-fd-controls">
        <span className="sfm-fd-summary">
          {changes.length} field{changes.length === 1 ? '' : 's'} will update
        </span>
        <button type="button" className="sfm-fd-link" onClick={() => setAll(true)}>All</button>
        <span className="sfm-fd-sep">·</span>
        <button type="button" className="sfm-fd-link" onClick={() => setAll(false)}>None</button>
      </div>

      <ul className="sfm-fd-list">
        {changes.map((c) => (
          <li key={c.key} className={`sfm-fd-row is-${c.kind}`}>
            <label className="sfm-fd-label">
              <input
                type="checkbox"
                checked={!!selected[c.key]}
                onChange={() => toggle(c.key)}
              />
              <div className="sfm-fd-content">
                <div className="sfm-fd-head">
                  <span className="sfm-fd-field">{c.label}</span>
                  <span className={`sfm-fd-tag is-${c.kind}`}>
                    {c.kind === 'adding' ? 'add' : 'change'}
                  </span>
                </div>
                {c.kind === 'changing' && (
                  <div className="sfm-fd-current" title="Current value">
                    <span className="sfm-fd-arrow">−</span>{' '}
                    <s>{truncate(c.currentValue, c.truncate)}</s>
                  </div>
                )}
                <div className="sfm-fd-resolved">
                  <span className="sfm-fd-arrow">+</span>{' '}
                  {truncate(c.resolvedValue, c.truncate)}
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>

      <div className="sfm-fd-footer">
        <button
          type="button"
          className="sp-action sp-action-primary sfm-fd-apply"
          onClick={() => onApply(checkedKeys)}
          disabled={checkedKeys.length === 0}
        >
          Apply {checkedKeys.length} change{checkedKeys.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}

function truncate(s, n) {
  if (!s) return '';
  if (!n || s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function CitationCard({ candidate, applied }) {
  if (!candidate) return null;
  return (
    <div className={`sfm-cite-card${applied ? ' is-applied' : ''}`}>
      <div className="sfm-cite-title">{candidate.title}</div>
      <div className="sfm-cite-meta">
        {candidate.authors && <span>{candidate.authors}</span>}
        {candidate.year && <span>· {candidate.year}</span>}
        {candidate.journal_name && <span>· <em>{candidate.journal_name}</em></span>}
      </div>
      {candidate.doi && (
        <div className="sfm-cite-doi">
          <span className="sfm-cite-doi-label">DOI</span> {candidate.doi}
        </div>
      )}
      {applied && <div className="sfm-cite-applied">✓ Fields filled below — review and save.</div>}
    </div>
  );
}

// =====================================================================
// Tab — Basics
// =====================================================================
function BasicsTab({
  formData, setFormData, item,
  pdfFile, setPdfFile,
  extractUrl, setExtractUrl, extracting, onExtract,
  fleshFragment, setFleshFragment, fleshing, fleshError, fleshResult,
  onFleshOut, onApplyAlternative, onApplyDiff, onClearFleshResult,
  titleDuplicate, urlDuplicate,
  parseAuthors, onCheckAuthors, authorsChecked, setProcessedAuthorsData,
  showMarkersEditor, setShowMarkersEditor,
  allMarkerOptions, toggleMarker, customMarker, setCustomMarker, addCustomMarker,
  showArticleFields, showBookFields, showChapterFields, showWebsiteFields, showReportFields,
}) {
  const hasPublicationFields =
    showArticleFields || showBookFields || showChapterFields || showWebsiteFields || showReportFields;
  return (
    <section className="sfm-section">
      <h3 className="sfm-h3">Basics</h3>

      <FleshOutCitation
        fragment={fleshFragment}
        setFragment={setFleshFragment}
        fleshing={fleshing}
        error={fleshError}
        result={fleshResult}
        onSubmit={onFleshOut}
        onApplyAlternative={onApplyAlternative}
        onClear={onClearFleshResult}
        isEdit={!!item}
        formData={formData}
        onApplyDiff={onApplyDiff}
      />

      {!item && (
        <div className="sfm-extract">
          <h4 className="sfm-extract-title">Quick Add from URL or DOI</h4>
          <p className="sfm-extract-text">
            Best results with a DOI ({' '}
            <code>10.1234/example</code>{' '}
            ).  Also works with PubMed, arXiv, and open-access journal pages.
          </p>
          <div className="sfm-extract-row">
            <input
              type="text"
              value={extractUrl}
              onChange={(e) => setExtractUrl(e.target.value)}
              placeholder="DOI, doi.org link, or article URL."
              className="form-input"
              disabled={extracting}
            />
            <button
              type="button"
              className="sp-action sp-action-primary"
              onClick={onExtract}
              disabled={extracting || !extractUrl}
            >
              {extracting ? 'Extracting.' : 'Extract'}
            </button>
          </div>
        </div>
      )}

      <Field label="Title" required>
        <textarea
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          rows={2}
          className={`form-input ${titleDuplicate ? 'is-warning' : ''}`}
          required
        />
        {titleDuplicate && (
          <DuplicateWarning>
            Possible duplicate:{' '}
            <a href={`/sources/${titleDuplicate.id}`} target="_blank" rel="noreferrer">{titleDuplicate.title}</a>
          </DuplicateWarning>
        )}
      </Field>

      <div className="sfm-grid-2">
        <Field label="Source Type" required>
          <select
            value={formData.kind}
            onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
            className="form-input"
          >
            {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Year">
          <input
            type="number"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            className="form-input"
            placeholder="2024"
          />
        </Field>
      </div>

      <Field label="URL">
        <input
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          className={`form-input ${urlDuplicate ? 'is-warning' : ''}`}
          placeholder="https://."
        />
        {urlDuplicate && (
          <DuplicateWarning>
            URL already exists:{' '}
            <a href={`/sources/${urlDuplicate.id}`} target="_blank" rel="noreferrer">{urlDuplicate.title}</a>
          </DuplicateWarning>
        )}
      </Field>

      {/* Markers */}
      <Field label="Markers" hint="Quick flags to organize: To Read, Needs PDF, Key Source, etc.">
        <div className="sfm-marker-row">
          {formData.markers.map(m => (
            <span key={m} className="sfm-marker-chip">
              {m}
              <button type="button" className="sfm-marker-x" onClick={() => toggleMarker(m)} aria-label={`Remove ${m}`}>×</button>
            </span>
          ))}
          <button
            type="button"
            className="sfm-marker-toggle"
            onClick={() => setShowMarkersEditor(v => !v)}
          >
            {showMarkersEditor ? 'Done' : '+ Marker'}
          </button>
        </div>
        {showMarkersEditor && (
          <div className="sfm-marker-editor">
            <div className="sfm-marker-options">
              {allMarkerOptions.map(m => (
                <label key={m} className="sfm-marker-option">
                  <input
                    type="checkbox"
                    className="sp-checkbox"
                    checked={formData.markers.includes(m)}
                    onChange={() => toggleMarker(m)}
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>
            <div className="sfm-marker-custom">
              <input
                type="text"
                className="form-input"
                placeholder="Add Custom Marker"
                value={customMarker}
                onChange={(e) => setCustomMarker(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomMarker(); } }}
              />
              <button type="button" className="sp-action sp-action-secondary" onClick={addCustomMarker}>Add</button>
            </div>
          </div>
        )}
      </Field>

      {/* Publication (kind-conditional) */}
      {hasPublicationFields && (
        <div className="sfm-subsection">
          <h4 className="sfm-h4">Publication</h4>

          {showArticleFields && (
            <>
              <Field label="Journal Name">
                <input type="text" value={formData.journal_name}
                       onChange={(e) => setFormData({ ...formData, journal_name: e.target.value })}
                       className="form-input" placeholder="e.g., Journal of Clinical Psychology" />
              </Field>
              <div className="sfm-grid-3">
                <Field label="Volume">
                  <input type="text" value={formData.volume}
                         onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                         className="form-input" placeholder="42" />
                </Field>
                <Field label="Issue">
                  <input type="text" value={formData.issue}
                         onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                         className="form-input" placeholder="3" />
                </Field>
                <Field label="Pages">
                  <input type="text" value={formData.pages}
                         onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                         className="form-input" placeholder="123–145" />
                </Field>
              </div>
              <div className="sfm-grid-2">
                <Field label="DOI">
                  <input type="text" value={formData.doi}
                         onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                         className="form-input" placeholder="10.1000/example" />
                </Field>
                <Field label="Publication Date">
                  <input type="date" value={formData.publication_date}
                         onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
                         className="form-input" />
                </Field>
              </div>
              {formData.keywords.length > 0 && (
                <Field label="Author Keywords" hint="Read-only metadata pulled from the source.">
                  <div className="sfm-keyword-bag">
                    {formData.keywords.map((k, i) => <span key={i} className="sfm-keyword">{k}</span>)}
                  </div>
                </Field>
              )}
            </>
          )}

          {showBookFields && (
            <>
              <div className="sfm-grid-2">
                <Field label="Publisher">
                  <input type="text" value={formData.publisher_or_venue}
                         onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                         className="form-input" placeholder="Wiley" />
                </Field>
                <Field label="Edition">
                  <input type="text" value={formData.edition}
                         onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                         className="form-input" placeholder="3rd ed." />
                </Field>
              </div>
              <Field label="ISBN">
                <input type="text" value={formData.isbn}
                       onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                       className="form-input" placeholder="978-0-123456-78-9" />
              </Field>
            </>
          )}

          {showChapterFields && (
            <>
              <Field label="Book Title">
                <input type="text" value={formData.book_title}
                       onChange={(e) => setFormData({ ...formData, book_title: e.target.value })}
                       className="form-input" placeholder="Handbook of Clinical Psychology" />
              </Field>
              <div className="sfm-grid-3">
                <Field label="Chapter Number">
                  <input type="number" value={formData.chapter_number}
                         onChange={(e) => setFormData({ ...formData, chapter_number: e.target.value })}
                         className="form-input" placeholder="5" />
                </Field>
                <Field label="Pages">
                  <input type="text" value={formData.pages}
                         onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                         className="form-input" placeholder="123–145" />
                </Field>
                <Field label="Edition">
                  <input type="text" value={formData.edition}
                         onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                         className="form-input" placeholder="2nd ed." />
                </Field>
              </div>
              <div className="sfm-grid-2">
                <Field label="Publisher">
                  <input type="text" value={formData.publisher_or_venue}
                         onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                         className="form-input" />
                </Field>
                <Field label="DOI">
                  <input type="text" value={formData.doi}
                         onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                         className="form-input" placeholder="10.1000/example" />
                </Field>
              </div>
            </>
          )}

          {showWebsiteFields && (
            <div className="sfm-grid-2">
              <Field label="Website Name">
                <input type="text" value={formData.website_name}
                       onChange={(e) => setFormData({ ...formData, website_name: e.target.value })}
                       className="form-input" placeholder="YouTube, Vimeo, etc." />
              </Field>
              <Field label="Access Date">
                <input type="date" value={formData.access_date}
                       onChange={(e) => setFormData({ ...formData, access_date: e.target.value })}
                       className="form-input" />
              </Field>
            </div>
          )}

          {showReportFields && (
            <div className="sfm-grid-2">
              <Field label={formData.kind === 'thesis' || formData.kind === 'dissertation' ? 'University' : 'Publisher / Organization'}>
                <input type="text" value={formData.publisher_or_venue}
                       onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                       className="form-input" />
              </Field>
              <Field label="DOI">
                <input type="text" value={formData.doi}
                       onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                       className="form-input" placeholder="10.1000/example" />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* Authors — citation string only.  Linked people live in the Connections tab. */}
      <Field
        label="Authors"
        hint="Citation string for display.  Use Check Authors to link them to People records on the Connections tab."
      >
        <div className="sfm-authors-head">
          <input
            type="text"
            value={formData.authors}
            onChange={(e) => {
              setFormData({ ...formData, authors: e.target.value });
              setProcessedAuthorsData(null);
            }}
            className="form-input"
            placeholder="Last, F., Last, F."
          />
          {formData.authors && parseAuthors(formData.authors).length > 0 && (
            <button
              type="button"
              className={`sp-action ${authorsChecked ? 'sp-action-primary' : 'sp-action-secondary'}`}
              onClick={onCheckAuthors}
            >
              {authorsChecked ? 'Authors Checked' : 'Check Authors'}
            </button>
          )}
        </div>
      </Field>

      {/* PDF */}
      <Field label="PDF File" hint="Drop or pick a PDF; we will autosave on existing sources.">
        {item?.pdf_url && !pdfFile && (
          <div className="sfm-pdf-current">
            Current file:{' '}
            <a href={item.pdf_url} target="_blank" rel="noreferrer">{item.pdf_filename}</a>
          </div>
        )}
        {pdfFile && (
          <div className="sfm-pdf-staged">
            <span>Selected: <strong>{pdfFile.name}</strong></span>
            <button type="button" className="sfm-link" onClick={() => setPdfFile(null)}>Remove</button>
          </div>
        )}
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setPdfFile(e.target.files[0])}
          className="form-input sfm-file"
        />
      </Field>
    </section>
  );
}

// =====================================================================
// Tab — Content
// =====================================================================
function ContentTab({ formData, setFormData, onAutoTagMethods, taggingMethods, methodsTagError }) {
  return (
    <section className="sfm-section">
      <h3 className="sfm-h3">Content</h3>

      <Field label="Abstract" hint="The full abstract from the source.">
        <RichTextEditor
          value={formData.abstract}
          onChange={(html) => setFormData({ ...formData, abstract: html })}
          placeholder="Full abstract from the source."
          rows={6}
          themeColor="var(--source)"
        />
      </Field>

      <Field label="Summary" hint="Three to five lines of key findings, in your own words.">
        <RichTextEditor
          value={formData.summary}
          onChange={(html) => setFormData({ ...formData, summary: html })}
          placeholder="Key findings and takeaways."
          rows={4}
          themeColor="var(--source)"
        />
      </Field>

      <Field
        label="Research Type(s)"
        hint="One or more methodological tags.  Use the magic button to auto-tag from the abstract."
        trailing={
          <button
            type="button"
            className="sfm-magic-btn"
            onClick={onAutoTagMethods}
            disabled={taggingMethods || !formData.title}
            title={!formData.title ? 'Add a title first' : 'Auto-tag from the abstract'}
          >
            <MagicSparkles size={13} spinning={taggingMethods} />
            {taggingMethods ? 'Tagging.' : 'Auto-tag'}
          </button>
        }
      >
        {methodsTagError && <div className="sfm-magic-note">{methodsTagError}</div>}
        <div className="sfm-method-grid">
          {RESEARCH_TYPES.map(m => (
            <label key={m} className="sfm-method-row">
              <input
                type="checkbox"
                className="sp-checkbox"
                checked={formData.methodologies.includes(m)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({ ...formData, methodologies: [...formData.methodologies, m] });
                  } else {
                    setFormData({ ...formData, methodologies: formData.methodologies.filter(x => x !== m) });
                  }
                }}
              />
              <span>{m}</span>
            </label>
          ))}
        </div>
      </Field>
    </section>
  );
}

// =====================================================================
// Tab — Connections
// =====================================================================
function ConnectionsTab({
  formData, setFormData, item, itemCollections, setItemCollections,
  newlyCreatedConcepts, loadingConceptSuggestions, onCheckConcepts, conceptsChecked,
  onSuggestAuthors, suggestingAuthors, authorSuggestNote,
}) {
  return (
    <section className="sfm-section">
      <h3 className="sfm-h3">Connections</h3>

      <div className="sfm-grid-2">
        <Field
          label="Concepts"
          trailing={formData.title && (
            <button
              type="button"
              className="sfm-magic-btn"
              onClick={onCheckConcepts}
              disabled={loadingConceptSuggestions}
            >
              <MagicSparkles size={13} spinning={loadingConceptSuggestions} />
              {loadingConceptSuggestions ? 'Analyzing.' : conceptsChecked ? 'Concepts Checked' : 'Suggest with Haiku'}
            </button>
          )}
        >
          <div className="sfm-selector-frame">
            <ConceptSelector
              selectedConceptIds={formData.concept_ids}
              onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
              themeColor="var(--concept)"
              newConcepts={newlyCreatedConcepts}
            />
          </div>
        </Field>

        <Field
          label="People"
          trailing={
            <button
              type="button"
              className="sfm-magic-btn"
              onClick={onSuggestAuthors}
              disabled={suggestingAuthors || !formData.title}
              title={!formData.title ? 'Add a title first' : 'Propose authors from DOI or abstract'}
            >
              <MagicSparkles size={13} spinning={suggestingAuthors} />
              {suggestingAuthors ? 'Looking.' : 'Suggest Authors'}
            </button>
          }
        >
          {authorSuggestNote && <div className="sfm-magic-note">{authorSuggestNote}</div>}
          <div className="sfm-selector-frame">
            <PeopleSelector
              selectedPersonIds={formData.person_ids}
              onChange={(person_ids) => setFormData({ ...formData, person_ids })}
              themeColor="var(--person)"
            />
          </div>
        </Field>
      </div>

      <div className="sfm-grid-2">
        <Field label="Tags">
          <div className="sfm-selector-frame">
            <TagSelector
              selectedTags={formData.tags}
              onChange={(tags) => setFormData({ ...formData, tags })}
              themeColor="var(--ink-3)"
            />
          </div>
        </Field>

        <Field label="Collections">
          <div className="sfm-selector-frame">
            <CollectionSelector
              itemType="Source"
              itemId={item?.id}
              selectedCollectionIds={item ? itemCollections.map(c => c.id) : formData.collection_ids}
              onChange={(ids, collections) => {
                if (item) {
                  setItemCollections(collections);
                } else {
                  setFormData({ ...formData, collection_ids: ids });
                }
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
    <div className="sfm-field">
      <div className="sfm-field-head">
        <label className="form-label">
          {label}{required && <span className="sfm-req"> *</span>}
        </label>
        {trailing}
      </div>
      {hint && <p className="form-hint">{hint}</p>}
      {children}
    </div>
  );
}

function DuplicateWarning({ children }) {
  return <div className="sfm-warning">{children}</div>;
}

// =====================================================================
// Save status pill
// =====================================================================
function SaveStatus({ status, error }) {
  if (status === 'pending')  return <span className="sfm-save is-pending">Save Pending.</span>;
  if (status === 'saving')   return <span className="sfm-save is-saving">Saving.</span>;
  if (status === 'saved')    return <span className="sfm-save is-saved">Saved</span>;
  if (status === 'error') {
    return (
      <span className="sfm-save is-error" title={error || 'Save failed'}>
        Save Error{error ? `: ${error}` : ''}
      </span>
    );
  }
  return <span className="sfm-save is-idle">Auto-Save On</span>;
}

// =====================================================================
// Styles
// =====================================================================
function SfmStyles() {
  return (
    <style>{`
      .sfm {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--paper);
        font-family: var(--font-body);
        color: var(--ink);
      }

      .sfm-head {
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
      .sfm-head-title { min-width: 0; flex: 1; }
      .sfm-head-title h2 {
        margin: 0;
        font-family: var(--font-display);
        font-size: 20px;
        font-weight: 600;
        color: var(--source);
        letter-spacing: -0.005em;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sfm-head-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      .sfm-close {
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
      .sfm-close:hover {
        background: var(--paper-soft);
        color: var(--ink);
        border-color: var(--ink-line);
      }

      /* Source-blue accents inside the modal */
      .sfm .form-label,
      .sfm .sfm-field > .sfm-field-head > .form-label { color: var(--source) !important; }
      .sfm .sp-action-primary {
        background: var(--source);
        border-color: var(--source);
      }
      .sfm .sp-action-primary:hover:not(:disabled) {
        background: var(--source-2);
        border-color: var(--source-2);
      }
      .sfm .sp-checkbox:checked,
      .sfm .sp-checkbox:indeterminate {
        background: var(--source);
        border-color: var(--source);
      }

      .sfm-save {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: var(--r-sm);
        background: var(--paper-soft);
      }
      .sfm-save.is-pending { color: var(--ink-3); }
      .sfm-save.is-saving  { color: var(--source-2); }
      .sfm-save.is-saved   { color: var(--source); background: var(--source-tint); }
      .sfm-save.is-error   {
        color: var(--error);
        background: color-mix(in srgb, var(--error) 8%, transparent);
        max-width: 360px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: help;
      }
      .sfm-save.is-idle    { color: var(--ink-3); }

      /* Manual save button — quiet by default, prominent on error */
      .sfm-save-now {
        height: 30px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        color: var(--ink-2);
        cursor: pointer;
        white-space: nowrap;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .sfm-save-now:hover:not(:disabled) {
        background: var(--source-tint);
        border-color: var(--source);
        color: var(--source-2);
      }
      .sfm-save-now:disabled { opacity: 0.55; cursor: wait; }
      .sfm-save-now.is-error {
        background: var(--error);
        border-color: var(--error);
        color: var(--paper);
      }
      .sfm-save-now.is-error:hover:not(:disabled) {
        background: color-mix(in srgb, var(--error) 88%, black);
        border-color: color-mix(in srgb, var(--error) 88%, black);
      }

      .sfm-error {
        margin: 12px 24px 0;
        padding: 10px 14px;
        border-radius: var(--r-md);
        background: rgba(122, 46, 46, 0.06);
        border: 1px solid var(--error);
        color: var(--error);
        font-size: 13px;
      }

      .sfm-body {
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }

      /* Sidebar nav */
      .sfm-nav {
        width: 200px;
        background: var(--paper-soft);
        padding: 14px 12px;
        flex-shrink: 0;
        border-right: 1px solid var(--ink-line);
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sfm-tab {
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
      .sfm-tab:hover { background: var(--hover); color: var(--ink); }
      .sfm-tab.is-active {
        background: var(--source-tint);
        color: var(--source-2);
        font-weight: 600;
      }

      /* Content */
      .sfm-content {
        flex: 1;
        overflow-y: auto;
        background: var(--paper);
        padding: 24px 32px;
        min-width: 0;
      }
      .sfm-section { display: flex; flex-direction: column; gap: 18px; }
      .sfm-h3 {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--source);
        margin: 0 0 6px;
        letter-spacing: -0.01em;
      }
      .sfm-subsection {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding-top: 6px;
        border-top: 1px solid var(--ink-line-soft);
      }
      .sfm-h4 {
        font-family: var(--font-display);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--ink-3);
        margin: 0;
      }

      /* Universal "do this for me with Haiku" button.  The sparkles icon
         is the across-product symbol for AI-assisted actions. */
      .sfm-magic-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--source-2);
        background: var(--source-tint);
        border: 1px solid color-mix(in srgb, var(--source) 30%, transparent);
        border-radius: var(--r-sm);
        padding: 4px 10px;
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
        white-space: nowrap;
      }
      .sfm-magic-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--source-tint) 60%, var(--source) 40%);
        color: var(--paper);
        border-color: var(--source);
      }
      .sfm-magic-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      .sfm-magic-note {
        font-size: 12px;
        color: var(--ink-3);
        font-style: italic;
        margin-bottom: 6px;
      }

      .sfm-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .sfm-grid-3 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px;
      }

      /* Field — stretches inside grid rows so paired boxes (Tags +
         Collections, Concepts + People) line up to equal height. */
      .sfm-field {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .sfm-field-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
      }
      .sfm-field > .sfm-selector-frame { flex: 1; min-height: 0; }
      .sfm-req { color: var(--source); font-weight: 700; }
      .sfm-field .form-input.is-warning {
        border-color: #d97706;
      }

      .sfm-warning {
        margin-top: 6px;
        padding: 8px 12px;
        border-radius: var(--r-sm);
        background: #fef3c7;
        border: 1px solid #d97706;
        color: #92400e;
        font-size: 12px;
      }
      .sfm-warning a { color: var(--source-2); font-weight: 600; text-decoration: underline; }

      /* Quick extract */
      .sfm-extract {
        background: var(--source-tint);
        border: 1px solid color-mix(in srgb, var(--source) 25%, transparent);
        border-radius: var(--r-md);
        padding: 14px 16px;
        margin-bottom: 4px;
      }
      .sfm-extract-title {
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 600;
        color: var(--source-2);
        margin: 0 0 4px;
      }
      .sfm-extract-text {
        font-size: 12.5px;
        color: var(--ink-2);
        margin: 0 0 10px;
        line-height: 1.5;
      }
      .sfm-extract-text code {
        font-family: var(--font-mono);
        font-size: 12px;
        background: var(--paper);
        padding: 1px 6px;
        border-radius: 3px;
        color: var(--ink);
        border: 1px solid var(--ink-line);
      }
      .sfm-extract-row { display: flex; gap: 8px; }
      .sfm-extract-row .form-input { flex: 1; }

      /* Flesh Out Citation */
      .sfm-flesh {
        background: linear-gradient(135deg, var(--source-tint), color-mix(in srgb, var(--source) 8%, var(--paper)));
        border: 1px solid color-mix(in srgb, var(--source) 35%, transparent);
        border-radius: var(--r-md);
        padding: 14px 16px;
        margin-bottom: 12px;
      }
      .sfm-flesh-title {
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 600;
        color: var(--source-2);
        margin: 0 0 4px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .sfm-flesh-title .fa-wand-magic-sparkles { color: var(--source); font-size: 13px; }
      .sfm-flesh-text {
        font-size: 12.5px;
        color: var(--ink-2);
        margin: 0 0 10px;
        line-height: 1.5;
      }
      .sfm-flesh-row {
        display: flex;
        gap: 8px;
        align-items: stretch;
      }
      .sfm-flesh-input {
        flex: 1;
        min-height: 56px;
        resize: vertical;
        font-family: var(--font-body);
        font-size: 13px;
      }
      .sfm-flesh-btn {
        align-self: flex-start;
        white-space: nowrap;
        background: var(--source);
        border-color: var(--source);
        color: var(--paper);
      }
      .sfm-flesh-btn:hover:not(:disabled) {
        background: var(--source-2);
        border-color: var(--source-2);
      }
      .sfm-flesh-btn .fa-spin { margin-right: 4px; }
      .sfm-flesh-error {
        margin-top: 10px;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--error, #a13838) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--error, #a13838) 30%, transparent);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--error, #a13838);
      }

      .sfm-flesh-result {
        margin-top: 12px;
        padding: 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .sfm-flesh-result.is-low { border-color: color-mix(in srgb, var(--source) 35%, transparent); }
      .sfm-flesh-result-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .sfm-flesh-conf {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .sfm-flesh-conf.is-high   { color: var(--success, #3a8568); }
      .sfm-flesh-conf.is-medium { color: var(--source-2); }
      .sfm-flesh-conf.is-low    { color: #b88621; }
      .sfm-flesh-dismiss {
        background: transparent;
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        padding: 4px 6px;
        font-size: 12px;
      }
      .sfm-flesh-dismiss:hover { color: var(--ink); }

      .sfm-flesh-alts {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--ink-line-soft);
      }
      .sfm-flesh-alts-label {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        margin: 0 0 8px;
      }
      .sfm-flesh-alt {
        display: block;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 0;
        margin-bottom: 6px;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .sfm-flesh-alt:last-child { margin-bottom: 0; }
      .sfm-flesh-alt:hover {
        border-color: var(--source);
        background: var(--source-tint);
      }

      /* Citation card (used inside flesh-out result) */
      .sfm-cite-card {
        padding: 10px 12px;
        font-family: var(--font-body);
      }
      .sfm-cite-card.is-applied {
        background: color-mix(in srgb, var(--success, #3a8568) 6%, transparent);
        border-radius: var(--r-sm);
      }
      .sfm-cite-title {
        font-family: var(--font-display);
        font-size: 14px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.35;
        margin-bottom: 4px;
      }
      .sfm-cite-meta {
        font-size: 12px;
        color: var(--ink-2);
        line-height: 1.45;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .sfm-cite-meta em { font-style: italic; }
      .sfm-cite-doi {
        margin-top: 4px;
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }
      .sfm-cite-doi-label {
        font-family: var(--font-body);
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--source);
        margin-right: 4px;
      }
      .sfm-cite-applied {
        margin-top: 6px;
        font-size: 11.5px;
        color: var(--success, #3a8568);
        font-weight: 600;
      }

      /* Flesh Out diff picker (edit mode) */
      .sfm-fd { display: flex; flex-direction: column; gap: 10px; }
      .sfm-fd-empty {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        font-style: italic;
        padding: 6px 0;
      }
      .sfm-fd-controls {
        display: flex;
        align-items: baseline;
        gap: 6px;
        padding: 0 2px;
        font-family: var(--font-body);
      }
      .sfm-fd-summary {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--ink-2);
        margin-right: auto;
      }
      .sfm-fd-link {
        background: transparent;
        border: none;
        padding: 0;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--source);
        font-weight: 600;
        cursor: pointer;
      }
      .sfm-fd-link:hover { color: var(--source-2); text-decoration: underline; }
      .sfm-fd-sep { color: var(--ink-4); font-size: 11.5px; }

      .sfm-fd-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sfm-fd-row {
        background: var(--paper);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-sm);
      }
      .sfm-fd-row.is-adding {
        border-color: color-mix(in srgb, var(--success, #3a8568) 30%, transparent);
        background: color-mix(in srgb, var(--success, #3a8568) 4%, var(--paper));
      }
      .sfm-fd-row.is-changing {
        border-color: color-mix(in srgb, #b88621 35%, transparent);
        background: color-mix(in srgb, #b88621 5%, var(--paper));
      }
      .sfm-fd-label {
        display: flex;
        gap: 10px;
        padding: 8px 12px;
        cursor: pointer;
        align-items: flex-start;
      }
      .sfm-fd-label input[type="checkbox"] {
        margin-top: 2px;
        flex-shrink: 0;
        accent-color: var(--source);
      }
      .sfm-fd-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sfm-fd-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .sfm-fd-field {
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-2);
      }
      .sfm-fd-tag {
        font-family: var(--font-body);
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 1px 6px;
        border-radius: 2px;
      }
      .sfm-fd-tag.is-adding {
        background: color-mix(in srgb, var(--success, #3a8568) 18%, transparent);
        color: var(--success, #3a8568);
      }
      .sfm-fd-tag.is-changing {
        background: color-mix(in srgb, #b88621 18%, transparent);
        color: #8a6418;
      }
      .sfm-fd-current,
      .sfm-fd-resolved {
        font-family: var(--font-body);
        font-size: 12.5px;
        line-height: 1.45;
        word-break: break-word;
      }
      .sfm-fd-current { color: var(--ink-3); }
      .sfm-fd-current s { text-decoration-color: var(--ink-4); }
      .sfm-fd-resolved { color: var(--ink); }
      .sfm-fd-arrow {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-4);
        margin-right: 2px;
      }

      .sfm-fd-footer {
        display: flex;
        justify-content: flex-end;
        padding-top: 4px;
      }
      .sfm-fd-apply {
        background: var(--source);
        border-color: var(--source);
        color: var(--paper);
      }
      .sfm-fd-apply:hover:not(:disabled) {
        background: var(--source-2);
        border-color: var(--source-2);
      }

      /* Markers */
      .sfm-marker-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        margin-top: 4px;
      }
      .sfm-marker-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        background: var(--source-tint);
        color: var(--source-2);
        padding: 2px 4px 2px 10px;
        border-radius: var(--r-sm);
      }
      .sfm-marker-x {
        background: none;
        border: none;
        color: inherit;
        font-size: 14px;
        line-height: 1;
        padding: 0 4px;
        cursor: pointer;
        opacity: 0.7;
      }
      .sfm-marker-x:hover { opacity: 1; }
      .sfm-marker-toggle {
        font-size: 12px;
        color: var(--ink-3);
        background: transparent;
        border: 1px dashed var(--ink-line);
        padding: 2px 10px;
        border-radius: var(--r-sm);
        cursor: pointer;
      }
      .sfm-marker-toggle:hover { color: var(--source-2); border-color: var(--source); }

      .sfm-marker-editor {
        margin-top: 10px;
        padding: 12px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .sfm-marker-options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        margin-bottom: 10px;
      }
      .sfm-marker-option {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        padding: 2px 4px;
        border-radius: var(--r-sm);
      }
      .sfm-marker-option:hover { background: var(--hover); }
      .sfm-marker-custom { display: flex; gap: 8px; }
      .sfm-marker-custom .form-input { flex: 1; }

      /* Authors */
      .sfm-authors-head {
        display: flex;
        gap: 8px;
        align-items: stretch;
        margin-bottom: 8px;
      }
      .sfm-authors-head .form-input { flex: 1; }
      .sfm-authors-head .sp-action { flex-shrink: 0; }

      .sfm-selector-frame {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }

      /* PDF */
      .sfm-pdf-current,
      .sfm-pdf-staged {
        font-size: 13px;
        color: var(--ink-2);
        margin-bottom: 8px;
      }
      .sfm-pdf-current a { color: var(--source-2); text-decoration: underline; }
      .sfm-pdf-staged {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        background: var(--source-tint);
        border-radius: var(--r-sm);
      }
      .sfm-link {
        background: none;
        border: none;
        color: var(--source-2);
        font-size: 12px;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
      }
      .sfm-file { padding: 6px 8px; }

      /* Methodologies */
      .sfm-method-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        max-height: 240px;
        overflow-y: auto;
      }
      .sfm-method-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--ink-2);
        padding: 2px 4px;
        border-radius: var(--r-sm);
        cursor: pointer;
      }
      .sfm-method-row:hover { background: var(--hover); }

      /* Keywords */
      .sfm-keyword-bag {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 12px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .sfm-keyword {
        font-size: 12px;
        color: var(--ink-2);
        background: var(--paper);
        border: 1px solid var(--ink-line);
        padding: 2px 8px;
        border-radius: var(--r-sm);
      }

      /* Footer */
      .sfm-foot {
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
        .sfm-nav {
          width: 56px;
          padding: 10px 6px;
        }
        .sfm-tab { font-size: 12px; padding: 6px 8px; justify-content: center; }
        .sfm-content { padding: 18px 16px; }
        .sfm-grid-2, .sfm-grid-3 { grid-template-columns: 1fr; gap: 12px; }
        .sfm-method-grid { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  );
}
