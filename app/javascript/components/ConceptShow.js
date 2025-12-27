import React, { useState, useEffect, useMemo } from 'react';
import ConceptFormModal from './ConceptFormModal';
import ConnectionFormModal from './ConnectionFormModal';
import NoteFormModal from './NoteFormModal';
import PersonFormModal from './PersonFormModal';
import SourceFormModal from './SourceFormModal';

// Memoized Sidebar component to prevent re-renders
const ConceptSidebar = React.memo(({
  sidebarOpen,
  allConcepts,
  conceptsLoading,
  currentConceptId,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  onConceptClick
}) => {
  const filteredConcepts = useMemo(() => {
    return allConcepts
      .filter(c => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return c.label?.toLowerCase().includes(query) ||
               c.node_type?.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (sortBy === 'alphabetical') {
          return (a.label || '').localeCompare(b.label || '');
        } else if (sortBy === 'type') {
          return (a.node_type || '').localeCompare(b.node_type || '');
        } else {
          return new Date(b.updated_at) - new Date(a.updated_at);
        }
      });
  }, [allConcepts, searchQuery, sortBy]);

  return (
    <aside
      style={{
        width: sidebarOpen ? '280px' : '0',
        background: 'var(--sidebar-bg)',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.3s ease',
        boxShadow: 'inset -8px 0 16px -8px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        flexShrink: 0
      }}
    >
      {sidebarOpen && (
        <div style={{ width: '280px', padding: 'var(--space-4)' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search concepts..."
            className="form-input"
            style={{
              width: '100%',
              marginBottom: 'var(--space-3)',
              fontSize: 'var(--text-sm)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-green)';
              e.currentTarget.style.outline = 'none';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--neutral-300)';
            }}
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="form-select"
            style={{
              width: '100%',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--text-xs)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-green)';
              e.currentTarget.style.outline = 'none';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--neutral-300)';
            }}
          >
            <option value="recent">Recently Updated</option>
            <option value="alphabetical">Alphabetical</option>
            <option value="type">By Type</option>
          </select>

          <div style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--neutral-500)',
            marginBottom: 'var(--space-2)',
            fontFamily: 'var(--font-body)'
          }}>
            All Concepts ({filteredConcepts.length})
          </div>

          {conceptsLoading ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
              Loading...
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {filteredConcepts.map(c => (
                <button
                  key={c.id}
                  onClick={() => onConceptClick(c.slug || c.id, c.id)}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    lineHeight: 1.3,
                    color: c.id === parseInt(currentConceptId) ? 'var(--accent-green)' : 'var(--neutral-700)',
                    background: c.id === parseInt(currentConceptId) ? 'var(--accent-green-light)' : 'transparent',
                    fontWeight: c.id === parseInt(currentConceptId) ? 600 : 400,
                    transition: 'all 0.15s',
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (c.id !== parseInt(currentConceptId)) {
                      e.currentTarget.style.background = 'var(--neutral-100)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (c.id !== parseInt(currentConceptId)) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {c.label}
                  {c.node_type && (
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-500)',
                      marginTop: 'var(--space-1)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {c.node_type.replace(/_/g, ' ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
});

export default function ConceptShow({ conceptId }) {
  const [currentConceptId, setCurrentConceptId] = useState(conceptId);
  const [concept, setConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [allConcepts, setAllConcepts] = useState([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    fetchAllConcepts();
  }, []);

  useEffect(() => {
    fetchConcept();
  }, [currentConceptId]);

  const fetchConcept = async () => {
    try {
      const response = await fetch(`/concepts/${currentConceptId}.json`);
      const data = await response.json();
      setConcept(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching concept:', error);
      setLoading(false);
    }
  };

  const handleConceptClick = (conceptSlugOrId, conceptIdNum) => {
    setCurrentConceptId(conceptIdNum);
    // Update URL without page reload
    window.history.pushState({}, '', `/concepts/${conceptSlugOrId}`);
  };

  const fetchAllConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setAllConcepts(data);
      setConceptsLoading(false);
    } catch (error) {
      console.error('Error fetching concepts:', error);
      setConceptsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left Sidebar - Concepts List */}
      <ConceptSidebar
        sidebarOpen={sidebarOpen}
        allConcepts={allConcepts}
        conceptsLoading={conceptsLoading}
        currentConceptId={currentConceptId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onConceptClick={handleConceptClick}
      />

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          left: sidebarOpen ? '280px' : '0',
          top: '200px',
          zIndex: 50,
          background: 'var(--accent-green)',
          color: 'white',
          padding: 'var(--space-2)',
          borderRadius: '0 4px 4px 0',
          boxShadow: 'var(--shadow)',
          border: 'none',
          cursor: 'pointer',
          transition: 'left 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Toggle concepts sidebar"
      >
        <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`}></i>
      </button>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading || !concept ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-8) 0', flex: 1 }}>
            <p style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>
              {loading ? 'Loading...' : 'Concept not found'}
            </p>
          </div>
        ) : (
          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 var(--space-6)', width: '100%' }}>
            {/* Header with Back, Edit, and Delete */}
            <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-4)' }}>
              <a
                href="/concepts"
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--accent-green)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  transition: 'color 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-green-dark)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-green)'}
              >
                ← Back to Concepts
              </a>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  onClick={() => setEditing(true)}
                  className="icon-btn"
                  style={{ color: 'var(--accent-green)' }}
                  title="Edit Concept"
                >
                  <i className="fas fa-pen"></i>
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Are you sure you want to delete "${concept.label}"? This action cannot be undone.`)) return;

                    try {
                      const response = await fetch(`/concepts/${conceptId}`, {
                        method: 'DELETE',
                        headers: {
                          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
                        },
                      });

                      if (response.ok) {
                        window.location.href = '/concepts';
                      } else {
                        alert('Error deleting concept');
                      }
                    } catch (error) {
                      console.error('Error deleting concept:', error);
                      alert('Error deleting concept');
                    }
                  }}
                  className="icon-btn"
                  style={{ color: 'var(--accent-green)' }}
                  title="Delete Concept"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <ConceptFormModal
              isOpen={editing}
              onClose={() => setEditing(false)}
              item={concept}
              onSuccess={(updatedConcept) => {
                setConcept(updatedConcept);
                setEditing(false);
                fetchAllConcepts(); // Refresh sidebar
              }}
            />

            <div style={{ background: 'white', padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
              <ConceptDisplay concept={concept} />
              <ConnectionManager conceptId={currentConceptId} allConcepts={allConcepts} onConceptClick={handleConceptClick} />
              <ConceptPeople conceptId={currentConceptId} />
              <ConceptSources conceptId={currentConceptId} />
              <ConceptNotes conceptId={currentConceptId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptDisplay({ concept }) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        {/* Tags in top right */}
        {concept.tags && concept.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
            {concept.tags.map((tag, idx) => (
              <span key={idx} style={{
                fontSize: 'var(--text-xs)',
                background: 'var(--accent-purple)',
                color: 'white',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: '4px',
                fontFamily: 'var(--font-body)',
                fontWeight: 500
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--neutral-900)',
          lineHeight: 1.2,
          marginBottom: 'var(--space-3)',
          textAlign: 'center'
        }}>
          {concept.label}
        </h1>
        {/* Type and status badges centered below title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {concept.node_type && (
            <span style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'var(--accent-green-light)',
              color: 'var(--accent-green)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: '4px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600
            }}>
              {concept.node_type.replace(/_/g, ' ')}
            </span>
          )}
          {concept.level_status && (
            <span style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'var(--neutral-100)',
              color: 'var(--neutral-700)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: '4px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500
            }}>
              {concept.level_status}
            </span>
          )}
        </div>
      </div>

      {/* Three-level mastery summaries */}
      <div>
        {concept.summary_top && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-green)',
              marginBottom: 'var(--space-3)'
            }}>
              Summary (Top-level)
            </h3>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              color: 'var(--neutral-700)',
              whiteSpace: 'pre-wrap'
            }}>
              {concept.summary_top}
            </p>
          </div>
        )}
        {concept.summary_mid && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-green)',
              marginBottom: 'var(--space-3)'
            }}>
              Summary (Mid-level)
            </h3>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              color: 'var(--neutral-700)',
              whiteSpace: 'pre-wrap'
            }}>
              {concept.summary_mid}
            </p>
          </div>
        )}
        {concept.summary_deep && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-green)',
              marginBottom: 'var(--space-3)'
            }}>
              Summary (Deep)
            </h3>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              color: 'var(--neutral-700)',
              whiteSpace: 'pre-wrap'
            }}>
              {concept.summary_deep}
            </p>
          </div>
        )}
      </div>

      {/* Array fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <ArraySection title="Mechanisms" items={concept.mechanisms} />
        <ArraySection title="Signature Techniques" items={concept.signature_techniques} />
        <ArraySection title="Strengths" items={concept.strengths} />
        <ArraySection title="Weaknesses" items={concept.weaknesses} />
        <ArraySection title="Adjacent Models" items={concept.adjacent_models} />
        <ArraySection title="Contrasts With" items={concept.contrasts_with} />
        <ArraySection title="Integrates With" items={concept.integrates_with} />
        <ArraySection title="Intake Questions" items={concept.intake_questions} />
        <ArraySection title="Micro Skills" items={concept.micro_skills} />
        <ArraySection title="Practice Prompts" items={concept.practice_prompts} />
        <ArraySection title="Assessment Links" items={concept.assessment_links} />
      </div>

      {/* Evidence and reflection */}
      {concept.evidence_brief && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: 'var(--accent-green)',
            marginBottom: 'var(--space-3)'
          }}>
            Evidence Brief
          </h3>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
            color: 'var(--neutral-700)',
            whiteSpace: 'pre-wrap'
          }}>
            {concept.evidence_brief}
          </p>
        </div>
      )}
      {concept.confidence_note && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: 'var(--accent-green)',
            marginBottom: 'var(--space-3)'
          }}>
            Confidence Note
          </h3>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
            color: 'var(--neutral-700)',
            whiteSpace: 'pre-wrap'
          }}>
            {concept.confidence_note}
          </p>
        </div>
      )}

    </div>
  );
}

function ArraySection({ title, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h3 style={{
        fontSize: 'var(--text-base)',
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
        color: 'var(--neutral-900)',
        marginBottom: 'var(--space-2)'
      }}>
        {title}
      </h3>
      <ul style={{
        listStyle: 'disc',
        paddingLeft: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)'
      }}>
        {items.map((item, idx) => (
          <li key={idx} style={{
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            color: 'var(--neutral-700)',
            lineHeight: 1.6
          }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConnectionManager({ conceptId, allConcepts, onConceptClick }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingConnection, setCreatingConnection] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [conceptId]);

  const fetchConnections = async () => {
    try {
      const response = await fetch(`/connections.json?concept_id=${conceptId}`);
      const data = await response.json();
      setConnections(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching connections:', error);
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!confirm('Delete this relationship?')) return;

    try {
      const response = await fetch(`/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setConnections(connections.filter(e => e.id !== connectionId));
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
    }
  };

  const relTypeLabels = {
    parent_of: 'Parent of',
    child_of: 'Child of',
    prerequisite_for: 'Prerequisite for',
    builds_on: 'Builds on',
    derived_from: 'Derived from',
    related_to: 'Related to',
    contrasts_with: 'Contrasts with',
    integrates_with: 'Integrates with',
    associated_with: 'Associated with',
    influenced: 'Influenced',
    supports: 'Supports',
    critiques: 'Critiques',
    authored: 'Authored',
    applies_to: 'Applies to',
    treats: 'Treats'
  };

  return (
    <>
      <ConnectionFormModal
        isOpen={creatingConnection}
        onClose={() => setCreatingConnection(false)}
        conceptId={conceptId}
        concepts={allConcepts.filter(c => c.id !== parseInt(conceptId))}
        allConcepts={allConcepts}
        onSuccess={(newConnection) => {
          fetchConnections();
          setCreatingConnection(false);
        }}
      />

      <div style={{ marginTop: 'var(--space-8)' }}>
        {/* Relationships Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)'
        }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--accent-green)',
            margin: 0
          }}>
            Relationships ({connections.length})
          </h2>
          <button
            onClick={() => setCreatingConnection(true)}
            className="btn-secondary"
            style={{
              fontSize: 'var(--text-sm)',
              background: 'var(--accent-green)',
              color: 'white',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-green-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-green)';
            }}
          >
            + New Relationship
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            Loading relationships...
          </p>
        ) : connections.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            No relationships yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {connections.map((connection, index) => {
              const isSource = connection.src_concept.id === parseInt(conceptId);
              const otherConcept = isSource ? connection.dst_concept : connection.src_concept;
              const direction = isSource ? '→' : '←';
              const isLast = index === connections.length - 1;

              return (
                <div key={connection.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: isLast ? 'none' : '1px solid var(--neutral-200)',
                  paddingBottom: isLast ? 0 : 'var(--space-3)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', flex: 1 }}>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: 'var(--accent-green-light)',
                      color: 'var(--accent-green)',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      {connection.relationship_label || relTypeLabels[connection.rel_type]}
                    </span>
                    <span style={{ color: 'var(--neutral-400)', fontSize: 'var(--text-lg)' }}>{direction}</span>
                    <button
                      onClick={() => onConceptClick(otherConcept.slug || otherConcept.id, otherConcept.id)}
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        color: 'var(--neutral-900)',
                        textDecoration: 'none',
                        transition: 'color 0.15s',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-green)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-900)'}
                    >
                      {otherConcept.label}
                    </button>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-500)',
                      fontFamily: 'var(--font-body)'
                    }}>
                      ({otherConcept.node_type})
                    </span>
                    {connection.description && (
                      <p style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--neutral-600)',
                        fontFamily: 'var(--font-body)',
                        width: '100%',
                        marginTop: 'var(--space-2)'
                      }}>
                        {connection.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteConnection(connection.id)}
                    className="icon-btn"
                    style={{
                      color: 'var(--accent-green)',
                      marginLeft: 'var(--space-4)',
                      flexShrink: 0
                    }}
                    title="Delete Relationship"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ConceptPeople({ conceptId }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingPerson, setCreatingPerson] = useState(false);

  useEffect(() => {
    fetchPeople();
  }, [conceptId]);

  const fetchPeople = async () => {
    try {
      const response = await fetch(`/concepts/${conceptId}.json`);
      const data = await response.json();
      setPeople(data.people || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching people:', error);
      setLoading(false);
    }
  };

  return (
    <>
      <PersonFormModal
        isOpen={creatingPerson}
        onClose={() => setCreatingPerson(false)}
        onSuccess={() => {
          fetchPeople();
          setCreatingPerson(false);
        }}
      />
      <div style={{ marginTop: 'var(--space-8)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)'
        }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--accent-gold)',
            margin: 0
          }}>
            People ({people.length})
          </h2>
          <button
            onClick={() => setCreatingPerson(true)}
            className="btn-secondary"
            style={{
              fontSize: 'var(--text-sm)',
              background: 'var(--accent-gold)',
              color: 'white',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#8a6624';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-gold)';
            }}
          >
            + New Person
          </button>
        </div>
        {loading ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            Loading people...
          </p>
        ) : people.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            No related people yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {people.map((person) => (
              <a
                key={person.id}
                href={`/people/${person.id}`}
                style={{
                  fontSize: 'var(--text-xs)',
                  background: 'var(--accent-gold)',
                  color: 'white',
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {person.full_name}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ConceptSources({ conceptId }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingSource, setCreatingSource] = useState(false);

  useEffect(() => {
    fetchSources();
  }, [conceptId]);

  const fetchSources = async () => {
    try {
      const response = await fetch(`/concepts/${conceptId}.json`);
      const data = await response.json();
      setSources(data.sources || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setLoading(false);
    }
  };

  return (
    <>
      <SourceFormModal
        isOpen={creatingSource}
        onClose={() => setCreatingSource(false)}
        onSuccess={() => {
          fetchSources();
          setCreatingSource(false);
        }}
      />
      <div style={{ marginTop: 'var(--space-8)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)'
        }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--accent-blue)',
            margin: 0
          }}>
            Related Sources ({sources.length})
          </h2>
          <button
            onClick={() => setCreatingSource(true)}
            className="btn-secondary"
            style={{
              fontSize: 'var(--text-sm)',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#244552';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-blue)';
            }}
          >
            + New Source
          </button>
        </div>
        {loading ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            Loading sources...
          </p>
        ) : sources.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            No related sources yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {sources.map((source) => (
              <a
                key={source.id}
                href={`/sources/${source.id}`}
                style={{
                  fontSize: 'var(--text-xs)',
                  background: 'var(--accent-blue)',
                  color: 'white',
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  transition: 'opacity 0.15s',
                  display: 'inline-block'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {source.title}
                {source.year && ` (${source.year})`}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ConceptNotes({ conceptId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingNote, setCreatingNote] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [conceptId]);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/notes.json?concept_id=${conceptId}`);
      const data = await response.json();
      setNotes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ marginTop: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--accent-teal)',
          margin: '0 0 var(--space-3) 0'
        }}>
          Notes (0)
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
          Loading notes...
        </p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <>
        <NoteFormModal
          isOpen={creatingNote}
          onClose={() => setCreatingNote(false)}
          conceptId={conceptId}
          onSuccess={(newNote) => {
            fetchNotes();
            setCreatingNote(false);
          }}
        />
        <div style={{ marginTop: 'var(--space-8)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-3)'
          }}>
            <h2 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-teal)',
              margin: 0
            }}>
              Notes (0)
            </h2>
            <button
              onClick={() => setCreatingNote(true)}
              className="btn-secondary"
              style={{
                fontSize: 'var(--text-sm)',
                background: 'var(--accent-teal)',
                color: 'white',
                border: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#527d81';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-teal)';
              }}
            >
              + New Note
            </button>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            No notes yet.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <NoteFormModal
        isOpen={creatingNote}
        onClose={() => setCreatingNote(false)}
        conceptId={conceptId}
        onSuccess={(newNote) => {
          fetchNotes();
          setCreatingNote(false);
        }}
      />
      <div style={{ marginTop: 'var(--space-8)' }}>
        {/* Notes Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)'
        }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--accent-teal)',
            margin: 0
          }}>
            Notes ({notes.length})
          </h2>
          <button
            onClick={() => setCreatingNote(true)}
            className="btn-secondary"
            style={{
              fontSize: 'var(--text-sm)',
              background: 'var(--accent-teal)',
              color: 'white',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#527d81';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent-teal)';
            }}
          >
            + New Note
          </button>
        </div>

        {/* Notes Cards */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {notes.map(note => (
              <div key={note.id} className="card" style={{ overflow: 'hidden' }}>
                {note.title && (
                  <div style={{
                    background: 'var(--accent-teal)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid var(--neutral-200)'
                  }}>
                    <h3 style={{
                      fontWeight: 600,
                      fontSize: 'var(--text-base)',
                      fontFamily: 'var(--font-display)',
                      color: 'white',
                      margin: 0
                    }}>
                      {note.title}
                    </h3>
                  </div>
                )}
                <div style={{ padding: 'var(--space-4)' }}>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-700)',
                      fontFamily: 'var(--font-body)',
                      lineHeight: 1.6,
                      marginBottom: 'var(--space-3)',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                    dangerouslySetInnerHTML={{ __html: note.body }}
                  />
                  {(note.concepts?.length > 0 || note.tags?.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                      {note.concepts?.map((concept) => (
                        <span key={concept.id} style={{
                          fontSize: 'var(--text-xs)',
                          background: 'var(--accent-green)',
                          color: 'white',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-body)'
                        }}>
                          {concept.label}
                        </span>
                      ))}
                      {note.tags?.map((tag, idx) => (
                        <span key={idx} style={{
                          fontSize: 'var(--text-xs)',
                          background: 'var(--accent-purple)',
                          color: 'white',
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-body)'
                        }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{
                  padding: 'var(--space-2) var(--space-4)',
                  background: 'var(--card-footer)',
                  borderTop: '1px solid var(--neutral-200)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
                    {new Date(note.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
