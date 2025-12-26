import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbtack, faPen, faTrash, faTimes, faChevronLeft, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';

export default function NotesIndex() {
  const [notes, setNotes] = useState([]);
  const [allSources, setAllSources] = useState([]);
  const [allConcepts, setAllConcepts] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcepts, setSelectedConcepts] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // View and sort states
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'list', 'grouped'
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc', 'date_asc', 'source', 'concept'
  const [groupBy, setGroupBy] = useState('source'); // 'source', 'concept', 'tag'

  // Sidebar section collapse states
  const [collapsedSections, setCollapsedSections] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [notesRes, sourcesRes, conceptsRes, tagsRes, peopleRes] = await Promise.all([
        fetch('/notes.json'),
        fetch('/sources.json'),
        fetch('/concepts.json'),
        fetch('/tags.json'),
        fetch('/people.json')
      ]);

      const [notesData, sourcesData, conceptsData, tagsData, peopleData] = await Promise.all([
        notesRes.json(),
        sourcesRes.json(),
        conceptsRes.json(),
        tagsRes.json(),
        peopleRes.json()
      ]);

      setNotes(notesData);
      setAllSources(sourcesData);
      setAllConcepts(conceptsData);
      setAllTags(tagsData);
      setAllPeople(peopleData);
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
      const response = await fetch(`/notes/${note.id}.json`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
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
    todo: 'To Do Item'
  };

  // Filter and sort notes
  const getFilteredAndSortedNotes = () => {
    let filtered = [...notes];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        note.title?.toLowerCase().includes(query) ||
        note.body?.toLowerCase().includes(query) ||
        note.context?.toLowerCase().includes(query)
      );
    }

    // Concept filter
    if (selectedConcepts.length > 0) {
      filtered = filtered.filter(note =>
        note.concepts?.some(c => selectedConcepts.includes(c.id))
      );
    }

    // Source filter
    if (selectedSources.length > 0) {
      filtered = filtered.filter(note =>
        note.source && selectedSources.includes(note.source.id)
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(note =>
        note.tags?.some(t => selectedTags.includes(typeof t === 'string' ? t : t.name))
      );
    }

    // Person filter
    if (selectedPeople.length > 0) {
      filtered = filtered.filter(note =>
        note.people?.some(p => selectedPeople.includes(p.id))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(note => note.note_type === filterType);
    }

    // Pinned filter
    if (showPinnedOnly) {
      filtered = filtered.filter(note => note.pinned);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(note => new Date(note.noted_on || note.created_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(note => new Date(note.noted_on || note.created_at) <= new Date(dateTo));
    }

    // Sort - pinned notes always come first
    filtered.sort((a, b) => {
      // First sort by pinned status
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Then sort by selected criteria
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.noted_on || b.created_at) - new Date(a.noted_on || a.created_at);
        case 'date_asc':
          return new Date(a.noted_on || a.created_at) - new Date(b.noted_on || b.created_at);
        case 'source':
          return (a.source?.title || '').localeCompare(b.source?.title || '');
        case 'concept':
          return (a.concepts?.[0]?.label || '').localeCompare(b.concepts?.[0]?.label || '');
        default:
          return 0;
      }
    });

    return filtered;
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedConcepts([]);
    setSelectedSources([]);
    setSelectedTags([]);
    setSelectedPeople([]);
    setFilterType('all');
    setShowPinnedOnly(false);
    setDateFrom('');
    setDateTo('');
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const hasActiveFilters = searchQuery || selectedConcepts.length > 0 || selectedSources.length > 0 ||
    selectedTags.length > 0 || selectedPeople.length > 0 || filterType !== 'all' ||
    showPinnedOnly || dateFrom || dateTo;

  const filteredNotes = getFilteredAndSortedNotes();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p>Loading notes...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-gray-300 bg-sage flex-shrink-0 shadow-lg`}>
        <div className="h-full overflow-y-auto p-4">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mb-4 pb-4 border-b border-gray-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Active Filters</span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-primary hover:text-accent-dark"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedConcepts.map(id => {
                  const concept = allConcepts.find(c => c.id === id);
                  return concept && (
                    <span key={id} className="inline-flex items-center gap-1 text-xs bg-accent-dark text-sand px-2 py-1 rounded">
                      {concept.label}
                      <button onClick={() => setSelectedConcepts(selectedConcepts.filter(cid => cid !== id))}>
                        <FontAwesomeIcon icon={faTimes} className="text-xs" />
                      </button>
                    </span>
                  );
                })}
                {selectedSources.map(id => {
                  const source = allSources.find(s => s.id === id);
                  return source && (
                    <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary text-sand px-2 py-1 rounded">
                      {source.title}
                      <button onClick={() => setSelectedSources(selectedSources.filter(sid => sid !== id))}>
                        <FontAwesomeIcon icon={faTimes} className="text-xs" />
                      </button>
                    </span>
                  );
                })}
                {selectedTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs bg-khaki text-primary px-2 py-1 rounded">
                    {tag}
                    <button onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}>
                      <FontAwesomeIcon icon={faTimes} className="text-xs" />
                    </button>
                  </span>
                ))}
                {selectedPeople.map(id => {
                  const person = allPeople.find(p => p.id === id);
                  return person && (
                    <span key={id} className="inline-flex items-center gap-1 text-xs bg-sand text-primary border border-primary px-2 py-1 rounded">
                      {person.full_name}
                      <button onClick={() => setSelectedPeople(selectedPeople.filter(pid => pid !== id))}>
                        <FontAwesomeIcon icon={faTimes} className="text-xs" />
                      </button>
                    </span>
                  );
                })}
                {filterType !== 'all' && (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                    {noteTypeLabels[filterType]}
                    <button onClick={() => setFilterType('all')}>
                      <FontAwesomeIcon icon={faTimes} className="text-xs" />
                    </button>
                  </span>
                )}
                {showPinnedOnly && (
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                    Pinned
                    <button onClick={() => setShowPinnedOnly(false)}>
                      <FontAwesomeIcon icon={faTimes} className="text-xs" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Filter Sections */}
          <FilterSection
            title="BY CONCEPT"
            isCollapsed={collapsedSections.concepts}
            onToggle={() => toggleSection('concepts')}
          >
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {allConcepts.map(concept => (
                <label key={concept.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer">
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
                    className="rounded"
                  />
                  <span className="flex-1">{concept.label}</span>
                  <span className="text-xs text-gray-500">
                    ({notes.filter(n => n.concepts?.some(c => c.id === concept.id)).length})
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          <FilterSection
            title="BY SOURCE"
            isCollapsed={collapsedSections.sources}
            onToggle={() => toggleSection('sources')}
          >
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {allSources.map(source => {
                const noteCount = notes.filter(n => n.source?.id === source.id).length;
                if (noteCount === 0) return null;
                return (
                  <label key={source.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer">
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
                      className="rounded"
                    />
                    <span className="flex-1 truncate" title={source.title}>{source.title}</span>
                    <span className="text-xs text-gray-500">({noteCount})</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection
            title="BY TAG"
            isCollapsed={collapsedSections.tags}
            onToggle={() => toggleSection('tags')}
          >
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {allTags.map(tag => {
                const tagName = typeof tag === 'string' ? tag : tag.name;
                const noteCount = notes.filter(n => n.tags?.some(t => (typeof t === 'string' ? t : t.name) === tagName)).length;
                if (noteCount === 0) return null;
                return (
                  <label key={tagName} className="flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer">
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
                      className="rounded"
                    />
                    <span className="flex-1">{tagName}</span>
                    <span className="text-xs text-gray-500">({noteCount})</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection
            title="BY PERSON"
            isCollapsed={collapsedSections.people}
            onToggle={() => toggleSection('people')}
          >
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {allPeople.map(person => {
                const noteCount = notes.filter(n => n.people?.some(p => p.id === person.id)).length;
                if (noteCount === 0) return null;
                return (
                  <label key={person.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPeople.includes(person.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPeople([...selectedPeople, person.id]);
                        } else {
                          setSelectedPeople(selectedPeople.filter(id => id !== person.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="flex-1">{person.full_name}</span>
                    <span className="text-xs text-gray-500">({noteCount})</span>
                  </label>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection
            title="BY TYPE"
            isCollapsed={collapsedSections.type}
            onToggle={() => toggleSection('type')}
          >
            <div className="space-y-1">
              {Object.entries(noteTypeLabels).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer">
                  <input
                    type="radio"
                    name="note-type"
                    checked={filterType === value}
                    onChange={() => setFilterType(value)}
                    className="rounded"
                  />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-gray-500">
                    ({notes.filter(n => n.note_type === value).length})
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer">
                <input
                  type="radio"
                  name="note-type"
                  checked={filterType === 'all'}
                  onChange={() => setFilterType('all')}
                  className="rounded"
                />
                <span className="flex-1">All Types</span>
              </label>
            </div>
          </FilterSection>

          <FilterSection
            title="OTHER FILTERS"
            isCollapsed={collapsedSections.other}
            onToggle={() => toggleSection('other')}
          >
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showPinnedOnly}
                  onChange={(e) => setShowPinnedOnly(e.target.checked)}
                  className="rounded"
                />
                Pinned only
              </label>
              <div>
                <label className="block text-xs mb-1">Date from</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Date to</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-sm"
                />
              </div>
            </div>
          </FilterSection>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-300 bg-white px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-sand rounded transition-colors text-primary"
                title={sidebarOpen ? 'Hide filters' : 'Show filters'}
              >
                <FontAwesomeIcon icon={sidebarOpen ? faChevronLeft : faChevronRight} />
              </button>
              <h1 className="text-3xl">Notes</h1>
            </div>
            <a
              href="/notes/new"
              className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark transition-colors"
            >
              New Note
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing {filteredNotes.length} of {notes.length} notes
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">View:</span>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 text-sm rounded ${viewMode === 'cards' ? 'bg-primary text-sand' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-primary text-sand' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-3 py-1 text-sm rounded ${viewMode === 'grouped' ? 'bg-primary text-sand' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Grouped
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded bg-white text-sm"
                >
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                  <option value="source">By source</option>
                  <option value="concept">By concept</option>
                </select>
              </div>
              {viewMode === 'grouped' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm">Group by:</label>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded bg-white text-sm"
                  >
                    <option value="source">Source</option>
                    <option value="concept">Concept</option>
                    <option value="tag">Tag</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-300 rounded-lg">
              <p className="text-lg text-gray-600">No notes match your filters</p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredNotes.map(note => (
            <div
              key={note.id}
              className="bg-white border border-gray-300 rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow flex flex-col"
            >
              {/* Header - always exists */}
              <div className="px-4 py-2 bg-primary flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => handleTogglePin(note)}
                    className={`bg-transparent border-0 transition-colors flex-shrink-0 ${note.pinned ? 'text-sand' : 'text-khaki hover:text-sand'}`}
                    title={note.pinned ? 'Unpin' : 'Pin'}
                  >
                    <FontAwesomeIcon icon={faThumbtack} className="text-sm" />
                  </button>
                  {note.title && (
                    <a href={`/notes/${note.id}`} className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-sand hover:opacity-80 transition-opacity truncate">
                        {note.title}
                      </h3>
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={`/notes/${note.id}/edit`}
                    className="text-sand hover:opacity-70 transition-opacity"
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faPen} className="text-sm" />
                  </a>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-sand hover:opacity-70 transition-opacity bg-transparent border-0"
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-sm" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1">
                <a href={`/notes/${note.id}`} className="block">
                  <div className="text-sm text-gray-700 prose prose-sm max-w-none line-clamp-4" dangerouslySetInnerHTML={{ __html: note.body }} />
                </a>

                {note.context && (
                  <div className="bg-sand rounded p-2 mt-3">
                    <p className="text-xs text-gray-700">
                      <span className="font-medium">Context:</span> {note.context}
                    </p>
                  </div>
                )}

                {(note.concepts?.length > 0 || note.tags?.length > 0 || note.note_type) && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {note.note_type && (
                      <span className="text-xs uppercase tracking-wider bg-sand text-gray-800 px-2 py-1 rounded">
                        {noteTypeLabels[note.note_type] || note.note_type}
                      </span>
                    )}
                    {note.concepts?.map((concept) => (
                      <a
                        key={concept.id}
                        href={`/concepts/${concept.id}`}
                        className="text-xs bg-accent-dark text-sand px-2 py-1 rounded hover:opacity-80 transition-opacity"
                      >
                        {concept.label}
                      </a>
                    ))}
                    {note.tags?.map((tag, idx) => (
                      <a
                        key={idx}
                        href={`/tags/${typeof tag === 'string' ? tag : tag.name}`}
                        className="text-xs bg-primary text-sand px-2 py-1 rounded hover:opacity-80 transition-opacity"
                      >
                        {typeof tag === 'string' ? tag : tag.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - always at bottom */}
              <div className="px-4 py-1 bg-sage flex items-center justify-between mt-auto">
                <div className="text-xs text-primary">
                  {note.source && (
                    <a href={`/sources/${note.source.id}`} className="hover:underline">
                      📚 {note.source.title}
                    </a>
                  )}
                </div>
                <div className="text-xs text-primary">
                  {new Date(note.noted_on || note.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-2">
              {filteredNotes.map(note => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  noteTypeLabels={noteTypeLabels}
                  handleTogglePin={handleTogglePin}
                  handleDeleteNote={handleDeleteNote}
                />
              ))}
            </div>
          ) : (
            <GroupedNotes
              notes={filteredNotes}
              groupBy={groupBy}
              noteTypeLabels={noteTypeLabels}
              handleTogglePin={handleTogglePin}
              handleDeleteNote={handleDeleteNote}
              allSources={allSources}
              allConcepts={allConcepts}
              allTags={allTags}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for collapsible filter sections
function FilterSection({ title, isCollapsed, onToggle, children }) {
  return (
    <div className="mb-3 border-b border-gray-300 pb-3">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left text-sm font-medium mb-2 text-primary transition-colors"
      >
        <span>{title}</span>
        <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronDown} className="text-xs" />
      </button>
      {!isCollapsed && <div>{children}</div>}
    </div>
  );
}

// List view component for compact display
function NoteListItem({ note, noteTypeLabels, handleTogglePin, handleDeleteNote }) {
  return (
    <div className="bg-white border border-gray-300 rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow flex flex-col">
      {/* Header - always exists */}
      <div className="px-4 py-2 bg-primary flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => handleTogglePin(note)}
            className={`bg-transparent border-0 transition-colors flex-shrink-0 ${note.pinned ? 'text-sand' : 'text-khaki hover:text-sand'}`}
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            <FontAwesomeIcon icon={faThumbtack} className="text-sm" />
          </button>
          {note.title && (
            <a href={`/notes/${note.id}`} className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-sand hover:opacity-80 transition-opacity truncate">
                {note.title}
              </h3>
            </a>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a href={`/notes/${note.id}/edit`} className="text-sand hover:opacity-70 transition-opacity" title="Edit">
            <FontAwesomeIcon icon={faPen} className="text-sm" />
          </a>
          <button onClick={() => handleDeleteNote(note.id)} className="text-sand hover:opacity-70 transition-opacity bg-transparent border-0" title="Delete">
            <FontAwesomeIcon icon={faTrash} className="text-sm" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-2 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {note.source && (
            <a href={`/sources/${note.source.id}`} className="text-primary hover:underline truncate">
              📚 {note.source.title}
            </a>
          )}
          {note.concepts?.map((concept) => (
            <a key={concept.id} href={`/concepts/${concept.id}`} className="bg-accent-dark text-sand px-2 py-1 rounded hover:opacity-80">
              {concept.label}
            </a>
          ))}
          {note.tags?.map((tag, idx) => (
            <a key={idx} href={`/tags/${typeof tag === 'string' ? tag : tag.name}`} className="bg-primary text-sand px-2 py-1 rounded hover:opacity-80">
              {typeof tag === 'string' ? tag : tag.name}
            </a>
          ))}
          {note.note_type && (
            <span className="uppercase tracking-wider bg-sand text-gray-800 px-2 py-1 rounded">
              {noteTypeLabels[note.note_type] || note.note_type}
            </span>
          )}
        </div>
      </div>

      {/* Footer - always at bottom */}
      <div className="px-4 py-1 bg-sage flex items-center justify-end mt-auto">
        <div className="text-xs text-primary">
          {new Date(note.noted_on || note.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

// Grouped view component
function GroupedNotes({ notes, groupBy, noteTypeLabels, handleTogglePin, handleDeleteNote, allSources, allConcepts, allTags }) {
  const [expandedGroups, setExpandedGroups] = React.useState({});

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Group notes
  const grouped = {};
  notes.forEach(note => {
    let groupKey, groupLabel;

    if (groupBy === 'source') {
      groupKey = note.source?.id || 'no-source';
      groupLabel = note.source?.title || 'No Source';
    } else if (groupBy === 'concept') {
      groupKey = note.concepts?.[0]?.id || 'no-concept';
      groupLabel = note.concepts?.[0]?.label || 'No Concept';
    } else if (groupBy === 'tag') {
      const firstTag = note.tags?.[0];
      groupKey = firstTag ? (typeof firstTag === 'string' ? firstTag : firstTag.name) : 'no-tag';
      groupLabel = groupKey === 'no-tag' ? 'No Tag' : groupKey;
    }

    if (!grouped[groupKey]) {
      grouped[groupKey] = { label: groupLabel, notes: [] };
    }
    grouped[groupKey].notes.push(note);
  });

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([groupKey, group]) => (
        <div key={groupKey} className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup(groupKey)}
            className="w-full flex items-center justify-between px-4 py-3 bg-sand hover:bg-khaki transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={expandedGroups[groupKey] ? faChevronDown : faChevronRight} />
              <span className="font-medium text-lg" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
                {group.label}
              </span>
              <span className="text-sm text-gray-600">
                ({group.notes.length} {group.notes.length === 1 ? 'note' : 'notes'})
              </span>
            </div>
          </button>

          {expandedGroups[groupKey] && (
            <div className="p-4 space-y-3">
              {group.notes.map(note => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  noteTypeLabels={noteTypeLabels}
                  handleTogglePin={handleTogglePin}
                  handleDeleteNote={handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
