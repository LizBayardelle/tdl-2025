import React, { useState, useEffect } from 'react';
import ConceptFormModal from './ConceptFormModal';
import { buildConceptHierarchy, flattenHierarchy } from '../utils/conceptHierarchy';

export default function ConceptsIndex() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConcept, setEditingConcept] = useState(null);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchConcepts();
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

  const filteredConcepts = filterType === 'all'
    ? concepts
    : concepts.filter(concept => concept.node_type === filterType);

  // Build hierarchy and flatten for display
  const hierarchy = buildConceptHierarchy(filteredConcepts);
  const flatConcepts = flattenHierarchy(hierarchy);

  const conceptTypes = ['model', 'technique', 'construct', 'measure', 'population', 'category', 'discipline'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading constructs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl">Knowledge Constructs</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark transition-colors"
        >
          {showForm ? 'Cancel' : 'New Construct'}
        </button>
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

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded ${
            filterType === 'all'
              ? 'bg-primary text-sand'
              : 'bg-white border border-gray-300 hover:bg-sand'
          }`}
        >
          All ({concepts.length})
        </button>
        {conceptTypes.map(type => {
          const count = concepts.filter(n => n.node_type === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded capitalize ${
                filterType === type
                  ? 'bg-primary text-sand'
                  : 'bg-white border border-gray-300 hover:bg-sand'
              }`}
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      {filteredConcepts.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-300 rounded">
          <p className="text-lg mb-4">No constructs yet.</p>
          <p className="text-sm">Create your first knowledge construct to begin building your framework.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-300 rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand border-b border-gray-300">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-sm">Concept</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Type</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Status</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Relationships</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Actions</th>
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
    <tr className="border-b border-gray-200 hover:bg-sand/30 transition-colors">
      <td className="px-4 py-3">
        <div style={{ paddingLeft: `${indentPx}px` }}>
          <a
            href={`/concepts/${concept.id}`}
            className="text-primary hover:text-accent-dark font-medium"
          >
            {concept.label}
          </a>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
          {concept.node_type}
        </span>
      </td>
      <td className="px-4 py-3">
        {concept.level_status && (
          <span className="text-xs uppercase tracking-wider text-gray-600">
            {concept.level_status}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {totalConnections > 0 ? totalConnections : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onEdit(concept)}
            className="text-primary hover:text-accent-dark transition-colors"
            title="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="text-accent hover:text-accent-dark transition-colors"
            title="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
