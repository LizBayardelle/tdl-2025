import React, { useState, useEffect } from 'react';
import ConceptFormModal from './ConceptFormModal';

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredConcepts.map(concept => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              onUpdate={fetchConcepts}
              onEdit={(concept) => {
                setEditingConcept(concept);
                setShowForm(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptCard({ concept, onUpdate, onEdit }) {
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

  const getRelationshipText = (relType) => {
    const textMap = {
      parent_of: 'parent of',
      child_of: 'child of',
      prerequisite_for: 'prerequisite for',
      builds_on: 'builds on',
      derived_from: 'derived from',
      related_to: 'related to',
      contrasts_with: 'contrasts with',
      integrates_with: 'integrates with',
      associated_with: 'associated with',
      influenced: 'influenced',
      supports: 'supports',
      critiques: 'critiques',
      authored: 'authored',
      applies_to: 'applies to',
      treats: 'treats'
    };
    return textMap[relType] || relType;
  };

  const outgoingConnections = concept.outgoing_connections || [];
  const incomingConnections = concept.incoming_connections || [];
  const totalConnections = outgoingConnections.length + incomingConnections.length;

  return (
    <div className="bg-white border border-gray-300 rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
            {concept.node_type}
          </span>
          {concept.level_status && (
            <span className="text-xs uppercase tracking-wider text-accent-dark">
              {concept.level_status}
            </span>
          )}
        </div>
        <button
          onClick={() => onEdit(concept)}
          className="!bg-transparent !text-primary hover:!text-accent-dark transition-colors !p-0"
          title="Edit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
      </div>

      <h3 className="text-xl mb-2">
        <a href={`/concepts/${concept.id}`} className="hover:text-primary">
          {concept.label}
        </a>
      </h3>

      {concept.summary_top && (
        <p className="text-sm mb-3 line-clamp-3">{concept.summary_top}</p>
      )}

      {/* Relationships Section */}
      {totalConnections > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="text-xs font-medium text-gray-700 mb-2">
            Relationships ({totalConnections})
          </div>
          <div className="space-y-1">
            {outgoingConnections.slice(0, 2).map(conn => (
              <div key={conn.id} className="text-xs text-gray-600">
                → {getRelationshipText(conn.rel_type)} <span className="font-medium">{conn.dst_concept.label}</span>
              </div>
            ))}
            {incomingConnections.slice(0, 2).map(conn => (
              <div key={conn.id} className="text-xs text-gray-600">
                ← <span className="font-medium">{conn.src_concept.label}</span> {getRelationshipText(conn.rel_type)} this
              </div>
            ))}
            {totalConnections > 4 && (
              <div className="text-xs text-gray-500 italic">
                +{totalConnections - 4} more...
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-auto">
        <span className="text-xs text-gray-500">
          Updated {new Date(concept.updated_at).toLocaleDateString()}
        </span>
        <button
          onClick={handleDelete}
          className="px-3 py-1 text-xs text-white bg-accent hover:bg-accent-dark rounded transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
