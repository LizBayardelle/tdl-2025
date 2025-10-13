import React, { useState, useEffect } from 'react';

export default function PathwaysIndex() {
  const [pathways, setPathways] = useState([]);
  const [selectedPathway, setSelectedPathway] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingPathway, setCreatingPathway] = useState(false);

  useEffect(() => {
    fetchPathways();
  }, []);

  const fetchPathways = async () => {
    try {
      const response = await fetch('/pathways.json');
      const data = await response.json();
      setPathways(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pathways:', error);
      setLoading(false);
    }
  };

  const handlePathwayClick = async (pathway) => {
    try {
      const response = await fetch(`/pathways/${pathway.id}.json`);
      const data = await response.json();
      setSelectedPathway(data);
    } catch (error) {
      console.error('Error fetching pathway details:', error);
    }
  };

  const handleDeletePathway = async (pathwayId) => {
    if (!confirm('Delete this learning pathway?')) return;

    try {
      const response = await fetch(`/pathways/${pathwayId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setPathways(pathways.filter(p => p.id !== pathwayId));
        if (selectedPathway?.id === pathwayId) {
          setSelectedPathway(null);
        }
      }
    } catch (error) {
      console.error('Error deleting pathway:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl mb-4">Learning Pathways</h1>
        <p className="text-lg mb-6">
          Create structured sequences for mastering related concepts
        </p>

        <button
          onClick={() => setCreatingPathway(!creatingPathway)}
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          {creatingPathway ? 'Cancel' : '+ New Pathway'}
        </button>

        {creatingPathway && (
          <div className="mt-6">
            <PathwayForm
              onSuccess={(newPathway) => {
                setPathways([newPathway, ...pathways]);
                setCreatingPathway(false);
                handlePathwayClick(newPathway);
              }}
              onCancel={() => setCreatingPathway(false)}
            />
          </div>
        )}
      </div>

      {loading ? (
        <p>Loading pathways...</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <h2 className="text-xl mb-4">All Pathways ({pathways.length})</h2>
              {pathways.length === 0 ? (
                <p className="text-sm text-gray-600">No pathways yet</p>
              ) : (
                <div className="space-y-2">
                  {pathways.map(pathway => (
                    <div
                      key={pathway.id}
                      className={`p-3 rounded cursor-pointer hover:bg-sand transition-colors ${
                        selectedPathway?.id === pathway.id ? 'bg-sand' : ''
                      }`}
                      onClick={() => handlePathwayClick(pathway)}
                    >
                      <div className="font-medium mb-1">{pathway.name}</div>
                      {pathway.description && (
                        <p className="text-xs text-gray-600 mb-2">{pathway.description}</p>
                      )}
                      <div className="text-xs text-gray-500">
                        {pathway.nodes_count || 0} construct{pathway.nodes_count === 1 ? '' : 's'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedPathway ? (
              <PathwayDetail
                pathway={selectedPathway}
                onDelete={() => handleDeletePathway(selectedPathway.id)}
                onUpdate={(updatedPathway) => {
                  setSelectedPathway(updatedPathway);
                  setPathways(pathways.map(p => p.id === updatedPathway.id ? updatedPathway : p));
                }}
              />
            ) : (
              <div className="bg-white border border-gray-300 rounded-lg p-12 text-center">
                <p className="text-lg text-gray-600">
                  Select a pathway to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PathwayDetail({ pathway, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PathwayForm
        pathway={pathway}
        onSuccess={(updatedPathway) => {
          onUpdate(updatedPathway);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-3xl mb-2">{pathway.name}</h2>
          {pathway.description && (
            <p className="text-gray-600 mb-2">{pathway.description}</p>
          )}
          {pathway.goal && (
            <div className="bg-sand rounded p-3 mt-3">
              <p className="text-sm">
                <span className="font-medium">Learning Goal:</span> {pathway.goal}
              </p>
            </div>
          )}
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

      {pathway.nodes && pathway.nodes.length > 0 ? (
        <div>
          <h3 className="text-lg mb-4">Learning Sequence ({pathway.nodes.length} steps)</h3>
          <div className="space-y-3">
            {pathway.nodes.map((node, index) => (
              <a
                key={node.id}
                href={`/nodes/${node.id}`}
                className="flex items-start gap-4 p-4 border border-gray-200 rounded hover:bg-sand transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-sand rounded-full flex items-center justify-center font-medium">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{node.label}</span>
                    <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-0.5 rounded">
                      {node.node_type}
                    </span>
                    {node.level_status && (
                      <span className="text-xs uppercase tracking-wider text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {node.level_status}
                      </span>
                    )}
                  </div>
                  {node.summary_top && (
                    <p className="text-sm text-gray-600">{node.summary_top}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">
          <p>No constructs in this pathway yet</p>
          <p className="text-sm mt-2">Edit the pathway to add learning steps</p>
        </div>
      )}
    </div>
  );
}

function PathwayForm({ pathway, onSuccess, onCancel }) {
  const [nodes, setNodes] = useState([]);
  const [formData, setFormData] = useState({
    name: pathway?.name || '',
    description: pathway?.description || '',
    goal: pathway?.goal || '',
    node_sequence: pathway?.node_sequence || []
  });

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const response = await fetch('/nodes.json');
      const data = await response.json();
      setNodes(data);
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = pathway ? `/pathways/${pathway.id}` : '/pathways';
      const method = pathway ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ pathway: formData }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving pathway:', error);
    }
  };

  const handleAddNode = (nodeId) => {
    if (!nodeId) return;
    const sequence = [...formData.node_sequence];
    sequence.push({ node_id: parseInt(nodeId) });
    setFormData({ ...formData, node_sequence: sequence });
  };

  const handleRemoveNode = (index) => {
    const sequence = [...formData.node_sequence];
    sequence.splice(index, 1);
    setFormData({ ...formData, node_sequence: sequence });
  };

  const handleMoveNode = (index, direction) => {
    const sequence = [...formData.node_sequence];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sequence.length) return;

    [sequence[index], sequence[newIndex]] = [sequence[newIndex], sequence[index]];
    setFormData({ ...formData, node_sequence: sequence });
  };

  const getNodeById = (nodeId) => {
    return nodes.find(n => n.id === nodeId);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-300 rounded-lg p-6">
      <h3 className="text-xl mb-4">{pathway ? 'Edit Pathway' : 'New Pathway'}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="e.g., CBT Fundamentals, ACT Mastery Path"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="Brief overview of this learning path"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Learning Goal</label>
          <textarea
            value={formData.goal}
            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="What will learners achieve by completing this pathway?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Learning Sequence</label>

          <div className="mb-3">
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  handleAddNode(e.target.value);
                  e.target.value = '';
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded bg-white"
              >
                <option value="">Add a construct...</option>
                {nodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.label} ({node.node_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.node_sequence.length === 0 ? (
            <p className="text-sm text-gray-600 py-4 text-center border border-dashed border-gray-300 rounded">
              No constructs added yet
            </p>
          ) : (
            <div className="space-y-2">
              {formData.node_sequence.map((item, index) => {
                const node = getNodeById(item.node_id || item['node_id']);
                if (!node) return null;

                return (
                  <div key={index} className="flex items-center gap-2 p-3 bg-sand rounded">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveNode(index, 'up')}
                        disabled={index === 0}
                        className="text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveNode(index, 'down')}
                        disabled={index === formData.node_sequence.length - 1}
                        className="text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-sand rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{node.label}</div>
                      <div className="text-xs text-gray-600">{node.node_type}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNode(index)}
                      className="text-sm text-accent-dark hover:text-primary"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          {pathway ? 'Save Changes' : 'Create Pathway'}
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
