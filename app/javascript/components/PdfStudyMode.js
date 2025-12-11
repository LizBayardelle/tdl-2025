import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Multi-select with create component
function MultiSelectWithCreate({ options, selected, onChange, placeholder, labelKey = 'label', valueKey = 'id', maxSelections = null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt[labelKey].toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      // If no exact match exists, create new tag
      const exactMatch = options.find(opt =>
        opt[labelKey].toLowerCase() === searchTerm.toLowerCase()
      );
      if (!exactMatch) {
        const newTag = { [labelKey]: searchTerm.trim(), [valueKey]: `new_${Date.now()}` };
        onChange([...selected, newTag]);
        setSearchTerm('');
      }
    }
  };

  const toggleSelection = (option) => {
    const isSelected = selected.some(s => s[valueKey] === option[valueKey]);
    if (isSelected) {
      onChange(selected.filter(s => s[valueKey] !== option[valueKey]));
    } else {
      if (maxSelections && selected.length >= maxSelections) {
        // Replace the last item if at max
        onChange([...selected.slice(0, maxSelections - 1), option]);
      } else {
        onChange([...selected, option]);
      }
    }
  };

  const removeItem = (option) => {
    onChange(selected.filter(s => s[valueKey] !== option[valueKey]));
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map(item => (
            <span
              key={item[valueKey]}
              className="text-xs bg-sand text-primary px-2 py-1 rounded flex items-center gap-1"
            >
              {item[labelKey]}
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="hover:text-accent-dark"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length === 0 && searchTerm.trim() ? (
            <div className="px-3 py-2 text-xs text-gray-500">
              Press Enter to create "{searchTerm}"
            </div>
          ) : (
            filteredOptions.map(option => {
              const isSelected = selected.some(s => s[valueKey] === option[valueKey]);
              return (
                <label
                  key={option[valueKey]}
                  className="flex items-center px-3 py-2 hover:bg-sand cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(option)}
                    className="mr-2"
                  />
                  {option[labelKey]}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function PdfStudyMode({ sourceId, sourceTitle, pdfUrl }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [notes, setNotes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState({ title: '', body: '' });
  const [selectedConcepts, setSelectedConcepts] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState('recent');

  useEffect(() => {
    fetchNotes();
    fetchConcepts();
    fetchTags();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/notes.json?source_id=${sourceId}`);
      const data = await response.json();
      setNotes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/tags.json');
      const data = await response.json();
      setTags(data.map(tag => ({ id: tag.name, name: tag.name })));
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.body.trim()) return;

    setSaving(true);
    try {
      const tagsArray = selectedTags.map(tag => tag.name);

      // Handle concept - create new ones if needed
      let conceptId = null;
      if (selectedConcepts.length > 0) {
        const firstConcept = selectedConcepts[0];

        // Check if this is a new concept (temporary ID starts with "new_")
        if (String(firstConcept.id).startsWith('new_')) {
          // Create the concept first
          const conceptResponse = await fetch('/concepts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({
              concept: {
                label: firstConcept.label,
                node_type: 'construct'
              }
            }),
          });

          if (conceptResponse.ok) {
            const newConcept = await conceptResponse.json();
            conceptId = newConcept.id;
            // Update concepts list with the new one
            setConcepts([...concepts, newConcept]);
          }
        } else {
          conceptId = firstConcept.id;
        }
      }

      const response = await fetch('/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          note: {
            title: newNote.title,
            body: newNote.body,
            source_id: sourceId,
            concept_id: conceptId,
            tags: tagsArray,
          }
        }),
      });

      if (response.ok) {
        const savedNote = await response.json();
        setNotes([savedNote, ...notes]);
        setNewNote({ title: '', body: '' });
        setSelectedConcepts([]);
        setSelectedTags([]);
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleClose = () => {
    window.location.href = `/sources/${sourceId}`;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl text-gray-600">No PDF available for this source</p>
          <button
            onClick={handleClose}
            className="mt-4 btn-secondary"
          >
            Back to Source
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* PDF Viewer - Left Side */}
      <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-medium flex-1 leading-snug" style={{ color: 'white' }}>{sourceTitle}</h1>
          <button
            onClick={handleClose}
            className="ml-4 btn-secondary flex-shrink-0"
          >
            <i className="fas fa-times mr-2"></i>
            Close (Esc)
          </button>
        </div>

        {/* PDF Controls */}
        <div className="bg-white border-b border-gray-300 px-6 py-3 flex items-center justify-between">
          <span className="text-sm">
            {numPages ? `${numPages} pages` : 'Loading...'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="px-3 py-1 bg-sand rounded hover:bg-khaki transition-colors"
            >
              <i className="fas fa-minus"></i>
            </button>
            <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
              className="px-3 py-1 bg-sand rounded hover:bg-khaki transition-colors"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>

        {/* PDF Document - All Pages */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center gap-4">
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div key={`page_${index + 1}`} className="shadow-lg mb-4">
                <Page
                  pageNumber={index + 1}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
          </Document>
        </div>
      </div>

      {/* Notes Sidebar - Right Side */}
      <div className="w-96 bg-sand border-l border-gray-300 flex flex-col overflow-hidden">
        {/* New Note Form */}
        <div className="p-6 bg-white border-b border-gray-300">
          <h2 className="text-xl font-medium mb-4">Create Note</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              placeholder="Note title (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
            />
            <textarea
              value={newNote.body}
              onChange={(e) => setNewNote({ ...newNote, body: e.target.value })}
              placeholder="Note content..."
              rows="6"
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <MultiSelectWithCreate
                options={concepts}
                selected={selectedConcepts}
                onChange={setSelectedConcepts}
                placeholder="Constructs"
                labelKey="label"
                valueKey="id"
              />
              <MultiSelectWithCreate
                options={tags}
                selected={selectedTags}
                onChange={setSelectedTags}
                placeholder="Tags"
                labelKey="name"
                valueKey="id"
              />
            </div>
            <button
              onClick={handleSaveNote}
              disabled={saving || !newNote.body.trim()}
              className="w-full btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">
              Notes ({notes.length})
            </h2>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">First Created</option>
            </select>
          </div>
          {loading ? (
            <p className="text-sm text-gray-600">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-600">No notes yet. Create your first note above!</p>
          ) : (
            <div className="space-y-3">
              {[...notes].sort((a, b) => {
                if (sortOrder === 'recent') {
                  return new Date(b.created_at) - new Date(a.created_at);
                } else {
                  return new Date(a.created_at) - new Date(b.created_at);
                }
              }).map(note => (
                <div
                  key={note.id}
                  className="bg-white border border-gray-300 rounded p-4"
                >
                  {note.title && (
                    <h3 className="font-medium text-sm mb-2">{note.title}</h3>
                  )}
                  <div
                    className="text-sm text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: note.body }}
                  />
                  {(note.concept || note.tags?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.concept && (
                        <span className="text-xs bg-accent-dark text-sand px-2 py-1 rounded">
                          {note.concept.label}
                        </span>
                      )}
                      {note.tags?.map((tag, idx) => (
                        <span key={idx} className="text-xs bg-primary text-sand px-2 py-1 rounded">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(note.created_at).toLocaleDateString()} at {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
