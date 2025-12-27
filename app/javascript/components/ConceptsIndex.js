import React, { useState, useEffect } from 'react';
import ConceptFormModal from './ConceptFormModal';
import { buildConceptHierarchy, flattenHierarchy } from '../utils/conceptHierarchy';

export default function ConceptsIndex() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConcept, setEditingConcept] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sortField, setSortField] = useState('label');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    fetchConcepts();
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

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching concepts:', error);
      setLoading(false);
    }
  };

  // Get unique types from actual data
  const conceptTypes = [...new Set(concepts.map(c => c.node_type))].filter(Boolean).sort();

  // Filter concepts based on selected types
  const filteredConcepts = selectedTypes.length === 0
    ? concepts
    : concepts.filter(concept => selectedTypes.includes(concept.node_type));

  // Toggle type selection
  const toggleType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Build hierarchy first
  const hierarchy = buildConceptHierarchy(filteredConcepts);

  // Sort hierarchy recursively at each level
  const sortHierarchy = (nodes) => {
    return nodes.sort((a, b) => {
      let aVal, bVal;

      if (sortField === 'label') {
        aVal = a.label.toLowerCase();
        bVal = b.label.toLowerCase();
      } else if (sortField === 'type') {
        aVal = a.node_type;
        bVal = b.node_type;
      } else if (sortField === 'status') {
        aVal = a.level_status || '';
        bVal = b.level_status || '';
      } else if (sortField === 'relationships') {
        const getRelCount = (concept) => {
          const outgoing = concept.outgoing_connections?.length || 0;
          const incoming = concept.incoming_connections?.length || 0;
          return outgoing + incoming;
        };
        aVal = getRelCount(a);
        bVal = getRelCount(b);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }).map(node => ({
      ...node,
      children: node.children ? sortHierarchy(node.children) : []
    }));
  };

  // Sort the hierarchy at all levels
  const sortedHierarchy = sortHierarchy(hierarchy);

  // Flatten for display
  const flatConcepts = flattenHierarchy(sortedHierarchy);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading constructs...</p>
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
                Filter by Type
              </div>

              {/* Clear all button */}
              {selectedTypes.length > 0 && (
                <button
                  onClick={() => setSelectedTypes([])}
                  style={{
                    fontFamily: 'var(--font-body)',
                    width: '100%',
                    padding: 'var(--space-2)',
                    marginBottom: 'var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--primary)',
                    background: 'transparent',
                    border: '1px solid var(--primary)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-green-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Clear All ({selectedTypes.length})
                </button>
              )}

              {/* Type filters */}
              {conceptTypes.map(type => {
                const count = concepts.filter(n => n.node_type === type).length;
                const isSelected = selectedTypes.includes(type);
                return (
                  <label
                    key={type}
                    style={{
                      fontFamily: 'var(--font-body)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-700)',
                      background: isSelected ? 'var(--neutral-200)' : 'transparent',
                      transition: 'background 0.15s',
                      marginBottom: '0.25rem',
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
                        toggleType(type);
                      }}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span style={{ flex: 1, textTransform: 'capitalize' }}>{type}</span>
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
          background: 'var(--primary)',
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
                Constructs
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--neutral-500)',
                  margin: 0,
                }}
              >
                Theories, Concepts, Subjects, Fields, etc.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--primary)',
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
                e.currentTarget.style.background = 'var(--primary-dark)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              title="New Construct"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <ConceptFormModal
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingConcept(null);
          }}
          onSuccess={() => {
            fetchConcepts();
            setShowForm(false);
            setEditingConcept(null);
          }}
          item={editingConcept}
        />

        {/* Concepts Table */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6)',
          paddingLeft: 'calc(var(--space-6) + 24px)',
          background: 'var(--background)'
        }}>
          {filteredConcepts.length === 0 ? (
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
                No constructs yet.
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)' }}>
                Create your first knowledge construct to begin building your framework.
              </p>
            </div>
          ) : (
            <div
              className="card"
              style={{
                overflow: 'hidden',
                transform: 'none !important',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--card-footer)', borderBottom: '1px solid var(--neutral-200)' }}>
                  <tr>
                    <th
                      onClick={() => handleSort('label')}
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
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
                    >
                      Concept {sortField === 'label' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th
                      onClick={() => handleSort('type')}
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
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
                    >
                      Type {sortField === 'type' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th
                      onClick={() => handleSort('status')}
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
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
                    >
                      Status {sortField === 'status' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th
                      onClick={() => handleSort('relationships')}
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
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--neutral-700)'}
                    >
                      Relationships {sortField === 'relationships' && (
                        <i className={`fas fa-chevron-${sortDirection === 'asc' ? 'up' : 'down'}`} style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}></i>
                      )}
                    </th>
                    <th style={{
                      fontFamily: 'var(--font-display)',
                      textAlign: 'right',
                      padding: '0.75rem 1rem',
                      fontWeight: 600,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-700)'
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {flatConcepts.map(({ concept, depth }) => (
                    <ConceptRow
                      key={concept.id}
                      concept={concept}
                      depth={depth}
                      onUpdate={fetchConcepts}
                      onEdit={(concept) => {
                        setEditingConcept(concept);
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

function ConceptRow({ concept, depth, onUpdate, onEdit }) {
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this concept?')) return;

    try {
      const response = await fetch(`/concepts/${concept.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting concept:', error);
    }
  };

  const getInverseRelType = (relType) => {
    const inverses = {
      parent_of: 'child_of',
      child_of: 'parent_of',
      prerequisite_for: 'builds_on',
      builds_on: 'prerequisite_for',
      derived_from: 'influenced',
      influenced: 'derived_from'
    };
    return inverses[relType] || relType;
  };

  // Convert incoming connections to their outgoing equivalent for consistent display
  const outgoingConnections = concept.outgoing_connections || [];
  const incomingConnections = concept.incoming_connections || [];

  // Convert incoming inverse relationships to outgoing perspective
  const normalizedIncoming = incomingConnections.map(conn => {
    const inverseType = getInverseRelType(conn.rel_type);
    return {
      id: conn.id,
      rel_type: inverseType,
      relationship_label: conn.relationship_label,
      target: conn.src_concept,
      isConverted: inverseType !== conn.rel_type
    };
  });

  // Convert outgoing to consistent format
  const normalizedOutgoing = outgoingConnections.map(conn => ({
    id: conn.id,
    rel_type: conn.rel_type,
    relationship_label: conn.relationship_label,
    target: conn.dst_concept,
    isConverted: false
  }));

  // Combine and deduplicate
  const allRelationships = [...normalizedOutgoing, ...normalizedIncoming];

  // Remove duplicates by checking if the same relationship exists in both directions
  const uniqueRelationships = allRelationships.filter((rel, index, self) => {
    const firstIndex = self.findIndex(r =>
      r.target.id === rel.target.id &&
      (r.rel_type === rel.rel_type || r.rel_type === getInverseRelType(rel.rel_type))
    );
    if (firstIndex === index) return true;
    if (firstIndex !== index && !rel.isConverted) return true;
    return false;
  });

  const totalConnections = uniqueRelationships.length;

  // Calculate indentation based on depth
  const indentPx = depth * 24; // 24px per level

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--neutral-200)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ paddingLeft: `${indentPx}px`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {depth > 0 && (
            <i className="fas fa-level-up-alt" style={{
              fontSize: '0.75rem',
              color: 'var(--neutral-400)',
              transform: 'rotate(90deg)',
            }}></i>
          )}
          <a
            href={`/concepts/${concept.id}`}
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-green)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-green)'}
          >
            {concept.label}
          </a>
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <span
          className="tag concept"
          style={{
            display: 'inline-block',
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {concept.node_type}
        </span>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        {concept.level_status && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--neutral-600)',
            }}
          >
            {concept.level_status}
          </span>
        )}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: 'var(--text-sm)', color: 'var(--neutral-600)' }}>
        {totalConnections > 0 ? totalConnections : '—'}
      </td>
      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onEdit(concept)}
            className="icon-btn"
            title="Edit"
          >
            <i className="fas fa-pen" style={{ fontSize: '12px' }}></i>
          </button>
          <button
            onClick={handleDelete}
            className="icon-btn"
            title="Delete"
            style={{ color: 'var(--error)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--error) 15%, transparent)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <i className="fas fa-trash" style={{ fontSize: '12px' }}></i>
          </button>
        </div>
      </td>
    </tr>
  );
}
