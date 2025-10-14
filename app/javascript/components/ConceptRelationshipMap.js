import React, { useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function ConceptRelationshipMap() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  const fgRef = useRef();

  useEffect(() => {
    fetchGraphData();
  }, []);

  // Zoom to fit all nodes after graph data loads
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 50); // 400ms transition, 50px padding
      }, 500); // Wait for initial layout
    }
  }, [graphData]);

  const fetchGraphData = async () => {
    try {
      const [conceptsRes, connectionsRes] = await Promise.all([
        fetch('/concepts.json'),
        fetch('/connections.json')
      ]);

      const [concepts, connections] = await Promise.all([
        conceptsRes.json(),
        connectionsRes.json()
      ]);

      // Build nodes - each concept becomes a node
      const nodes = concepts.map(concept => ({
        id: concept.id,
        label: concept.label,
        type: concept.node_type,
        slug: concept.slug,
        level_status: concept.level_status || 'mapped',
        // Count connections for node sizing
        connectionCount: connections.filter(c =>
          c.src_concept_id === concept.id || c.dst_concept_id === concept.id
        ).length
      }));

      // Build links - each connection becomes a link
      const links = connections.map(connection => ({
        source: connection.src_concept_id,
        target: connection.dst_concept_id,
        rel_type: connection.rel_type,
        relationship_label: connection.relationship_label,
        category: getCategoryForType(connection.rel_type),
        description: connection.description
      }));

      setGraphData({ nodes, links });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching graph data:', error);
      setLoading(false);
    }
  };

  const getCategoryForType = (relType) => {
    const hierarchical = ['parent_of', 'child_of'];
    const semantic = ['related_to', 'contrasts_with', 'integrates_with', 'associated_with'];
    const sequential = ['prerequisite_for', 'builds_on', 'derived_from'];
    const influence = ['influenced', 'supports', 'critiques'];

    if (hierarchical.includes(relType)) return 'hierarchical';
    if (semantic.includes(relType)) return 'semantic';
    if (sequential.includes(relType)) return 'sequential';
    if (influence.includes(relType)) return 'influence';
    return 'other';
  };

  const getFilteredData = () => {
    if (filterType === 'all') return graphData;

    const filteredLinks = graphData.links.filter(link => link.category === filterType);
    const connectedNodeIds = new Set();
    filteredLinks.forEach(link => {
      connectedNodeIds.add(link.source.id || link.source);
      connectedNodeIds.add(link.target.id || link.target);
    });

    const filteredNodes = graphData.nodes.filter(node => connectedNodeIds.has(node.id));

    return { nodes: filteredNodes, links: filteredLinks };
  };

  const handleNodeHover = (node) => {
    const newHighlightNodes = new Set();
    const newHighlightLinks = new Set();

    if (node) {
      newHighlightNodes.add(node.id);
      graphData.links.forEach(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;

        if (sourceId === node.id) {
          newHighlightLinks.add(link);
          newHighlightNodes.add(targetId);
        } else if (targetId === node.id) {
          newHighlightLinks.add(link);
          newHighlightNodes.add(sourceId);
        }
      });
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
    setHoverNode(node);
  };

  const handleNodeClick = (node) => {
    window.location.href = `/concepts/${node.slug}`;
  };

  const paintNode = (node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = 12 / globalScale;
    const nodeSize = 3 + (node.connectionCount || 0) * 0.5;

    // Theme colors
    const themeColors = {
      olive: '#414431',
      khaki: '#cab7a2',
      sand: '#F6F0E9',
      plum: '#51344d',
      eggplant: '#6f5060',
      dusty: '#bf979b'
    };

    // Determine node color based on type and highlight
    let nodeColor;
    if (hoverNode && node.id === hoverNode.id) {
      nodeColor = themeColors.plum; // accent-dark for hover
    } else if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) {
      nodeColor = '#e5e7eb'; // gray (faded)
    } else {
      // Color by node type using theme colors
      switch (node.type) {
        case 'framework': nodeColor = themeColors.plum; break; // accent-dark
        case 'theory': nodeColor = themeColors.olive; break; // primary
        case 'method': nodeColor = themeColors.eggplant; break; // accent
        case 'skill': nodeColor = themeColors.khaki; break; // primary-light
        case 'tool': nodeColor = themeColors.dusty; break; // accent-light
        default: nodeColor = '#6b7280'; // gray
      }
    }

    // Draw node
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    // Draw border for highlighted nodes
    if (highlightNodes.has(node.id)) {
      ctx.strokeStyle = themeColors.olive;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Draw label
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = highlightNodes.size > 0 && !highlightNodes.has(node.id) ? '#9ca3af' : '#1a1a1a';
    ctx.fillText(label, node.x, node.y + nodeSize + fontSize);
  };

  const paintLink = (link, ctx, globalScale) => {
    const sourceId = link.source.id || link.source;
    const targetId = link.target.id || link.target;

    // Theme colors
    const themeColors = {
      olive: '#414431',
      khaki: '#cab7a2',
      plum: '#51344d',
      eggplant: '#6f5060',
      dusty: '#bf979b'
    };

    // Determine link color and style based on category
    let linkColor;
    let linkWidth = 1;
    let dashPattern = [];

    if (highlightLinks.size > 0 && !highlightLinks.has(link)) {
      linkColor = '#e5e7eb';
      linkWidth = 0.5;
    } else {
      switch (link.category) {
        case 'hierarchical':
          linkColor = themeColors.plum; // accent-dark
          linkWidth = 2;
          break;
        case 'semantic':
          linkColor = themeColors.olive; // primary
          linkWidth = 1;
          dashPattern = [5, 5];
          break;
        case 'sequential':
          linkColor = themeColors.eggplant; // accent
          linkWidth = 1.5;
          break;
        case 'influence':
          linkColor = themeColors.dusty; // accent-light
          linkWidth = 1;
          dashPattern = [2, 2];
          break;
        default:
          linkColor = '#6b7280'; // gray
          linkWidth = 1;
      }
    }

    // Draw the link
    const start = link.source;
    const end = link.target;

    if (typeof start !== 'object' || typeof end !== 'object') return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = linkColor;
    ctx.lineWidth = linkWidth / globalScale;

    if (dashPattern.length > 0) {
      ctx.setLineDash(dashPattern.map(d => d / globalScale));
    } else {
      ctx.setLineDash([]);
    }

    ctx.stroke();

    // Draw arrow for directional relationships
    if (link.category === 'hierarchical' || link.category === 'sequential') {
      const arrowLength = 8 / globalScale;
      const arrowWidth = 4 / globalScale;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const angle = Math.atan2(dy, dx);

      // Position arrow at the end
      const arrowX = end.x;
      const arrowY = end.y;

      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-arrowLength, arrowWidth);
      ctx.lineTo(-arrowLength, -arrowWidth);
      ctx.closePath();
      ctx.fillStyle = linkColor;
      ctx.fill();

      ctx.restore();
    }

    ctx.setLineDash([]);
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <p>Loading relationship map...</p>
      </div>
    );
  }

  const filteredData = getFilteredData();

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h2 className="text-xl sm:text-2xl">Concept Relationship Map</h2>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded text-sm ${
              filterType === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('hierarchical')}
            className={`px-3 py-1 rounded text-sm ${
              filterType === 'hierarchical'
                ? 'bg-accent-dark text-sand'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hierarchical
          </button>
          <button
            onClick={() => setFilterType('semantic')}
            className={`px-3 py-1 rounded text-sm ${
              filterType === 'semantic'
                ? 'bg-primary text-sand'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semantic
          </button>
          <button
            onClick={() => setFilterType('sequential')}
            className={`px-3 py-1 rounded text-sm ${
              filterType === 'sequential'
                ? 'bg-accent text-sand'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sequential
          </button>
          <button
            onClick={() => setFilterType('influence')}
            className={`px-3 py-1 rounded text-sm ${
              filterType === 'influence'
                ? 'bg-accent-light text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Influence
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-accent-dark" />
          <span>Hierarchical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-primary" />
          <span>Semantic</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-accent" />
          <span>Sequential</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-accent-light" />
          <span>Influence</span>
        </div>
      </div>

      <div className="border border-gray-200 rounded overflow-hidden" style={{ height: '400px', minHeight: '300px' }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={filteredData}
          nodeLabel="label"
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={link => highlightLinks.has(link) ? 2 : 0}
          d3VelocityDecay={0.3}
          cooldownTime={3000}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          width={undefined}
          height={400}
        />
      </div>

      {hoverNode && (
        <div className="mt-4 p-4 bg-sand border border-gray-300 rounded">
          <h3 className="font-medium text-lg">{hoverNode.label}</h3>
          <div className="text-sm text-gray-600 mt-1">
            <span className="inline-block bg-white px-2 py-1 rounded mr-2">
              {hoverNode.type}
            </span>
            <span className="inline-block bg-white px-2 py-1 rounded">
              {hoverNode.connectionCount} connection{hoverNode.connectionCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
