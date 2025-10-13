import React, { useState, useEffect } from 'react';
import ConceptFormModal from './ConceptFormModal';

export default function ConceptsIndex() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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

  const conceptTypes = ['model', 'technique', 'mechanism', 'construct', 'measure', 'population'];

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
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          fetchConcepts();
          setShowForm(false);
        }}
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
            <ConceptCard key={concept.id} concept={concept} onUpdate={fetchConcepts} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptCard({ concept, onUpdate }) {
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

  return (
    <div className="bg-white border border-gray-300 rounded p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
          {concept.node_type}
        </span>
        {concept.level_status && (
          <span className="text-xs uppercase tracking-wider text-accent-dark">
            {concept.level_status}
          </span>
        )}
      </div>

      <h3 className="text-xl mb-2">
        <a href={`/concepts/${concept.id}`} className="hover:text-primary">
          {concept.label}
        </a>
      </h3>

      {concept.summary_top && (
        <p className="text-sm mb-3 line-clamp-3">{concept.summary_top}</p>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
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
