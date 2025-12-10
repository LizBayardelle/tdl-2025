import React, { useState, useEffect } from 'react';

export default function SourceSelector({ selectedSourceIds = [], onChange }) {
  const [allSources, setAllSources] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const response = await fetch('/sources.json');
      const data = await response.json();
      setAllSources(data.sort((a, b) => a.title.localeCompare(b.title)));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setLoading(false);
    }
  };

  const filteredSources = filter
    ? allSources.filter(source =>
        source.title.toLowerCase().includes(filter.toLowerCase())
      )
    : allSources;

  const handleToggle = (sourceId) => {
    if (selectedSourceIds.includes(sourceId)) {
      onChange(selectedSourceIds.filter(id => id !== sourceId));
    } else {
      onChange([...selectedSourceIds, sourceId]);
    }
  };

  const selectedSources = allSources.filter(s => selectedSourceIds.includes(s.id));

  if (loading) return <p className="text-sm text-gray-500">Loading sources...</p>;

  return (
    <div className="border border-gray-300 rounded bg-white h-full flex flex-col">
      {/* Search/Filter Input */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Type to filter sources..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
        />
      </div>

      {/* Selected Sources */}
      {selectedSources.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-sand">
          <div className="text-xs font-medium mb-2 text-gray-600">Selected:</div>
          <div className="flex flex-wrap gap-2">
            {selectedSources.map(source => (
              <span
                key={source.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-sand text-xs rounded"
              >
                {source.title} {source.year && `(${source.year})`}
                <button
                  type="button"
                  onClick={() => handleToggle(source.id)}
                  className="hover:text-accent-light"
                  style={{ background: 'none', padding: 0, fontSize: '14px' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Source List */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredSources.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No sources found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSources.map(source => (
              <label key={source.id} className="flex items-start gap-2 cursor-pointer hover:bg-sand px-2 py-1 rounded">
                <input
                  type="checkbox"
                  checked={selectedSourceIds.includes(source.id)}
                  onChange={() => handleToggle(source.id)}
                  className="mt-1 rounded border-gray-300"
                  style={{ accentColor: '#414431' }}
                />
                <span className="text-sm">
                  {source.title} {source.year && `(${source.year})`}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
