import React, { useState, useEffect } from 'react';
import SourceFormModal from './SourceFormModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

export default function SourcesIndex() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState([]);
  const [selectedAuthors, setSelectedAuthors] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchSources();
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

  const fetchSources = async () => {
    try {
      const response = await fetch('/sources.json');
      const data = await response.json();
      setSources(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setLoading(false);
    }
  };

  // Get unique values for filters
  const sourceKinds = [...new Set(sources.map(s => s.kind))].filter(Boolean).sort();

  const peopleMap = new Map();
  sources.forEach(s => {
    (s.people || []).forEach(p => {
      if (!peopleMap.has(p.id)) {
        peopleMap.set(p.id, { id: p.id, full_name: p.full_name });
      }
    });
  });
  const allAuthors = Array.from(peopleMap.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));

  const allTags = [...new Set(sources.flatMap(s => s.tags || []))].filter(Boolean).sort();

  const years = [...new Set(sources.map(s => s.year).filter(Boolean))].sort((a, b) => a - b);
  const minYear = years[0] || new Date().getFullYear();
  const maxYear = years[years.length - 1] || new Date().getFullYear();

  // Filter sources
  const filteredSources = sources.filter(source => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = source.title?.toLowerCase().includes(query);
      const matchesAuthors = typeof source.authors === 'string' && source.authors.toLowerCase().includes(query);
      const matchesAbstract = source.abstract?.toLowerCase().includes(query);
      const matchesSummary = source.summary?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesAuthors && !matchesAbstract && !matchesSummary) {
        return false;
      }
    }

    // Kind filter
    if (selectedKinds.length > 0 && !selectedKinds.includes(source.kind)) {
      return false;
    }

    // Author filter
    if (selectedAuthors.length > 0 && !source.people?.some(p => selectedAuthors.includes(p.id))) {
      return false;
    }

    // Tag filter
    if (selectedTags.length > 0 && !source.tags?.some(t => selectedTags.includes(t))) {
      return false;
    }

    // Year range filter
    if (yearMin && source.year < parseInt(yearMin)) {
      return false;
    }
    if (yearMax && source.year > parseInt(yearMax)) {
      return false;
    }

    return true;
  });

  // Toggle selections
  const toggleKind = (kind) => {
    setSelectedKinds(prev =>
      prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind]
    );
  };

  const toggleAuthor = (authorId) => {
    setSelectedAuthors(prev =>
      prev.includes(authorId) ? prev.filter(a => a !== authorId) : [...prev, authorId]
    );
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearAllFilters = () => {
    setSelectedKinds([]);
    setSelectedAuthors([]);
    setSelectedTags([]);
    setYearMin('');
    setYearMax('');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedKinds.length > 0 || selectedAuthors.length > 0 ||
                          selectedTags.length > 0 || yearMin || yearMax || searchQuery;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading sources...</p>
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
                placeholder="Title, author, abstract..."
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
                  color: 'var(--accent-blue)',
                  background: 'transparent',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-blue-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Clear All Filters
              </button>
            )}

            {/* Type filters */}
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
                Type
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {sourceKinds.map(kind => {
                  const count = sources.filter(s => s.kind === kind).length;
                  const isSelected = selectedKinds.includes(kind);
                  return (
                    <label
                      key={kind}
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
                          toggleKind(kind);
                        }}
                        style={{ accentColor: 'var(--accent-blue)' }}
                      />
                      <span style={{ flex: 1, textTransform: 'capitalize' }}>{kind.replace(/_/g, ' ')}</span>
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

            {/* Author filters */}
            {allAuthors.length > 0 && (
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
                  Author
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {allAuthors.map(author => {
                    const count = sources.filter(s => s.people?.some(p => p.id === author.id)).length;
                    const isSelected = selectedAuthors.includes(author.id);
                    return (
                      <label
                        key={author.id}
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
                            toggleAuthor(author.id);
                          }}
                          style={{ accentColor: 'var(--accent-blue)' }}
                        />
                        <span style={{ flex: 1 }}>{author.full_name}</span>
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
                    const count = sources.filter(s => s.tags?.includes(tag)).length;
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
                          style={{ accentColor: 'var(--accent-blue)' }}
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

            {/* Year Range */}
            {years.length > 0 && (
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
                  Year Range
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder={minYear.toString()}
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value)}
                    className="form-input"
                    style={{
                      flex: 1,
                      fontSize: 'var(--text-sm)',
                      padding: 'var(--space-2)',
                    }}
                    min={minYear}
                    max={maxYear}
                  />
                  <span style={{ color: 'var(--neutral-500)' }}>–</span>
                  <input
                    type="number"
                    placeholder={maxYear.toString()}
                    value={yearMax}
                    onChange={(e) => setYearMax(e.target.value)}
                    className="form-input"
                    style={{
                      flex: 1,
                      fontSize: 'var(--text-sm)',
                      padding: 'var(--space-2)',
                    }}
                    min={minYear}
                    max={maxYear}
                  />
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
          background: 'var(--accent-blue)',
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
                Sources
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-500)',
                  margin: 0,
                }}
              >
                {filteredSources.length} of {sources.length} sources
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
                background: 'var(--accent-blue)',
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
                e.currentTarget.style.background = 'var(--accent-blue-dark)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-blue)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              title="New Source"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <SourceFormModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            fetchSources();
            setShowForm(false);
          }}
        />

        {/* Sources Cards */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6)',
          paddingLeft: 'calc(var(--space-6) + 24px)',
          background: 'white'
        }}>
          {filteredSources.length === 0 ? (
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
                No sources found.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)' }}>
                {hasActiveFilters ? 'Try adjusting your filters.' : 'Add your first source to build your evidence base.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {filteredSources.map(source => (
                <SourceCard key={source.id} source={source} onUpdate={fetchSources} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SourceCard({ source, onUpdate }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showAbstract, setShowAbstract] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this source?')) return;

    try {
      const response = await fetch(`/sources/${source.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting source:', error);
    }
  };

  return (
    <>
      <div
        className="card"
        style={{
          overflow: 'hidden',
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.18), 0 2px 4px rgba(0, 0, 0, 0.12)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Card Header */}
        <div style={{
          background: 'var(--card-header)',
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--neutral-200)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
            {source.pdf_url && (
              <a
                href={source.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--accent-blue)',
                  fontSize: 'var(--text-base)',
                }}
                title="View PDF"
              >
                <i className="fas fa-file-pdf"></i>
              </a>
            )}
            <a
              href={`/sources/${source.id}`}
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--neutral-900)',
                textDecoration: 'none',
                lineHeight: 1.4,
                transition: 'color 0.15s',
                flex: 1,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-900)'}
            >
              {source.title}
            </a>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'var(--space-4)' }}>
            <button
              onClick={() => setShowEdit(true)}
              className="icon-btn"
              title="Edit"
              style={{ color: 'var(--accent-blue)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue-dark)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
            >
              <i className="fas fa-pen"></i>
            </button>
            <button
              onClick={handleDelete}
              className="icon-btn"
              title="Delete"
              style={{ color: 'var(--accent-blue)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue-dark)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div style={{ padding: 'var(--space-4)' }}>
          {/* Authors and metadata */}
          {(source.authors || source.year || source.kind) && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              {source.authors && (
                <div style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-700)',
                  marginBottom: 'var(--space-1)',
                }}>
                  {source.authors}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', fontSize: 'var(--text-xs)' }}>
                {source.kind && (
                  <span className="tag" style={{ textTransform: 'uppercase', background: 'var(--accent-blue-light)', color: 'var(--accent-blue)' }}>
                    {source.kind.replace(/_/g, ' ')}
                  </span>
                )}
                {source.year && (
                  <span style={{ color: 'var(--neutral-600)', fontWeight: 600 }}>
                    {source.year}
                  </span>
                )}
                {source.doi && (
                  <a
                    href={`https://doi.org/${source.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--accent-blue)',
                      fontFamily: 'monospace',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                  >
                    DOI
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Abstract */}
          {source.abstract && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  lineHeight: 1.6,
                  color: 'var(--neutral-700)',
                  display: showAbstract ? 'block' : '-webkit-box',
                  WebkitLineClamp: showAbstract ? 'unset' : 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                dangerouslySetInnerHTML={{ __html: source.abstract }}
              />
              {source.abstract.length > 200 && (
                <button
                  onClick={() => setShowAbstract(!showAbstract)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--accent-blue)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    marginTop: 'var(--space-1)',
                    fontWeight: 500,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue-dark)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                >
                  {showAbstract ? 'Show Less' : 'Show More'}
                </button>
              )}
            </div>
          )}

          {/* Tags */}
          {(source.concepts?.length > 0 || source.tags?.length > 0 || source.people?.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {source.concepts?.map((concept) => (
                <a
                  key={concept.id}
                  href={`/concepts/${concept.id}`}
                  className="tag concept"
                  style={{ textDecoration: 'none' }}
                >
                  {concept.label}
                </a>
              ))}
              {source.tags?.map((tag, idx) => (
                <span key={idx} className="tag tag-purple">
                  {tag}
                </span>
              ))}
              {source.people?.map((person) => (
                <a
                  key={person.id}
                  href={`/people/${person.id}`}
                  className="tag person"
                  style={{ textDecoration: 'none' }}
                >
                  {person.full_name}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div style={{
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--card-footer)',
          borderTop: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-500)',
        }}>
          <a
            href={`/sources/${source.id}/study`}
            style={{
              color: 'var(--accent-teal)',
              textDecoration: 'none',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            <i className="fas fa-pen"></i>
            Take Notes
          </a>

          <span>{source.notes_count || 0} note{source.notes_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <SourceFormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          onUpdate();
          setShowEdit(false);
        }}
        item={source}
      />
    </>
  );
}
