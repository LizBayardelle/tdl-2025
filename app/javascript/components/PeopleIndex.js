import React, { useState, useEffect } from 'react';
import PersonFormModal from './PersonFormModal';

export default function PeopleIndex() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/people.json');
      const data = await response.json();
      setPeople(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching people:', error);
      setLoading(false);
    }
  };

  const filteredPeople = filterRole === 'all'
    ? people
    : people.filter(person => person.role === filterRole);

  const roles = ['theorist', 'clinician', 'researcher', 'peer', 'client'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading people...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl">People & Lineage</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark transition-colors"
        >
          {showForm ? 'Cancel' : 'New Person'}
        </button>
      </div>

      <PersonFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          fetchPeople();
          setShowForm(false);
        }}
      />

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterRole('all')}
          className={`px-4 py-2 rounded text-sm ${
            filterRole === 'all'
              ? 'bg-primary text-sand'
              : 'bg-white border border-gray-300 hover:bg-sand'
          }`}
        >
          All ({people.length})
        </button>
        {roles.map(role => {
          const count = people.filter(p => p.role === role).length;
          if (count === 0) return null;
          return (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-4 py-2 rounded capitalize text-sm ${
                filterRole === role
                  ? 'bg-primary text-sand'
                  : 'bg-white border border-gray-300 hover:bg-sand'
              }`}
            >
              {role} ({count})
            </button>
          );
        })}
      </div>

      {filteredPeople.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-300 rounded">
          <p className="text-lg mb-4">No people yet.</p>
          <p className="text-sm">Add people to track intellectual lineage and influence.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map(person => (
            <PersonCard key={person.id} person={person} onUpdate={fetchPeople} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({ person, onUpdate }) {
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this person?')) return;

    try {
      const response = await fetch(`/people/${person.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        {person.role && (
          <span className="text-xs uppercase tracking-wider text-primary bg-sand px-3 py-1 rounded">
            {person.role}
          </span>
        )}
        <button
          onClick={handleDelete}
          className="px-3 py-1 text-xs text-white bg-accent hover:bg-accent-dark rounded transition-colors"
        >
          Delete
        </button>
      </div>

      <h3 className="text-xl mb-2">
        <a href={`/people/${person.id}`} className="hover:text-primary">
          {person.full_name}
        </a>
      </h3>

      {person.aka && person.aka.length > 0 && (
        <p className="text-xs text-gray-600 mb-2">
          Also known as: {person.aka.join(', ')}
        </p>
      )}

      {person.summary && (
        <p className="text-sm mb-3 line-clamp-3">{person.summary}</p>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          Updated {new Date(person.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
