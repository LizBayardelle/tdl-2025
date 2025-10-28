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
  const labelBounds = useRef(new Map()); // Store label bounding boxes for collision detection
  const currentFrame = useRef(0); // Track render frames
  const nodesPainted = useRef(0); // Track how many nodes painted in current frame

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

  // Check if two bounding boxes overlap
  const boxesOverlap = (box1, box2) => {
    return !(
      box1.right < box2.left ||
      box1.left > box2.right ||
      box1.bottom < box2.top ||
      box1.top > box2.bottom
    );
  };

  // Check if a label position would overlap with existing labels
  const checkLabelOverlap = (nodeId, bounds) => {
    for (const [existingId, existingBounds] of labelBounds.current.entries()) {
      if (existingId !== nodeId && boxesOverlap(bounds, existingBounds)) {
        return true;
      }
    }
    return false;
  };

  // Truncate text with ellipsis to fit within maxWidth
  const truncateText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }

    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  const paintNode = (node, ctx, globalScale) => {
    // Clear label bounds at the start of each render frame
    // We detect a new frame by checking if this is the first node
    if (nodesPainted.current === 0) {
      labelBounds.current.clear();
      currentFrame.current++;
    }
    nodesPainted.current++;

    // Reset counter after all nodes are painted (will be reset by next frame)
    if (nodesPainted.current >= graphData.nodes.length) {
      nodesPainted.current = 0;
    }

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

    // Draw label with collision detection
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = highlightNodes.size > 0 && !highlightNodes.has(node.id) ? '#9ca3af' : '#1a1a1a';

    // Measure text dimensions
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2; // Approximate height with padding
    const padding = 2 / globalScale;

    // Try different positions for the label
    const positions = [
      { x: node.x, y: node.y + nodeSize + fontSize, name: 'below' },
      { x: node.x, y: node.y - nodeSize - fontSize * 0.5, name: 'above' },
      { x: node.x + nodeSize + textWidth / 2 + padding * 2, y: node.y, name: 'right' },
      { x: node.x - nodeSize - textWidth / 2 - padding * 2, y: node.y, name: 'left' }
    ];

    let bestPosition = positions[0];
    let hasOverlap = false;
    let displayLabel = label;

    // Find the first position without overlap
    for (const pos of positions) {
      const bounds = {
        left: pos.x - textWidth / 2 - padding,
        right: pos.x + textWidth / 2 + padding,
        top: pos.y - textHeight / 2 - padding,
        bottom: pos.y + textHeight / 2 + padding
      };

      if (!checkLabelOverlap(node.id, bounds)) {
        bestPosition = pos;
        hasOverlap = false;
        labelBounds.current.set(node.id, bounds);
        break;
      }
      hasOverlap = true;
    }

    // If all positions overlap, truncate the label at the default position
    if (hasOverlap) {
      const maxWidth = 80 / globalScale; // Max width before truncation
      displayLabel = truncateText(ctx, label, maxWidth);

      const truncatedMetrics = ctx.measureText(displayLabel);
      const truncatedWidth = truncatedMetrics.width;

      const bounds = {
        left: bestPosition.x - truncatedWidth / 2 - padding,
        right: bestPosition.x + truncatedWidth / 2 + padding,
        top: bestPosition.y - textHeight / 2 - padding,
        bottom: bestPosition.y + textHeight / 2 + padding
      };

      labelBounds.current.set(node.id, bounds);
    }

    // Always show full label on hover
    if (hoverNode && node.id === hoverNode.id) {
      displayLabel = label;
      // Draw background for hover label
      const hoverMetrics = ctx.measureText(displayLabel);
      const hoverWidth = hoverMetrics.width;
      ctx.fillStyle = 'rgba(246, 240, 233, 0.9)'; // sand with transparency
      ctx.fillRect(
        bestPosition.x - hoverWidth / 2 - padding * 2,
        bestPosition.y - textHeight / 2 - padding,
        hoverWidth + padding * 4,
        textHeight + padding * 2
      );
      ctx.fillStyle = highlightNodes.size > 0 && !highlightNodes.has(node.id) ? '#9ca3af' : '#1a1a1a';
    }

    ctx.fillText(displayLabel, bestPosition.x, bestPosition.y);
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
