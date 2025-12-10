import React, { useState, useEffect } from 'react';

export default function TagSelector({ selectedTags = [], onChange }) {
  const [allTags, setAllTags] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await fetch('/tags.json');
      const data = await response.json();
      setAllTags(data.map(tag => tag.name));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setLoading(false);
    }
  };

  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(filter.toLowerCase())
  );

  const handleToggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleCreateFromFilter = () => {
    if (filter.trim() && !allTags.includes(filter.trim()) && !selectedTags.includes(filter.trim())) {
      const newTag = filter.trim();
      setAllTags([...allTags, newTag]);
      onChange([...selectedTags, newTag]);
      setFilter('');
    }
  };

  const canCreateNew = filter.trim() &&
                       !allTags.includes(filter.trim()) &&
                       !selectedTags.includes(filter.trim());

  if (loading) {
    return <div className="text-sm text-gray-500">Loading tags...</div>;
  }

  return (
    <div className="border border-gray-300 rounded bg-white h-full flex flex-col">
      {/* Search/Filter Input */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreateNew) {
              e.preventDefault();
              handleCreateFromFilter();
            }
          }}
          placeholder="Type to filter or create new tag..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
        />
        {canCreateNew && (
          <button
            type="button"
            onClick={handleCreateFromFilter}
            className="mt-2 text-xs hover:text-accent-dark"
            style={{ background: 'none', padding: 0, color: '#414431' }}
          >
            + Create "{filter.trim()}"
          </button>
        )}
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-sand">
          <div className="text-xs font-medium mb-2 text-gray-600">Selected:</div>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-sand text-xs rounded"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleToggleTag(tag)}
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

      {/* Scrollable Tag List */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredTags.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            {filter ? 'No matching tags. Press Enter to create new.' : 'No tags yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTags.map(tag => (
              <label
                key={tag}
                className="flex items-center gap-2 cursor-pointer hover:bg-sand px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => handleToggleTag(tag)}
                  className="rounded border-gray-300"
                  style={{ accentColor: '#414431' }}
                />
                <span className="text-sm">{tag}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
