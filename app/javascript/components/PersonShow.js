import React, { useState, useEffect, useMemo } from 'react';
import PersonFormModal from './PersonFormModal';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import TagFormModal from './TagFormModal';

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
        background: 'var(--background)',
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
              {person.concepts && person.concepts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {person.concepts.map(concept => (
                    <div
                      key={concept.id}
                      className="card"
                      style={{
                        padding: 'var(--space-4)',
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                      }}
                      onClick={() => window.location.href = `/concepts/${concept.id}`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent-green-light)';
                        e.currentTarget.style.borderColor = 'var(--accent-green)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = 'var(--neutral-200)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          color: 'var(--neutral-900)',
                          fontFamily: 'var(--font-body)',
                        }}>
                          {concept.label}
                        </span>
                        {concept.node_type && (
                          <span className="tag" style={{ background: 'var(--accent-green-light)', color: 'var(--accent-green)', textTransform: 'capitalize' }}>
                            {concept.node_type}
                          </span>
                        )}
                      </div>
                    </div>
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
              {person.sources && person.sources.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {person.sources.map(source => (
                    <div
                      key={source.id}
                      className="card"
                      style={{
                        padding: 'var(--space-4)',
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                      }}
                      onClick={() => window.location.href = `/sources/${source.id}`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent-blue-light)';
                        e.currentTarget.style.borderColor = 'var(--accent-blue)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = 'var(--neutral-200)';
                      }}
                    >
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--neutral-900)',
                        marginBottom: 'var(--space-1)',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {source.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--neutral-600)' }}>
                        {source.authors && <span>{source.authors}</span>}
                        {source.year && <span>({source.year})</span>}
                      </div>
                    </div>
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
              {person.tags && person.tags.length > 0 ? (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {person.tags.map((tag, idx) => (
                    <span key={idx} className="tag tag-purple">
                      {tag}
                    </span>
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
    </div>
  );
}
