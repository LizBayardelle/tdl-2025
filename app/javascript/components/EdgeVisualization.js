import React, { useState, useEffect } from 'react';

export default function EdgeVisualization() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedRelType, setSelectedRelType] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        fetch('/nodes.json'),
        fetch('/edges.json')
      ]);
      const nodesData = await nodesRes.json();
      const edgesData = await edgesRes.json();
      setNodes(nodesData);
      setEdges(edgesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const filteredNodes = selectedType === 'all'
    ? nodes
    : nodes.filter(n => n.node_type === selectedType);

  const filteredEdges = edges.filter(edge => {
    const hasNode = filteredNodes.some(n => n.id === edge.src.id || n.id === edge.dst.id);
    const matchesRelType = selectedRelType === 'all' || edge.rel_type === selectedRelType;
    return hasNode && matchesRelType;
  });

  // Group nodes by type
  const nodesByType = filteredNodes.reduce((acc, node) => {
    if (!acc[node.node_type]) acc[node.node_type] = [];
    acc[node.node_type].push(node);
    return acc;
  }, {});

  const relTypeLabels = {
    adjacent: 'Adjacent',
    contrasts_with: 'Contrasts',
    integrates_with: 'Integrates',
    builds_on: 'Builds on',
    subsumes: 'Subsumes'
  };

  const relTypeColors = {
    adjacent: 'bg-blue-100 border-blue-300',
    contrasts_with: 'bg-red-100 border-red-300',
    integrates_with: 'bg-green-100 border-green-300',
    builds_on: 'bg-purple-100 border-purple-300',
    subsumes: 'bg-yellow-100 border-yellow-300'
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p>Loading visualization...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl mb-4">Knowledge Graph</h1>
        <p className="text-lg mb-6">
          Explore relationships between constructs
        </p>

        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="all">All Types</option>
              <option value="model">Model</option>
              <option value="technique">Technique</option>
              <option value="mechanism">Mechanism</option>
              <option value="construct">Construct</option>
              <option value="measure">Measure</option>
              <option value="population">Population</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Filter by Relationship</label>
            <select
              value={selectedRelType}
              onChange={(e) => setSelectedRelType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="all">All Relationships</option>
              <option value="adjacent">Adjacent</option>
              <option value="contrasts_with">Contrasts With</option>
              <option value="integrates_with">Integrates With</option>
              <option value="builds_on">Builds On</option>
              <option value="subsumes">Subsumes</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium mb-2">Legend:</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(relTypeLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${relTypeColors[key]}`} />
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(nodesByType).map(([type, typeNodes]) => (
          <div key={type} className="bg-white border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl mb-4 capitalize">
              {type.replace('_', ' ')}s ({typeNodes.length})
            </h2>
            <div className="space-y-4">
              {typeNodes.map(node => {
                const nodeEdges = filteredEdges.filter(
                  e => e.src.id === node.id || e.dst.id === node.id
                );

                return (
                  <div key={node.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <a
                          href={`/nodes/${node.id}`}
                          className="text-lg font-medium hover:text-primary"
                        >
                          {node.label}
                        </a>
                        {node.summary_top && (
                          <p className="text-sm text-gray-600 mt-1">{node.summary_top}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-4">
                        {nodeEdges.length} {nodeEdges.length === 1 ? 'connection' : 'connections'}
                      </span>
                    </div>

                    {nodeEdges.length > 0 && (
                      <div className="grid md:grid-cols-2 gap-2 mt-3">
                        {nodeEdges.map(edge => {
                          const isSource = edge.src.id === node.id;
                          const otherNode = isSource ? edge.dst : edge.src;
                          const direction = isSource ? '→' : '←';

                          return (
                            <div
                              key={edge.id}
                              className={`${relTypeColors[edge.rel_type]} border rounded px-3 py-2`}
                            >
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium">
                                  {relTypeLabels[edge.rel_type]}
                                </span>
                                <span className="text-gray-600">{direction}</span>
                                <a
                                  href={`/nodes/${otherNode.id}`}
                                  className="hover:underline flex-1 truncate"
                                >
                                  {otherNode.label}
                                </a>
                              </div>
                              {edge.strength && (
                                <div className="text-xs text-gray-600 mt-1">
                                  Strength: {edge.strength}/5
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredNodes.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-300 rounded-lg">
          <p className="text-lg text-gray-600">No constructs match your filters</p>
        </div>
      )}
    </div>
  );
}
