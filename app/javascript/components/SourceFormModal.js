import React, { useState, useEffect } from 'react';
import Modal from './Modal';

export default function SourceFormModal({ isOpen, onClose, onSuccess, item }) {
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    year: '',
    kind: 'article',
    publisher_or_venue: '',
    doi_or_url: '',
    citation: '',
    summary: '',
    tags: []
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          title: item.title || '',
          authors: item.authors || '',
          year: item.year || '',
          kind: item.kind || 'article',
          publisher_or_venue: item.publisher_or_venue || '',
          doi_or_url: item.doi_or_url || '',
          citation: item.citation || '',
          summary: item.summary || '',
          tags: item.tags || []
        });
      } else {
        setFormData({
          title: '',
          authors: '',
          year: '',
          kind: 'article',
          publisher_or_venue: '',
          doi_or_url: '',
          citation: '',
          summary: '',
          tags: []
        });
      }
      setError('');
    }
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = item ? `/sources/${item.id}` : '/sources';
      const method = item ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ source: formData }),
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
      console.error('Error saving source:', error);
      setError('An error occurred while saving the source');
    }
  };

  const handleArrayInput = (value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, tags: items });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Source' : 'New Source'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Authors</label>
            <input
              type="text"
              value={formData.authors}
              onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
              placeholder="Last, F., Last, F."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Year</label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
              placeholder="2024"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kind</label>
            <select
              value={formData.kind}
              onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="article">Article</option>
              <option value="textbook">Textbook</option>
              <option value="chapter">Chapter</option>
              <option value="manual">Manual</option>
              <option value="rct">RCT</option>
              <option value="meta_analysis">Meta-Analysis</option>
              <option value="guideline">Guideline</option>
              <option value="video_demo">Video Demo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Publisher/Venue</label>
            <input
              type="text"
              value={formData.publisher_or_venue}
              onChange={(e) => setFormData({ ...formData, publisher_or_venue: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">DOI or URL</label>
          <input
            type="text"
            value={formData.doi_or_url}
            onChange={(e) => setFormData({ ...formData, doi_or_url: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full Citation</label>
          <textarea
            value={formData.citation}
            onChange={(e) => setFormData({ ...formData, citation: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Summary (3-5 lines of key findings)
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
            Tags (one per line)
          </label>
          <textarea
            value={formData.tags.join('\n')}
            onChange={(e) => handleArrayInput(e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {item ? 'Save Changes' : 'Create Source'}
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
