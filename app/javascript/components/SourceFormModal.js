import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import TagSelector from './TagSelector';
import ConceptSelector from './ConceptSelector';
import PeopleSelector from './PeopleSelector';
import CollectionSelector from './CollectionSelector';
import AuthorDisambiguationModal from './AuthorDisambiguationModal';
import ConceptDisambiguationModal from './ConceptDisambiguationModal';
import RichTextEditor from './RichTextEditor';

export default function SourceFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'pending', 'saving', 'saved', 'error'
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    year: '',
    kind: 'article',
    methodologies: [],
    publisher_or_venue: '',
    doi: '',
    url: '',
    citation: '',
    summary: '',
    tags: [],
    concept_ids: [],
    person_ids: [],
    journal_name: '',
    volume: '',
    issue: '',
    pages: '',
    publication_date: '',
    abstract: '',
    keywords: [],
    book_title: '',
    edition: '',
    isbn: '',
    chapter_number: '',
    website_name: '',
    access_date: '',
    collection_ids: []
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [authorModalMode, setAuthorModalMode] = useState('check'); // 'check' or 'save'
  const [parsedAuthors, setParsedAuthors] = useState([]);
  const [authorsData, setAuthorsData] = useState(null);
  const [processedAuthorsData, setProcessedAuthorsData] = useState(null);
  const [titleDuplicate, setTitleDuplicate] = useState(null);
  const [urlDuplicate, setUrlDuplicate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Concept suggestion
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [conceptSuggestions, setConceptSuggestions] = useState([]);
  const [processedConceptsData, setProcessedConceptsData] = useState(null);
  const [loadingConceptSuggestions, setLoadingConceptSuggestions] = useState(false);
  const [newlyCreatedConcepts, setNewlyCreatedConcepts] = useState([]); // Track concepts created via modal

  // Collections state
  const [collections, setCollections] = useState([]);
  const [itemCollections, setItemCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState('');

  // Debounced duplicate checking
  useEffect(() => {
    if (!isOpen || item) return; // Only check for new sources

    const checkDuplicates = async () => {
      // Check title
      if (formData.title && formData.title.length > 10) {
        try {
          const response = await fetch(`/sources.json`);
          const data = await response.json();
          const sources = Array.isArray(data) ? data : (data.sources || []);
          const duplicate = sources.find(s =>
            s.title?.toLowerCase().trim() === formData.title.toLowerCase().trim()
          );
          setTitleDuplicate(duplicate || null);
        } catch (error) {
          console.error('Error checking title duplicates:', error);
        }
      } else {
        setTitleDuplicate(null);
      }

      // Check URL
      if (formData.url && formData.url.length > 10) {
        try {
          const response = await fetch(`/sources.json`);
          const data = await response.json();
          const sources = Array.isArray(data) ? data : (data.sources || []);
          const duplicate = sources.find(s =>
            s.url && s.url.toLowerCase().trim() === formData.url.toLowerCase().trim()
          );
          setUrlDuplicate(duplicate || null);
        } catch (error) {
          console.error('Error checking URL duplicates:', error);
        }
      } else {
        setUrlDuplicate(null);
      }
    };

    const timeoutId = setTimeout(checkDuplicates, 500); // Debounce 500ms
    return () => clearTimeout(timeoutId);
  }, [formData.title, formData.url, isOpen, item]);

  // Autosave function for existing items
  const performAutosave = useCallback(async (dataToSave) => {
    if (!item?.id) return;

    setSaveStatus('saving');

    try {
      const response = await fetch(`/sources/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ source: dataToSave }),
      });

      if (response.ok) {
        lastSavedData.current = JSON.stringify(dataToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Autosave error:', error);
      setSaveStatus('error');
    }
  }, [item?.id]);

  // Handle close with pending save check
  const handleClose = useCallback(async () => {
    // If there's a pending save, save immediately before closing
    if (saveStatus === 'pending' && item?.id) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await performAutosave(formData);
    }
    // If currently saving, wait for it to complete
    else if (saveStatus === 'saving') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    onClose();
  }, [saveStatus, item?.id, formData, performAutosave, onClose]);

  // Debounced autosave effect
  useEffect(() => {
    if (!isOpen || !item?.id) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedData.current = JSON.stringify(formData);
      return;
    }

    // Skip if data hasn't changed
    if (JSON.stringify(formData) === lastSavedData.current) return;

    // Show pending state immediately when data changes
    setSaveStatus('pending');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(() => {
      performAutosave(formData);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, isOpen, item?.id, performAutosave]);

  // Autosave when PDF file is selected (for existing items)
  useEffect(() => {
    if (!isOpen || !item?.id || !pdfFile) return;

    const uploadPdf = async () => {
      setSaveStatus('saving');

      try {
        const formDataToSend = new FormData();
        formDataToSend.append('_method', 'PATCH');
        formDataToSend.append('source[pdf]', pdfFile);

        const response = await fetch(`/sources/${item.id}`, {
          method: 'POST',
          headers: {
            'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
          },
          body: formDataToSend,
        });

        if (response.ok) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('error');
        }
      } catch (error) {
        console.error('PDF upload error:', error);
        setSaveStatus('error');
      }
    };

    uploadPdf();
  }, [pdfFile, isOpen, item?.id]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setSaveStatus('idle');
      isInitialMount.current = true;
      setTitleDuplicate(null);
      setUrlDuplicate(null);
      setProcessedAuthorsData(null); // Reset author check state
      setProcessedConceptsData(null); // Reset concept check state
      setConceptSuggestions([]);
      setNewlyCreatedConcepts([]);
      fetchCollections();
      setCollectionFilter('');
      if (item) {
        fetchItemCollections(item.id);
        const newFormData = {
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
          access_date: item.access_date || ''
        };
        setFormData(newFormData);
        lastSavedData.current = JSON.stringify(newFormData);
      } else {
        setItemCollections([]);
        setFormData({
          title: '',
          authors: '',
          year: '',
          kind: 'article',
          methodologies: [],
          publisher_or_venue: '',
          doi: '',
          url: '',
          citation: '',
          summary: '',
          tags: [],
          concept_ids: [],
          person_ids: [],
          journal_name: '',
          volume: '',
          issue: '',
          pages: '',
          publication_date: '',
          abstract: '',
          keywords: [],
          book_title: '',
          edition: '',
          isbn: '',
          chapter_number: '',
          website_name: '',
          access_date: '',
          collection_ids: []
        });
      }
      setError('');
      setPdfFile(null);
    }
  }, [isOpen, item]);

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
    try {
      const url = item ? `/sources/${item.id}` : '/sources';
      const method = item ? 'PATCH' : 'POST';

      let requestBody;
      let headers = {
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
      };

      const dataToSend = { ...formData };
      if (processedAuthors) {
        dataToSend.processed_authors = processedAuthors;
        dataToSend.override_authors = true;
      }

      if (pdfFile) {
        const formDataToSend = new FormData();

        if (method === 'PATCH') {
          formDataToSend.append('_method', 'PATCH');
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

        formDataToSend.append('source[pdf]', pdfFile);
        requestBody = formDataToSend;
      } else {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify({ source: dataToSend });
      }

      const response = await fetch(url, {
        method: pdfFile && method === 'PATCH' ? 'POST' : method,
        headers,
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await response.json();
        setError(data.errors?.join(', ') || data.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error saving source:', error);
      setError('An error occurred while saving the source');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArrayInput = (field, value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, [field]: items });
  };

  const handleExtractMetadata = async () => {
    if (!extractUrl) {
      setError('Please enter a URL to extract metadata from');
      return;
    }

    setExtracting(true);
    setError('');

    try {
      const response = await fetch('/sources/extract_metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ url: extractUrl }),
      });

      if (response.ok) {
        const metadata = await response.json();

        // Keywords are stored as read-only metadata from the source
        // Concepts remain user-curated and unchanged by extraction
        setFormData({
          ...formData,
          title: metadata.title || '',
          authors: metadata.authors || '',
          year: metadata.year || '',
          kind: metadata.kind || 'article',
          journal_name: metadata.journal_name || '',
          volume: metadata.volume || '',
          issue: metadata.issue || '',
          pages: metadata.pages || '',
          doi: metadata.doi || '',
          url: metadata.url || extractUrl,
          abstract: metadata.abstract || '',
          keywords: metadata.keywords || [],
          publisher_or_venue: metadata.publisher_or_venue || '',
          book_title: metadata.book_title || '',
          edition: metadata.edition || '',
          isbn: metadata.isbn || '',
          website_name: metadata.website_name || '',
          summary: metadata.abstract || metadata.summary || '',
        });

        // Store structured author data for disambiguation modal
        setAuthorsData(metadata.authors_data || null);

        setExtractUrl('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to extract metadata');
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
      setError('An error occurred while extracting metadata');
    } finally {
      setExtracting(false);
    }
  };

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const response = await fetch('/collections.json');
      const data = await response.json();
      setCollections(data);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoadingCollections(false);
    }
  };

  const fetchItemCollections = async (sourceId) => {
    try {
      const response = await fetch(`/sources/${sourceId}.json`);
      const data = await response.json();
      setItemCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching item collections:', error);
    }
  };

  const handleAddToCollection = async (collectionId) => {
    if (!item?.id) return;

    try {
      const response = await fetch(`/collections/${collectionId}/add_item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          item_type: 'Source',
          item_id: item.id
        }),
      });

      if (response.ok) {
        const collection = collections.find(c => c.id === collectionId);
        if (collection && !itemCollections.find(c => c.id === collectionId)) {
          setItemCollections([...itemCollections, collection]);
        }
      }
    } catch (error) {
      console.error('Error adding to collection:', error);
    }
  };

  const handleRemoveFromCollection = async (collectionId) => {
    if (!item?.id) return;

    try {
      const response = await fetch(`/collections/${collectionId}/remove_item`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          item_type: 'Source',
          item_id: item.id
        }),
      });

      if (response.ok) {
        setItemCollections(itemCollections.filter(c => c.id !== collectionId));
      }
    } catch (error) {
      console.error('Error removing from collection:', error);
    }
  };

  const handleCreateCollection = async (name) => {
    if (!name.trim()) return;

    try {
      const response = await fetch('/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          collection: { name: name.trim() }
        }),
      });

      if (response.ok) {
        const newCollection = await response.json();
        setCollections([newCollection, ...collections]);
        setCollectionFilter('');
        if (item?.id) {
          handleAddToCollection(newCollection.id);
        }
        return newCollection;
      }
    } catch (error) {
      console.error('Error creating collection:', error);
    }
    return null;
  };

  const showArticleFields = formData.kind === 'article' || formData.kind === 'conference';
  const showBookFields = formData.kind === 'book';
  const showChapterFields = formData.kind === 'book_chapter';
  const showWebsiteFields = formData.kind === 'website' || formData.kind === 'video' || formData.kind === 'podcast';
  const showReportFields = formData.kind === 'report' || formData.kind === 'thesis' || formData.kind === 'dissertation';

  return (
    <>
      <SlidePanel
        isOpen={isOpen}
        onClose={handleClose}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                <i className="fas fa-book" style={{ fontSize: 'var(--text-base)', opacity: 0.9 }}></i>
                {item ? (formData.title || item.title || 'Untitled Source') : 'New Source'}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* Save Status - only show for editing */}
              {item && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  background: 'rgba(255,255,255,0.9)',
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: 'var(--radius)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-body)',
                }}>
                  {saveStatus === 'pending' && (
                    <>
                      <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--neutral-400)' }}></i>
                      <span style={{ color: 'var(--neutral-500)' }}>Save Pending...</span>
                    </>
                  )}
                  {saveStatus === 'saving' && (
                    <>
                      <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--accent-blue)' }}></i>
                      <span style={{ color: 'var(--accent-blue)' }}>Saving...</span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <i className="fas fa-check" style={{ color: 'var(--accent-green)' }}></i>
                      <span style={{ color: 'var(--accent-green)' }}>Saved</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <i className="fas fa-exclamation-circle" style={{ color: 'var(--error)' }}></i>
                      <span style={{ color: 'var(--error)' }}>Error</span>
                    </>
                  )}
                  {saveStatus === 'idle' && (
                    <span style={{ color: 'var(--neutral-400)' }}>Auto-save on</span>
                  )}
                </div>
              )}
              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
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
          </div>

          {error && (
            <div className="alert alert-error" style={{ margin: 'var(--space-4)', marginBottom: 0 }}>
              <span className="alert-title"><i className="fas fa-times-circle"></i> Error:</span>
              {error}
            </div>
          )}

          {/* Sidebar + Content Layout */}
          <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', position: 'relative' }}>
            {/* Left Sidebar Navigation */}
            <div className="w-12 md:w-[200px]" style={{
              background: '#e2e2e2',
              padding: 'var(--space-2)',
              paddingTop: 'var(--space-3)',
              flexShrink: 0,
              boxShadow: 'inset -8px 0 16px -8px rgba(0, 0, 0, 0.15)',
            }}>
              <div className="hidden md:block" style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--neutral-500)',
                marginBottom: 'var(--space-3)',
                fontFamily: 'var(--font-body)',
              }}>
                Sections
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className="justify-center md:justify-start"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-700)',
                  background: activeTab === 'basic' ? '#c8c8c8' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-body)',
                  marginBottom: '0.25rem',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'basic') e.currentTarget.style.background = '#d8d8d8';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'basic') e.currentTarget.style.background = 'transparent';
                }}
                title="Basic Info"
              >
                <i className="fas fa-info-circle" style={{ width: '16px' }}></i>
                <span className="hidden md:inline">Basic Info</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('publication')}
                className="justify-center md:justify-start"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-700)',
                  background: activeTab === 'publication' ? '#c8c8c8' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-body)',
                  marginBottom: '0.25rem',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'publication') e.currentTarget.style.background = '#d8d8d8';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'publication') e.currentTarget.style.background = 'transparent';
                }}
                title="Publication"
              >
                <i className="fas fa-book" style={{ width: '16px' }}></i>
                <span className="hidden md:inline">Publication</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('content')}
                className="justify-center md:justify-start"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-700)',
                  background: activeTab === 'content' ? '#c8c8c8' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-body)',
                  marginBottom: '0.25rem',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'content') e.currentTarget.style.background = '#d8d8d8';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'content') e.currentTarget.style.background = 'transparent';
                }}
                title="Content"
              >
                <i className="fas fa-file-alt" style={{ width: '16px' }}></i>
                <span className="hidden md:inline">Content</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('metadata')}
                className="justify-center md:justify-start"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-700)',
                  background: activeTab === 'metadata' ? '#c8c8c8' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-body)',
                  marginBottom: '0.25rem',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'metadata') e.currentTarget.style.background = '#d8d8d8';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'metadata') e.currentTarget.style.background = 'transparent';
                }}
                title="Connections"
              >
                <i className="fas fa-project-diagram" style={{ width: '16px' }}></i>
                <span className="hidden md:inline">Connections</span>
              </button>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', background: 'white' }}>
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--accent-blue)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    Basic Information
                  </h2>

                  {/* Quick Extract - Only for new sources */}
                  {!item && (
                    <div style={{
                      padding: 'var(--space-4)',
                      background: 'var(--accent-blue-light)',
                      borderRadius: '4px',
                      marginBottom: 'var(--space-6)',
                    }}>
                      <h3 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-lg)',
                        fontWeight: 600,
                        color: 'var(--accent-blue)',
                        marginBottom: 'var(--space-2)',
                      }}>
                        Quick Add from URL or DOI
                      </h3>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--neutral-700)',
                        marginBottom: 'var(--space-2)',
                      }}>
                        <strong>Best results:</strong> Use DOI directly (e.g., <span style={{ fontFamily: 'monospace' }}>10.1234/example</span>)
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-600)',
                        marginBottom: 'var(--space-3)',
                      }}>
                        Also works with: PubMed, arXiv, and open-access journal URLs. Note: Some paywalled sites heavily obfuscate content - use DOI for those.
                      </p>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <input
                          type="text"
                          value={extractUrl}
                          onChange={(e) => setExtractUrl(e.target.value)}
                          placeholder="DOI, doi.org link, or article URL..."
                          className="form-input"
                          style={{ flex: 1 }}
                          disabled={extracting}
                        />
                        <button
                          type="button"
                          onClick={handleExtractMetadata}
                          disabled={extracting || !extractUrl}
                          className="btn-primary"
                          style={{
                            background: 'var(--accent-blue)',
                            opacity: (extracting || !extractUrl) ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!extracting && extractUrl) e.currentTarget.style.background = 'var(--accent-blue-dark)';
                          }}
                          onMouseLeave={(e) => {
                            if (!extracting && extractUrl) e.currentTarget.style.background = 'var(--accent-blue)';
                          }}
                        >
                          {extracting ? 'Extracting...' : 'Extract'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                      <label className="form-label">Title *</label>
                      <textarea
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        rows="2"
                        className="form-input"
                        required
                        style={titleDuplicate ? { borderColor: '#d97706' } : {}}
                      />
                      {titleDuplicate && (
                        <div style={{
                          marginTop: 'var(--space-2)',
                          padding: 'var(--space-2) var(--space-3)',
                          background: '#fef3c7',
                          border: '1px solid #d97706',
                          borderRadius: '4px',
                          fontSize: 'var(--text-xs)',
                          color: '#92400e',
                          fontFamily: 'var(--font-body)',
                        }}>
                          <i className="fas fa-exclamation-triangle" style={{ marginRight: 'var(--space-2)' }}></i>
                          Possible duplicate: <a href={`/sources/${titleDuplicate.id}`} target="_blank" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{titleDuplicate.title}</a>
                        </div>
                      )}
                    </div>

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

                    <div>
                      <label className="form-label">URL</label>
                      <input
                        type="url"
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        className="form-input"
                        placeholder="https://..."
                        style={urlDuplicate ? { borderColor: '#d97706' } : {}}
                      />
                      {urlDuplicate && (
                        <div style={{
                          marginTop: 'var(--space-2)',
                          padding: 'var(--space-2) var(--space-3)',
                          background: '#fef3c7',
                          border: '1px solid #d97706',
                          borderRadius: '4px',
                          fontSize: 'var(--text-xs)',
                          color: '#92400e',
                          fontFamily: 'var(--font-body)',
                        }}>
                          <i className="fas fa-exclamation-triangle" style={{ marginRight: 'var(--space-2)' }}></i>
                          This URL already exists: <a href={`/sources/${urlDuplicate.id}`} target="_blank" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{urlDuplicate.title}</a>
                        </div>
                      )}
                    </div>

                    {/* Authors */}
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--accent-gold)',
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
                      <div style={{ height: formData.person_ids.length > 0 ? '280px' : '200px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                        <PeopleSelector
                          selectedPersonIds={formData.person_ids}
                          onChange={(person_ids) => setFormData({ ...formData, person_ids })}
                          themeColor="var(--accent-gold)"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">PDF File</label>
                      {item?.pdf_url && !pdfFile && (
                        <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ color: 'var(--neutral-600)' }}>Current file: </span>
                          <a
                            href={item.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}
                          >
                            {item.pdf_filename}
                          </a>
                        </div>
                      )}
                      {pdfFile && (
                        <div style={{
                          marginBottom: 'var(--space-2)',
                          padding: 'var(--space-3)',
                          background: 'var(--accent-blue-light)',
                          borderRadius: '4px',
                          border: '1px solid #d1cec6',
                        }}>
                          <p style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 500,
                            color: 'var(--accent-blue)',
                          }}>
                            Selected: {pdfFile.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => setPdfFile(null)}
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 'var(--text-xs)',
                              color: 'var(--accent-blue-dark)',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              marginTop: 'var(--space-1)',
                              textDecoration: 'underline',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setPdfFile(e.target.files[0])}
                        className="form-input"
                        style={{ padding: 'var(--space-2)' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Publication Tab */}
              {activeTab === 'publication' && (
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--accent-blue)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    Publication Details
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {showArticleFields && (
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
                            <label className="form-label">Publication Date</label>
                            <input
                              type="date"
                              value={formData.publication_date}
                              onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
                              className="form-input"
                            />
                          </div>
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
                      </>
                    )}

                    {showBookFields && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                          <div>
                            <label className="form-label">Publisher</label>
                            <input
                              type="text"
                              value={formData.publisher_or_venue}
                              onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                              className="form-input"
                              placeholder="Wiley"
                            />
                          </div>

                          <div>
                            <label className="form-label">Edition</label>
                            <input
                              type="text"
                              value={formData.edition}
                              onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                              className="form-input"
                              placeholder="3rd ed."
                            />
                          </div>
                        </div>

                        <div>
                          <label className="form-label">ISBN</label>
                          <input
                            type="text"
                            value={formData.isbn}
                            onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                            className="form-input"
                            placeholder="978-0-123456-78-9"
                          />
                        </div>
                      </>
                    )}

                    {showChapterFields && (
                      <>
                        <div>
                          <label className="form-label">Book Title</label>
                          <input
                            type="text"
                            value={formData.book_title}
                            onChange={(e) => setFormData({ ...formData, book_title: e.target.value })}
                            className="form-input"
                            placeholder="Handbook of Clinical Psychology"
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                          <div>
                            <label className="form-label">Chapter Number</label>
                            <input
                              type="number"
                              value={formData.chapter_number}
                              onChange={(e) => setFormData({ ...formData, chapter_number: e.target.value })}
                              className="form-input"
                              placeholder="5"
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

                          <div>
                            <label className="form-label">Edition</label>
                            <input
                              type="text"
                              value={formData.edition}
                              onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                              className="form-input"
                              placeholder="2nd ed."
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                          <div>
                            <label className="form-label">Publisher</label>
                            <input
                              type="text"
                              value={formData.publisher_or_venue}
                              onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                              className="form-input"
                            />
                          </div>

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
                        </div>
                      </>
                    )}

                    {showWebsiteFields && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                          <div>
                            <label className="form-label">Website Name</label>
                            <input
                              type="text"
                              value={formData.website_name}
                              onChange={(e) => setFormData({ ...formData, website_name: e.target.value })}
                              className="form-input"
                              placeholder="YouTube, Vimeo, etc."
                            />
                          </div>

                          <div>
                            <label className="form-label">Access Date</label>
                            <input
                              type="date"
                              value={formData.access_date}
                              onChange={(e) => setFormData({ ...formData, access_date: e.target.value })}
                              className="form-input"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {showReportFields && (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                          <div>
                            <label className="form-label">
                              {formData.kind === 'thesis' || formData.kind === 'dissertation' ? 'University' : 'Publisher/Organization'}
                            </label>
                            <input
                              type="text"
                              value={formData.publisher_or_venue}
                              onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                              className="form-input"
                              placeholder={formData.kind === 'thesis' || formData.kind === 'dissertation' ? 'University name' : 'Publisher or organization'}
                            />
                          </div>

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
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Content Tab */}
              {activeTab === 'content' && (
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--accent-blue)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    Content
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                      <label className="form-label">Abstract</label>
                      <RichTextEditor
                        value={formData.abstract}
                        onChange={(html) => setFormData({ ...formData, abstract: html })}
                        placeholder="Full abstract from the source..."
                        rows={6}
                        themeColor="var(--accent-blue)"
                      />
                    </div>

                    <div>
                      <label className="form-label">Summary (3-5 lines of key findings)</label>
                      <RichTextEditor
                        value={formData.summary}
                        onChange={(html) => setFormData({ ...formData, summary: html })}
                        placeholder="Key findings and takeaways..."
                        rows={4}
                        themeColor="var(--accent-blue)"
                      />
                    </div>

                    <div>
                      <label className="form-label">Research Type(s)</label>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-4)',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: '4px',
                        background: 'white',
                        maxHeight: '12rem',
                        overflowY: 'auto',
                      }}>
                        {[
                          'Case study',
                          'Cohort study',
                          'Computational modeling',
                          'Cross-sectional',
                          'Experimental',
                          'Literature review',
                          'Longitudinal',
                          'Meta-analysis',
                          'Mixed methods',
                          'Natural experiment',
                          'Observational',
                          'Pilot study',
                          'Predictive modeling',
                          'Psychometrics',
                          'Qualitative',
                          'Quantitative',
                          'Quasi-experimental',
                          'RCT',
                          'Replication study',
                          'Secondary data analysis',
                          'Systematic review',
                          'Theoretical paper'
                        ].map(methodology => (
                          <label key={methodology} style={{
                            fontFamily: 'var(--font-body)',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: 'var(--text-sm)',
                          }}>
                            <input
                              type="checkbox"
                              checked={formData.methodologies.includes(methodology)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    methodologies: [...formData.methodologies, methodology]
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    methodologies: formData.methodologies.filter(m => m !== methodology)
                                  });
                                }
                              }}
                              style={{ marginRight: 'var(--space-2)', accentColor: 'var(--accent-blue)' }}
                            />
                            {methodology}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Connections Tab */}
              {activeTab === 'metadata' && (
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--accent-blue)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    Connections
                  </h2>

                  {/* Row 1: Concepts and People */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    {/* Concepts */}
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--accent-green)',
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
                      <div style={{ height: formData.concept_ids.length > 0 ? '360px' : '280px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                        <ConceptSelector
                          selectedConceptIds={formData.concept_ids}
                          onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                          themeColor="var(--accent-green)"
                          newConcepts={newlyCreatedConcepts}
                        />
                      </div>
                    </div>

                    {/* People */}
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--accent-gold)',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}>
                        <i className="fas fa-user" style={{ fontSize: 'var(--text-sm)' }}></i>
                        People
                      </div>
                      <div style={{ height: formData.person_ids.length > 0 ? '360px' : '280px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                        <PeopleSelector
                          selectedPersonIds={formData.person_ids}
                          onChange={(person_ids) => setFormData({ ...formData, person_ids })}
                          themeColor="var(--accent-gold)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Tags and Collections */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    {/* Tags */}
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--accent-purple)',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}>
                        <i className="fas fa-tag" style={{ fontSize: 'var(--text-sm)' }}></i>
                        Tags
                      </div>
                      <div style={{ height: formData.tags.length > 0 ? '360px' : '280px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
                        <TagSelector
                          selectedTags={formData.tags}
                          onChange={(tags) => setFormData({ ...formData, tags })}
                          themeColor="var(--accent-purple)"
                        />
                      </div>
                    </div>

                    {/* Collections */}
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--accent-maroon)',
                        marginBottom: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}>
                        <i className="fas fa-folder" style={{ fontSize: 'var(--text-sm)' }}></i>
                        Collections
                      </div>
                      <div style={{ height: (item ? itemCollections.length > 0 : formData.collection_ids.length > 0) ? '360px' : '280px', overflow: 'hidden', transition: 'height 0.2s ease' }}>
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
                          themeColor="var(--accent-maroon)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - only show for new sources, editing uses autosave */}
          {!item && (
            <div style={{
              borderTop: '1px solid var(--neutral-200)',
              background: 'white',
              padding: 'var(--space-4) var(--space-6)',
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
                disabled={submitting}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: submitting ? 'var(--neutral-300)' : 'var(--accent-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 500,
                  cursor: submitting ? 'not-allowed' : 'pointer',
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
