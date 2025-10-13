import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function TagFormModal({ isOpen, onClose, onSuccess, item }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#414431'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          name: item.name || '',
          description: item.description || '',
          color: item.color || '#414431'
        });
      } else {
        setFormData({
          name: '',
          description: '',
          color: '#414431'
        });
      }
      setError('');
    }
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/tags/${item.id}` : '/tags';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ tag: formData }),
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
      console.error('Error saving tag:', error);
      setError('An error occurred while saving the tag');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Tag' : 'New Tag'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="What does this tag represent?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Color</label>
          <input
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="w-full h-12 border border-gray-300 rounded bg-white"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Tag'}
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
