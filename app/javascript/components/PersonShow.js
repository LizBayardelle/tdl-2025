import React, { useState, useEffect, useMemo } from 'react';
import PersonFormModal from './PersonFormModal';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import TagFormModal from './TagFormModal';
import ConceptSelector from './ConceptSelector';
import SourceSelector from './SourceSelector';
import TagSelector from './TagSelector';
import Modal from './Modal';

const PersonSidebar = React.memo(({
  sidebarOpen,
  allPeople,
  peopleLoading,
  currentPersonId,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  onPersonClick
}) => {
  const filteredPeople = useMemo(() => {
    return allPeople
      .filter(p => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return p.full_name?.toLowerCase().includes(query) ||
               p.role?.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (sortBy === 'alphabetical') {
          return (a.full_name || '').localeCompare(b.full_name || '');
        } else if (sortBy === 'role') {
          return (a.role || '').localeCompare(b.role || '');
        } else {
          return new Date(b.updated_at) - new Date(a.updated_at);
        }
      });
  }, [allPeople, searchQuery, sortBy]);

  if (!sidebarOpen) return null;

  return (
    <div style={{
      width: '280px',
      background: 'var(--sidebar-bg)',
      overflowY: 'auto',
      padding: 'var(--space-4)',
      boxShadow: 'inset -8px 0 16px -8px rgba(0, 0, 0, 0.25)',
      flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <input
          type="text"
          placeholder="Search people..."
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

      {/* Sort */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="form-select"
          style={{
            width: '100%',
            fontSize: 'var(--text-sm)',
            padding: 'var(--space-2)',
          }}
        >
          <option value="recent">Recent</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="role">By Role</option>
        </select>
      </div>

      {/* People List */}
      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--neutral-500)',
        marginBottom: 'var(--space-3)',
        fontFamily: 'var(--font-body)',
      }}>
        People ({filteredPeople.length})
      </div>

      {peopleLoading ? (
        <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {filteredPeople.map(person => (
            <button
              key={person.id}
              onClick={() => onPersonClick(person.id, person.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: '4px',
                border: 'none',
                background: currentPersonId === person.id ? 'var(--neutral-200)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (currentPersonId !== person.id) e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (currentPersonId !== person.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-900)',
                fontWeight: currentPersonId === person.id ? 600 : 400,
              }}>
                {person.full_name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default function PersonShow({ personId: initialPersonId }) {
  const [currentPersonId, setCurrentPersonId] = useState(initialPersonId);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showLinkConceptModal, setShowLinkConceptModal] = useState(false);
  const [showLinkSourceModal, setShowLinkSourceModal] = useState(false);
  const [showLinkTagModal, setShowLinkTagModal] = useState(false);
  const [selectedConceptIds, setSelectedConceptIds] = useState([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch all people for sidebar
  useEffect(() => {
    const fetchAllPeople = async () => {
      try {
        const response = await fetch('/people.json');
        const data = await response.json();
        setAllPeople(data);
        setPeopleLoading(false);
      } catch (error) {
        console.error('Error fetching people:', error);
        setPeopleLoading(false);
      }
    };
    fetchAllPeople();
  }, []);

  // Handle responsive sidebar
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

  // Fetch person data when currentPersonId changes
  const fetchPerson = async () => {
    if (!currentPersonId) return;
    setLoading(true);
    try {
      const response = await fetch(`/people/${currentPersonId}.json`);
      const data = await response.json();
      setPerson(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching person:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerson();
  }, [currentPersonId]);

  const handlePersonClick = (personSlugOrId, personIdNum) => {
    setCurrentPersonId(personIdNum);
    window.history.pushState({}, '', `/people/${personSlugOrId}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${person.full_name}"? This action cannot be undone.`)) return;

    try {
      const response = await fetch(`/people/${currentPersonId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        window.location.href = '/people';
      } else {
        const data = await response.json();
        alert(data.error || 'Error deleting person');
      }
    } catch (error) {
      console.error('Error deleting person:', error);
      alert('Error deleting person');
    }
  };

  const handleLinkConcepts = async () => {
    try {
      const response = await fetch(`/people/${currentPersonId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          person: {
            concept_ids: selectedConceptIds
          }
        }),
      });

      if (response.ok) {
        await fetchPerson();
        setShowLinkConceptModal(false);
        setSelectedConceptIds([]);
      } else {
        alert('Error linking concepts');
      }
    } catch (error) {
      console.error('Error linking concepts:', error);
      alert('Error linking concepts');
    }
  };

  const handleLinkSources = async () => {
    try {
      const response = await fetch(`/people/${currentPersonId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          person: {
            source_ids: selectedSourceIds
          }
        }),
      });

      if (response.ok) {
        await fetchPerson();
        setShowLinkSourceModal(false);
        setSelectedSourceIds([]);
      } else {
        alert('Error linking sources');
      }
    } catch (error) {
      console.error('Error linking sources:', error);
      alert('Error linking sources');
    }
  };

  const handleLinkTags = async () => {
    try {
      const response = await fetch(`/people/${currentPersonId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          person: {
            tags: selectedTags
          }
        }),
      });

      if (response.ok) {
        await fetchPerson();
        setShowLinkTagModal(false);
        setSelectedTags([]);
      } else {
        alert('Error linking tags');
      }
    } catch (error) {
      console.error('Error linking tags:', error);
      alert('Error linking tags');
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      <PersonSidebar
        sidebarOpen={sidebarOpen}
        allPeople={allPeople}
        peopleLoading={peopleLoading}
        currentPersonId={currentPersonId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onPersonClick={handlePersonClick}
      />

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
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px' }}></i>
      </button>

      {/* Main content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: 'var(--space-6)',
        paddingRight: 'var(--space-6)',
        paddingBottom: 'var(--space-6)',
        paddingLeft: 'calc(var(--space-6) + 24px)',
        background: 'white',
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-500)' }}>
            Loading person...
          </div>
        ) : !person ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-500)' }}>
            Person not found
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              marginBottom: 'var(--space-6)',
              paddingTop: 'var(--space-4)',
              paddingBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--neutral-200)',
            }}>
              {/* Back link and action buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <a
                  href="/people"
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--accent-gold)',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold-dark)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                >
                  ← Back to People
                </a>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="icon-btn"
                    style={{ color: 'var(--accent-gold)' }}
                    title="Edit Person"
                  >
                    <i className="fas fa-pen"></i>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="icon-btn"
                    style={{ color: 'var(--accent-gold)' }}
                    title="Delete Person"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              {/* Name and role */}
              <div>
                <h1 style={{
                  fontSize: 'var(--text-3xl)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--neutral-900)',
                  lineHeight: 1.2,
                  marginBottom: 'var(--space-3)',
                  textAlign: 'center'
                }}>
                  {person.full_name}
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {person.role && (
                    <span className="tag" style={{ background: 'var(--accent-gold-light)', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>
                      {person.role}
                    </span>
                  )}
                </div>

                {/* Contact Info */}
                {(person.email || person.url) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    justifyContent: 'center',
                    marginTop: 'var(--space-3)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--neutral-600)'
                  }}>
                    {person.email && (
                      <a
                        href={`mailto:${person.email}`}
                        style={{
                          color: 'var(--accent-gold)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-1)',
                          transition: 'color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#8a6624'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                      >
                        <i className="fas fa-envelope"></i>
                        <span>{person.email}</span>
                      </a>
                    )}
                    {person.url && (
                      <a
                        href={person.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--accent-gold)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-1)',
                          transition: 'color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#8a6624'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                      >
                        <i className="fas fa-link"></i>
                        <span>Website</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Also Known As */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-gold)',
                marginBottom: 'var(--space-3)',
              }}>
                Also Known As
              </h2>
              {person.aka && person.aka.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {person.aka.map((name, idx) => (
                    <span key={idx} className="tag" style={{ background: 'var(--accent-gold-light)', color: 'var(--accent-gold)' }}>
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                  No alternate names
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-gold)',
                marginBottom: 'var(--space-3)',
              }}>
                Summary
              </h2>
              {person.summary ? (
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.6,
                    color: 'var(--neutral-700)',
                    fontFamily: 'var(--font-body)',
                  }}
                  dangerouslySetInnerHTML={{ __html: person.summary }}
                />
              ) : (
                <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                  No summary available
                </div>
              )}
            </div>

            {/* Concepts */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-3)',
              }}>
                <h2 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-green)',
                  margin: 0,
                }}>
                  Related Concepts ({person.concepts?.length || 0})
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => {
                      setSelectedConceptIds(person.concepts?.map(c => c.id) || []);
                      setShowLinkConceptModal(true);
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'white',
                      color: 'var(--accent-green)',
                      border: '2px solid var(--accent-green)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-sm)',
                      transition: 'all 0.15s',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      e.currentTarget.style.background = 'var(--accent-green)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = 'var(--accent-green)';
                    }}
                    title="Link Existing Concept"
                  >
                    <i className="fas fa-link"></i>
                  </button>
                  <button
                    onClick={() => setShowConceptModal(true)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-green)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-sm)',
                      transition: 'all 0.15s',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                    title="New Concept"
                  >
                    <i className="fas fa-plus"></i>
                  </button>
                </div>
              </div>
              {person.concepts && person.concepts.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 'var(--space-3)'
                }}>
                  {person.concepts.map(concept => (
                    <a
                      key={concept.id}
                      href={`/concepts/${concept.id}`}
                      className="card"
                      style={{
                        padding: 'var(--space-3)',
                        textDecoration: 'none',
                        borderLeft: '3px solid var(--accent-green)',
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                    >
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--neutral-900)',
                        fontFamily: 'var(--font-body)',
                        marginBottom: concept.node_type ? 'var(--space-1)' : '0'
                      }}>
                        {concept.label}
                      </div>
                      {concept.node_type && (
                        <div style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-600)',
                          textTransform: 'capitalize',
                          fontFamily: 'var(--font-body)',
                        }}>
                          {concept.node_type}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                  No related concepts
                </div>
              )}
            </div>

            {/* Sources */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-3)',
              }}>
                <h2 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-blue)',
                  margin: 0,
                }}>
                  Related Sources ({person.sources?.length || 0})
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => {
                      setSelectedSourceIds(person.sources?.map(s => s.id) || []);
                      setShowLinkSourceModal(true);
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'white',
                      color: 'var(--accent-blue)',
                      border: '2px solid var(--accent-blue)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-sm)',
                      transition: 'all 0.15s',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      e.currentTarget.style.background = 'var(--accent-blue)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = 'var(--accent-blue)';
                    }}
                    title="Link Existing Source"
                  >
                    <i className="fas fa-link"></i>
                  </button>
                  <button
                    onClick={() => setShowSourceModal(true)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-blue)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-sm)',
                      transition: 'all 0.15s',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                    title="New Source"
                  >
                    <i className="fas fa-plus"></i>
                  </button>
                </div>
              </div>
              {person.sources && person.sources.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 'var(--space-3)'
                }}>
                  {person.sources.map(source => (
                    <a
                      key={source.id}
                      href={`/sources/${source.id}`}
                      className="card"
                      style={{
                        padding: 'var(--space-3)',
                        textDecoration: 'none',
                        borderLeft: '3px solid var(--accent-blue)',
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                    >
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--neutral-900)',
                        fontFamily: 'var(--font-body)',
                        marginBottom: (source.authors || source.year) ? 'var(--space-1)' : '0'
                      }}>
                        {source.title}
                      </div>
                      {(source.authors || source.year) && (
                        <div style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-600)',
                          fontFamily: 'var(--font-body)',
                        }}>
                          {source.authors && <span>{source.authors}</span>}
                          {source.year && <span>{source.authors ? ` (${source.year})` : `${source.year}`}</span>}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                  No related sources
                </div>
              )}
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-3)',
              }}>
                <h2 style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent-purple)',
                  margin: 0,
                }}>
                  Tags ({person.tags?.length || 0})
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => {
                      setSelectedTags(person.tags || []);
                      setShowLinkTagModal(true);
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'white',
                      color: 'var(--accent-purple)',
                      border: '2px solid var(--accent-purple)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-sm)',
                      transition: 'all 0.15s',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      e.currentTarget.style.background = 'var(--accent-purple)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = 'var(--accent-purple)';
                    }}
                    title="Link Existing Tag"
                  >
                    <i className="fas fa-link"></i>
                  </button>
                  <button
                    onClick={() => setShowTagModal(true)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-purple)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--text-sm)',
                      transition: 'all 0.15s',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                    title="New Tag"
                  >
                    <i className="fas fa-plus"></i>
                  </button>
                </div>
              </div>
              {person.tags && person.tags.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 'var(--space-3)'
                }}>
                  {person.tags.map((tag, idx) => (
                    <div
                      key={idx}
                      className="card"
                      style={{
                        padding: 'var(--space-3)',
                        borderLeft: '3px solid var(--accent-purple)',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                    >
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--neutral-900)',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {tag}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                  No tags
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PersonFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
          fetchPerson();
        }}
        item={person ? {
          id: person.id,
          full_name: person.full_name,
          role: person.role,
          email: person.email,
          url: person.url,
          summary: person.summary,
          aka: person.aka || [],
          concept_ids: person.concepts ? person.concepts.map(c => c.id) : [],
          source_ids: person.sources ? person.sources.map(s => s.id) : [],
          tags: person.tags || []
        } : null}
      />

      <ConceptFormModal
        isOpen={showConceptModal}
        onClose={() => setShowConceptModal(false)}
        onSuccess={() => {
          setShowConceptModal(false);
          fetchPerson();
        }}
        item={{ people_ids: [currentPersonId] }}
      />

      <SourceFormModal
        isOpen={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        onSuccess={() => {
          setShowSourceModal(false);
          fetchPerson();
        }}
        item={{ person_ids: [currentPersonId] }}
      />

      <TagFormModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onSuccess={() => {
          setShowTagModal(false);
          fetchPerson();
        }}
        item={null}
      />

      {/* Link Existing Concept Modal */}
      <Modal
        isOpen={showLinkConceptModal}
        onClose={() => {
          setShowLinkConceptModal(false);
          setSelectedConceptIds([]);
        }}
        title="Link Existing Concepts"
        size="large"
      >
        <div style={{ height: '400px', marginBottom: 'var(--space-4)' }}>
          <ConceptSelector
            selectedConceptIds={selectedConceptIds}
            onChange={setSelectedConceptIds}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button
            onClick={() => {
              setShowLinkConceptModal(false);
              setSelectedConceptIds([]);
            }}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'white',
              border: '1px solid var(--neutral-300)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLinkConcepts}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--accent-green)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
            }}
          >
            Save ({selectedConceptIds.length})
          </button>
        </div>
      </Modal>

      {/* Link Existing Source Modal */}
      <Modal
        isOpen={showLinkSourceModal}
        onClose={() => {
          setShowLinkSourceModal(false);
          setSelectedSourceIds([]);
        }}
        title="Link Existing Sources"
        size="large"
      >
        <div style={{ height: '400px', marginBottom: 'var(--space-4)' }}>
          <SourceSelector
            selectedSourceIds={selectedSourceIds}
            onChange={setSelectedSourceIds}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button
            onClick={() => {
              setShowLinkSourceModal(false);
              setSelectedSourceIds([]);
            }}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'white',
              border: '1px solid var(--neutral-300)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLinkSources}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
            }}
          >
            Save ({selectedSourceIds.length})
          </button>
        </div>
      </Modal>

      {/* Link Existing Tag Modal */}
      <Modal
        isOpen={showLinkTagModal}
        onClose={() => {
          setShowLinkTagModal(false);
          setSelectedTags([]);
        }}
        title="Link Existing Tags"
        size="large"
      >
        <div style={{ height: '400px', padding: 'var(--space-6)', paddingBottom: 0 }}>
          <TagSelector
            selectedTags={selectedTags}
            onChange={setSelectedTags}
          />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-3)',
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--neutral-200)'
        }}>
          <button
            onClick={() => {
              setShowLinkTagModal(false);
              setSelectedTags([]);
            }}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'white',
              border: '1px solid var(--neutral-300)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLinkTags}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--accent-purple)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
            }}
          >
            Save ({selectedTags.length})
          </button>
        </div>
      </Modal>
    </div>
  );
}
