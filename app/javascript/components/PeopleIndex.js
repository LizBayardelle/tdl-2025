import React, { useState, useEffect } from 'react';
import PersonFormModal from './PersonFormModal';

export default function PeopleIndex() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedConcepts, setSelectedConcepts] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [sourceSearchFilter, setSourceSearchFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    fetchPeople();
  }, []);

  // Handle responsive sidebar - closed on mobile by default (below md: 768px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/people.json');
      const data = await response.json();
      setPeople(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching people:', error);
      setLoading(false);
    }
  };

  // Get unique values for filters
  const personRoles = [...new Set(people.map(p => p.role))].filter(Boolean).sort();

  const conceptsMap = new Map();
  people.forEach(p => {
    (p.concepts || []).forEach(c => {
      if (!conceptsMap.has(c.id)) {
        conceptsMap.set(c.id, { id: c.id, label: c.label });
      }
    });
  });
  const allConcepts = Array.from(conceptsMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  const allTags = [...new Set(people.flatMap(p => p.tags || []))].filter(Boolean).sort();

  const sourcesMap = new Map();
  people.forEach(p => {
    (p.sources || []).forEach(s => {
      if (!sourcesMap.has(s.id)) {
        sourcesMap.set(s.id, { id: s.id, title: s.title, kind: s.kind });
      }
    });
  });
  const allSources = Array.from(sourcesMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  const filteredSourcesForSidebar = sourceSearchFilter
    ? allSources.filter(s => s.title.toLowerCase().includes(sourceSearchFilter.toLowerCase()))
    : allSources;

  const collectionsMap = new Map();
  people.forEach(p => {
    (p.collections || []).forEach(c => {
      if (!collectionsMap.has(c.id)) {
        collectionsMap.set(c.id, { id: c.id, name: c.name });
      }
    });
  });
  const allCollections = Array.from(collectionsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Filter people
  const filteredPeople = people.filter(person => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = person.full_name?.toLowerCase().includes(query);
      const matchesAka = person.aka?.some(aka => aka.toLowerCase().includes(query));
      const matchesSummary = person.summary?.toLowerCase().includes(query);
      if (!matchesName && !matchesAka && !matchesSummary) {
        return false;
      }
    }

    // Role filter
    if (selectedRoles.length > 0 && !selectedRoles.includes(person.role)) {
      return false;
    }

    // Concept filter
    if (selectedConcepts.length > 0 && !person.concepts?.some(c => selectedConcepts.includes(c.id))) {
      return false;
    }

    // Tag filter
    if (selectedTags.length > 0 && !person.tags?.some(t => selectedTags.includes(t))) {
      return false;
    }

    // Source filter
    if (selectedSources.length > 0 && !person.sources?.some(s => selectedSources.includes(s.id))) {
      return false;
    }

    // Collection filter
    if (selectedCollections.length > 0 && !person.collections?.some(c => selectedCollections.includes(c.id))) {
      return false;
    }

    return true;
  });

  // Toggle selections
  const toggleRole = (role) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleConcept = (conceptId) => {
    setSelectedConcepts(prev =>
      prev.includes(conceptId) ? prev.filter(c => c !== conceptId) : [...prev, conceptId]
    );
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleSource = (sourceId) => {
    setSelectedSources(prev =>
      prev.includes(sourceId) ? prev.filter(s => s !== sourceId) : [...prev, sourceId]
    );
  };

  const toggleCollection = (collectionId) => {
    setSelectedCollections(prev =>
      prev.includes(collectionId) ? prev.filter(c => c !== collectionId) : [...prev, collectionId]
    );
  };

  const clearAllFilters = () => {
    setSelectedRoles([]);
    setSelectedConcepts([]);
    setSelectedTags([]);
    setSelectedSources([]);
    setSelectedCollections([]);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedRoles.length > 0 || selectedConcepts.length > 0 ||
                          selectedTags.length > 0 || selectedSources.length > 0 ||
                          selectedCollections.length > 0 || searchQuery;

  // Sort people
  const sortedPeople = [...filteredPeople].sort((a, b) => {
    let aVal, bVal;

    switch (sortField) {
      case 'name':
        aVal = a.full_name || '';
        bVal = b.full_name || '';
        break;
      case 'role':
        aVal = a.role || '';
        bVal = b.role || '';
        break;
      case 'sources':
        aVal = a.sources_count || 0;
        bVal = b.sources_count || 0;
        break;
      case 'notes':
        aVal = a.notes_count || 0;
        bVal = b.notes_count || 0;
        break;
      case 'tags':
        aVal = (a.tags || []).length;
        bVal = (b.tags || []).length;
        break;
      default:
        aVal = a.full_name || '';
        bVal = b.full_name || '';
    }

    if (typeof aVal === 'string') {
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    } else {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading people...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? '280px' : '0',
          background: '#e2e2e2',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: sidebarOpen ? 'var(--space-6)' : '0',
          boxShadow: sidebarOpen ? 'var(--shadow-sidebar)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {sidebarOpen && (
          <>
            {/* Search */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--neutral-500)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                Search
              </div>
              <input
                type="text"
                placeholder="Name, summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  fontSize: 'var(--text-sm)',
                  padding: 'var(--space-2)',
                }}
              />
            </div>

            {/* Clear all button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                style={{
                  fontFamily: 'var(--font-body)',
                  width: '100%',
                  padding: 'var(--space-2)',
                  marginBottom: 'var(--space-6)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent-gold)',
                  background: 'transparent',
                  border: '1px solid var(--accent-gold)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-gold-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Clear All Filters
              </button>
            )}

            {/* Role filters */}
            {personRoles.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--neutral-500)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  Role ({personRoles.length})
                </div>

                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'white',
                  borderRadius: '6px',
                  padding: 'var(--space-2)',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                }}>
                  {personRoles.map(role => {
                    const count = people.filter(p => p.role === role).length;
                    const isSelected = selectedRoles.includes(role);
                    return (
                      <label
                        key={role}
                        style={{
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-700)',
                          background: isSelected ? 'color-mix(in srgb, var(--accent-gold) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-gold) 15%, white)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRole(role);
                          }}
                          style={{ accentColor: 'var(--accent-gold)' }}
                        />
                        <span style={{ flex: 1, textTransform: 'capitalize' }}>{role.replace(/_/g, ' ')}</span>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--neutral-400)',
                            fontWeight: 500,
                          }}
                        >
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Concept filters */}
            {allConcepts.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--neutral-500)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  Concept ({allConcepts.length})
                </div>

                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'white',
                  borderRadius: '6px',
                  padding: 'var(--space-2)',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                }}>
                  {allConcepts.map(concept => {
                    const count = people.filter(p => p.concepts?.some(c => c.id === concept.id)).length;
                    const isSelected = selectedConcepts.includes(concept.id);
                    return (
                      <label
                        key={concept.id}
                        style={{
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-700)',
                          background: isSelected ? 'color-mix(in srgb, var(--accent-gold) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-gold) 15%, white)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleConcept(concept.id);
                          }}
                          style={{ accentColor: 'var(--accent-gold)' }}
                        />
                        <span style={{ flex: 1 }}>{concept.label}</span>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--neutral-400)',
                            fontWeight: 500,
                          }}
                        >
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--neutral-500)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  Tag ({allTags.length})
                </div>

                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'white',
                  borderRadius: '6px',
                  padding: 'var(--space-2)',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                }}>
                  {allTags.map(tag => {
                    const count = people.filter(p => p.tags?.includes(tag)).length;
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <label
                        key={tag}
                        style={{
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-700)',
                          background: isSelected ? 'color-mix(in srgb, var(--accent-gold) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-gold) 15%, white)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleTag(tag);
                          }}
                          style={{ accentColor: 'var(--accent-gold)' }}
                        />
                        <span style={{ flex: 1 }}>{tag}</span>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--neutral-400)',
                            fontWeight: 500,
                          }}
                        >
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Source filters */}
            {allSources.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--neutral-500)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  Source ({allSources.length})
                </div>

                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'white',
                  borderRadius: '6px',
                  padding: 'var(--space-2)',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                }}>
                  <input
                    type="text"
                    value={sourceSearchFilter}
                    onChange={(e) => setSourceSearchFilter(e.target.value)}
                    placeholder="Search sources..."
                    style={{
                      width: '100%',
                      padding: 'var(--space-2)',
                      marginBottom: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      border: '1px solid var(--neutral-300)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-body)',
                      background: 'white',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = 'none';
                      e.currentTarget.style.border = '2px solid var(--accent-gold)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent-gold) 15%, transparent)';
                      e.currentTarget.style.padding = 'calc(var(--space-2) - 1px)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = '1px solid var(--neutral-300)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.padding = 'var(--space-2)';
                    }}
                  />
                  {filteredSourcesForSidebar.map(source => {
                    const count = people.filter(p => p.sources?.some(s => s.id === source.id)).length;
                    const isSelected = selectedSources.includes(source.id);
                    return (
                      <label
                        key={source.id}
                        style={{
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-700)',
                          background: isSelected ? 'color-mix(in srgb, var(--accent-gold) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-gold) 15%, white)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSource(source.id);
                          }}
                          style={{ accentColor: 'var(--accent-gold)' }}
                        />
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }} title={source.title}>{source.title}</span>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--neutral-400)',
                            fontWeight: 500,
                          }}
                        >
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collection filters */}
            {allCollections.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--neutral-500)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  Collection ({allCollections.length})
                </div>

                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'white',
                  borderRadius: '6px',
                  padding: 'var(--space-2)',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                }}>
                  {allCollections.map(collection => {
                    const count = people.filter(p => p.collections?.some(c => c.id === collection.id)).length;
                    const isSelected = selectedCollections.includes(collection.id);
                    return (
                      <label
                        key={collection.id}
                        style={{
                          fontFamily: 'var(--font-body)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--neutral-700)',
                          background: isSelected ? 'color-mix(in srgb, var(--accent-gold) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-gold) 15%, white)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleCollection(collection.id);
                          }}
                          style={{ accentColor: 'var(--accent-gold)' }}
                        />
                        <span style={{ flex: 1 }}>{collection.name}</span>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--neutral-400)',
                            fontWeight: 500,
                          }}
                        >
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute',
          left: sidebarOpen ? '280px' : '0',
          top: '164px',
          width: '24px',
          height: '48px',
          background: 'var(--accent-gold)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
          transition: 'left 0.3s ease',
          zIndex: 20,
          boxShadow: '2px 0 4px rgba(0, 0, 0, 0.2)',
        }}
        className="sidebar-toggle"
        title={sidebarOpen ? 'Hide filters' : 'Show filters'}
      >
        <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px' }}></i>
      </button>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-6) var(--space-8)',
          background: 'color-mix(in srgb, var(--accent-gold) 15%, white)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          position: 'relative',
          zIndex: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-4xl)',
                  fontWeight: 700,
                  color: 'var(--accent-gold)',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                People
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--neutral-600)',
                  marginTop: 'var(--space-1)',
                  marginBottom: 0,
                }}
              >
                {filteredPeople.length} of {people.length} people
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{
                width: '48px',
                height: '48px',
                minWidth: '48px',
                minHeight: '48px',
                flexShrink: 0,
                borderRadius: '50%',
                background: 'var(--accent-gold)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-xl)',
                transition: 'all 0.15s',
                boxShadow: 'var(--shadow-md)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#8a6624';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-gold)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              title="New Person"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <PersonFormModal
          isOpen={showForm}
          onClose={() => {
            // Refresh data when closing edit modal (autosave means changes may have been made)
            if (editingPerson) {
              fetchPeople();
            }
            setShowForm(false);
            setEditingPerson(null);
          }}
          onSuccess={() => {
            fetchPeople();
            setShowForm(false);
            setEditingPerson(null);
          }}
          item={editingPerson}
        />

        {/* People Table */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          paddingTop: 'var(--space-8)',
        }}>
          {sortedPeople.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                margin: 'var(--space-6)',
                marginLeft: 'calc(var(--space-6) + 24px)',
                background: 'white',
                border: '1px solid var(--neutral-200)',
                borderRadius: '4px',
              }}
            >
              <p style={{ fontSize: 'var(--text-lg)', marginBottom: '1rem', color: 'var(--neutral-700)' }}>
                No people found.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)' }}>
                {hasActiveFilters ? 'Try adjusting your filters.' : 'Add your first person to track intellectual lineage and influence.'}
              </p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead style={{
                  background: 'white',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <tr>
                    <th
                      onClick={() => handleSort('name')}
                      style={{
                        fontFamily: 'var(--font-display)',
                        textAlign: 'left',
                        padding: '0.75rem 1rem 0.75rem 2rem',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--accent-gold)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Name {sortField === 'name' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th
                      onClick={() => handleSort('role')}
                      style={{
                        fontFamily: 'var(--font-display)',
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--accent-gold)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Role {sortField === 'role' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th style={{
                      fontFamily: 'var(--font-display)',
                      textAlign: 'center',
                      padding: '0.75rem 1rem',
                      fontWeight: 600,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--accent-gold)',
                      width: '80px'
                    }}>
                      Contact
                    </th>
                    <th
                      onClick={() => handleSort('sources')}
                      style={{
                        fontFamily: 'var(--font-display)',
                        textAlign: 'center',
                        padding: '0.75rem 1rem',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--accent-gold)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'opacity 0.15s',
                        width: '100px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Sources {sortField === 'sources' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th
                      onClick={() => handleSort('notes')}
                      style={{
                        fontFamily: 'var(--font-display)',
                        textAlign: 'center',
                        padding: '0.75rem 1rem',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--accent-gold)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'opacity 0.15s',
                        width: '100px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Notes {sortField === 'notes' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th
                      onClick={() => handleSort('tags')}
                      style={{
                        fontFamily: 'var(--font-display)',
                        textAlign: 'center',
                        padding: '0.75rem 1rem',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--accent-gold)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'opacity 0.15s',
                        width: '100px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Tags {sortField === 'tags' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th style={{
                      padding: '0.75rem 1rem',
                      width: '60px'
                    }}>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPeople.map(person => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      onUpdate={fetchPeople}
                      onEdit={(person) => {
                        setEditingPerson(person);
                        setShowForm(true);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PersonRow({ person, onUpdate, onEdit }) {
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${person.full_name}"?`)) return;

    try {
      const response = await fetch(`/people/${person.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete person');
      }
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  };

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--neutral-200)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {/* Name */}
      <td style={{ padding: '0.75rem 1rem 0.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <a
            href={`/people/${person.id}`}
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--neutral-900)',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-900)'}
          >
            {person.full_name}
          </a>
          <button
            onClick={() => onEdit(person)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--neutral-400)',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '2px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-gold)';
              e.currentTarget.style.background = 'var(--neutral-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--neutral-400)';
              e.currentTarget.style.background = 'transparent';
            }}
            title={`Edit ${person.full_name}`}
          >
            <i className="fas fa-pen"></i>
          </button>
        </div>
      </td>

      {/* Role */}
      <td style={{ padding: '0.75rem 1rem' }}>
        {person.role && (
          <span
            className="tag"
            style={{
              textTransform: 'uppercase',
              background: 'var(--accent-gold-light)',
              color: 'var(--accent-gold)',
              fontSize: 'var(--text-xs)',
              padding: '0.25rem 0.5rem',
            }}
          >
            {person.role.replace(/_/g, ' ')}
          </span>
        )}
      </td>

      {/* Contact */}
      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              style={{
                color: 'var(--accent-gold)',
                fontSize: 'var(--text-sm)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#8a6624'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
              title={person.email}
            >
              <i className="fas fa-envelope"></i>
            </a>
          )}
          {person.url && (
            <a
              href={person.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-gold)',
                fontSize: 'var(--text-sm)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#8a6624'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
              title={person.url}
            >
              <i className="fas fa-link"></i>
            </a>
          )}
        </div>
      </td>

      {/* Sources */}
      <td style={{
        padding: '0.75rem 1rem',
        textAlign: 'center',
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-600)',
        fontFamily: 'var(--font-body)',
      }}>
        {person.sources_count || 0}
      </td>

      {/* Notes */}
      <td style={{
        padding: '0.75rem 1rem',
        textAlign: 'center',
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-600)',
        fontFamily: 'var(--font-body)',
      }}>
        {person.notes_count || 0}
      </td>

      {/* Tags */}
      <td style={{
        padding: '0.75rem 1rem',
        textAlign: 'center',
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-600)',
        fontFamily: 'var(--font-body)',
      }}>
        {(person.tags || []).length}
      </td>

      {/* Delete */}
      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
        <button
          onClick={handleDelete}
          className="icon-btn"
          title="Delete"
          style={{
            color: 'var(--accent-gold)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            fontSize: 'var(--text-sm)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#8a6624'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
        >
          <i className="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  );
}
