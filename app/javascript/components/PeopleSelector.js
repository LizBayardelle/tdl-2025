import React, { useState, useEffect } from 'react';

export default function PeopleSelector({ selectedPersonIds = [], onChange }) {
  const [allPeople, setAllPeople] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/people.json');
      const data = await response.json();
      setAllPeople(data.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching people:', error);
      setLoading(false);
    }
  };

  const filteredPeople = filter
    ? allPeople.filter(person =>
        person.full_name.toLowerCase().includes(filter.toLowerCase())
      )
    : allPeople;

  const handleToggle = (personId) => {
    if (selectedPersonIds.includes(personId)) {
      onChange(selectedPersonIds.filter(id => id !== personId));
    } else {
      onChange([...selectedPersonIds, personId]);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading people...</p>;

  return (
    <div className="border border-gray-300 rounded bg-white">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Type to filter people..."
        className="w-full px-4 py-2 border-b border-gray-300 rounded-t bg-white"
      />
      <div className="max-h-48 overflow-y-auto p-3 space-y-2">
        {filteredPeople.length === 0 ? (
          <p className="text-sm text-gray-500">No people found</p>
        ) : (
          filteredPeople.map(person => (
            <label key={person.id} className="flex items-start gap-2 cursor-pointer hover:bg-sand p-1 rounded">
              <input
                type="checkbox"
                checked={selectedPersonIds.includes(person.id)}
                onChange={() => handleToggle(person.id)}
                className="mt-1 rounded"
                style={{ accentColor: '#414431' }}
              />
              <span className="text-sm">
                {person.full_name} {person.role && `(${person.role})`}
              </span>
            </label>
          ))
        )}
      </div>
      <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-200">
        {selectedPersonIds.length} selected
      </div>
    </div>
  );
}
