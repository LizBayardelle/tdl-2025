import React, { useState, useEffect } from 'react';

export default function TagsIndex() {
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('popularity');
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    fetchTags();
  }, [sortBy]);

  const fetchTags = async () => {
    try {
      const response = await fetch(`/tags.json?sort=${sortBy === 'alphabetical' ? 'alphabetical' : 'popularity'}`);
      const data = await response.json();
      setTags(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setLoading(false);
    }
  };

  const handleTagClick = async (tag) => {
    try {
      const response = await fetch(`/tags/${tag.id}.json`);
      const data = await response.json();
      setSelectedTag(data);
    } catch (error) {
      console.error('Error fetching tag details:', error);
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!confirm('Delete this tag? This will remove it from all items.')) return;

    try {
      const response = await fetch(`/tags/${tagId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setTags(tags.filter(t => t.id !== tagId));
        if (selectedTag?.id === tagId) {
          setSelectedTag(null);
        }
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl mb-4">Tags</h1>
        <p className="text-lg mb-6">
          Browse and organize your knowledge by tags
        </p>

        <div className="flex items-center gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="popularity">Popularity</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>

          <button
            onClick={() => setCreatingTag(!creatingTag)}
            className="ml-auto mt-6 px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
          >
            {creatingTag ? 'Cancel' : '+ New Tag'}
          </button>
        </div>

        {creatingTag && (
          <TagForm
            onSuccess={(newTag) => {
              setTags([newTag, ...tags]);
              setCreatingTag(false);
            }}
            onCancel={() => setCreatingTag(false)}
          />
        )}
      </div>

      {loading ? (
        <p>Loading tags...</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">All Tags ({tags.length})</h2>
              {tags.length === 0 ? (
                <p className="text-sm text-gray-600">No tags yet</p>
              ) : (
                <div className="space-y-2">
                  {tags.map(tag => (
                    <div
                      key={tag.id}
                      className={`flex items-center justify-between p-3 rounded cursor-pointer hover:bg-sand transition-colors ${
                        selectedTag?.id === tag.id ? 'bg-sand' : ''
                      }`}
                      onClick={() => handleTagClick(tag)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {tag.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          <span className="font-medium">{tag.name}</span>
                        </div>
                        {tag.description && (
                          <p className="text-xs text-gray-600 mt-1">{tag.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {tag.taggings_count || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedTag ? (
              <TagDetail
                tag={selectedTag}
                onDelete={() => handleDeleteTag(selectedTag.id)}
                onUpdate={(updatedTag) => {
                  setSelectedTag(updatedTag);
                  setTags(tags.map(t => t.id === updatedTag.id ? updatedTag : t));
                }}
              />
            ) : (
              <div className="bg-white border border-gray-300 rounded-lg p-12 text-center">
                <p className="text-lg text-gray-600">
                  Select a tag to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TagDetail({ tag, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);

  const typeLabels = {
    Node: 'Constructs',
    Source: 'Sources',
    Person: 'People',
    Edge: 'Relationships',
    Note: 'Notes'
  };

  if (editing) {
    return (
      <TagForm
        tag={tag}
        onSuccess={(updatedTag) => {
          onUpdate(updatedTag);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          {tag.color && (
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
          )}
          <div>
            <h2 className="text-3xl">{tag.name}</h2>
            {tag.description && (
              <p className="text-gray-600 mt-1">{tag.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-sand"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm text-accent-dark hover:text-primary"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg mb-3">Tagged Items ({tag.taggings_count})</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(tag.taggings_by_type || {}).map(([type, count]) => (
            <div key={type} className="bg-sand px-4 py-2 rounded">
              <span className="font-medium">{typeLabels[type] || type}</span>
              <span className="text-gray-600 ml-2">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {tag.nodes && tag.nodes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg mb-3">Constructs</h3>
          <div className="space-y-2">
            {tag.nodes.map(node => (
              <a
                key={node.id}
                href={`/nodes/${node.id}`}
                className="block p-3 border border-gray-200 rounded hover:bg-sand"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{node.label}</span>
                  <span className="text-xs text-gray-500">{node.node_type}</span>
                </div>
                {node.summary_top && (
                  <p className="text-sm text-gray-600 mt-1">{node.summary_top}</p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {tag.sources && tag.sources.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg mb-3">Sources</h3>
          <div className="space-y-2">
            {tag.sources.map(source => (
              <div key={source.id} className="p-3 border border-gray-200 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{source.title}</span>
                  <span className="text-xs text-gray-500">{source.kind}</span>
                </div>
                {source.authors && (
                  <p className="text-sm text-gray-600 mt-1">{source.authors}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tag.people && tag.people.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg mb-3">People</h3>
          <div className="space-y-2">
            {tag.people.map(person => (
              <div key={person.id} className="p-3 border border-gray-200 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{person.full_name}</span>
                  <span className="text-xs text-gray-500">{person.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tag.notes && tag.notes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg mb-3">Notes</h3>
          <div className="space-y-2">
            {tag.notes.map(note => (
              <div key={note.id} className="p-3 border border-gray-200 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
                    {note.note_type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">{note.body}</p>
                {note.node && (
                  <a href={`/nodes/${note.node.id}`} className="text-xs text-primary hover:underline mt-1 block">
                    → {note.node.label}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TagForm({ tag, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: tag?.name || '',
    description: tag?.description || '',
    color: tag?.color || '#414431'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = tag ? `/tags/${tag.id}` : '/tags';
      const method = tag ? 'PATCH' : 'POST';

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
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving tag:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-300 rounded-lg p-6">
      <h3 className="text-xl mb-4">{tag ? 'Edit Tag' : 'New Tag'}</h3>

      <div className="space-y-4">
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
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          {tag ? 'Save Changes' : 'Create Tag'}
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
