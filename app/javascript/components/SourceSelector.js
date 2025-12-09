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

  if (loading) return <p className="text-sm text-gray-500">Loading sources...</p>;

  return (
    <div className="border border-gray-300 rounded bg-white">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Type to filter sources..."
        className="w-full px-4 py-2 border-b border-gray-300 rounded-t bg-white"
      />
      <div className="max-h-48 overflow-y-auto p-3 space-y-2">
        {filteredSources.length === 0 ? (
          <p className="text-sm text-gray-500">No sources found</p>
        ) : (
          filteredSources.map(source => (
            <label key={source.id} className="flex items-start gap-2 cursor-pointer hover:bg-sand p-1 rounded">
              <input
                type="checkbox"
                checked={selectedSourceIds.includes(source.id)}
                onChange={() => handleToggle(source.id)}
                className="mt-1 rounded"
                style={{ accentColor: '#414431' }}
              />
              <span className="text-sm">
                {source.title} {source.year && `(${source.year})`}
              </span>
            </label>
          ))
        )}
      </div>
      <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-200">
        {selectedSourceIds.length} selected
      </div>
    </div>
  );
}
