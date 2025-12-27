import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import TagSelector from './TagSelector';
import ConceptSelector from './ConceptSelector';
import PeopleSelector from './PeopleSelector';
import AuthorDisambiguationModal from './AuthorDisambiguationModal';
import RichTextEditor from './RichTextEditor';

export default function SourceFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basic');
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
    access_date: ''
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [parsedAuthors, setParsedAuthors] = useState([]);
  const [titleDuplicate, setTitleDuplicate] = useState(null);
  const [urlDuplicate, setUrlDuplicate] = useState(null);

  // Debounced duplicate checking
  useEffect(() => {
    if (!isOpen || item) return; // Only check for new sources

    const checkDuplicates = async () => {
      // Check title
      if (formData.title && formData.title.length > 10) {
        try {
          const response = await fetch(`/sources.json`);
          const sources = await response.json();
          const duplicate = sources.find(s =>
            s.title.toLowerCase().trim() === formData.title.toLowerCase().trim()
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
          const sources = await response.json();
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

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setTitleDuplicate(null);
      setUrlDuplicate(null);
      if (item) {
        setFormData({
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
        });
      } else {
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
          access_date: ''
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
    if (authors.length > 0) {
      setParsedAuthors(authors);
      setShowAuthorModal(true);
    } else {
      await performSave();
    }
  };

  const handleAuthorConfirm = async (processedAuthors) => {
    setShowAuthorModal(false);
    await performSave(processedAuthors);
  };

  const performSave = async (processedAuthors = null) => {
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
          tags: metadata.keywords || []
        });

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

  const showArticleFields = formData.kind === 'article' || formData.kind === 'conference';
  const showBookFields = formData.kind === 'book';
  const showChapterFields = formData.kind === 'book_chapter';
  const showWebsiteFields = formData.kind === 'website' || formData.kind === 'video' || formData.kind === 'podcast';
  const showReportFields = formData.kind === 'report' || formData.kind === 'thesis' || formData.kind === 'dissertation';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={item ? 'Edit Source' : 'New Source'}
        size="large"
        hideHeader={true}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {error && (
            <div className="alert alert-error" style={{ margin: 'var(--space-4)', marginBottom: 0 }}>
              <span className="alert-title"><i className="fas fa-times-circle"></i> Error:</span>
              {error}
            </div>
          )}

          {/* Sidebar + Content Layout */}
          <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden' }}>
            {/* Left Sidebar Navigation */}
            <div className="w-12 md:w-[200px]" style={{
              background: 'var(--sidebar-bg)',
              padding: 'var(--space-2)',
              paddingTop: 'var(--space-6)',
              flexShrink: 0,
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
                  color: 'var(--accent-blue)',
                  background: activeTab === 'basic' ? 'var(--neutral-200)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font-body)',
                  fontWeight: activeTab === 'basic' ? 600 : 400,
                  marginBottom: 'var(--space-1)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'basic') e.currentTarget.style.background = 'var(--neutral-100)';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'basic') e.currentTarget.style.background = 'transparent';
                }}
                title="Basic Info"
              >
                <i className="fas fa-info-circle" style={{ width: '16px', color: 'var(--accent-blue)' }}></i>
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
                  color: 'var(--accent-blue)',
                  background: activeTab === 'publication' ? 'var(--neutral-200)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font-body)',
                  fontWeight: activeTab === 'publication' ? 600 : 400,
                  marginBottom: 'var(--space-1)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'publication') e.currentTarget.style.background = 'var(--neutral-100)';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'publication') e.currentTarget.style.background = 'transparent';
                }}
                title="Publication"
              >
                <i className="fas fa-book" style={{ width: '16px', color: 'var(--accent-blue)' }}></i>
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
                  color: 'var(--accent-blue)',
                  background: activeTab === 'content' ? 'var(--neutral-200)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font-body)',
                  fontWeight: activeTab === 'content' ? 600 : 400,
                  marginBottom: 'var(--space-1)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'content') e.currentTarget.style.background = 'var(--neutral-100)';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'content') e.currentTarget.style.background = 'transparent';
                }}
                title="Content"
              >
                <i className="fas fa-file-alt" style={{ width: '16px', color: 'var(--accent-blue)' }}></i>
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
                  color: 'var(--accent-blue)',
                  background: activeTab === 'metadata' ? 'var(--neutral-200)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font-body)',
                  fontWeight: activeTab === 'metadata' ? 600 : 400,
                  marginBottom: 'var(--space-1)',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== 'metadata') e.currentTarget.style.background = 'var(--neutral-100)';
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== 'metadata') e.currentTarget.style.background = 'transparent';
                }}
                title="Concepts & Tags"
              >
                <i className="fas fa-tags" style={{ width: '16px', color: 'var(--accent-blue)' }}></i>
                <span className="hidden md:inline">Concepts & Tags</span>
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

                    <div>
                      <label className="form-label">
                        Authors String <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--neutral-500)' }}>(optional - or use selector below)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.authors}
                        onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                        className="form-input"
                        placeholder="Last, F., Last, F."
                      />
                    </div>

                    <div>
                      <label className="form-label">Authors (select or create)</label>
                      <div style={{ height: '16rem' }}>
                        <PeopleSelector
                          selectedPersonIds={formData.person_ids}
                          onChange={(person_ids) => setFormData({ ...formData, person_ids })}
                          themeColor="var(--accent-blue)"
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

                        <div>
                          <label className="form-label">Keywords (one per line)</label>
                          <textarea
                            value={formData.keywords.join('\n')}
                            onChange={(e) => handleArrayInput('keywords', e.target.value)}
                            rows="3"
                            className="form-textarea"
                            placeholder="machine learning&#10;neural networks&#10;cognitive therapy"
                          />
                        </div>
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

              {/* Concepts & Tags Tab */}
              {activeTab === 'metadata' && (
                <div>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--accent-blue)',
                    marginBottom: 'var(--space-4)',
                  }}>
                    Concepts & Tags
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label className="form-label">Concepts</label>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <ConceptSelector
                          selectedConceptIds={formData.concept_ids}
                          onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label className="form-label">Tags</label>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <TagSelector
                          selectedTags={formData.tags}
                          onChange={(tags) => setFormData({ ...formData, tags })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with Buttons */}
          <div style={{
            borderTop: '1px solid var(--neutral-200)',
            padding: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-3)',
          }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ background: 'var(--accent-blue)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-blue-dark)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-blue)'}
            >
              {item ? 'Save Changes' : 'Create Source'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <AuthorDisambiguationModal
        isOpen={showAuthorModal}
        onClose={() => setShowAuthorModal(false)}
        authors={parsedAuthors}
        onConfirm={handleAuthorConfirm}
      />
    </>
  );
}
