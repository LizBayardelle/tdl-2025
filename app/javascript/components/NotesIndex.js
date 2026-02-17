import React, { useState, useEffect } from 'react';
import NoteFormModal from './NoteFormModal';
import NoteShowModal from './NoteShowModal';

export default function NotesIndex() {
  const [notes, setNotes] = useState([]);
  const [allSources, setAllSources] = useState([]);
  const [allConcepts, setAllConcepts] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Sidebar state - closed on mobile by default
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcepts, setSelectedConcepts] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // View mode: 'cards' or 'list'
  const [viewMode, setViewMode] = useState('cards');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = async () => {
    try {
      const [notesRes, sourcesRes, conceptsRes, tagsRes] = await Promise.all([
        fetch('/notes.json'),
        fetch('/sources.json'),
        fetch('/concepts.json'),
        fetch('/tags.json')
      ]);

      const [notesData, sourcesData, conceptsData, tagsData] = await Promise.all([
        notesRes.json(),
        sourcesRes.json(),
        conceptsRes.json(),
        tagsRes.json()
      ]);

      setNotes(notesData);
      setAllSources(sourcesData);
      setAllConcepts(conceptsData);
      setAllTags(tagsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
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

  const handleTogglePin = async (note) => {
    try {
      const response = await fetch(`/notes/${note.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: { pinned: !note.pinned } }),
      });

      if (response.ok) {
        const updatedNote = await response.json();
        setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const noteTypeLabels = {
    note: 'Note',
    question: 'Question',
    synthesis: 'Synthesis',
    connection: 'Connection',
    todo: 'To Do'
  };

  // Filter notes
  const getFilteredNotes = () => {
    let filtered = [...notes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        note.title?.toLowerCase().includes(query) ||
        note.body?.toLowerCase().includes(query) ||
        note.context?.toLowerCase().includes(query)
      );
    }

    if (selectedConcepts.length > 0) {
      filtered = filtered.filter(note =>
        note.concepts?.some(c => selectedConcepts.includes(c.id))
      );
    }

    if (selectedSources.length > 0) {
      filtered = filtered.filter(note =>
        note.source && selectedSources.includes(note.source.id)
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(note =>
        note.tags?.some(t => selectedTags.includes(typeof t === 'string' ? t : t.name))
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(note => note.note_type === filterType);
    }

    if (showPinnedOnly) {
      filtered = filtered.filter(note => note.pinned);
    }

    // Sort - pinned first, then by date
    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.noted_on || b.created_at) - new Date(a.noted_on || a.created_at);
    });

    return filtered;
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedConcepts([]);
    setSelectedSources([]);
    setSelectedTags([]);
    setFilterType('all');
    setShowPinnedOnly(false);
  };

  const hasActiveFilters = searchQuery || selectedConcepts.length > 0 || selectedSources.length > 0 ||
    selectedTags.length > 0 || filterType !== 'all' || showPinnedOnly;

  const filteredNotes = getFilteredNotes();

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>Loading notes...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="sidebar-toggle"
          style={{
            position: 'absolute',
            left: sidebarOpen ? '280px' : '0',
            top: '200px',
            zIndex: 20,
            background: 'var(--accent-teal)',
            color: 'white',
            border: 'none',
            padding: 'var(--space-2)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderRadius: '0 4px 4px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '48px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#4a8187'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-teal)'}
        >
          <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px' }}></i>
        </button>

        {/* Left Sidebar */}
        {sidebarOpen && (
          <aside style={{
            width: '280px',
            background: '#e2e2e2',
            overflowY: 'auto',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-sidebar)',
            flexShrink: 0
          }}>
            {/* Add Note Button */}
            <button
              onClick={() => {
                setEditingNote(null);
                setShowFormModal(true);
              }}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                borderRadius: 'var(--radius)',
                background: 'var(--accent-teal)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                transition: 'all 0.15s',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4a8187';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-teal)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <i className="fas fa-plus"></i>
              New Note
            </button>

            {/* Search */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div style={{
                marginBottom: 'var(--space-4)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--neutral-200)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-2)'
                }}>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--neutral-500)'
                  }}>Active Filters</span>
                  <button
                    onClick={clearAllFilters}
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--accent-teal)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)'
                    }}
                  >
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                  {selectedConcepts.map(id => {
                    const concept = allConcepts.find(c => c.id === id);
                    return concept && (
                      <span key={id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        fontSize: 'var(--text-xs)',
                        background: 'var(--accent-green-light)',
                        color: 'var(--accent-green)',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500
                      }}>
                        {concept.label}
                        <button
                          onClick={() => setSelectedConcepts(selectedConcepts.filter(cid => cid !== id))}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', padding: 0 }}
                        >
                          <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                        </button>
                      </span>
                    );
                  })}
                  {selectedSources.map(id => {
                    const source = allSources.find(s => s.id === id);
                    return source && (
                      <span key={id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        fontSize: 'var(--text-xs)',
                        background: 'var(--accent-blue-light)',
                        color: 'var(--accent-blue)',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500
                      }}>
                        {source.title}
                        <button
                          onClick={() => setSelectedSources(selectedSources.filter(sid => sid !== id))}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: 0 }}
                        >
                          <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                        </button>
                      </span>
                    );
                  })}
                  {selectedTags.map(tag => (
                    <span key={tag} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      fontSize: 'var(--text-xs)',
                      background: 'var(--accent-purple-light)',
                      color: 'var(--accent-purple)',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500
                    }}>
                      {tag}
                      <button
                        onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', padding: 0 }}
                      >
                        <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Filter: By Concept */}
            <FilterSection title="By Concept">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: '200px', overflowY: 'auto' }}>
                {allConcepts.map(concept => {
                  const count = notes.filter(n => n.concepts?.some(c => c.id === concept.id)).length;
                  if (count === 0) return null;
                  return (
                    <label key={concept.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      borderRadius: '4px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedConcepts.includes(concept.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedConcepts([...selectedConcepts, concept.id]);
                          } else {
                            setSelectedConcepts(selectedConcepts.filter(id => id !== concept.id));
                          }
                        }}
                        style={{ accentColor: 'var(--accent-teal)' }}
                      />
                      <span style={{ flex: 1 }}>{concept.label}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>({count})</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Filter: By Source */}
            <FilterSection title="By Source">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: '200px', overflowY: 'auto' }}>
                {allSources.map(source => {
                  const count = notes.filter(n => n.source?.id === source.id).length;
                  if (count === 0) return null;
                  return (
                    <label key={source.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      borderRadius: '4px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(source.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSources([...selectedSources, source.id]);
                          } else {
                            setSelectedSources(selectedSources.filter(id => id !== source.id));
                          }
                        }}
                        style={{ accentColor: 'var(--accent-teal)' }}
                      />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={source.title}>{source.title}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>({count})</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Filter: By Tag */}
            <FilterSection title="By Tag">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: '200px', overflowY: 'auto' }}>
                {allTags.map(tag => {
                  const tagName = typeof tag === 'string' ? tag : tag.name;
                  const count = notes.filter(n => n.tags?.some(t => (typeof t === 'string' ? t : t.name) === tagName)).length;
                  if (count === 0) return null;
                  return (
                    <label key={tagName} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      borderRadius: '4px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tagName)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTags([...selectedTags, tagName]);
                          } else {
                            setSelectedTags(selectedTags.filter(t => t !== tagName));
                          }
                        }}
                        style={{ accentColor: 'var(--accent-teal)' }}
                      />
                      <span style={{ flex: 1 }}>{tagName}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>({count})</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Filter: By Type */}
            <FilterSection title="By Type">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  padding: 'var(--space-1)',
                  borderRadius: '4px',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="radio"
                    name="note-type"
                    checked={filterType === 'all'}
                    onChange={() => setFilterType('all')}
                    style={{ accentColor: 'var(--accent-teal)' }}
                  />
                  <span>All Types</span>
                </label>
                {Object.entries(noteTypeLabels).map(([value, label]) => {
                  const count = notes.filter(n => n.note_type === value).length;
                  return (
                    <label key={value} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                      borderRadius: '4px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="radio"
                        name="note-type"
                        checked={filterType === value}
                        onChange={() => setFilterType(value)}
                        style={{ accentColor: 'var(--accent-teal)' }}
                      />
                      <span style={{ flex: 1 }}>{label}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)' }}>({count})</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>

            {/* Other Filters */}
            <FilterSection title="Other">
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={showPinnedOnly}
                  onChange={(e) => setShowPinnedOnly(e.target.checked)}
                  style={{ accentColor: 'var(--accent-teal)' }}
                />
                Pinned only
              </label>
            </FilterSection>
          </aside>
        )}

        {/* Main Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
          {/* Header */}
          <div style={{
            padding: 'var(--space-6) var(--space-8)',
            background: 'color-mix(in srgb, var(--accent-teal) 15%, white)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            position: 'relative',
            zIndex: 5,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{
                  fontSize: 'var(--text-4xl)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-teal)',
                  margin: 0,
                  lineHeight: 1.1
                }}>Notes</h1>
                <p style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--neutral-600)',
                  fontFamily: 'var(--font-body)',
                  marginTop: 'var(--space-1)',
                  marginBottom: 0
                }}>
                  Showing {filteredNotes.length} of {notes.length} notes
                </p>
              </div>
              {/* View Mode Toggle - hidden on mobile */}
              <div
                className="hidden md:flex"
                onClick={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}
                style={{
                  width: '56px',
                  height: '28px',
                  background: 'var(--accent-teal)',
                  borderRadius: '14px',
                  padding: '3px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
                title={viewMode === 'cards' ? 'Switch to list view' : 'Switch to card view'}
              >
                {/* Sliding ball */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  background: 'white',
                  borderRadius: '50%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transform: viewMode === 'list' ? 'translateX(28px)' : 'translateX(0)',
                  transition: 'transform 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <i
                    className={`fas ${viewMode === 'cards' ? 'fa-th-large' : 'fa-list'}`}
                    style={{ fontSize: '10px', color: 'var(--accent-teal)' }}
                  ></i>
                </div>
                {/* Background icons */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 8px',
                  pointerEvents: 'none',
                }}>
                  <i
                    className="fas fa-th-large"
                    style={{
                      fontSize: '10px',
                      color: 'white',
                      opacity: viewMode === 'cards' ? 0 : 0.6,
                      transition: 'opacity 0.2s',
                    }}
                  ></i>
                  <i
                    className="fas fa-list"
                    style={{
                      fontSize: '10px',
                      color: 'white',
                      opacity: viewMode === 'list' ? 0 : 0.6,
                      transition: 'opacity 0.2s',
                    }}
                  ></i>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Grid */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-6)',
            paddingTop: 'var(--space-8)',
            paddingLeft: 'calc(var(--space-6) + 24px)',
            background: 'white'
          }}>
            {filteredNotes.length === 0 ? (
              <div className="card" style={{
                textAlign: 'center',
                padding: 'var(--space-8)'
              }}>
                <p style={{
                  fontSize: 'var(--text-lg)',
                  color: 'var(--neutral-600)',
                  fontFamily: 'var(--font-body)'
                }}>
                  {hasActiveFilters ? 'No notes match your filters' : 'No notes yet'}
                </p>
              </div>
            ) : (
              <div style={{
                display: viewMode === 'list' ? 'flex' : 'grid',
                flexDirection: viewMode === 'list' ? 'column' : undefined,
                gridTemplateColumns: viewMode === 'list' ? undefined : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 'var(--space-4)',
                maxWidth: viewMode === 'list' ? '900px' : undefined,
              }}>
                {filteredNotes.map(note => (
                  <div
                    key={note.id}
                    className="card"
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
                    onClick={() => { setViewingNote(note); setShowViewModal(true); }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {note.title && (
                      <div style={{
                        background: 'var(--accent-teal)',
                        padding: '5px var(--space-4)',
                        borderBottom: '1px solid var(--neutral-200)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <h3 style={{
                          fontWeight: 600,
                          fontSize: 'var(--text-base)',
                          fontFamily: 'var(--font-display)',
                          color: 'white',
                          margin: 0,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.2
                        }}>
                          {note.title}
                        </h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: note.pinned ? 'white' : 'rgba(255, 255, 255, 0.6)',
                            cursor: 'pointer',
                            padding: 'var(--space-1)',
                            fontSize: 'var(--text-sm)',
                            marginLeft: 'var(--space-2)'
                          }}
                          title={note.pinned ? 'Unpin' : 'Pin'}
                        >
                          <i className="fas fa-thumbtack"></i>
                        </button>
                      </div>
                    )}
                    <div style={{ padding: 'var(--space-4)', flex: 1 }}>
                      {!note.title && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}
                          style={{
                            position: 'absolute',
                            top: 'var(--space-3)',
                            right: 'var(--space-3)',
                            background: 'none',
                            border: 'none',
                            color: note.pinned ? 'var(--accent-teal)' : 'var(--neutral-400)',
                            cursor: 'pointer',
                            padding: 'var(--space-1)',
                            fontSize: 'var(--text-sm)'
                          }}
                          title={note.pinned ? 'Unpin' : 'Pin'}
                        >
                          <i className="fas fa-thumbtack"></i>
                        </button>
                      )}
                      <div
                        className="prose prose-sm max-w-none [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:ml-1 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_pre]:bg-gray-100 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-1 [&_td]:text-xs [&_th]:border [&_th]:border-gray-300 [&_th]:p-1 [&_th]:text-xs [&_th]:bg-gray-100 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto"
                        style={{
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-700)',
                          fontFamily: 'var(--font-body)',
                          lineHeight: 1.6,
                          marginBottom: 'var(--space-3)',
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                        dangerouslySetInnerHTML={{ __html: note.body }}
                      />
                      {(note.concepts?.length > 0 || note.tags?.length > 0) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                          {note.concepts?.map((concept) => (
                            <a
                              key={concept.id}
                              href={`/concepts/${concept.id}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: 'var(--text-xs)',
                                background: 'var(--accent-green-light)',
                                color: 'var(--accent-green)',
                                padding: 'var(--space-1) var(--space-2)',
                                borderRadius: '4px',
                                fontFamily: 'var(--font-body)',
                                fontWeight: 500,
                                textDecoration: 'none',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--accent-green)';
                                e.currentTarget.style.color = 'white';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--accent-green-light)';
                                e.currentTarget.style.color = 'var(--accent-green)';
                              }}
                            >
                              {concept.label}
                            </a>
                          ))}
                          {note.tags?.map((tag, idx) => (
                            <span key={idx} style={{
                              fontSize: 'var(--text-xs)',
                              background: 'var(--accent-purple-light)',
                              color: 'var(--accent-purple)',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-body)',
                              fontWeight: 500
                            }}>
                              {typeof tag === 'string' ? tag : tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: 'var(--space-2) var(--space-4)',
                      background: '#e2e2e2',
                      borderTop: '1px solid var(--neutral-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)',
                        lineHeight: 1
                      }}>
                        {note.source && (
                          <a href={`/sources/${note.source.id}`} onClick={(e) => e.stopPropagation()} style={{
                            color: 'var(--accent-blue)',
                            textDecoration: 'none',
                            fontWeight: 600,
                            lineHeight: 1,
                            display: 'block'
                          }}>
                            {note.source.title}
                          </a>
                        )}
                        {!note.source && (
                          <span>{new Date(note.noted_on || note.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNote(note);
                            setShowFormModal(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-teal)',
                            cursor: 'pointer',
                            padding: 'var(--space-1)',
                            fontSize: 'var(--text-sm)',
                            transition: 'opacity 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-teal)',
                            cursor: 'pointer',
                            padding: 'var(--space-1)',
                            fontSize: 'var(--text-sm)',
                            transition: 'opacity 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Mobile FAB - only show when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => {
              setEditingNote(null);
              setShowFormModal(true);
            }}
            className="md:hidden"
            style={{
              position: 'fixed',
              bottom: 'var(--space-6)',
              right: 'var(--space-6)',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--accent-teal)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-xl)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 30,
            }}
            title="New Note"
          >
            <i className="fas fa-plus"></i>
          </button>
        )}
      </div>

      <NoteShowModal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewingNote(null); }}
        note={viewingNote}
        onEdit={(note) => {
          setShowViewModal(false);
          setViewingNote(null);
          setEditingNote(note);
          setShowFormModal(true);
        }}
        onDelete={(noteId) => {
          setShowViewModal(false);
          setViewingNote(null);
          handleDeleteNote(noteId);
        }}
        onTogglePin={(note) => {
          handleTogglePin(note);
          setViewingNote({ ...note, pinned: !note.pinned });
        }}
      />

      <NoteFormModal
        isOpen={showFormModal}
        onClose={() => {
          // Refresh data when closing edit modal (autosave means changes may have been made)
          if (editingNote) {
            fetchData();
          }
          setShowFormModal(false);
          setEditingNote(null);
        }}
        onSuccess={() => {
          fetchData();
          setShowFormModal(false);
          setEditingNote(null);
        }}
        onDelete={(noteId) => {
          handleDeleteNote(noteId);
          setShowFormModal(false);
          setEditingNote(null);
        }}
        item={editingNote}
      />
    </>
  );
}

// Filter Section Component
function FilterSection({ title, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{
      marginBottom: 'var(--space-4)',
      paddingBottom: 'var(--space-3)',
      borderBottom: '1px solid var(--neutral-200)'
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          marginBottom: 'var(--space-2)',
          cursor: 'pointer',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--neutral-500)',
          fontFamily: 'var(--font-body)',
          textAlign: 'left'
        }}
      >
        <span>{title}</span>
        <i className={`fas fa-chevron-${isOpen ? 'down' : 'right'}`} style={{ fontSize: '10px' }}></i>
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  );
}
