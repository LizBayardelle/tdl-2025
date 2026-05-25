import React, { useState, useRef, useEffect, useCallback } from 'react';
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

export default function PdfUploadModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('drop'); // 'drop' | 'extracting' | 'review' | 'saving'
  const [pdfFile, setPdfFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Form state for review step
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    year: '',
    kind: 'article',
    doi: '',
    url: '',
    abstract: '',
    summary: '',
    journal_name: '',
    volume: '',
    issue: '',
    pages: '',
    publisher_or_venue: '',
    keywords: [],
    methodologies: [],
    tags: [],
    concept_ids: [],
    person_ids: [],
    collection_ids: []
  });

  // Author disambiguation
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [authorModalMode, setAuthorModalMode] = useState('check'); // 'check' or 'save'
  const [parsedAuthors, setParsedAuthors] = useState([]);
  const [processedAuthorsData, setProcessedAuthorsData] = useState(null); // Store confirmed author data
  const [submitting, setSubmitting] = useState(false);
  // Remembers the last performSave arg so the "Try Again" button on the
  // error banner can re-run the exact same submission (incl. processed
  // authors) after a transient failure.
  const [lastSaveArgs, setLastSaveArgs] = useState(null);

  // Concept suggestion
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [conceptSuggestions, setConceptSuggestions] = useState([]);
  const [processedConceptsData, setProcessedConceptsData] = useState(null);
  const [loadingConceptSuggestions, setLoadingConceptSuggestions] = useState(false);
  const [newlyCreatedConcepts, setNewlyCreatedConcepts] = useState([]); // Track concepts created via modal

  // Duplicate detection
  const [duplicates, setDuplicates] = useState({ title: null, doi: null, url: null, pdf: null });

  // DOI search
  const [doiInput, setDoiInput] = useState('');
  const [doiSearching, setDoiSearching] = useState(false);

  // Flesh Out Citation — free-form fragment → Crossref + Haiku
  const [fleshFragment, setFleshFragment] = useState('');
  const [fleshing, setFleshing] = useState(false);
  const [fleshError, setFleshError] = useState('');
  const [fleshAlternatives, setFleshAlternatives] = useState([]);

  // Duplicate checking
  React.useEffect(() => {
    if (step !== 'review') return;

    const checkDuplicates = async () => {
      try {
        const response = await fetch('/sources.json');
        const data = await response.json();
        const sources = Array.isArray(data) ? data : (data.sources || []);

        const newDuplicates = { title: null, doi: null, url: null, pdf: null };

        // Check title (exact match, case-insensitive)
        if (formData.title && formData.title.length > 10) {
          const titleMatch = sources.find(s =>
            s.title?.toLowerCase().trim() === formData.title.toLowerCase().trim()
          );
          if (titleMatch) newDuplicates.title = titleMatch;
        }

        // Check DOI (exact match)
        if (formData.doi) {
          const doiMatch = sources.find(s =>
            s.doi?.toLowerCase().trim() === formData.doi.toLowerCase().trim()
          );
          if (doiMatch) newDuplicates.doi = doiMatch;
        }

        // Check URL (exact match)
        if (formData.url && formData.url.length > 10) {
          const urlMatch = sources.find(s =>
            s.url?.toLowerCase().trim() === formData.url.toLowerCase().trim()
          );
          if (urlMatch) newDuplicates.url = urlMatch;
        }

        // Check PDF filename
        if (pdfFile?.name) {
          const pdfMatch = sources.find(s =>
            s.pdf_filename?.toLowerCase().trim() === pdfFile.name.toLowerCase().trim()
          );
          if (pdfMatch) newDuplicates.pdf = pdfMatch;
        }

        setDuplicates(newDuplicates);
      } catch (error) {
        console.error('Error checking duplicates:', error);
      }
    };

    const timeoutId = setTimeout(checkDuplicates, 300);
    return () => clearTimeout(timeoutId);
  }, [formData.title, formData.doi, formData.url, pdfFile?.name, step]);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setStep('drop');
      setPdfFile(null);
      setMetadata(null);
      setError('');
      setProcessedAuthorsData(null); // Reset author check state
      setProcessedConceptsData(null); // Reset concept check state
      setLastSaveArgs(null); // Clear any prior failed-submit retry state
      setConceptSuggestions([]);
      setNewlyCreatedConcepts([]);
      setDuplicates({ title: null, doi: null, url: null, pdf: null });
      setDoiInput('');
      setDoiSearching(false);
      setFleshFragment('');
      setFleshing(false);
      setFleshError('');
      setFleshAlternatives([]);
      setFormData({
        title: '',
        authors: '',
        year: '',
        kind: 'article',
        doi: '',
        url: '',
        abstract: '',
        summary: '',
        journal_name: '',
        volume: '',
        issue: '',
        pages: '',
        publisher_or_venue: '',
        keywords: [],
        tags: [],
        concept_ids: [],
        person_ids: [],
        collection_ids: []
      });
    }
  }, [isOpen]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const pdfs = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf'
    );
    if (pdfs.length === 0) {
      setError('Please drop a PDF file.');
      return;
    }
    if (pdfs.length === 1) {
      handleFileSelected(pdfs[0]);
      return;
    }

    // Multiple PDFs → hand off to the bulk upload wizard
    try {
      const formData = new FormData();
      formData.append('name', `Upload ${new Date().toLocaleString()}`);
      pdfs.forEach((f) => formData.append('files[]', f));

      const response = await fetch('/upload_batches', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.errors?.join(', ') || 'Bulk upload failed.');
        return;
      }

      window.location.href = '/uploads';
    } catch (err) {
      console.error('Bulk upload error:', err);
      setError('An error occurred starting the bulk upload.');
    }
  }, []);

  const handleFileSelected = async (file) => {
    setPdfFile(file);
    setError('');
    setStep('extracting');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('pdf', file);

      const response = await fetch('/sources/extract_from_pdf', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        setMetadata(data);

        // Keywords are stored as read-only metadata from the source
        // Concepts are user-curated and separate
        setFormData({
          title: data.title || '',
          authors: data.authors || '',
          year: data.year || '',
          kind: data.kind || 'article',
          doi: data.doi || data.extracted_doi || '',
          url: data.url || '',
          abstract: data.abstract || '',
          summary: data.summary || data.abstract || '',
          journal_name: data.journal_name || '',
          volume: data.volume || '',
          issue: data.issue || '',
          pages: data.pages || '',
          publisher_or_venue: data.publisher_or_venue || '',
          keywords: data.keywords || [],
          methodologies: data.methodologies || [],
          tags: [],
          concept_ids: [],
          person_ids: [],
          collection_ids: []
        });
        setStep('review');
      } else {
        // No DOI found or extraction failed - show empty form with PDF attached
        setError(data.error || 'Could not extract metadata from PDF.');
        setFormData({
          title: '',
          authors: '',
          year: '',
          kind: 'article',
          doi: '',
          url: '',
          abstract: '',
          summary: '',
          journal_name: '',
          volume: '',
          issue: '',
          pages: '',
          publisher_or_venue: '',
          keywords: [],
          methodologies: [],
          tags: [],
          concept_ids: [],
          person_ids: [],
          collection_ids: []
        });
        setStep('review');
      }
    } catch (err) {
      console.error('Error extracting from PDF:', err);
      setError('An error occurred while processing the PDF. You can still enter metadata manually.');
      setStep('review');
    }
  };

  // DOI search handler
  const handleDoiSearch = async () => {
    const doi = doiInput.trim();
    if (!doi) return;

    setDoiSearching(true);
    setError('');

    try {
      const response = await fetch('/sources/extract_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ url: doi }),
      });

      const data = await response.json();

      if (response.ok && data.title) {
        setMetadata(data);
        setFormData({
          title: data.title || '',
          authors: data.authors || '',
          year: data.year || '',
          kind: data.kind || 'article',
          doi: data.doi || doi,
          url: data.url || '',
          abstract: data.abstract || '',
          summary: data.summary || data.abstract || '',
          journal_name: data.journal_name || '',
          volume: data.volume || '',
          issue: data.issue || '',
          pages: data.pages || '',
          publisher_or_venue: data.publisher_or_venue || '',
          keywords: data.keywords || [],
          methodologies: data.methodologies || [],
          tags: [],
          concept_ids: [],
          person_ids: [],
          collection_ids: []
        });
        setStep('review');
      } else {
        setError(data.error || 'Could not find metadata for this DOI. You can enter details manually.');
        // Still go to review so they can enter manually
        setFormData(prev => ({ ...prev, doi: doi }));
        setStep('review');
      }
    } catch (err) {
      console.error('Error searching DOI:', err);
      setError('An error occurred while searching. You can still enter metadata manually.');
      setFormData(prev => ({ ...prev, doi: doi }));
      setStep('review');
    } finally {
      setDoiSearching(false);
    }
  };

  // ====================================================================
  // Flesh Out Citation — free-form fragment → resolved metadata
  // Same pipeline as the SourceFormModal: Crossref + OpenAlex + Haiku
  // disambiguation.  High/medium confidence auto-applies and jumps to
  // the review step; low confidence shows alternatives below the input
  // for the user to pick from.
  // ====================================================================
  const applyResolvedToForm = (m) => {
    setMetadata(m);
    setFormData(prev => {
      const next = { ...prev };
      next.title              = m.title              || prev.title;
      next.authors            = m.authors            || prev.authors;
      next.year               = m.year               || prev.year;
      next.kind               = m.kind               || prev.kind || 'article';
      next.doi                = m.doi                || prev.doi;
      next.url                = m.url                || prev.url;
      next.abstract           = m.abstract           || prev.abstract;
      next.summary            = m.summary || m.abstract || prev.summary;
      next.journal_name       = m.journal_name       || prev.journal_name;
      next.volume             = m.volume             || prev.volume;
      next.issue              = m.issue              || prev.issue;
      next.pages              = m.pages              || prev.pages;
      next.publisher_or_venue = m.publisher_or_venue || prev.publisher_or_venue;
      next.book_title         = m.book_title         || prev.book_title;
      next.isbn               = m.isbn               || prev.isbn;
      next.publication_date   = m.publication_date   || prev.publication_date;
      next.keywords           = (Array.isArray(m.keywords) && m.keywords.length) ? m.keywords : prev.keywords;
      if (m.authors && m.authors.toString().trim().length > 0) {
        next.override_authors = true;
      }
      // Only auto-apply "Needs PDF" when there's no PDF — running Flesh
      // Out on the review step after a PDF was already dropped should
      // not flag the source as missing one.
      if (!pdfFile) {
        const markers = Array.isArray(prev.markers) ? prev.markers : [];
        if (!markers.includes('Needs PDF')) {
          next.markers = [...markers, 'Needs PDF'];
        }
      }
      return next;
    });
    setFleshAlternatives([]);
    setFleshError('');
    if (step !== 'review') setStep('review');
  };

  const handleFleshOut = async () => {
    const fragment = fleshFragment.trim();
    if (fragment.length < 4) {
      setFleshError('Add a few more characters to search for.');
      return;
    }
    setFleshing(true);
    setFleshError('');
    setFleshAlternatives([]);
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
      if (data.confidence !== 'low' && data.best) {
        applyResolvedToForm(data.best);
      } else if (data.best) {
        // Low confidence — keep the user on this step and let them pick
        // from candidates (best + alternatives) listed inline.
        setFleshAlternatives([data.best, ...(data.alternatives || [])]);
      } else {
        setFleshError('No matches found.  Try refining the citation.');
      }
    } catch (e) {
      console.error('Flesh out error:', e);
      setFleshError('Lookup failed.  Try refining the citation.');
    } finally {
      setFleshing(false);
    }
  };

  const handlePickFleshAlt = async (alt) => {
    // If the alt has a DOI but no abstract, hit extract_metadata to fill
    // the gap before applying — same pattern as the SourceFormModal.
    setFleshing(true);
    try {
      let enriched = alt;
      if (alt?.doi && !alt.abstract) {
        try {
          const r = await fetch('/sources/extract_metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({ url: alt.doi }),
          });
          if (r.ok) {
            const m = await r.json();
            enriched = {
              ...alt,
              abstract: alt.abstract || m.abstract,
              summary:  alt.summary  || m.abstract || m.summary,
              keywords: (alt.keywords?.length ? alt.keywords : m.keywords) || alt.keywords,
              pages: alt.pages || m.pages,
              volume: alt.volume || m.volume,
              issue: alt.issue || m.issue,
              journal_name: alt.journal_name || m.journal_name,
              publisher_or_venue: alt.publisher_or_venue || m.publisher_or_venue,
            };
          }
        } catch (e) { console.warn('Alt enrich failed:', e); }
      }
      applyResolvedToForm(enriched);
    } finally {
      setFleshing(false);
    }
  };

  const parseAuthors = (authorsString) => {
    if (!authorsString || typeof authorsString !== 'string' || authorsString.trim() === '') return [];
    return authorsString.split(/\.\s*,\s*(?=[A-Z])/).map(author => author.trim() + '.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const authors = parseAuthors(formData.authors);

    // If we already have processed author data from the Check button, use it
    if (processedAuthorsData) {
      await performSave(processedAuthorsData);
      return;
    }

    // Otherwise, if there are authors, show the modal in save mode
    if (authors.length > 0) {
      setParsedAuthors(authors);
      setAuthorModalMode('save');
      setShowAuthorModal(true);
    } else {
      await performSave();
    }
  };

  const handleAuthorConfirm = async (processedAuthors) => {
    setShowAuthorModal(false);

    // Collect all person IDs - both linked and newly created
    const allPersonIds = [];
    const updatedProcessedAuthors = [...processedAuthors];

    // Process each author
    for (let i = 0; i < processedAuthors.length; i++) {
      const author = processedAuthors[i];

      if ((author.action === 'link' || author.action === 'link_and_update') && author.linkedPersonId) {
        // Linked to existing person
        allPersonIds.push(Number(author.linkedPersonId));

        // If merging ORCID, update the person now
        if (author.action === 'link_and_update' && author.mergeOrcid) {
          try {
            await fetch(`/people/${author.linkedPersonId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
              },
              body: JSON.stringify({ person: { orcid: author.mergeOrcid } }),
            });
          } catch (error) {
            console.error('Error updating person ORCID:', error);
          }
        }
      } else if (author.action === 'create') {
        // Create new person immediately so they appear in the selector
        try {
          const response = await fetch('/people', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({
              person: {
                first_name: [author.firstName, author.middleName].filter(Boolean).join(' ') || null,
                last_name: author.lastName,
                orcid: author.orcid || null,
                role: 'researcher'
              }
            }),
          });

          if (response.ok) {
            const newPerson = await response.json();
            allPersonIds.push(Number(newPerson.id));
            // Update the processed author with the new ID so we don't create duplicates on save
            updatedProcessedAuthors[i] = {
              ...author,
              action: 'link',
              linkedPersonId: newPerson.id
            };
          }
        } catch (error) {
          console.error('Error creating person:', error);
        }
      }
    }

    // Update form with all person IDs
    if (allPersonIds.length > 0) {
      const existingIds = (formData.person_ids || []).map(id => Number(id));
      const newIds = [...new Set([...existingIds, ...allPersonIds])];
      setFormData(prev => ({ ...prev, person_ids: newIds }));
    }

    if (authorModalMode === 'save') {
      // Triggered from submit - save immediately
      await performSave(updatedProcessedAuthors);
    } else {
      // Triggered from Check button - store updated data for later
      setProcessedAuthorsData(updatedProcessedAuthors);
    }
  };

  // Open author modal manually for checking
  const handleCheckAuthors = () => {
    const authors = parseAuthors(formData.authors);
    if (authors.length > 0) {
      setParsedAuthors(authors);
      setAuthorModalMode('check');
      setShowAuthorModal(true);
    }
  };

  // Re-tag research methodology with Haiku (the abstract may have been edited
  // since the initial extraction).
  const [taggingMethods, setTaggingMethods] = useState(false);
  const [methodsTagNote, setMethodsTagNote] = useState('');

  const handleAutoTagMethods = async () => {
    if (!formData.title) {
      setMethodsTagNote('Add a title first.');
      return;
    }
    setMethodsTagNote('');
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
      const suggested = Array.isArray(data.types) ? data.types : [];
      if (suggested.length === 0) {
        setMethodsTagNote('Nothing strong to suggest from this abstract.');
        return;
      }
      setFormData(prev => ({
        ...prev,
        methodologies: Array.from(new Set([...(prev.methodologies || []), ...suggested])),
      }));
    } catch (e) {
      console.error(e);
      setMethodsTagNote('Auto-tag failed.  Try again in a moment.');
    } finally {
      setTaggingMethods(false);
    }
  };

  const toggleMethodology = (m) => {
    setFormData(prev => ({
      ...prev,
      methodologies: (prev.methodologies || []).includes(m)
        ? (prev.methodologies || []).filter(x => x !== m)
        : [...(prev.methodologies || []), m],
    }));
  };

  // Auto-fire methodology tagging once metadata lands on the review step.
  // Skips when there's no title or when methodologies are already populated
  // (e.g., the user came back from a different tab and we already tagged).
  useEffect(() => {
    if (step !== 'review') return;
    if (!formData.title) return;
    if ((formData.methodologies || []).length > 0) return;
    handleAutoTagMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Concept suggestion handlers
  const handleCheckConcepts = async () => {
    if (!formData.title) return;
    setLoadingConceptSuggestions(true);
    try {
      const response = await fetch('/concepts/suggest_from_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          title: formData.title,
          abstract: formData.abstract,
          keywords: formData.keywords
        }),
      });
      const data = await response.json();
      if (data.suggestions?.length > 0) {
        setConceptSuggestions(data.suggestions);
        setShowConceptModal(true);
      } else {
        setConceptSuggestions([]);
        setShowConceptModal(true); // Show modal with "no suggestions" message
      }
    } catch (error) {
      console.error('Error fetching concept suggestions:', error);
    } finally {
      setLoadingConceptSuggestions(false);
    }
  };

  const handleConceptConfirm = async (processedConcepts) => {
    setShowConceptModal(false);
    const allConceptIds = [];
    const createdConcepts = [];

    for (const concept of processedConcepts) {
      if (concept.action === 'skip') continue;

      if (concept.action === 'link' && concept.linkedConceptId) {
        allConceptIds.push(Number(concept.linkedConceptId));
      } else if (concept.action === 'create') {
        try {
          const response = await fetch('/concepts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({
              concept: {
                label: concept.editedLabel,
                concept_type: concept.editedConceptType || 'non_physical_concept'
              }
            }),
          });
          if (response.ok) {
            const newConcept = await response.json();
            allConceptIds.push(Number(newConcept.id));
            createdConcepts.push(newConcept);
          }
        } catch (error) {
          console.error('Error creating concept:', error);
        }
      }
    }

    // Track newly created concepts so ConceptSelector can display them
    if (createdConcepts.length > 0) {
      setNewlyCreatedConcepts(prev => [...prev, ...createdConcepts]);
    }

    const existingIds = (formData.concept_ids || []).map(id => Number(id));
    const newIds = [...new Set([...existingIds, ...allConceptIds])];
    setFormData(prev => ({ ...prev, concept_ids: newIds }));
    setProcessedConceptsData(processedConcepts);
  };

  const performSave = async (processedAuthors = null) => {
    setSubmitting(true);
    setStep('saving');
    // Stash the args so "Try Again" on the error banner can replay this
    // exact submission without forcing the user back through the modals.
    setLastSaveArgs({ processedAuthors });

    try {
      const formDataToSend = new FormData();

      const dataToSend = { ...formData };
      if (processedAuthors) {
        dataToSend.processed_authors = processedAuthors;
        dataToSend.override_authors = true;
      }

      Object.keys(dataToSend).forEach(key => {
        if (key === 'processed_authors') {
          formDataToSend.append(`source[processed_authors]`, JSON.stringify(dataToSend[key]));
        } else if (Array.isArray(dataToSend[key])) {
          dataToSend[key].forEach(value => {
            formDataToSend.append(`source[${key}][]`, value);
          });
        } else if (dataToSend[key] !== null && dataToSend[key] !== '') {
          formDataToSend.append(`source[${key}]`, dataToSend[key]);
        }
      });

      // Attach the PDF
      if (pdfFile) {
        formDataToSend.append('source[pdf]', pdfFile);
      }

      // Diagnostic: log payload shape so failures (esp. Heroku H33 stream
      // resets that produce no Rails log entry) can be correlated to the
      // size/field count of the multipart body that triggered them.
      let totalBytes = 0;
      let fieldCount = 0;
      const fieldSizes = {};
      for (const [k, v] of formDataToSend.entries()) {
        fieldCount++;
        const size = (typeof v === 'string') ? v.length : (v?.size || 0);
        totalBytes += size;
        fieldSizes[k] = (fieldSizes[k] || 0) + size;
      }
      console.log('POST /sources payload:', { fieldCount, totalBytes, fieldSizes });

      const response = await fetch('/sources', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
      } else {
        // Read as text first so we can surface non-JSON error pages
        // (Heroku platform 503s, Puma error pages) instead of throwing
        // silently on response.json().
        const text = await response.text();
        console.error('POST /sources failed', {
          status: response.status,
          statusText: response.statusText,
          body: text,
          payloadBytes: totalBytes,
          fieldCount,
        });
        let message = `Server error (${response.status})`;
        try {
          const data = JSON.parse(text);
          message = data.errors?.join(', ') || data.error || message;
        } catch {
          if (text) message = `${message}: ${text.slice(0, 200)}`;
        }
        setError(message);
        setStep('review');
      }
    } catch (error) {
      console.error('Error saving source:', error);
      setError(`Network error while saving${error?.message ? `: ${error.message}` : ''}`);
      setStep('review');
    } finally {
      setSubmitting(false);
    }
  };

  // Replay the last performSave call.  Used by the "Try Again" button on
  // the error banner — most useful for transient failures (Heroku H33
  // HTTP/2 stream resets) where the same payload succeeds on retry.
  const handleRetry = async () => {
    setError('');
    await performSave(lastSaveArgs?.processedAuthors ?? null);
  };

  const handleArrayInput = (field, value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, [field]: items });
  };

  return (
    <>
      <SlidePanel isOpen={isOpen} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Modal Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--accent-blue)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <h2 style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}>
                <i className={pdfFile ? "fas fa-file-pdf" : (metadata && formData.doi ? "fas fa-link" : "fas fa-plus-circle")} style={{ fontSize: 'var(--text-base)', opacity: 0.9 }}></i>
                {step === 'drop' ? 'Add New Source' : (pdfFile ? 'Add Source from PDF' : (metadata && formData.doi ? 'Add Source from DOI' : 'Add Source Manually'))}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                fontSize: 'var(--text-xl)',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
              title="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', background: 'white' }}>
            {/* Drop Zone Step */}
            {step === 'drop' && (
              <>
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `3px dashed ${isDragging ? 'var(--accent-blue)' : 'var(--neutral-300)'}`,
                  borderRadius: '12px',
                  padding: 'var(--space-12)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? 'color-mix(in srgb, var(--accent-blue) 10%, white)' : 'var(--neutral-50)',
                  transition: 'all 0.2s ease',
                  minHeight: '300px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-4)',
                }}
              >
                <i
                  className="fas fa-file-pdf"
                  style={{
                    fontSize: '4rem',
                    color: isDragging ? 'var(--accent-blue)' : 'var(--neutral-400)',
                    transition: 'color 0.2s ease',
                  }}
                ></i>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-xl)',
                    fontWeight: 600,
                    color: 'var(--neutral-700)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    {isDragging ? 'Drop your PDF here' : 'Drop a PDF or click to select'}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-500)',
                  }}>
                    We'll extract the DOI and fetch metadata automatically
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </div>

              {/* DOI Search Option */}
              <div style={{
                marginTop: 'var(--space-6)',
                textAlign: 'center',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                }}>
                  <div style={{ height: '1px', width: '60px', background: 'var(--neutral-300)' }}></div>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-500)',
                  }}>
                    or search by DOI
                  </span>
                  <div style={{ height: '1px', width: '60px', background: 'var(--neutral-300)' }}></div>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  maxWidth: '400px',
                  margin: '0 auto',
                }}>
                  <input
                    type="text"
                    value={doiInput}
                    onChange={(e) => setDoiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && doiInput.trim()) {
                        e.preventDefault();
                        handleDoiSearch();
                      }
                    }}
                    placeholder="10.1000/example or DOI URL"
                    className="form-input"
                    disabled={doiSearching}
                    style={{
                      flex: 1,
                      height: '44px',
                      fontSize: 'var(--text-base)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleDoiSearch}
                    disabled={!doiInput.trim() || doiSearching}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      background: (!doiInput.trim() || doiSearching) ? 'var(--neutral-300)' : 'var(--accent-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 600,
                      cursor: (!doiInput.trim() || doiSearching) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      height: '44px',
                    }}
                  >
                    {doiSearching ? (
                      <><i className="fas fa-spinner fa-spin"></i></>
                    ) : (
                      <><i className="fas fa-search"></i> Search</>
                    )}
                  </button>
                </div>
              </div>

              {/* Flesh Out Citation — free-form fragment lookup */}
              <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
                }}>
                  <div style={{ height: '1px', width: '60px', background: 'var(--neutral-300)' }}></div>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--neutral-500)' }}>
                    or paste any citation fragment
                  </span>
                  <div style={{ height: '1px', width: '60px', background: 'var(--neutral-300)' }}></div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'stretch', gap: 'var(--space-2)',
                  maxWidth: '560px', margin: '0 auto',
                }}>
                  <textarea
                    value={fleshFragment}
                    onChange={(e) => setFleshFragment(e.target.value)}
                    placeholder='e.g. "Vaswani et al., 2017, attention is all you need"'
                    className="form-input"
                    disabled={fleshing}
                    rows={2}
                    style={{ flex: 1, resize: 'vertical', fontSize: 'var(--text-sm)', minHeight: '54px' }}
                  />
                  <button
                    type="button"
                    onClick={handleFleshOut}
                    disabled={!fleshFragment.trim() || fleshing}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      background: (!fleshFragment.trim() || fleshing) ? 'var(--neutral-300)' : 'var(--accent-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      cursor: (!fleshFragment.trim() || fleshing) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      whiteSpace: 'nowrap',
                      alignSelf: 'flex-start',
                      minHeight: '54px',
                    }}
                  >
                    {fleshing
                      ? <><i className="fas fa-spinner fa-spin"></i> Searching…</>
                      : <><MagicSparkles size={14} /> Flesh Out</>}
                  </button>
                </div>
                {fleshError && (
                  <div style={{
                    marginTop: 'var(--space-3)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--accent-red, #a13838)',
                  }}>
                    {fleshError}
                  </div>
                )}
                {fleshAlternatives.length > 0 && (
                  <div style={{
                    marginTop: 'var(--space-4)',
                    maxWidth: '560px',
                    margin: 'var(--space-4) auto 0',
                    textAlign: 'left',
                  }}>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--neutral-500)',
                      margin: '0 0 var(--space-2)',
                    }}>
                      Possible matches — pick one
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {fleshAlternatives.slice(0, 12).map((alt) => (
                        <button
                          key={alt.doi || alt.title}
                          type="button"
                          onClick={() => handlePickFleshAlt(alt)}
                          disabled={fleshing}
                          style={{
                            background: 'var(--paper)',
                            border: '1px solid var(--ink-line)',
                            borderRadius: 'var(--r-sm)',
                            padding: '10px 12px',
                            cursor: fleshing ? 'wait' : 'pointer',
                            textAlign: 'left',
                            fontFamily: 'var(--font-body)',
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (!fleshing) {
                              e.currentTarget.style.borderColor = 'var(--source)';
                              e.currentTarget.style.background = 'var(--source-tint)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--ink-line)';
                            e.currentTarget.style.background = 'var(--paper)';
                          }}
                        >
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                            {alt.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--ink-2)' }}>
                            {alt.authors && <span>{alt.authors.slice(0, 80)}</span>}
                            {alt.year && <span> · {alt.year}</span>}
                            {alt.journal_name && <span> · <em>{alt.journal_name}</em></span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Input Option */}
              <div style={{
                marginTop: 'var(--space-6)',
                textAlign: 'center',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                }}>
                  <div style={{ height: '1px', width: '60px', background: 'var(--neutral-300)' }}></div>
                  <span style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-500)',
                  }}>
                    or
                  </span>
                  <div style={{ height: '1px', width: '60px', background: 'var(--neutral-300)' }}></div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  style={{
                    padding: 'var(--space-3) var(--space-6)',
                    background: 'white',
                    color: 'var(--accent-blue)',
                    border: '2px solid var(--accent-blue)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-blue)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = 'var(--accent-blue)';
                  }}
                >
                  <i className="fas fa-edit"></i>
                  Input Source Manually
                </button>
              </div>
              </>
            )}

            {/* Extracting Step */}
            {step === 'extracting' && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-4)',
                minHeight: '300px',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <i
                    className="fas fa-spinner fa-spin"
                    style={{ fontSize: '2rem', color: 'var(--accent-blue)' }}
                  ></i>
                </div>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-xl)',
                    fontWeight: 600,
                    color: 'var(--neutral-700)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Extracting metadata from PDF...
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-500)',
                  }}>
                    {pdfFile?.name}
                  </p>
                </div>
              </div>
            )}

            {/* Saving Step */}
            {step === 'saving' && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-4)',
                minHeight: '300px',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <i
                    className="fas fa-spinner fa-spin"
                    style={{ fontSize: '2rem', color: 'var(--accent-blue)' }}
                  ></i>
                </div>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-xl)',
                    fontWeight: 600,
                    color: 'var(--neutral-700)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    Saving source...
                  </p>
                </div>
              </div>
            )}

            {/* Review Step */}
            {step === 'review' && (
              <form onSubmit={handleSubmit}>
                {/* PDF Info Banner - only show if PDF attached */}
                {pdfFile && (
                  <div style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'color-mix(in srgb, var(--accent-blue) 10%, white)',
                    borderRadius: '8px',
                    marginBottom: 'var(--space-4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                  }}>
                    <i className="fas fa-file-pdf" style={{ fontSize: 'var(--text-xl)', color: 'var(--accent-blue)' }}></i>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--neutral-700)',
                        margin: 0,
                      }}>
                        {pdfFile?.name}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        margin: 0,
                      }}>
                        PDF will be attached to this source
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfFile(null);
                      }}
                      style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--neutral-500)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                    }}
                    title="Remove PDF"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                  </div>
                )}

                {/* Flesh Out Citation — rescue panel when extraction was thin */}
                <div style={{
                  background: 'linear-gradient(135deg, var(--source-tint), color-mix(in srgb, var(--source) 8%, var(--paper)))',
                  border: '1px solid color-mix(in srgb, var(--source) 35%, transparent)',
                  borderRadius: 'var(--r-md)',
                  padding: '14px 16px',
                  marginBottom: 'var(--space-4)',
                }}>
                  <h4 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    color: 'var(--source-2)',
                    margin: '0 0 4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <MagicSparkles size={13} /> Flesh Out Citation
                  </h4>
                  <p style={{
                    fontSize: '12.5px',
                    color: 'var(--ink-2)',
                    margin: '0 0 10px',
                    lineHeight: 1.5,
                  }}>
                    Missing fields after extraction?  Paste any citation fragment and we'll fill the gaps from Crossref.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                    <textarea
                      value={fleshFragment}
                      onChange={(e) => setFleshFragment(e.target.value)}
                      placeholder='e.g. "Vaswani et al., 2017, attention is all you need" or a DOI'
                      className="form-input"
                      disabled={fleshing}
                      rows={2}
                      style={{ flex: 1, resize: 'vertical', fontSize: '13px', minHeight: '54px' }}
                    />
                    <button
                      type="button"
                      onClick={handleFleshOut}
                      disabled={!fleshFragment.trim() || fleshing}
                      style={{
                        padding: '0 14px',
                        background: (!fleshFragment.trim() || fleshing) ? 'var(--neutral-300)' : 'var(--source)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--r-md)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: (!fleshFragment.trim() || fleshing) ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        alignSelf: 'flex-start',
                        height: '54px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {fleshing
                        ? <><i className="fas fa-spinner fa-spin"></i> Searching…</>
                        : <>Flesh Out →</>}
                    </button>
                  </div>
                  {fleshError && (
                    <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--error, #a13838)' }}>
                      {fleshError}
                    </div>
                  )}
                  {fleshAlternatives.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        margin: '0 0 6px',
                      }}>
                        Possible matches — pick one
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                        {fleshAlternatives.slice(0, 12).map((alt) => (
                          <button
                            key={alt.doi || alt.title}
                            type="button"
                            onClick={() => handlePickFleshAlt(alt)}
                            disabled={fleshing}
                            style={{
                              background: 'var(--paper)',
                              border: '1px solid var(--ink-line)',
                              borderRadius: 'var(--r-sm)',
                              padding: '8px 12px',
                              cursor: fleshing ? 'wait' : 'pointer',
                              textAlign: 'left',
                              fontFamily: 'var(--font-body)',
                              transition: 'border-color 0.15s, background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!fleshing) {
                                e.currentTarget.style.borderColor = 'var(--source)';
                                e.currentTarget.style.background = 'var(--source-tint)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--ink-line)';
                              e.currentTarget.style.background = 'var(--paper)';
                            }}
                          >
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
                              {alt.title}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--ink-2)' }}>
                              {alt.authors && <span>{alt.authors.slice(0, 80)}</span>}
                              {alt.year && <span> · {alt.year}</span>}
                              {alt.journal_name && <span> · <em>{alt.journal_name}</em></span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="alert alert-warning" style={{
                    marginBottom: 'var(--space-4)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="alert-title"><i className="fas fa-exclamation-triangle"></i> Note:</span>
                      {error}
                    </div>
                    {lastSaveArgs && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        disabled={submitting}
                        style={{
                          flexShrink: 0,
                          padding: 'var(--space-2) var(--space-3)',
                          background: submitting ? 'var(--neutral-300)' : 'var(--accent-blue)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontFamily: 'var(--font-display)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          cursor: submitting ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          whiteSpace: 'nowrap',
                        }}
                        title="Retry the same submission — most useful for transient network errors"
                      >
                        <i className={submitting ? 'fas fa-spinner fa-spin' : 'fas fa-redo'}></i>
                        {submitting ? 'Retrying…' : 'Try Again'}
                      </button>
                    )}
                  </div>
                )}

                {/* Duplicate Warnings */}
                {(duplicates.doi || duplicates.title || duplicates.url || duplicates.pdf) && (
                  <div style={{
                    marginBottom: 'var(--space-4)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: '#fef3c7',
                    border: '1px solid #d97706',
                    borderRadius: '8px',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: '#92400e',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}>
                      <i className="fas fa-exclamation-triangle"></i>
                      Possible Duplicate Detected
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                      color: '#92400e',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                    }}>
                      {duplicates.doi && (
                        <div>
                          <strong>Same DOI:</strong>{' '}
                          <a
                            href={`/sources/${duplicates.doi.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-blue)', fontWeight: 600 }}
                          >
                            {duplicates.doi.title}
                          </a>
                        </div>
                      )}
                      {duplicates.title && !duplicates.doi && (
                        <div>
                          <strong>Same Title:</strong>{' '}
                          <a
                            href={`/sources/${duplicates.title.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-blue)', fontWeight: 600 }}
                          >
                            {duplicates.title.title}
                          </a>
                        </div>
                      )}
                      {duplicates.url && !duplicates.doi && (
                        <div>
                          <strong>Same URL:</strong>{' '}
                          <a
                            href={`/sources/${duplicates.url.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-blue)', fontWeight: 600 }}
                          >
                            {duplicates.url.title}
                          </a>
                        </div>
                      )}
                      {duplicates.pdf && !duplicates.doi && (
                        <div>
                          <strong>Same PDF filename:</strong>{' '}
                          <a
                            href={`/sources/${duplicates.pdf.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-blue)', fontWeight: 600 }}
                          >
                            {duplicates.pdf.title}
                          </a>
                        </div>
                      )}
                    </div>
                    <p style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: '#b45309',
                      marginTop: 'var(--space-2)',
                      marginBottom: 0,
                    }}>
                      You can still save this source if it's not actually a duplicate.
                    </p>
                  </div>
                )}

                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 700,
                  color: 'var(--accent-blue)',
                  marginBottom: 'var(--space-4)',
                }}>
                  Review & Edit Metadata
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {/* Title */}
                  <div>
                    <label className="form-label">Title *</label>
                    <textarea
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      rows="2"
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Type and Year */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div>
                      <label className="form-label">Source Type *</label>
                      <select
                        value={formData.kind}
                        onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
                        className="form-select"
                        style={{ height: '42px' }}
                      >
                        <option value="article">Article</option>
                        <option value="book">Book</option>
                        <option value="book_chapter">Book Chapter</option>
                        <option value="conference">Conference Paper</option>
                        <option value="report">Report</option>
                        <option value="thesis">Thesis</option>
                        <option value="dissertation">Dissertation</option>
                        <option value="website">Website</option>
                        <option value="video">Video</option>
                        <option value="podcast">Podcast</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Year</label>
                      <input
                        type="number"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        className="form-input"
                        placeholder="2024"
                        style={{ height: '42px' }}
                      />
                    </div>
                  </div>

                  {/* Authors */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                      color: 'var(--source)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <i className="fas fa-users" style={{ fontSize: 'var(--text-sm)' }}></i>
                        Authors
                      </div>
                      {formData.authors && parseAuthors(formData.authors).length > 0 && (
                        <button
                          type="button"
                          onClick={handleCheckAuthors}
                          style={{
                            padding: 'var(--space-1) var(--space-2)',
                            background: processedAuthorsData ? 'var(--accent-green-light)' : 'var(--accent-gold-light)',
                            color: processedAuthorsData ? 'var(--accent-green)' : 'var(--accent-gold)',
                            border: `1px solid ${processedAuthorsData ? 'var(--accent-green)' : 'var(--accent-gold)'}`,
                            borderRadius: '4px',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)',
                            transition: 'all 0.15s'
                          }}
                        >
                          <i className={processedAuthorsData ? "fas fa-check-circle" : "fas fa-search"}></i>
                          {processedAuthorsData ? 'Authors Checked' : 'Check Author Data'}
                        </button>
                      )}
                    </div>
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <label className="form-label" style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-600)' }}>
                        Citation String <span style={{ fontWeight: 400, color: 'var(--neutral-500)' }}>(for display)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.authors}
                        onChange={(e) => {
                          setFormData({ ...formData, authors: e.target.value });
                          // Clear processed data when authors string changes
                          setProcessedAuthorsData(null);
                        }}
                        className="form-input"
                        placeholder="Last, F., Last, F."
                      />
                    </div>
                    <div style={{ height: formData.person_ids.length > 0 ? '240px' : '200px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                      <PeopleSelector
                        selectedPersonIds={formData.person_ids}
                        onChange={(person_ids) => setFormData({ ...formData, person_ids })}
                        themeColor="var(--accent-gold)"
                      />
                    </div>
                  </div>

                  {/* DOI and URL */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div>
                      <label className="form-label">DOI</label>
                      <input
                        type="text"
                        value={formData.doi}
                        onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                        className="form-input"
                        placeholder="10.1000/example"
                      />
                    </div>
                    <div>
                      <label className="form-label">URL</label>
                      <input
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        className="form-input"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  {/* Journal details (for articles) */}
                  {(formData.kind === 'article' || formData.kind === 'conference') && (
                    <>
                      <div>
                        <label className="form-label">Journal Name</label>
                        <input
                          type="text"
                          value={formData.journal_name}
                          onChange={(e) => setFormData({ ...formData, journal_name: e.target.value })}
                          className="form-input"
                          placeholder="e.g., Journal of Clinical Psychology"
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                        <div>
                          <label className="form-label">Volume</label>
                          <input
                            type="text"
                            value={formData.volume}
                            onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                            className="form-input"
                            placeholder="42"
                          />
                        </div>
                        <div>
                          <label className="form-label">Issue</label>
                          <input
                            type="text"
                            value={formData.issue}
                            onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                            className="form-input"
                            placeholder="3"
                          />
                        </div>
                        <div>
                          <label className="form-label">Pages</label>
                          <input
                            type="text"
                            value={formData.pages}
                            onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                            className="form-input"
                            placeholder="123-145"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Abstract */}
                  <div>
                    <label className="form-label">Abstract</label>
                    <RichTextEditor
                      value={formData.abstract}
                      onChange={(html) => setFormData({ ...formData, abstract: html })}
                      placeholder="Full abstract from the source..."
                      rows={4}
                      themeColor="var(--accent-blue)"
                    />
                  </div>

                  {/* Keywords (read-only from source metadata) */}
                  {formData.keywords.length > 0 && (
                    <div>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <i className="fas fa-key" style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}></i>
                        Author Keywords
                        <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>(from source)</span>
                      </label>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3)',
                        background: 'var(--neutral-50)',
                        borderRadius: '6px',
                        border: '1px solid var(--neutral-200)',
                      }}>
                        {formData.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '4px 10px',
                              background: 'white',
                              border: '1px solid var(--neutral-300)',
                              borderRadius: '4px',
                              fontSize: 'var(--text-xs)',
                              fontFamily: 'var(--font-body)',
                              color: 'var(--neutral-600)',
                            }}
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Research Type(s) — auto-tagged on extract, editable here */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                      color: 'var(--source, var(--accent-blue))',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <i className="fas fa-flask" style={{ fontSize: 'var(--text-sm)' }}></i>
                        Research Type(s)
                      </div>
                      {formData.title && (
                        <button
                          type="button"
                          onClick={handleAutoTagMethods}
                          disabled={taggingMethods}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)',
                            padding: 'var(--space-1) var(--space-2)',
                            background: 'var(--source-tint, var(--accent-blue-light))',
                            color: 'var(--source-2, var(--accent-blue))',
                            border: '1px solid var(--source, var(--accent-blue))',
                            borderRadius: '4px',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 500,
                            cursor: taggingMethods ? 'wait' : 'pointer',
                            opacity: taggingMethods ? 0.7 : 1,
                          }}
                          title="Re-tag from the current abstract"
                        >
                          <MagicSparkles size={12} spinning={taggingMethods} />
                          {taggingMethods ? 'Tagging.' : 'Auto-tag'}
                        </button>
                      )}
                    </div>
                    {methodsTagNote && (
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        fontStyle: 'italic',
                        marginBottom: 'var(--space-2)',
                      }}>
                        {methodsTagNote}
                      </div>
                    )}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '4px',
                      padding: 'var(--space-3)',
                      background: 'white',
                      border: '1px solid var(--neutral-300)',
                      borderRadius: '6px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      {RESEARCH_TYPES.map(m => (
                        <label key={m} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-700)',
                          padding: '2px 4px',
                          cursor: 'pointer',
                        }}>
                          <input
                            type="checkbox"
                            checked={(formData.methodologies || []).includes(m)}
                            onChange={() => toggleMethodology(m)}
                            style={{ accentColor: 'var(--source, var(--accent-blue))' }}
                          />
                          <span>{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Concepts */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                      color: 'var(--source)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <i className="fas fa-lightbulb" style={{ fontSize: 'var(--text-sm)' }}></i>
                        Concepts
                      </div>
                      {formData.title && (
                        <button
                          type="button"
                          onClick={handleCheckConcepts}
                          disabled={loadingConceptSuggestions}
                          style={{
                            padding: 'var(--space-1) var(--space-2)',
                            background: processedConceptsData ? 'var(--accent-green-light)' : 'var(--accent-green-light)',
                            color: processedConceptsData ? 'var(--accent-green)' : 'var(--accent-green)',
                            border: `1px solid ${processedConceptsData ? 'var(--accent-green)' : 'var(--accent-green)'}`,
                            borderRadius: '4px',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 500,
                            cursor: loadingConceptSuggestions ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)',
                            transition: 'all 0.15s',
                            opacity: loadingConceptSuggestions ? 0.7 : 1,
                          }}
                        >
                          {loadingConceptSuggestions ? (
                            <>
                              <i className="fas fa-spinner fa-spin"></i>
                              Analyzing...
                            </>
                          ) : processedConceptsData ? (
                            <>
                              <i className="fas fa-check-circle"></i>
                              Concepts Checked
                            </>
                          ) : (
                            <>
                              <i className="fas fa-magic"></i>
                              Check Concepts
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div style={{ height: formData.concept_ids.length > 0 ? '240px' : '200px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                      <ConceptSelector
                        selectedConceptIds={formData.concept_ids}
                        onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                        themeColor="var(--accent-green)"
                        newConcepts={newlyCreatedConcepts}
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                      color: 'var(--source)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}>
                      <i className="fas fa-tag" style={{ fontSize: 'var(--text-sm)' }}></i>
                      Tags
                    </div>
                    <div style={{ height: formData.tags.length > 0 ? '240px' : '200px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                      <TagSelector
                        selectedTags={formData.tags}
                        onChange={(tags) => setFormData({ ...formData, tags })}
                        themeColor="var(--ink-3)"
                      />
                    </div>
                  </div>

                  {/* Collections */}
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                      color: 'var(--source)',
                      marginBottom: 'var(--space-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}>
                      <i className="fas fa-folder" style={{ fontSize: 'var(--text-sm)' }}></i>
                      Collections
                    </div>
                    <div style={{ height: formData.collection_ids.length > 0 ? '240px' : '200px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                      <CollectionSelector
                        itemType="Source"
                        itemId={null}
                        selectedCollectionIds={formData.collection_ids}
                        onChange={(ids) => setFormData({ ...formData, collection_ids: ids })}
                        themeColor="var(--ink-3)"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  marginTop: 'var(--space-6)',
                  paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--neutral-200)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: 'white',
                      color: 'var(--accent-blue)',
                      border: '1px solid var(--accent-blue)',
                      borderRadius: '6px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formData.title}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: (submitting || !formData.title) ? 'var(--neutral-300)' : 'var(--accent-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 500,
                      cursor: (submitting || !formData.title) ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {submitting ? (
                      <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Saving...</>
                    ) : (
                      'Create Source'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </SlidePanel>

      <AuthorDisambiguationModal
        isOpen={showAuthorModal}
        onClose={() => setShowAuthorModal(false)}
        authors={parsedAuthors}
        authorsData={metadata?.authors_data}
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
