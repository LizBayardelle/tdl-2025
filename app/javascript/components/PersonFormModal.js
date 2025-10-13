import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function PersonFormModal({ isOpen, onClose, onSuccess, item }) {
  const [concepts, setConcepts] = useState([]);
  const [sources, setSources] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'theorist',
    summary: '',
    aka: [],
    concept_ids: [],
    source_ids: []
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchConcepts();
      fetchSources();
      if (item) {
        setFormData({
          full_name: item.full_name || '',
          role: item.role || 'theorist',
          summary: item.summary || '',
          aka: item.aka || [],
          concept_ids: item.concept_ids || [],
          source_ids: item.source_ids || []
        });
      } else {
        setFormData({
          full_name: '',
          role: 'theorist',
          summary: '',
          aka: [],
          concept_ids: [],
          source_ids: []
        });
      }
      setError('');
    }
  }, [isOpen, item]);

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  const fetchSources = async () => {
    try {
      const response = await fetch('/sources.json');
      const data = await response.json();
      setSources(data);
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/people/${item.id}` : '/people';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ person: formData }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await response.json();
        setError(data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving person:', error);
      setError('An error occurred while saving the person');
    }
  };

  const handleArrayInput = (value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, aka: items });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Person' : 'New Person'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

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

        <div>
          <label className="block text-sm font-medium mb-1">
            Link Sources (hold Cmd/Ctrl to select multiple)
          </label>
          <select
            multiple
            value={formData.source_ids}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
              setFormData({ ...formData, source_ids: selected });
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            size="5"
          >
            {sources.map(source => (
              <option key={source.id} value={source.id}>
                {source.title} {source.year ? `(${source.year})` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-600 mt-1">
            Selected: {formData.source_ids.length} {formData.source_ids.length === 1 ? 'source' : 'sources'}
          </p>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Person'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
