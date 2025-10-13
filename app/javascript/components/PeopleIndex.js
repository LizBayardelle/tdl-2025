import React, { useState, useEffect } from 'react';

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

      {showForm && (
        <div className="mb-8 p-6 bg-white border border-gray-300 rounded">
          <PersonForm
            onSuccess={() => {
              fetchPeople();
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

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
          className="text-xs text-accent hover:text-accent-dark"
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

function PersonForm({ onSuccess, onCancel }) {
  const [concepts, setConcepts] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'theorist',
    summary: '',
    aka: [],
    concept_ids: []
  });

  useEffect(() => {
    fetchConcepts();
  }, []);

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ person: formData }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error creating person:', error);
    }
  };

  const handleArrayInput = (value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, aka: items });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Full Name *</label>
        <input
          type="text"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Role</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
        >
          <option value="theorist">Theorist</option>
          <option value="clinician">Clinician</option>
          <option value="researcher">Researcher</option>
          <option value="peer">Peer</option>
          <option value="client">Client</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Also Known As (one per line)
        </label>
        <textarea
          value={formData.aka.join('\n')}
          onChange={(e) => handleArrayInput(e.target.value)}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          placeholder="Aaron T. Beck&#10;A.T. Beck"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Summary
        </label>
        <textarea
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Link Constructs (hold Cmd/Ctrl to select multiple)
        </label>
        <select
          multiple
          value={formData.concept_ids}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
            setFormData({ ...formData, concept_ids: selected });
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          size="5"
        >
          {concepts.map(concept => (
            <option key={concept.id} value={concept.id}>
              {concept.label} ({concept.node_type})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mt-1">
          Selected: {formData.concept_ids.length} {formData.concept_ids.length === 1 ? 'construct' : 'constructs'}
        </p>
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Create Person
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
