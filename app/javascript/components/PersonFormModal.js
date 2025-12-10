import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';

export default function PersonFormModal({ isOpen, onClose, onSuccess, item }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [sources, setSources] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'theorist',
    summary: '',
    aka: [],
    concept_ids: [],
    source_ids: [],
    tags: []
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      fetchSources();
      if (item) {
        setFormData({
          full_name: item.full_name || '',
          role: item.role || 'theorist',
          summary: item.summary || '',
          aka: item.aka || [],
          concept_ids: item.concept_ids || [],
          source_ids: item.source_ids || [],
          tags: item.tags || []
        });
      } else {
        setFormData({
          full_name: '',
          role: 'theorist',
          summary: '',
          aka: [],
          concept_ids: [],
          source_ids: [],
          tags: []
        });
      }
      setError('');
    }
  }, [isOpen, item]);

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

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'details', label: 'Details' },
    { id: 'metadata', label: 'Metadata' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Person' : 'New Person'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 font-medium rounded-t-lg ${
                activeTab === tab.id
                  ? '!bg-sand !text-gray-800'
                  : '!bg-primary !text-sand hover:!bg-accent-dark'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Tab Content */}
        <div className="overflow-y-auto bg-sand p-6 rounded-b-lg rounded-tr-lg shadow-lg h-[450px]">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
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
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Summary
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  rows="8"
                  className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
                />
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
                  size="8"
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
            </div>
          )}

          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <div className="grid grid-cols-1 gap-4 h-full">
              <div className="flex flex-col">
                <label className="block text-sm font-medium mb-1">
                  Concepts
                </label>
                <div className="flex-1 overflow-hidden">
                  <ConceptSelector
                    selectedConceptIds={formData.concept_ids}
                    onChange={(concept_ids) => setFormData({ ...formData, concept_ids })}
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="block text-sm font-medium mb-1">
                  Tags
                </label>
                <div className="flex-1 overflow-hidden">
                  <TagSelector
                    selectedTags={formData.tags}
                    onChange={(tags) => setFormData({ ...formData, tags })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-6 mt-0">
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
