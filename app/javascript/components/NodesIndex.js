import React, { useState, useEffect } from 'react';

export default function NodesIndex() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const response = await fetch('/nodes.json');
      const data = await response.json();
      setNodes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching nodes:', error);
      setLoading(false);
    }
  };

  const filteredNodes = filterType === 'all'
    ? nodes
    : nodes.filter(node => node.node_type === filterType);

  const nodeTypes = ['model', 'technique', 'mechanism', 'construct', 'measure', 'population'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading constructs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl">Knowledge Constructs</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark transition-colors"
        >
          {showForm ? 'Cancel' : 'New Construct'}
        </button>
      </div>

      {showForm && (
        <div className="mb-8 p-6 bg-white border border-gray-300 rounded">
          <NodeForm
            onSuccess={() => {
              fetchNodes();
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded ${
            filterType === 'all'
              ? 'bg-primary text-sand'
              : 'bg-white border border-gray-300 hover:bg-sand'
          }`}
        >
          All ({nodes.length})
        </button>
        {nodeTypes.map(type => {
          const count = nodes.filter(n => n.node_type === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded capitalize ${
                filterType === type
                  ? 'bg-primary text-sand'
                  : 'bg-white border border-gray-300 hover:bg-sand'
              }`}
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      {filteredNodes.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-300 rounded">
          <p className="text-lg mb-4">No constructs yet.</p>
          <p className="text-sm">Create your first knowledge construct to begin building your framework.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNodes.map(node => (
            <NodeCard key={node.id} node={node} onUpdate={fetchNodes} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeCard({ node, onUpdate }) {
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this node?')) return;

    try {
      const response = await fetch(`/nodes/${node.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
          {node.node_type}
        </span>
        {node.level_status && (
          <span className="text-xs uppercase tracking-wider text-accent-dark">
            {node.level_status}
          </span>
        )}
      </div>

      <h3 className="text-xl mb-2">
        <a href={`/nodes/${node.id}`} className="hover:text-primary">
          {node.label}
        </a>
      </h3>

      {node.summary_top && (
        <p className="text-sm mb-3 line-clamp-3">{node.summary_top}</p>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <span className="text-xs text-gray-500">
          Updated {new Date(node.updated_at).toLocaleDateString()}
        </span>
        <button
          onClick={handleDelete}
          className="text-xs text-accent hover:text-accent-dark"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function NodeForm({ onSuccess, onCancel }) {
  const [people, setPeople] = useState([]);
  const [formData, setFormData] = useState({
    label: '',
    node_type: 'model',
    level_status: 'mapped',
    summary_top: '',
    summary_mid: '',
    summary_deep: '',
    mechanisms: [],
    signature_techniques: [],
    strengths: [],
    weaknesses: [],
    adjacent_models: [],
    contrasts_with: [],
    integrates_with: [],
    intake_questions: [],
    micro_skills: [],
    practice_prompts: [],
    assessment_links: [],
    evidence_brief: '',
    confidence_note: '',
    tags: [],
    people_ids: []
  });

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await fetch('/people.json');
      const data = await response.json();
      setPeople(data);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const handleArrayInput = (field, value) => {
    const items = value.split('\n').filter(item => item.trim());
    setFormData({ ...formData, [field]: items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ node: formData }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error creating node:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Label *</label>
        <input
          type="text"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type *</label>
          <select
            value={formData.node_type}
            onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="model">Model</option>
            <option value="technique">Technique</option>
            <option value="mechanism">Mechanism</option>
            <option value="construct">Construct</option>
            <option value="measure">Measure</option>
            <option value="population">Population</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={formData.level_status}
            onChange={(e) => setFormData({ ...formData, level_status: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="mapped">Mapped</option>
            <option value="basic">Basic</option>
            <option value="deep">Deep</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Summary Top (2-3 sentences)
        </label>
        <textarea
          value={formData.summary_top}
          onChange={(e) => setFormData({ ...formData, summary_top: e.target.value })}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Summary Mid (~200 words)
        </label>
        <textarea
          value={formData.summary_mid}
          onChange={(e) => setFormData({ ...formData, summary_mid: e.target.value })}
          rows="5"
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Summary Deep (~600 words)
        </label>
        <textarea
          value={formData.summary_deep}
          onChange={(e) => setFormData({ ...formData, summary_deep: e.target.value })}
          rows="8"
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Mechanisms (one per line)
          </label>
          <textarea
            value={formData.mechanisms.join('\n')}
            onChange={(e) => handleArrayInput('mechanisms', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Signature Techniques (one per line)
          </label>
          <textarea
            value={formData.signature_techniques.join('\n')}
            onChange={(e) => handleArrayInput('signature_techniques', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Strengths (one per line)
          </label>
          <textarea
            value={formData.strengths.join('\n')}
            onChange={(e) => handleArrayInput('strengths', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Weaknesses (one per line)
          </label>
          <textarea
            value={formData.weaknesses.join('\n')}
            onChange={(e) => handleArrayInput('weaknesses', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Adjacent Models (one per line)
          </label>
          <textarea
            value={formData.adjacent_models.join('\n')}
            onChange={(e) => handleArrayInput('adjacent_models', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Contrasts With (one per line)
          </label>
          <textarea
            value={formData.contrasts_with.join('\n')}
            onChange={(e) => handleArrayInput('contrasts_with', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Integrates With (one per line)
          </label>
          <textarea
            value={formData.integrates_with.join('\n')}
            onChange={(e) => handleArrayInput('integrates_with', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Intake Questions (one per line)
          </label>
          <textarea
            value={formData.intake_questions.join('\n')}
            onChange={(e) => handleArrayInput('intake_questions', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Micro Skills (one per line)
          </label>
          <textarea
            value={formData.micro_skills.join('\n')}
            onChange={(e) => handleArrayInput('micro_skills', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Practice Prompts (one per line)
          </label>
          <textarea
            value={formData.practice_prompts.join('\n')}
            onChange={(e) => handleArrayInput('practice_prompts', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Assessment Links (one per line)
          </label>
          <textarea
            value={formData.assessment_links.join('\n')}
            onChange={(e) => handleArrayInput('assessment_links', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Tags (one per line)
          </label>
          <textarea
            value={formData.tags.join('\n')}
            onChange={(e) => handleArrayInput('tags', e.target.value)}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Link People (hold Cmd/Ctrl to select multiple)
        </label>
        <select
          multiple
          value={formData.people_ids}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
            setFormData({ ...formData, people_ids: selected });
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          size="5"
        >
          {people.map(person => (
            <option key={person.id} value={person.id}>
              {person.full_name} ({person.role})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mt-1">
          Selected: {formData.people_ids.length} {formData.people_ids.length === 1 ? 'person' : 'people'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Evidence Brief
        </label>
        <textarea
          value={formData.evidence_brief}
          onChange={(e) => setFormData({ ...formData, evidence_brief: e.target.value })}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Confidence Note
        </label>
        <textarea
          value={formData.confidence_note}
          onChange={(e) => setFormData({ ...formData, confidence_note: e.target.value })}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Create Construct
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
