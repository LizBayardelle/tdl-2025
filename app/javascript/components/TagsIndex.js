import React, { useState, useEffect } from 'react';
import TagFormModal from './TagFormModal';
import PersonFormModal from './PersonFormModal';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import NoteFormModal from './NoteFormModal';
import PeopleSelector from './PeopleSelector';
import ConceptSelector from './ConceptSelector';
import SourceSelector from './SourceSelector';
import NoteSelector from './NoteSelector';
import Modal from './Modal';

export default function TagsIndex() {
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('popularity');
  const [creatingTag, setCreatingTag] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  useEffect(() => {
    fetchTags();
  }, [sortBy]);

  // Auto-select first tag on initial load
  useEffect(() => {
    if (tags.length > 0 && !selectedTag) {
      handleTagClick(tags[0]);
    }
  }, [tags]);

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

  const fetchTags = async () => {
    try {
      const response = await fetch(`/tags.json?sort=${sortBy === 'alphabetical' ? 'alphabetical' : 'popularity'}`);
      const data = await response.json();
      setTags(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setLoading(false);
    }
  };

  const handleTagClick = async (tag) => {
    try {
      const response = await fetch(`/tags/${tag.id}.json`);
      const data = await response.json();
      setSelectedTag(data);
      // Close sidebar on mobile after selection
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error('Error fetching tag details:', error);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!confirm('Delete this tag? This will remove it from all items.')) return;

    try {
      const response = await fetch(`/tags/${tagId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setTags(tags.filter(t => t.id !== tagId));
        if (selectedTag?.id === tagId) {
          setSelectedTag(null);
        }
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>Loading tags...</p>
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
            background: 'var(--accent-purple)',
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
          onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple) 80%, black)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-purple)'}
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
            {/* Sort and New Tag */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--neutral-500)',
                marginBottom: 'var(--space-2)'
              }}>
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)'
                }}
              >
                <option value="popularity">Popularity</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>

            {/* Tags List */}
            <div style={{
              borderTop: '1px solid var(--neutral-300)',
              paddingTop: 'var(--space-3)'
            }}>
              <h2 style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                fontFamily: 'var(--font-body)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--neutral-500)',
                marginBottom: 'var(--space-3)'
              }}>
                All Tags ({tags.length})
              </h2>
              {tags.length === 0 ? (
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-600)',
                  fontFamily: 'var(--font-body)',
                  textAlign: 'center',
                  padding: 'var(--space-4)'
                }}>No tags yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  {tags.map(tag => (
                    <div
                      key={tag.id}
                      onClick={() => handleTagClick(tag)}
                      style={{
                        padding: 'var(--space-2)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: selectedTag?.id === tag.id ? 'var(--accent-purple)' : 'transparent',
                        color: selectedTag?.id === tag.id ? 'white' : 'var(--neutral-900)',
                        transition: 'all 0.15s',
                        fontFamily: 'var(--font-body)'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedTag?.id !== tag.id) {
                          e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTag?.id !== tag.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 500
                          }}>
                            {tag.color && (
                              <div
                                style={{
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  background: tag.color,
                                  flexShrink: 0
                                }}
                              />
                            )}
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {tag.name}
                            </span>
                          </div>
                          {tag.description && (
                            <p style={{
                              fontSize: 'var(--text-xs)',
                              marginTop: 'var(--space-1)',
                              opacity: 0.8,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {tag.description}
                            </p>
                          )}
                        </div>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          marginLeft: 'var(--space-2)',
                          flexShrink: 0,
                          opacity: 0.7
                        }}>
                          {tag.taggings_count || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
          {/* Header */}
          <div style={{
            padding: 'var(--space-6) var(--space-8)',
            background: 'color-mix(in srgb, var(--accent-purple) 15%, white)',
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
                  color: 'var(--accent-purple)',
                  margin: 0,
                  lineHeight: 1.1
                }}>Tags</h1>
                <p style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--neutral-600)',
                  fontFamily: 'var(--font-body)',
                  marginTop: 'var(--space-1)',
                  marginBottom: 0
                }}>
                  Browse and organize your knowledge by tags
                </p>
              </div>
              {/* New Tag Button */}
              <button
                onClick={() => setCreatingTag(true)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--accent-purple)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-purple) 80%, black)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-purple)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                title="New Tag"
              >
                <i className="fas fa-plus"></i>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-6)',
          }}>
            {selectedTag ? (
              <TagDetail
                tag={selectedTag}
                onDelete={() => handleDeleteTag(selectedTag.id)}
                onUpdate={(updatedTag) => {
                  setSelectedTag(updatedTag);
                  setTags(tags.map(t => t.id === updatedTag.id ? updatedTag : t));
                }}
              />
            ) : null}
          </div>
        </main>
      </div>

      <TagFormModal
        isOpen={creatingTag}
        onClose={() => setCreatingTag(false)}
        onSuccess={(newTag) => {
          setTags([newTag, ...tags]);
          setCreatingTag(false);
        }}
      />
    </>
  );
}

function TagDetail({ tag, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);

  // Modal states
  const [showLinkPeopleModal, setShowLinkPeopleModal] = useState(false);
  const [showLinkConceptsModal, setShowLinkConceptsModal] = useState(false);
  const [showLinkSourcesModal, setShowLinkSourcesModal] = useState(false);
  const [showLinkNotesModal, setShowLinkNotesModal] = useState(false);
  const [showNewPersonModal, setShowNewPersonModal] = useState(false);
  const [showNewConceptModal, setShowNewConceptModal] = useState(false);
  const [showNewSourceModal, setShowNewSourceModal] = useState(false);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);

  // Selection states
  const [selectedPersonIds, setSelectedPersonIds] = useState([]);
  const [selectedConceptIds, setSelectedConceptIds] = useState([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);

  const typeLabels = {
    Concept: 'Concepts',
    Source: 'Sources',
    Person: 'People',
    Connection: 'Relationships',
    Note: 'Notes'
  };

  const fetchTagDetails = async () => {
    try {
      const response = await fetch(`/tags/${tag.id}.json`);
      const data = await response.json();
      onUpdate(data);
    } catch (error) {
      console.error('Error fetching tag details:', error);
    }
  };

  const handleLinkPeople = async () => {
    try {
      const response = await fetch(`/tags/${tag.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          tag: {
            person_ids: selectedPersonIds
          }
        }),
      });

      if (response.ok) {
        await fetchTagDetails();
        setShowLinkPeopleModal(false);
        setSelectedPersonIds([]);
      } else {
        alert('Error linking people');
      }
    } catch (error) {
      console.error('Error linking people:', error);
      alert('Error linking people');
    }
  };

  const handleLinkConcepts = async () => {
    try {
      const response = await fetch(`/tags/${tag.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          tag: {
            concept_ids: selectedConceptIds
          }
        }),
      });

      if (response.ok) {
        await fetchTagDetails();
        setShowLinkConceptsModal(false);
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
      const response = await fetch(`/tags/${tag.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          tag: {
            source_ids: selectedSourceIds
          }
        }),
      });

      if (response.ok) {
        await fetchTagDetails();
        setShowLinkSourcesModal(false);
        setSelectedSourceIds([]);
      } else {
        alert('Error linking sources');
      }
    } catch (error) {
      console.error('Error linking sources:', error);
      alert('Error linking sources');
    }
  };

  const handleLinkNotes = async () => {
    try {
      const response = await fetch(`/tags/${tag.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          tag: {
            note_ids: selectedNoteIds
          }
        }),
      });

      if (response.ok) {
        await fetchTagDetails();
        setShowLinkNotesModal(false);
        setSelectedNoteIds([]);
      } else {
        alert('Error linking notes');
      }
    } catch (error) {
      console.error('Error linking notes:', error);
      alert('Error linking notes');
    }
  };

  return (
    <>
      <TagFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        item={tag}
        onSuccess={(updatedTag) => {
          onUpdate(updatedTag);
          setEditing(false);
        }}
      />
      <div style={{ overflow: 'visible' }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          background: 'white'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
              {tag.color && (
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: tag.color,
                    flexShrink: 0
                  }}
                />
              )}
              <h2 style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-purple)',
                margin: 0
              }}>
                {tag.name}
              </h2>
            </div>
            {tag.description && (
              <p style={{
                fontSize: 'var(--text-base)',
                color: 'var(--neutral-600)',
                fontFamily: 'var(--font-body)',
                margin: 0
              }}>
                {tag.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={() => setEditing(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-purple)',
                cursor: 'pointer',
                padding: 'var(--space-2)',
                fontSize: 'var(--text-lg)',
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-purple-light)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-purple)'}
              title="Edit"
            >
              <i className="fas fa-edit"></i>
            </button>
            <button
              onClick={onDelete}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-purple)',
                cursor: 'pointer',
                padding: 'var(--space-2)',
                fontSize: 'var(--text-lg)',
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-purple-light)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-purple)'}
              title="Delete"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'white'
        }}>
          <h3 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: 'var(--neutral-900)',
            marginBottom: 'var(--space-3)'
          }}>
            Tagged Items ({tag.taggings_count})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {Object.entries(tag.taggings_by_type || {}).map(([type, count]) => (
              <div
                key={type}
                style={{
                  background: 'var(--accent-purple)',
                  color: 'white',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: '4px',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500
                }}
              >
                <span>{typeLabels[type] || type}</span>
                <span style={{ marginLeft: 'var(--space-2)', opacity: 0.8 }}>({count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body with color-coded sections */}
        <div style={{ padding: 'var(--space-6)', background: 'white' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-gold)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <i className="fas fa-user" style={{ fontSize: 'var(--text-sm)' }}></i>
                People ({tag.people?.length || 0})
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => {
                    setSelectedPersonIds(tag.people?.map(p => p.id) || []);
                    setShowLinkPeopleModal(true);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: 'white',
                    color: 'var(--accent-gold)',
                    border: '2px solid var(--accent-gold)',
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
                    e.currentTarget.style.background = 'var(--accent-gold)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = 'var(--accent-gold)';
                  }}
                  title="Link Existing People"
                >
                  <i className="fas fa-link"></i>
                </button>
                <button
                  onClick={() => setShowNewPersonModal(true)}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: 'var(--accent-gold)',
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
                  title="New Person"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
            </div>
            {tag.people && tag.people.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-3)'
              }}>
                {tag.people.map(person => (
                  <a
                    key={person.id}
                    href={`/people/${person.id}`}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      textDecoration: 'none',
                      borderLeft: '3px solid var(--accent-gold)',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                  >
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                      color: 'var(--neutral-900)',
                      marginBottom: 'var(--space-1)'
                    }}>
                      {person.full_name}
                    </div>
                    {person.role && (
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)'
                      }}>
                        {person.role}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
            {!tag.people || tag.people.length === 0 && (
              <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                No people tagged
              </div>
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-green)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <i className="fas fa-lightbulb" style={{ fontSize: 'var(--text-sm)' }}></i>
                Concepts ({tag.concepts?.length || 0})
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => {
                    setSelectedConceptIds(tag.concepts?.map(c => c.id) || []);
                    setShowLinkConceptsModal(true);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
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
                  title="Link Existing Concepts"
                >
                  <i className="fas fa-link"></i>
                </button>
                <button
                  onClick={() => setShowNewConceptModal(true)}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
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
            {tag.concepts && tag.concepts.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-3)'
              }}>
                {tag.concepts.map(concept => (
                  <a
                    key={concept.id}
                    href={`/concepts/${concept.id}`}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      textDecoration: 'none',
                      borderLeft: '3px solid var(--accent-green)',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--space-1)'
                    }}>
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--neutral-900)'
                      }}>
                        {concept.label}
                      </div>
                      {concept.node_type && (
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-600)',
                          fontFamily: 'var(--font-body)'
                        }}>
                          {concept.node_type}
                        </span>
                      )}
                    </div>
                    {concept.summary_top && (
                      <p style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)',
                        margin: 0,
                        lineHeight: 1.4
                      }}>
                        {concept.summary_top}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}
            {!tag.concepts || tag.concepts.length === 0 && (
              <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                No concepts tagged
              </div>
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-blue)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <i className="fas fa-book" style={{ fontSize: 'var(--text-sm)' }}></i>
                Sources ({tag.sources?.length || 0})
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => {
                    setSelectedSourceIds(tag.sources?.map(s => s.id) || []);
                    setShowLinkSourcesModal(true);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
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
                  title="Link Existing Sources"
                >
                  <i className="fas fa-link"></i>
                </button>
                <button
                  onClick={() => setShowNewSourceModal(true)}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
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
            {tag.sources && tag.sources.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-3)'
              }}>
                {tag.sources.map(source => (
                  <a
                    key={source.id}
                    href={`/sources/${source.id}`}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      textDecoration: 'none',
                      borderLeft: '3px solid var(--accent-blue)',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'start',
                      justifyContent: 'space-between',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-1)'
                    }}>
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--neutral-900)',
                        flex: 1,
                        lineHeight: 1.4
                      }}>
                        {source.title}
                      </div>
                      {source.kind && (
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--neutral-600)',
                          fontFamily: 'var(--font-body)',
                          flexShrink: 0
                        }}>
                          {source.kind}
                        </span>
                      )}
                    </div>
                    {source.authors && (
                      <p style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)',
                        margin: 0
                      }}>
                        {source.authors}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}
            {!tag.sources || tag.sources.length === 0 && (
              <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                No sources tagged
              </div>
            )}
          </div>

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-3)',
            }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-teal)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <i className="fas fa-sticky-note" style={{ fontSize: 'var(--text-sm)' }}></i>
                Notes ({tag.notes?.length || 0})
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => {
                    setSelectedNoteIds(tag.notes?.map(n => n.id) || []);
                    setShowLinkNotesModal(true);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: 'white',
                    color: 'var(--accent-teal)',
                    border: '2px solid var(--accent-teal)',
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
                    e.currentTarget.style.background = 'var(--accent-teal)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = 'var(--accent-teal)';
                  }}
                  title="Link Existing Notes"
                >
                  <i className="fas fa-link"></i>
                </button>
                <button
                  onClick={() => setShowNewNoteModal(true)}
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    minHeight: '32px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: 'var(--accent-teal)',
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
                  title="New Note"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
            </div>
            {tag.notes && tag.notes.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-3)'
              }}>
                {tag.notes.map(note => (
                  <a
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      textDecoration: 'none',
                      borderLeft: '3px solid var(--accent-teal)',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--space-2)'
                    }}>
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'white',
                        background: 'var(--accent-teal)',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600
                      }}>
                        {note.note_type}
                      </span>
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)'
                      }}>
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {note.title && (
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--neutral-900)',
                        marginBottom: 'var(--space-1)'
                      }}>
                        {note.title}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-700)',
                        fontFamily: 'var(--font-body)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                      dangerouslySetInnerHTML={{ __html: note.body }}
                    />
                    {note.concepts?.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-1)',
                        marginTop: 'var(--space-2)'
                      }}>
                        {note.concepts.map((concept) => (
                          <span
                            key={concept.id}
                            style={{
                              fontSize: 'var(--text-xs)',
                              background: 'var(--accent-green)',
                              color: 'white',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-body)'
                            }}
                          >
                            {concept.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
            {!tag.notes || tag.notes.length === 0 && (
              <div style={{ color: 'var(--neutral-500)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                No notes tagged
              </div>
            )}
          </div>

          {tag.connections && tag.connections.length > 0 && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent-purple)',
                marginBottom: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <i className="fas fa-link" style={{ fontSize: 'var(--text-sm)' }}></i>
                Relationships
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-3)'
              }}>
                {tag.connections.map(connection => (
                  <div
                    key={connection.id}
                    className="card"
                    style={{
                      padding: 'var(--space-3)',
                      borderLeft: '3px solid var(--accent-purple)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      marginBottom: 'var(--space-1)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)'
                    }}>
                      <a
                        href={`/concepts/${connection.src.id}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--accent-green)',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {connection.src.label}
                      </a>
                      <span style={{ color: 'var(--neutral-500)' }}>→</span>
                      <a
                        href={`/concepts/${connection.dst.id}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--accent-green)',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {connection.dst.label}
                      </a>
                    </div>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-600)',
                      fontFamily: 'var(--font-body)'
                    }}>
                      {connection.rel_type}
                      {connection.description && `: ${connection.description}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Link Existing Modals */}
      <Modal
        isOpen={showLinkPeopleModal}
        onClose={() => setShowLinkPeopleModal(false)}
        title="Apply Tag to People"
        titleColor="var(--accent-gold)"
        size="large"
      >
        <div style={{ height: '400px', padding: 'var(--space-6)', paddingBottom: 0 }}>
          <PeopleSelector
            selectedPersonIds={selectedPersonIds}
            onChange={setSelectedPersonIds}
            themeColor="var(--accent-gold)"
          />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-2)',
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--neutral-200)'
        }}>
          <button
            onClick={() => setShowLinkPeopleModal(false)}
            className="btn-secondary"
            style={{
              background: 'color-mix(in srgb, var(--accent-gold) 10%, white)',
              color: 'var(--accent-gold)',
              border: '1px solid color-mix(in srgb, var(--accent-gold) 30%, white)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLinkPeople}
            className="btn-primary"
            style={{ background: 'var(--accent-gold)' }}
          >
            Save ({selectedPersonIds.length})
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showLinkConceptsModal}
        onClose={() => setShowLinkConceptsModal(false)}
        title="Apply Tag to Concepts"
        titleColor="var(--accent-green)"
        size="large"
      >
        <div style={{ height: '400px', padding: 'var(--space-6)', paddingBottom: 0 }}>
          <ConceptSelector
            selectedConceptIds={selectedConceptIds}
            onChange={setSelectedConceptIds}
            themeColor="var(--accent-green)"
          />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-2)',
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--neutral-200)'
        }}>
          <button
            onClick={() => setShowLinkConceptsModal(false)}
            className="btn-secondary"
            style={{
              background: 'color-mix(in srgb, var(--accent-green) 10%, white)',
              color: 'var(--accent-green)',
              border: '1px solid color-mix(in srgb, var(--accent-green) 30%, white)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLinkConcepts}
            className="btn-primary"
            style={{ background: 'var(--accent-green)' }}
          >
            Save ({selectedConceptIds.length})
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showLinkSourcesModal}
        onClose={() => setShowLinkSourcesModal(false)}
        title="Apply Tag to Sources"
        titleColor="var(--accent-blue)"
        size="large"
      >
        <div style={{ height: '400px', padding: 'var(--space-6)', paddingBottom: 0 }}>
          <SourceSelector
            selectedSourceIds={selectedSourceIds}
            onChange={setSelectedSourceIds}
            themeColor="var(--accent-blue)"
          />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-2)',
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--neutral-200)'
        }}>
          <button
            onClick={() => setShowLinkSourcesModal(false)}
            className="btn-secondary"
            style={{
              background: 'color-mix(in srgb, var(--accent-blue) 10%, white)',
              color: 'var(--accent-blue)',
              border: '1px solid color-mix(in srgb, var(--accent-blue) 30%, white)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLinkSources}
            className="btn-primary"
            style={{ background: 'var(--accent-blue)' }}
          >
            Save ({selectedSourceIds.length})
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showLinkNotesModal}
        onClose={() => setShowLinkNotesModal(false)}
        title="Apply Tag to Notes"
        titleColor="var(--accent-teal)"
        size="large"
      >
        <div style={{ height: '400px', padding: 'var(--space-6)', paddingBottom: 0 }}>
          <NoteSelector
            selectedNoteIds={selectedNoteIds}
            onChange={setSelectedNoteIds}
            themeColor="var(--accent-teal)"
          />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-2)',
          padding: 'var(--space-6)',
          borderTop: '1px solid var(--neutral-200)'
        }}>
          <button
            onClick={() => setShowLinkNotesModal(false)}
            className="btn-secondary"
            style={{
              background: 'color-mix(in srgb, var(--accent-teal) 10%, white)',
              color: 'var(--accent-teal)',
              border: '1px solid color-mix(in srgb, var(--accent-teal) 30%, white)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleLinkNotes}
            className="btn-primary"
            style={{ background: 'var(--accent-teal)' }}
          >
            Save ({selectedNoteIds.length})
          </button>
        </div>
      </Modal>

      {/* Create New Modals - pre-populated with current tag */}
      <PersonFormModal
        isOpen={showNewPersonModal}
        onClose={() => setShowNewPersonModal(false)}
        defaultTags={[tag.name]}
        onSuccess={async (newPerson) => {
          setShowNewPersonModal(false);
          await fetchTagDetails();
        }}
      />

      <ConceptFormModal
        isOpen={showNewConceptModal}
        onClose={() => setShowNewConceptModal(false)}
        defaultTags={[tag.name]}
        onSuccess={async (newConcept) => {
          setShowNewConceptModal(false);
          await fetchTagDetails();
        }}
      />

      <SourceFormModal
        isOpen={showNewSourceModal}
        onClose={() => setShowNewSourceModal(false)}
        defaultTags={[tag.name]}
        onSuccess={async (newSource) => {
          setShowNewSourceModal(false);
          await fetchTagDetails();
        }}
      />

      <NoteFormModal
        isOpen={showNewNoteModal}
        onClose={() => setShowNewNoteModal(false)}
        defaultTags={[tag.name]}
        onSuccess={async (newNote) => {
          setShowNewNoteModal(false);
          await fetchTagDetails();
        }}
      />
    </>
  );
}
