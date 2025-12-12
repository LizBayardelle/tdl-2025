import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ColorSchemeManager from './ColorSchemeManager';

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
  const [showColorManager, setShowColorManager] = useState(false);
  const [highlightColors, setHighlightColors] = useState([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selection, setSelection] = useState(null);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [highlights, setHighlights] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteData, setEditingNoteData] = useState({ title: '', body: '' });
  const [editingConcepts, setEditingConcepts] = useState([]);
  const [editingTags, setEditingTags] = useState([]);

  useEffect(() => {
    fetchNotes();
    fetchConcepts();
    fetchTags();
    fetchHighlightColors();
    fetchHighlights();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/notes.json?source_id=${sourceId}`);
      const data = await response.json();
      console.log('Fetched notes:', data);
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

  const fetchHighlightColors = async () => {
    try {
      const response = await fetch('/highlight_colors.json');
      const data = await response.json();
      setHighlightColors(data);
    } catch (error) {
      console.error('Error fetching highlight colors:', error);
    }
  };

  const fetchHighlights = async () => {
    try {
      const response = await fetch(`/highlights.json?source_id=${sourceId}`);
      const data = await response.json();
      setHighlights(data);
    } catch (error) {
      console.error('Error fetching highlights:', error);
    }
  };

  const applyHighlights = () => {
    console.log('Applying highlights:', highlights.length);

    highlights.forEach(highlight => {
      const textLayers = document.querySelectorAll('.textLayer');

      // Normalize the highlight text - collapse all whitespace
      const highlightText = highlight.text_content.replace(/\s+/g, ' ').trim().toLowerCase();
      console.log('Looking for:', highlightText.substring(0, 60) + '...');

      textLayers.forEach((textLayer, layerIndex) => {
        // Normalize layer text the same way
        const layerText = textLayer.textContent.replace(/\s+/g, ' ').trim().toLowerCase();

        if (layerText.includes(highlightText)) {
          console.log('✓ Found in layer', layerIndex);

          // Get all spans in order and build up text to find matches
          const spans = Array.from(textLayer.querySelectorAll('span:not(.markedContent)'));
          let currentText = '';
          const startIndex = layerText.indexOf(highlightText);
          const endIndex = startIndex + highlightText.length;

          spans.forEach((span, spanIndex) => {
            const spanText = span.textContent;
            const beforeLength = currentText.length;
            // Normalize as we build to match layerText
            currentText += spanText.replace(/\s+/g, ' ');
            const afterLength = currentText.length;

            // Check if this span overlaps with the highlight range
            if (beforeLength <= endIndex && afterLength >= startIndex) {
              if (!span.dataset.highlighted) {
                span.style.backgroundColor = highlight.color_hex;
                span.style.mixBlendMode = 'multiply';
                span.dataset.highlighted = 'true';
                console.log('  → Highlighted:', spanText.trim().substring(0, 40));
              }
            }
          });
        }
      });
    });
  };

  const handleSaveNote = async () => {
    if (!newNote.body.trim()) return;

    setSaving(true);
    try {
      const tagsArray = selectedTags.map(tag => tag.name);

      // Handle concepts - create new ones if needed
      const conceptIds = [];
      for (const concept of selectedConcepts) {
        // Check if this is a new concept (temporary ID starts with "new_")
        if (String(concept.id).startsWith('new_')) {
          // Create the concept first
          const conceptResponse = await fetch('/concepts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({
              concept: {
                label: concept.label,
                node_type: 'construct'
              }
            }),
          });

          if (conceptResponse.ok) {
            const newConcept = await conceptResponse.json();
            conceptIds.push(newConcept.id);
            // Update concepts list with the new one
            setConcepts([...concepts, newConcept]);
          }
        } else {
          conceptIds.push(concept.id);
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
            concept_ids: conceptIds,
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

        // Clear the contenteditable div
        const noteEditor = document.querySelector('[contenteditable]');
        if (noteEditor) {
          noteEditor.innerHTML = '';
        }
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

  const handleTextSelection = () => {
    const sel = window.getSelection();
    const selectedText = sel.toString().trim();

    if (selectedText.length > 0) {
      // Get the selection's bounding rect
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Store selection details
      setSelection({
        text: selectedText,
        range: range,
        rect: rect
      });

      // Position the popup near the selection
      setPickerPosition({
        x: rect.left + (rect.width / 2),
        y: rect.bottom + 5
      });

      setShowColorPicker(true);
    } else {
      setShowColorPicker(false);
    }
  };

  const handleAddQuote = (color = null) => {
    if (!selection) return;

    // Format as HTML blockquote with page number and optional color
    const borderColor = color ? color.color_hex : '#414431'; // default to olive
    const bgColor = color ? `${color.color_hex}20` : 'rgba(246, 240, 233, 0.5)'; // add transparency
    const colorLabel = color ? `<span style="font-size: 0.75rem; color: ${color.color_hex}; font-weight: 600;">[${color.label}]</span> ` : '';

    const quote = `<blockquote style="border-left: 4px solid ${borderColor}; background-color: ${bgColor}; padding: 0.75rem 1rem; margin: 1rem 0; font-style: italic; color: #4a5568; border-radius: 0 0.25rem 0.25rem 0;">${selection.text}<br><em style="font-size: 0.875rem; color: #6b7280;">${colorLabel}(Page 1)</em></blockquote>`;

    // Get the contenteditable div and insert at cursor position
    const noteEditor = document.querySelector('[contenteditable]');
    if (noteEditor) {
      // Insert at the end
      noteEditor.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(noteEditor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

      // Insert the HTML
      document.execCommand('insertHTML', false, quote);

      // Update state
      setNewNote({
        ...newNote,
        body: noteEditor.innerHTML
      });
    }

    // Clear PDF selection
    setShowColorPicker(false);
    setSelection(null);
  };

  const handleCreateHighlight = async (color) => {
    if (!selection) return;

    try {
      const response = await fetch('/highlights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          highlight: {
            source_id: sourceId,
            page_number: 1, // TODO: Determine actual page number
            text_content: selection.text,
            color_hex: color.color_hex,
            bounds: null // TODO: Calculate actual bounds
          }
        }),
      });

      if (response.ok) {
        const newHighlight = await response.json();

        // Add to highlights array and trigger re-render
        const updatedHighlights = [...highlights, newHighlight];
        setHighlights(updatedHighlights);

        // Clear selection and hide picker
        window.getSelection().removeAllRanges();
        setShowColorPicker(false);
        setSelection(null);

        // Apply highlights after a short delay to let state update
        setTimeout(() => applyHighlights(), 100);
      }
    } catch (error) {
      console.error('Error creating highlight:', error);
    }
  };

  const handleClose = () => {
    window.location.href = `/sources/${sourceId}`;
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingNoteData({ title: note.title || '', body: note.body });

    // Set existing concepts (many-to-many)
    if (note.concepts && note.concepts.length > 0) {
      setEditingConcepts(note.concepts.map(c => ({ id: c.id, label: c.label })));
    } else {
      setEditingConcepts([]);
    }

    if (note.tags && note.tags.length > 0) {
      setEditingTags(note.tags.map(tag => ({ id: tag.name, name: tag.name })));
    } else {
      setEditingTags([]);
    }

    // Wait a tick for the DOM to update, then set the innerHTML
    setTimeout(() => {
      const editor = document.querySelector(`#edit-note-${note.id}`);
      if (editor) {
        editor.innerHTML = note.body;
      }
    }, 10);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteData({ title: '', body: '' });
    setEditingConcepts([]);
    setEditingTags([]);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId) return;

    try {
      const tagsArray = editingTags.map(tag => tag.name);

      // Handle concepts - create new ones if needed
      const conceptIds = [];
      for (const concept of editingConcepts) {
        // Check if this is a new concept (temporary ID starts with "new_")
        if (String(concept.id).startsWith('new_')) {
          // Create the concept first
          const conceptResponse = await fetch('/concepts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
            },
            body: JSON.stringify({
              concept: {
                label: concept.label,
                node_type: 'construct'
              }
            }),
          });

          if (conceptResponse.ok) {
            const newConcept = await conceptResponse.json();
            conceptIds.push(newConcept.id);
            // Update concepts list with the new one
            setConcepts([...concepts, newConcept]);
          }
        } else {
          conceptIds.push(concept.id);
        }
      }

      const response = await fetch(`/notes/${editingNoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          note: {
            title: editingNoteData.title,
            body: editingNoteData.body,
            concept_ids: conceptIds,
            tags: tagsArray,
          }
        }),
      });

      if (response.ok) {
        // Reload all notes to ensure we have the latest data with proper includes
        await fetchNotes();
        setEditingNoteId(null);
        setEditingNoteData({ title: '', body: '' });
        setEditingConcepts([]);
        setEditingTags([]);
      }
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;

    try {
      const response = await fetch(`/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setNotes(notes.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
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

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => document.removeEventListener('mouseup', handleTextSelection);
  }, [highlightColors]);

  useEffect(() => {
    if (highlights.length > 0 && numPages) {
      // Wait for PDF text layer to render, then apply highlights
      // Longer timeout to ensure text layers are fully loaded
      setTimeout(applyHighlights, 1500);
    }
  }, [highlights, numPages]);

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
            <div
              contentEditable
              onInput={(e) => setNewNote({ ...newNote, body: e.currentTarget.innerHTML })}
              placeholder="Note content..."
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm min-h-[150px] prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-primary overflow-auto"
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
                  {editingNoteId === note.id ? (
                    /* Edit mode */
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingNoteData.title}
                        onChange={(e) => setEditingNoteData({ ...editingNoteData, title: e.target.value })}
                        placeholder="Note title (optional)"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <div
                        id={`edit-note-${note.id}`}
                        contentEditable
                        onInput={(e) => setEditingNoteData({ ...editingNoteData, body: e.currentTarget.innerHTML })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm min-h-[100px] prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <MultiSelectWithCreate
                          options={concepts}
                          selected={editingConcepts}
                          onChange={setEditingConcepts}
                          placeholder="Constructs"
                          labelKey="label"
                          valueKey="id"
                        />
                        <MultiSelectWithCreate
                          options={tags}
                          selected={editingTags}
                          onChange={setEditingTags}
                          placeholder="Tags"
                          labelKey="name"
                          valueKey="id"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 bg-primary text-sand rounded hover:bg-accent-dark text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <>
                      <div className="relative">
                        <div className="absolute top-0 right-0 flex gap-1">
                          <button
                            onClick={() => handleEditNote(note)}
                            className="text-sm hover:opacity-70"
                            style={{ background: 'transparent', color: '#6f5060', border: 'none', padding: '0.25rem' }}
                            title="Edit"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-sm hover:opacity-70"
                            style={{ background: 'transparent', color: '#6f5060', border: 'none', padding: '0.25rem' }}
                            title="Delete"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                        {note.title && (
                          <h3 className="font-medium text-sm mb-2 pr-16">{note.title}</h3>
                        )}
                      </div>
                      <div
                        className="text-sm text-gray-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: note.body }}
                      />
                      {(note.concepts?.length > 0 || note.tags?.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {note.concepts?.map((concept, idx) => (
                            <span key={idx} className="text-xs bg-accent-dark text-sand px-2 py-1 rounded">
                              {concept.label}
                            </span>
                          ))}
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
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Color Scheme Button */}
      <button
        onClick={() => setShowColorManager(true)}
        className="fixed bottom-8 left-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-accent-dark transition-colors flex items-center justify-center z-40"
        title="Manage Color Coding Scheme"
      >
        <i className="fas fa-palette"></i>
      </button>

      {/* Color Scheme Manager Modal */}
      <ColorSchemeManager
        isOpen={showColorManager}
        onClose={() => setShowColorManager(false)}
      />

      {/* Quote Selection Popup */}
      {showColorPicker && (
        <div
          className="fixed bg-white border border-gray-300 rounded shadow-lg p-3 z-50"
          style={{
            left: `${pickerPosition.x}px`,
            top: `${pickerPosition.y}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="text-xs font-medium mb-2 text-center text-gray-600">Add Quote to Note</div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => handleAddQuote()}
              className="px-3 py-2 bg-sand border border-gray-300 rounded hover:bg-primary hover:text-sand text-sm whitespace-nowrap transition-colors"
              title="No color coding"
            >
              Default
            </button>
            {highlightColors.map(color => (
              <button
                key={color.id}
                onClick={() => handleAddQuote(color)}
                className="w-8 h-8 rounded border-2 border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color.color_hex }}
                title={color.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
