import React, { useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Canvas can't read CSS custom properties, so we mirror the design-system
// palette here.  Keep these in sync with design-system.css.
const PALETTE = {
  concept:      '#48A27E',
  conceptTint:  '#E8F4EE',
  source:       '#4976B1',
  person:       '#614498',
  ink:          '#15191F',
  ink2:         '#3F454E',
  ink3:         '#71777F',
  ink4:         '#A4A9B1',
  inkLine:      '#E1E4E8',
  inkLineSoft:  '#EBEDF0',
  paper:        '#FFFFFF',
};

const FILTER_OPTIONS = [
  { value: 'all',          label: 'All' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'semantic',     label: 'Semantic' },
  { value: 'sequential',   label: 'Sequential' },
  { value: 'influence',    label: 'Influence' },
  { value: 'positional',   label: 'Positional' },
];

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

  // Configure forces and zoom to fit all nodes after graph data loads
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Configure stronger repulsion forces to spread nodes apart
      const fg = fgRef.current;

      // Access d3-force from the library (it's bundled with react-force-graph)
      import('d3-force').then((d3) => {
        // Set charge force (repulsion between nodes) - stronger repulsion
        fg.d3Force('charge', d3.forceManyBody().strength(-400).distanceMax(500));

        // Set link distance - longer links for more space
        fg.d3Force('link').distance(100);

        // Add collision force to prevent node overlap
        fg.d3Force('collision', d3.forceCollide().radius(60).strength(1));

        // Reheat simulation to apply new forces
        fg.d3ReheatSimulation();
      });

      // Zoom to fit after forces are configured
      setTimeout(() => {
        fg.zoomToFit(400, 50); // 400ms transition, 50px padding
      }, 1000); // Wait for layout with new forces
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
      // Only include concepts that have at least one connection
      const nodes = concepts
        .map(concept => ({
          id: concept.id,
          label: concept.label,
          type: concept.concept_type,
          slug: concept.slug,
          // Count connections for node sizing
          connectionCount: connections.filter(c =>
            c.src_concept_id === concept.id || c.dst_concept_id === concept.id
          ).length
        }))
        .filter(node => node.connectionCount > 0);

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
    const positional = [
      'is_above', 'is_below', 'contains', 'is_inside', 'faces', 'faces_away_from', 'is_near',
      'superior_to', 'inferior_to', 'anterior_to', 'posterior_to',
      'medial_to', 'lateral_to', 'dorsal_to', 'ventral_to',
      'rostral_to', 'caudal_to', 'proximal_to', 'distal_to',
      'ipsilateral_to', 'contralateral_to'
    ];

    if (hierarchical.includes(relType)) return 'hierarchical';
    if (semantic.includes(relType)) return 'semantic';
    if (sequential.includes(relType)) return 'sequential';
    if (influence.includes(relType)) return 'influence';
    if (positional.includes(relType)) return 'positional';
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
    if (nodesPainted.current === 0) {
      labelBounds.current.clear();
      currentFrame.current++;
    }
    nodesPainted.current++;

    // Reset counter after all nodes are painted
    if (nodesPainted.current >= graphData.nodes.length) {
      nodesPainted.current = 0;
    }

    const label = node.label;
    const fontSize = 12 / globalScale;
    const nodeSize = 4 + (node.connectionCount || 0) * 0.5;

    // Resolve node color and halo per highlight state.
    const isFaded = highlightNodes.size > 0 && !highlightNodes.has(node.id);
    const isHovered = hoverNode && node.id === hoverNode.id;
    const nodeColor = isFaded ? PALETTE.ink4 : PALETTE.concept;
    const haloColor = isFaded ? PALETTE.inkLineSoft : PALETTE.conceptTint;

    // Halo behind every node (matches the samplepage map style)
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize + 5, 0, 2 * Math.PI);
    ctx.fillStyle = haloColor;
    ctx.fill();

    // Solid node
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    // Subtle ring on the hovered node
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = PALETTE.concept;
      ctx.lineWidth = 1.25 / globalScale;
      ctx.stroke();
    }

    // Draw label with collision detection
    ctx.font = `500 ${fontSize}px "Source Sans 3", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isFaded ? PALETTE.ink4 : PALETTE.ink;

    // Measure text dimensions
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2;
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

    // If all positions overlap, truncate the label
    if (hasOverlap) {
      const maxWidth = 80 / globalScale;
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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.fillRect(
        bestPosition.x - hoverWidth / 2 - padding * 2,
        bestPosition.y - textHeight / 2 - padding,
        hoverWidth + padding * 4,
        textHeight + padding * 2
      );
      ctx.fillStyle = PALETTE.ink;
    }

    ctx.fillText(displayLabel, bestPosition.x, bestPosition.y);
  };

  const paintLink = (link, ctx, globalScale) => {
    const sourceId = link.source.id || link.source;
    const targetId = link.target.id || link.target;

    // Hairline links, vary by line style based on relationship category.
    let linkColor;
    let linkWidth = 1;
    let dashPattern = [];
    let isDouble = false;

    if (highlightLinks.size > 0 && !highlightLinks.has(link)) {
      linkColor = PALETTE.inkLineSoft;
      linkWidth = 0.5;
    } else {
      linkColor = PALETTE.ink4;

      switch (link.category) {
        case 'hierarchical':
          // Bold solid line
          linkWidth = 2.5;
          dashPattern = [];
          break;
        case 'semantic':
          // Dashed line
          linkWidth = 1.5;
          dashPattern = [8, 4];
          break;
        case 'sequential':
          // Solid line (medium)
          linkWidth = 2;
          dashPattern = [];
          break;
        case 'influence':
          // Dotted line
          linkWidth = 1.5;
          dashPattern = [2, 3];
          break;
        case 'positional':
          // Dash-dot line
          linkWidth = 1.5;
          dashPattern = [8, 3, 2, 3];
          break;
        default:
          // Regular solid
          linkWidth = 1;
          dashPattern = [];
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
    if (link.category === 'hierarchical' || link.category === 'sequential' || link.category === 'positional') {
      const arrowLength = 12 / globalScale;
      const arrowWidth = 6 / globalScale;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate arrow position - offset from node center by node radius plus padding
      const nodeRadius = 3 + ((end.connectionCount || 0) * 0.5);
      const padding = 3 / globalScale; // Extra padding
      const offset = (nodeRadius + padding) / distance;

      const arrowX = end.x - dx * offset;
      const arrowY = end.y - dy * offset;

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
      <section className="sp-relationship">
        <CrmStyles />
        <div className="sp-relationship-head">
          <div>
            <h2 className="sp-chart-title">Concept map</h2>
            <p className="sp-chart-subtitle">Loading.</p>
          </div>
        </div>
      </section>
    );
  }

  const filteredData = getFilteredData();
  const totalNodes = filteredData.nodes.length;
  const totalLinks = filteredData.links.length;

  return (
    <section className="sp-relationship">
      <CrmStyles />

      <div className="sp-relationship-head">
        <div>
          <h2 className="sp-chart-title">Concept map</h2>
          <p className="sp-chart-subtitle">
            {totalNodes > 0
              ? <>{totalNodes} concept{totalNodes === 1 ? '' : 's'} · {totalLinks} connection{totalLinks === 1 ? '' : 's'}.  Drag a node to reposition.  Scroll to zoom.</>
              : 'A view of how your concepts connect.'}
          </p>
        </div>
        <div className="crm-filters">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`crm-filter ${filterType === opt.value ? 'is-active' : ''}`}
              onClick={() => setFilterType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="crm-legend">
        <span className="crm-legend-item">
          <svg width="32" height="3" aria-hidden="true"><line x1="0" y1="1.5" x2="32" y2="1.5" stroke="#A4A9B1" strokeWidth="2.5" /></svg>
          Hierarchical
        </span>
        <span className="crm-legend-item">
          <svg width="32" height="3" aria-hidden="true"><line x1="0" y1="1.5" x2="32" y2="1.5" stroke="#A4A9B1" strokeWidth="1.5" strokeDasharray="8,4" /></svg>
          Semantic
        </span>
        <span className="crm-legend-item">
          <svg width="32" height="3" aria-hidden="true"><line x1="0" y1="1.5" x2="32" y2="1.5" stroke="#A4A9B1" strokeWidth="2" /></svg>
          Sequential
        </span>
        <span className="crm-legend-item">
          <svg width="32" height="3" aria-hidden="true"><line x1="0" y1="1.5" x2="32" y2="1.5" stroke="#A4A9B1" strokeWidth="1.5" strokeDasharray="2,3" /></svg>
          Influence
        </span>
        <span className="crm-legend-item">
          <svg width="32" height="3" aria-hidden="true"><line x1="0" y1="1.5" x2="32" y2="1.5" stroke="#A4A9B1" strokeWidth="1.5" strokeDasharray="8,3,2,3" /></svg>
          Positional
        </span>
      </div>

      <div className="crm-canvas">
        <ForceGraph2D
          ref={fgRef}
          graphData={filteredData}
          nodeLabel="label"
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={(link) => (highlightLinks.has(link) ? 2 : 0)}
          d3VelocityDecay={0.3}
          d3AlphaDecay={0.01}
          cooldownTime={5000}
          enableNodeDrag={true}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          width={undefined}
          height={500}
          backgroundColor={PALETTE.paper}
        />
      </div>

      {hoverNode && (
        <div className="crm-hover">
          <h3 className="crm-hover-title">{hoverNode.label}</h3>
          <div className="crm-hover-meta">
            <span className="sp-chip is-concept">{(hoverNode.type || 'concept').replace(/_/g, ' ')}</span>
            <span className="sp-chip is-neutral">
              {hoverNode.connectionCount} connection{hoverNode.connectionCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function CrmStyles() {
  return (
    <style>{`
      .crm-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .crm-filter {
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-3);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        padding: 4px 10px;
        cursor: pointer;
        line-height: 1.4;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .crm-filter:hover {
        background: var(--paper-soft);
        color: var(--ink);
      }
      .crm-filter.is-active {
        background: var(--paper-warm);
        color: var(--ink);
        border-color: var(--ink-line);
        font-weight: 600;
      }

      .crm-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        margin-bottom: 12px;
      }
      .crm-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .crm-canvas {
        background: var(--paper);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-md);
        overflow: hidden;
        height: 500px;
      }

      .crm-hover {
        margin-top: 14px;
        padding: 12px 16px;
        background: var(--concept-tint);
        border-left: 3px solid var(--concept);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
      }
      .crm-hover-title {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--concept-2);
        margin: 0 0 8px;
        letter-spacing: -0.005em;
      }
      .crm-hover-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .crm-hover-meta .sp-chip { text-transform: capitalize; }
    `}</style>
  );
}

