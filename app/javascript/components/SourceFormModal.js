import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import TagSelector from './TagSelector';
import ConceptSelector from './ConceptSelector';
import AuthorDisambiguationModal from './AuthorDisambiguationModal';

export default function SourceFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    year: '',
    kind: 'article',
    publisher_or_venue: '',
    doi: '',
    url: '',
    citation: '',
    summary: '',
    tags: [],
    concept_ids: [],
    // Article-specific
    journal_name: '',
    volume: '',
    issue: '',
    pages: '',
    publication_date: '',
    abstract: '',
    keywords: [],
    // Book-specific
    book_title: '',
    edition: '',
    isbn: '',
    chapter_number: '',
    // Website-specific
    website_name: '',
    access_date: ''
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [extractUrl, setExtractUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [parsedAuthors, setParsedAuthors] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          title: item.title || '',
          authors: item.authors || '',
          year: item.year || '',
          kind: item.kind || 'article',
          publisher_or_venue: item.publisher_or_venue || '',
          doi: item.doi || '',
          url: item.url || '',
          citation: item.citation || '',
          summary: item.summary || '',
          tags: item.tags || [],
          concept_ids: item.concept_ids || [],
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
          publisher_or_venue: '',
          doi: '',
          url: '',
          citation: '',
          summary: '',
          tags: [],
          concept_ids: [],
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
    if (!authorsString || authorsString.trim() === '') return [];

    // Split on pattern: period, comma, space, capital letter (start of next author)
    return authorsString.split(/\.\s*,\s*(?=[A-Z])/).map(author => author.trim() + '.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Parse authors and show disambiguation modal if there are any
    const authors = parseAuthors(formData.authors);
    if (authors.length > 0) {
      setParsedAuthors(authors);
      setShowAuthorModal(true);
    } else {
      // No authors, proceed directly
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
      }

      // Use FormData if we have a PDF file, otherwise use JSON
      if (pdfFile) {
        const formDataToSend = new FormData();

        // Append all form fields
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

        // Append PDF file
        formDataToSend.append('source[pdf]', pdfFile);

        requestBody = formDataToSend;
      } else {
        headers['Content-Type'] = 'application/json';
        requestBody = JSON.stringify({ source: dataToSend });
      }

      const response = await fetch(url, {
        method,
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

        // Populate form with extracted metadata
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

  const showArticleFields = formData.kind === 'article' || formData.kind === 'rct' || formData.kind === 'meta_analysis';
  const showBookFields = formData.kind === 'textbook' || formData.kind === 'manual';
  const showChapterFields = formData.kind === 'chapter';
  const showWebsiteFields = formData.kind === 'video_demo';

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'publication', label: 'Publication' },
    { id: 'content', label: 'Content' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'files', label: 'Files' }
  ];

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Source' : 'New Source'}
      size="large"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* URL Extraction */}
        {!item && (
          <div className="space-y-3 pb-4 mb-4 border-b border-gray-200 bg-blue-50 p-4 rounded">
            <h3 className="text-lg font-medium text-blue-900">Quick Add from URL or DOI</h3>
            <p className="text-sm text-blue-700">
              <strong>Best results:</strong> Use DOI directly (e.g., <span className="font-mono">10.1234/example</span>)
            </p>
            <p className="text-xs text-blue-600 mb-2">
              Also works with: PubMed, arXiv, and open-access journal URLs. Note: Some paywalled sites heavily obfuscate content - use DOI for those.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={extractUrl}
                onChange={(e) => setExtractUrl(e.target.value)}
                placeholder="DOI, doi.org link, or article URL..."
                className="flex-1 px-4 py-2 border border-blue-300 rounded bg-white"
                disabled={extracting}
              />
              <button
                type="button"
                onClick={handleExtractMetadata}
                disabled={extracting || !extractUrl}
                className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {extracting ? 'Extracting...' : 'Extract'}
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary font-medium'
                  : 'text-gray-600 hover:text-primary'
              }`}
              style={{ background: 'transparent' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Tab Content */}
        <div className="overflow-y-auto px-1 flex-1">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Authors</label>
                  <input
                    type="text"
                    value={formData.authors}
                    onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                    placeholder="Last, F., Last, F."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                    placeholder="2024"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Source Type *</label>
                  <select
                    value={formData.kind}
                    onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  >
                    <option value="article">Article</option>
                    <option value="rct">RCT (Research Study)</option>
                    <option value="meta_analysis">Meta-Analysis</option>
                    <option value="textbook">Textbook</option>
                    <option value="chapter">Book Chapter</option>
                    <option value="manual">Manual</option>
                    <option value="guideline">Guideline</option>
                    <option value="video_demo">Video/Website</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Publication Tab */}
          {activeTab === 'publication' && (
            <div className="space-y-4">
              {/* Article-specific fields */}
              {showArticleFields && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Journal Name</label>
                    <input
                      type="text"
                      value={formData.journal_name}
                      onChange={(e) => setFormData({ ...formData, journal_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                      placeholder="e.g., Journal of Clinical Psychology"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Volume</label>
                      <input
                        type="text"
                        value={formData.volume}
                        onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="42"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Issue</label>
                      <input
                        type="text"
                        value={formData.issue}
                        onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Pages</label>
                      <input
                        type="text"
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="123-145"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">DOI</label>
                      <input
                        type="text"
                        value={formData.doi}
                        onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="10.1000/example"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Publication Date</label>
                      <input
                        type="date"
                        value={formData.publication_date}
                        onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Keywords (one per line)</label>
                    <textarea
                      value={formData.keywords.join('\n')}
                      onChange={(e) => handleArrayInput('keywords', e.target.value)}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                      placeholder="machine learning&#10;neural networks&#10;cognitive therapy"
                    />
                  </div>
                </>
              )}

              {/* Book-specific fields */}
              {showBookFields && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Publisher</label>
                      <input
                        type="text"
                        value={formData.publisher_or_venue}
                        onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="Wiley"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Edition</label>
                      <input
                        type="text"
                        value={formData.edition}
                        onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="3rd ed."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">ISBN</label>
                    <input
                      type="text"
                      value={formData.isbn}
                      onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                      placeholder="978-0-123456-78-9"
                    />
                  </div>
                </>
              )}

              {/* Chapter-specific fields */}
              {showChapterFields && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Book Title</label>
                    <input
                      type="text"
                      value={formData.book_title}
                      onChange={(e) => setFormData({ ...formData, book_title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                      placeholder="Handbook of Clinical Psychology"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Chapter Number</label>
                      <input
                        type="number"
                        value={formData.chapter_number}
                        onChange={(e) => setFormData({ ...formData, chapter_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Pages</label>
                      <input
                        type="text"
                        value={formData.pages}
                        onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="123-145"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Edition</label>
                      <input
                        type="text"
                        value={formData.edition}
                        onChange={(e) => setFormData({ ...formData, edition: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="2nd ed."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Publisher</label>
                      <input
                        type="text"
                        value={formData.publisher_or_venue}
                        onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">DOI</label>
                      <input
                        type="text"
                        value={formData.doi}
                        onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="10.1000/example"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Website-specific fields */}
              {showWebsiteFields && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Website Name</label>
                      <input
                        type="text"
                        value={formData.website_name}
                        onChange={(e) => setFormData({ ...formData, website_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                        placeholder="YouTube, Vimeo, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Access Date</label>
                      <input
                        type="date"
                        value={formData.access_date}
                        onChange={(e) => setFormData({ ...formData, access_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Abstract</label>
                <textarea
                  value={formData.abstract}
                  onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                  rows="6"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                  placeholder="Full abstract from the source..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Summary (3-5 lines of key findings)
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
          )}

          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Concepts
                </label>
                <ConceptSelector
                  selectedConceptIds={formData.concept_ids}
                  onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Tags
                </label>
                <TagSelector
                  selectedTags={formData.tags}
                  onChange={(tags) => setFormData({ ...formData, tags })}
                />
              </div>
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  PDF File
                </label>
                {item?.pdf_url && !pdfFile && (
                  <div className="mb-2 text-sm">
                    <span className="text-gray-600">Current file: </span>
                    <a
                      href={item.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-accent-dark"
                    >
                      {item.pdf_filename}
                    </a>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files[0])}
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-sand file:text-primary hover:file:bg-primary hover:file:text-sand"
                />
                {pdfFile && (
                  <p className="mt-1 text-sm text-gray-600">
                    Selected: {pdfFile.name}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Source'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
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
