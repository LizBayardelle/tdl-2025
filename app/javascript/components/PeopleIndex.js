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

  const clearAllFilters = () => {
    setSelectedRoles([]);
    setSelectedConcepts([]);
    setSelectedTags([]);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedRoles.length > 0 || selectedConcepts.length > 0 ||
                          selectedTags.length > 0 || searchQuery;

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
          background: 'var(--sidebar-bg)',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: sidebarOpen ? 'var(--space-6)' : '0',
          boxShadow: sidebarOpen ? 'inset -8px 0 16px -8px rgba(0, 0, 0, 0.25)' : 'none',
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
                Role
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
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
                        background: isSelected ? 'var(--neutral-200)' : 'transparent',
                        transition: 'background 0.15s',
                        marginBottom: '0.125rem',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--neutral-100)';
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
                  Concept
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
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
                          background: isSelected ? 'var(--neutral-200)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--neutral-100)';
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
                  Tag
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
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
                          background: isSelected ? 'var(--neutral-200)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--neutral-100)';
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
          zIndex: 5,
          boxShadow: '2px 0 4px rgba(0, 0, 0, 0.2)',
        }}
        className="sidebar-toggle"
        title={sidebarOpen ? 'Hide filters' : 'Show filters'}
      >
        <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px' }}></i>
      </button>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-3xl)',
                  fontWeight: 700,
                  color: 'var(--neutral-900)',
                  letterSpacing: '-0.02em',
                  marginBottom: 'var(--space-1)',
                }}
              >
                People
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-500)',
                  margin: 0,
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
          overflowY: 'auto',
          padding: 'var(--space-6)',
          paddingLeft: 'calc(var(--space-6) + 24px)',
          background: 'var(--background)'
        }}>
          {sortedPeople.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
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
            <div style={{ background: 'white', borderRadius: '4px', border: '1px solid var(--neutral-200)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--neutral-200)' }}>
                  <tr>
                    <th
                      onClick={() => handleSort('name')}
                      style={{
                        fontFamily: 'var(--font-display)',
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        fontWeight: 600,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--neutral-700)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
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
                        color: 'var(--neutral-700)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
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
                      color: 'var(--neutral-700)',
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
                        color: 'var(--neutral-700)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.15s',
                        width: '100px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
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
                        color: 'var(--neutral-700)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.15s',
                        width: '100px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
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
                        color: 'var(--neutral-700)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.15s',
                        width: '100px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
                    >
                      Tags {sortField === 'tags' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th style={{
                      fontFamily: 'var(--font-display)',
                      textAlign: 'right',
                      padding: '0.75rem 1rem',
                      fontWeight: 600,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-700)',
                      width: '100px'
                    }}>
                      Actions
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
      <td style={{ padding: '0.75rem 1rem' }}>
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

      {/* Actions */}
      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onEdit(person)}
            className="icon-btn"
            title="Edit"
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
            <i className="fas fa-pen"></i>
          </button>
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
        </div>
      </td>
    </tr>
  );
}
