import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function NoteFormModal({ isOpen, onClose, onSuccess, item, conceptId }) {
  const [concepts, setConcepts] = useState([]);
  const [formData, setFormData] = useState({
    body: '',
    note_type: 'reflection',
    context: '',
    pinned: false,
    noted_on: new Date().toISOString().split('T')[0],
    concept_id: '',
    tags: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (!conceptId && !item) {
        fetchConcepts();
      }
      if (item) {
        setFormData({
          body: item.body || '',
          note_type: item.note_type || 'reflection',
          context: item.context || '',
          pinned: item.pinned || false,
          noted_on: item.noted_on || new Date().toISOString().split('T')[0],
          concept_id: item.concept_id || conceptId || '',
          tags: (item.tags || []).join('\n')
        });
      } else {
        setFormData({
          body: '',
          note_type: 'reflection',
          context: '',
          pinned: false,
          noted_on: new Date().toISOString().split('T')[0],
          concept_id: conceptId || '',
          tags: ''
        });
      }
      setError('');
    }
  }, [isOpen, item, conceptId]);

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
    setError('');

    const payload = {
      ...formData,
      concept_id: formData.concept_id || null,
      tags: formData.tags.split('\n').filter(t => t.trim())
    };

    try {
      const url = item ? `/notes/${item.id}` : '/notes';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: payload }),
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
      console.error('Error saving note:', error);
      setError('An error occurred while saving the note');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Note' : 'New Note'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Type *</label>
          <select
            value={formData.note_type}
            onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="reflection">Reflection</option>
            <option value="question">Question</option>
            <option value="insight">Insight</option>
            <option value="critique">Critique</option>
            <option value="application">Application</option>
            <option value="synthesis">Synthesis</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Body *</label>
          <textarea
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            rows="6"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="What are you thinking about?"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Context</label>
          <textarea
            value={formData.context}
            onChange={(e) => setFormData({ ...formData, context: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="What prompted this note?"
          />
        </div>

        {!conceptId && (
          <div>
            <label className="block text-sm font-medium mb-1">Link to Construct</label>
            <select
              value={formData.concept_id}
              onChange={(e) => setFormData({ ...formData, concept_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="">None (general note)</option>
              {concepts.map(concept => (
                <option key={concept.id} value={concept.id}>
                  {concept.label} ({concept.node_type})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Tags (one per line)</label>
          <textarea
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date Noted</label>
            <input
              type="date"
              value={formData.noted_on}
              onChange={(e) => setFormData({ ...formData, noted_on: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            />
          </div>

          <div className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              id="pinned"
              checked={formData.pinned}
              onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="pinned" className="text-sm">
              Pin this note
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Note'}
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
