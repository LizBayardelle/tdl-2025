import React, { useState, useEffect } from 'react';
import SourceFormModal from './SourceFormModal';

export default function SourcesIndex() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterKind, setFilterKind] = useState('all');

  useEffect(() => {
    fetchSources();
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

  const filteredSources = filterKind === 'all'
    ? sources
    : sources.filter(source => source.kind === filterKind);

  const kinds = ['manual', 'textbook', 'rct', 'meta_analysis', 'guideline', 'video_demo', 'article', 'chapter'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading sources...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl">Evidence Sources</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark transition-colors"
        >
          {showForm ? 'Cancel' : 'New Source'}
        </button>
      </div>

      <SourceFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          fetchSources();
          setShowForm(false);
        }}
      />

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterKind('all')}
          className={`px-4 py-2 rounded text-sm ${
            filterKind === 'all'
              ? 'bg-primary text-sand'
              : 'bg-white border border-gray-300 hover:bg-sand'
          }`}
        >
          All ({sources.length})
        </button>
        {kinds.map(kind => {
          const count = sources.filter(s => s.kind === kind).length;
          if (count === 0) return null;
          return (
            <button
              key={kind}
              onClick={() => setFilterKind(kind)}
              className={`px-4 py-2 rounded capitalize text-sm ${
                filterKind === kind
                  ? 'bg-primary text-sand'
                  : 'bg-white border border-gray-300 hover:bg-sand'
              }`}
            >
              {kind.replace('_', ' ')} ({count})
            </button>
          );
        })}
      </div>

      {filteredSources.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-300 rounded">
          <p className="text-lg mb-4">No sources yet.</p>
          <p className="text-sm">Add your first source to build your evidence base.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSources.map(source => (
            <SourceCard key={source.id} source={source} onUpdate={fetchSources} />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceCard({ source, onUpdate }) {
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
    <div className="bg-white border border-gray-300 rounded p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {source.kind && (
              <span className="text-xs uppercase tracking-wider text-primary bg-sand px-3 py-1 rounded">
                {source.kind.replace('_', ' ')}
              </span>
            )}
            {source.year && (
              <span className="text-xs text-gray-600">{source.year}</span>
            )}
          </div>
          <h3 className="text-xl mb-2">
            <a href={`/sources/${source.id}`} className="hover:text-primary">
              {source.title}
            </a>
          </h3>
          {source.authors && (
            <p className="text-sm text-gray-600 mb-2">{source.authors}</p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="px-3 py-1 text-xs text-white bg-accent hover:bg-accent-dark rounded transition-colors ml-4"
        >
          Delete
        </button>
      </div>

      {source.summary && (
        <p className="text-sm mb-3">{source.summary}</p>
      )}

      {source.doi_or_url && (
        <a
          href={source.doi_or_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:text-accent-dark underline"
        >
          {source.doi_or_url}
        </a>
      )}
    </div>
  );
}
