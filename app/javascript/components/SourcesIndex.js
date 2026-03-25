import React, { useState, useEffect, useRef } from 'react';
import SourceFormModal from './SourceFormModal';
import PdfUploadModal from './PdfUploadModal';
import AuthorsDisplay from './AuthorsDisplay';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

const ITEMS_PER_PAGE_CARDS = 20;
const ITEMS_PER_PAGE_LIST = 50;

export default function SourcesIndex() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState([]);
  const [selectedAuthors, setSelectedAuthors] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pdfOnly, setPdfOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
  const [sortColumn, setSortColumn] = useState(null); // 'title' or 'year'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // Server-side pagination state
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter metadata (loaded once from first page)
  const [filterMeta, setFilterMeta] = useState({
    kinds: [],
    years: [],
    authors: [],
    tags: [],
    collections: [],
    pdfCount: 0
  });

  const itemsPerPage = viewMode === 'cards' ? ITEMS_PER_PAGE_CARDS : ITEMS_PER_PAGE_LIST;
  const isFirstRender = useRef(true);

  useEffect(() => {
    fetchSources(1, true);
  }, []);

  // Refetch when view mode or sort changes (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSources([]);
    setCurrentPage(1);
    fetchSources(1, true);
  }, [viewMode, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'year' ? 'desc' : 'asc');
    }
  };

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

  const fetchSources = async (page = 1, isInitial = false, perPage = null) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const effectivePerPage = perPage || itemsPerPage;
      let url = `/sources.json?page=${page}&per_page=${effectivePerPage}`;
      if (sortColumn) {
        url += `&sort_by=${sortColumn}&sort_dir=${sortDirection}`;
      }
      const response = await fetch(url);
      const data = await response.json();

      // Handle both old array format and new paginated format
      if (Array.isArray(data)) {
        // Old format - array of sources
        setSources(data);
        setTotalCount(data.length);
        setTotalPages(1);
      } else if (data.sources) {
        // New paginated format
        if (page === 1) {
          setSources(data.sources);
          // Store filter metadata from first page
          if (data.filters) {
            setFilterMeta({
              kinds: data.filters.kinds || [],
              years: data.filters.years || [],
              authors: data.filters.authors || [],
              tags: data.filters.tags || [],
              collections: data.filters.collections || [],
              pdfCount: data.filters.pdf_count || 0
            });
          }
        } else {
          setSources(prev => [...prev, ...data.sources]);
        }

        if (data.pagination) {
          setTotalCount(data.pagination.total_count);
          setTotalPages(data.pagination.total_pages);
        }
      } else {
        console.error('Unexpected response format:', data);
        setSources([]);
      }

      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setSources([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreSources = () => {
    if (currentPage < totalPages && !loadingMore) {
      fetchSources(currentPage + 1);
    }
  };

  // Use filter metadata for sidebar
  const sourceKinds = filterMeta.kinds;
  const allAuthors = filterMeta.authors;
  const allTags = filterMeta.tags;
  const allCollections = filterMeta.collections;
  const years = filterMeta.years;
  const minYear = years[0] || new Date().getFullYear();
  const maxYear = years[years.length - 1] || new Date().getFullYear();

  // Filter sources (client-side filtering on loaded data)
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

    // Collection filter
    if (selectedCollections.length > 0 && !source.collections?.some(c => selectedCollections.includes(c.id))) {
      return false;
    }

    // Year range filter
    if (yearMin && source.year < parseInt(yearMin)) {
      return false;
    }
    if (yearMax && source.year > parseInt(yearMax)) {
      return false;
    }

    // PDF filter
    if (pdfOnly && !source.pdf_url) {
      return false;
    }

    return true;
  });

  const hasMorePages = currentPage < totalPages;

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

  const toggleCollection = (collectionId) => {
    setSelectedCollections(prev =>
      prev.includes(collectionId) ? prev.filter(c => c !== collectionId) : [...prev, collectionId]
    );
  };

  const clearAllFilters = () => {
    setSelectedKinds([]);
    setSelectedAuthors([]);
    setSelectedTags([]);
    setSelectedCollections([]);
    setYearMin('');
    setYearMax('');
    setSearchQuery('');
    setPdfOnly(false);
  };

  const hasActiveFilters = selectedKinds.length > 0 || selectedAuthors.length > 0 ||
                          selectedTags.length > 0 || selectedCollections.length > 0 || yearMin || yearMax || searchQuery || pdfOnly;

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

            {/* Sort dropdown */}
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
                Sort By
              </div>
              <select
                value={sortColumn ? `${sortColumn}-${sortDirection}` : 'created_at-desc'}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split('-');
                  setSortColumn(col);
                  setSortDirection(dir);
                }}
                className="form-input"
                style={{
                  width: '100%',
                  fontSize: 'var(--text-sm)',
                  padding: 'var(--space-2)',
                  cursor: 'pointer',
                }}
              >
                <option value="created_at-desc">Recently Added</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="title-desc">Title (Z-A)</option>
                <option value="year-desc">Year (Newest)</option>
                <option value="year-asc">Year (Oldest)</option>
                <option value="notes_count-desc">Most Notes</option>
                <option value="notes_count-asc">Fewest Notes</option>
              </select>
            </div>

            {/* PDF Filter Toggle */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-700)',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  PDFs Only
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-400)',
                      fontWeight: 500,
                    }}
                  >
                    ({filterMeta.pdfCount})
                  </span>
                </span>
                <div
                  className={`toggle-switch ${pdfOnly ? 'active' : ''}`}
                  onClick={() => setPdfOnly(!pdfOnly)}
                >
                  <div className="toggle-slider"></div>
                </div>
              </label>
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
                Type ({sourceKinds.length})
              </div>

              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'white',
                borderRadius: '6px',
                padding: 'var(--space-2)',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
              }}>
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
                        background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 20%, white)' : 'transparent',
                        transition: 'background 0.15s',
                        marginBottom: '0.125rem',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 15%, white)';
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
                  Author ({allAuthors.length})
                </div>

                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'white',
                  borderRadius: '6px',
                  padding: 'var(--space-2)',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
                }}>
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
                          background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 15%, white)';
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
                          background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 15%, white)';
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
                    const count = sources.filter(s => s.collections?.some(c => c.id === collection.id)).length;
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
                          background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 20%, white)' : 'transparent',
                          transition: 'background 0.15s',
                          marginBottom: '0.125rem',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 15%, white)';
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
                          style={{ accentColor: 'var(--accent-blue)' }}
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
          zIndex: 10,
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
          background: 'color-mix(in srgb, var(--accent-blue) 15%, white)',
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
                  color: 'var(--accent-blue)',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                Sources
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
                {filteredSources.length} of {totalCount} sources
                {sources.length < totalCount && ` (${sources.length} loaded)`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {/* View toggle */}
              <div style={{
                display: 'flex',
                background: 'white',
                borderRadius: '6px',
                padding: '2px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
              }}>
                <button
                  onClick={() => setViewMode('cards')}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    border: 'none',
                    borderRadius: '4px',
                    background: viewMode === 'cards' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'cards' ? 'white' : 'var(--neutral-600)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                  title="Card view"
                >
                  <i className="fas fa-th-large"></i>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    border: 'none',
                    borderRadius: '4px',
                    background: viewMode === 'list' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'list' ? 'white' : 'var(--neutral-600)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                  title="List view"
                >
                  <i className="fas fa-list"></i>
                </button>
              </div>
              <button
                onClick={() => setShowPdfModal(true)}
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
                title="Add New Source"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>

        <PdfUploadModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          onSuccess={() => {
            fetchSources();
            setShowPdfModal(false);
          }}
        />

        {/* Sources Cards */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6)',
          paddingTop: 'var(--space-8)',
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
            <>
              {viewMode === 'cards' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {filteredSources.map(source => (
                    <SourceCard key={source.id} source={source} onUpdate={() => fetchSources(1, true)} />
                  ))}
                </div>
              ) : (
                <SourcesTable
                  sources={filteredSources}
                  onUpdate={() => fetchSources(1, true)}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              )}

              {/* Load More */}
              {hasMorePages && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-6)',
                    paddingBottom: 'var(--space-4)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--neutral-500)',
                    }}
                  >
                    Showing {sources.length} of {totalCount} sources
                  </span>
                  <button
                    onClick={loadMoreSources}
                    disabled={loadingMore}
                    style={{
                      padding: 'var(--space-3) var(--space-6)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      background: loadingMore ? 'var(--neutral-200)' : 'var(--accent-blue)',
                      color: loadingMore ? 'var(--neutral-500)' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!loadingMore) e.currentTarget.style.background = 'var(--accent-blue-dark)';
                    }}
                    onMouseLeave={(e) => {
                      if (!loadingMore) e.currentTarget.style.background = 'var(--accent-blue)';
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <i className="fas fa-spinner fa-spin" style={{ marginRight: 'var(--space-2)' }}></i>
                        Loading...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-plus" style={{ marginRight: 'var(--space-2)' }}></i>
                        Load More
                      </>
                    )}
                  </button>
                </div>
              )}

              {!hasMorePages && sources.length > 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: 'var(--space-6)',
                    paddingBottom: 'var(--space-4)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--neutral-500)',
                  }}
                >
                  Showing all {totalCount} sources
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SourcesTable({ sources, onUpdate, sortColumn, sortDirection, onSort }) {
  const [editingSource, setEditingSource] = useState(null);

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return <i className="fas fa-sort" style={{ opacity: 0.3, marginLeft: '4px' }}></i>;
    }
    return sortDirection === 'asc'
      ? <i className="fas fa-sort-up" style={{ marginLeft: '4px' }}></i>
      : <i className="fas fa-sort-down" style={{ marginLeft: '4px' }}></i>;
  };

  const handleDelete = async (source) => {
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
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        overflowX: 'auto',
      }}>
        <table style={{
          minWidth: '900px',
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
        }}>
          <thead>
            <tr style={{
              background: '#e2e2e2',
              borderBottom: '2px solid var(--neutral-300)',
            }}>
              <th style={{
                padding: 'var(--space-3) var(--space-2)',
                textAlign: 'center',
                fontWeight: 600,
                color: 'var(--neutral-700)',
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                width: '40px',
              }}>PDF</th>
              <th
                onClick={() => onSort('title')}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: sortColumn === 'title' ? 'var(--accent-blue)' : 'var(--neutral-700)',
                  fontSize: 'var(--text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  minWidth: '300px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Title
                <SortIcon column="title" />
              </th>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'left',
                fontWeight: 600,
                color: 'var(--neutral-700)',
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                width: '220px',
              }}>Authors</th>
              <th
                onClick={() => onSort('year')}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: sortColumn === 'year' ? 'var(--accent-blue)' : 'var(--neutral-700)',
                  fontSize: 'var(--text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: '80px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Year
                <SortIcon column="year" />
              </th>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'left',
                fontWeight: 600,
                color: 'var(--neutral-700)',
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                width: '280px',
              }}>Badges</th>
              <th style={{
                padding: 'var(--space-3) var(--space-4)',
                textAlign: 'center',
                fontWeight: 600,
                color: 'var(--neutral-700)',
                fontSize: 'var(--text-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                width: '80px',
              }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source, index) => (
              <tr
                key={source.id}
                style={{
                  borderBottom: '1px solid var(--neutral-200)',
                  background: index % 2 === 0 ? 'white' : 'var(--neutral-50)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 5%, white)'}
                onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'white' : 'var(--neutral-50)'}
              >
                <td style={{ padding: 'var(--space-3) var(--space-2)', textAlign: 'center' }}>
                  {source.pdf_url ? (
                    <a
                      href={source.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-blue)', fontSize: 'var(--text-base)' }}
                      title="View PDF"
                    >
                      <i className="fas fa-file-pdf"></i>
                    </a>
                  ) : (
                    <span style={{ color: 'var(--neutral-300)' }}>—</span>
                  )}
                </td>
                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <a
                    href={`/sources/${source.id}`}
                    style={{
                      color: 'var(--neutral-900)',
                      textDecoration: 'none',
                      fontWeight: 400,
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-900)'}
                  >
                    {source.title}
                  </a>
                </td>
                <td style={{
                  padding: 'var(--space-3) var(--space-4)',
                  color: 'var(--neutral-700)',
                  maxWidth: '220px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'var(--text-xs)',
                }}>
                  {source.authors || (source.people?.length > 0 ? source.people.map(p => p.full_name).join(', ') : '—')}
                </td>
                <td style={{
                  padding: 'var(--space-3) var(--space-4)',
                  textAlign: 'center',
                  color: 'var(--neutral-600)',
                  fontWeight: 600,
                }}>
                  {source.year || '—'}
                </td>
                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {source.kind && (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 500,
                        background: 'var(--accent-blue-light)',
                        color: 'var(--accent-blue)',
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                      }}>
                        {source.kind.replace(/_/g, ' ')}
                      </span>
                    )}
                    {source.doi && (
                      <a
                        href={`https://doi.org/${source.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 500,
                          background: 'var(--accent-teal-light)',
                          color: 'var(--accent-teal)',
                          borderRadius: '3px',
                          textDecoration: 'none',
                        }}
                      >
                        DOI
                      </a>
                    )}
                    {source.notes_count > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 6px',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 500,
                        background: 'var(--accent-gold-light)',
                        color: 'var(--accent-gold)',
                        borderRadius: '3px',
                      }}>
                        <i className="fas fa-sticky-note" style={{ fontSize: '9px' }}></i>
                        {source.notes_count}
                      </span>
                    )}
                    {source.collections?.slice(0, 2).map((collection) => (
                      <a
                        key={collection.id}
                        href={`/collections/${collection.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 6px',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 500,
                          background: 'var(--accent-maroon-light)',
                          color: 'var(--accent-maroon)',
                          borderRadius: '3px',
                          textDecoration: 'none',
                        }}
                      >
                        <i className="fas fa-folder" style={{ fontSize: '9px' }}></i>
                        {collection.name}
                      </a>
                    ))}
                    {source.collections?.length > 2 && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                      }}>
                        +{source.collections.length - 2}
                      </span>
                    )}
                    {source.concepts?.slice(0, 2).map((concept) => (
                      <a
                        key={concept.id}
                        href={`/concepts/${concept.id}`}
                        className="tag concept"
                        style={{ textDecoration: 'none', padding: '2px 6px', fontSize: 'var(--text-xs)' }}
                      >
                        {concept.label}
                      </a>
                    ))}
                    {source.concepts?.length > 2 && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                      }}>
                        +{source.concepts.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => setEditingSource(source)}
                      className="icon-btn"
                      title="Edit"
                      style={{ color: 'var(--accent-blue)', fontSize: 'var(--text-sm)' }}
                    >
                      <i className="fas fa-pen"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(source)}
                      className="icon-btn"
                      title="Delete"
                      style={{ color: 'var(--accent-blue)', fontSize: 'var(--text-sm)' }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingSource && (
        <SourceFormModal
          isOpen={true}
          onClose={() => {
            onUpdate();
            setEditingSource(null);
          }}
          onSuccess={() => {
            onUpdate();
            setEditingSource(null);
          }}
          item={editingSource}
        />
      )}
    </>
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
          background: '#e2e2e2',
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
                  <AuthorsDisplay
                    authors={source.authors}
                    people={source.people}
                    onPersonClick={(personId) => window.location.href = `/people/${personId}`}
                  />
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

          {/* Tags & Keywords */}
          {(source.concepts?.length > 0 || source.tags?.length > 0 || source.people?.length > 0 || source.collections?.length > 0 || source.keywords?.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {source.collections?.map((collection) => (
                <a
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 500,
                    background: 'var(--accent-maroon-light)',
                    color: 'var(--accent-maroon)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-body)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-maroon) 25%, white)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-maroon-light)'}
                >
                  <i className="fas fa-folder" style={{ fontSize: '10px' }}></i>
                  {collection.name}
                </a>
              ))}
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
              {source.keywords?.map((keyword, idx) => (
                <span
                  key={`kw-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 400,
                    background: 'var(--neutral-100)',
                    color: 'var(--neutral-600)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)',
                    border: '1px solid var(--neutral-200)',
                  }}
                  title="Author keyword"
                >
                  <i className="fas fa-key" style={{ fontSize: '8px', opacity: 0.6 }}></i>
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div style={{
          padding: 'var(--space-2) var(--space-4)',
          background: '#e2e2e2',
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
        onClose={() => {
          // Refresh data when closing edit modal (autosave means changes may have been made)
          onUpdate();
          setShowEdit(false);
        }}
        onSuccess={() => {
          onUpdate();
          setShowEdit(false);
        }}
        item={source}
      />
    </>
  );
}
