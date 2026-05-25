import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Canvas can't read CSS custom properties, so we mirror the design-system
// palette here.  Keep these in sync with design-system.css.
const PALETTE = {
  concept:      '#48A27E',
  conceptTint:  '#E8F4EE',
  concept2:     '#2F7A5C',
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

const RAIL_LIMIT = 50;

export default function ConceptRelationshipMap() {
  const [allNodes, setAllNodes] = useState([]);
  const [allLinks, setAllLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  const fgRef = useRef();
  const labelBounds = useRef(new Map());
  const nodesPainted = useRef(0);

  useEffect(() => {
    fetchGraphData();
  }, []);

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

      const countMap = new Map();
      connections.forEach(c => {
        countMap.set(c.src_concept_id, (countMap.get(c.src_concept_id) || 0) + 1);
        countMap.set(c.dst_concept_id, (countMap.get(c.dst_concept_id) || 0) + 1);
      });

      const nodes = concepts
        .map(concept => ({
          id: concept.id,
          label: concept.label,
          type: concept.concept_type,
          slug: concept.slug,
          connectionCount: countMap.get(concept.id) || 0,
        }))
        .filter(node => node.connectionCount > 0);

      const links = connections.map(connection => ({
        source: connection.src_concept_id,
        target: connection.dst_concept_id,
        rel_type: connection.rel_type,
        relationship_label: connection.relationship_label,
        category: getCategoryForType(connection.rel_type),
        description: connection.description
      }));

      setAllNodes(nodes);
      setAllLinks(links);

      const topConcept = nodes.reduce((best, n) =>
        !best || n.connectionCount > best.connectionCount ? n : best, null);
      if (topConcept) setSelectedNodeId(topConcept.id);

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

  // Sorted full list (rail uses this for top-N + search).
  const sortedConcepts = useMemo(
    () => [...allNodes].sort((a, b) => b.connectionCount - a.connectionCount),
    [allNodes]
  );

  // Rail contents: search filters the whole graph, otherwise top N.
  const railConcepts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return sortedConcepts.filter(n => n.label.toLowerCase().includes(q)).slice(0, 200);
    }
    return sortedConcepts.slice(0, RAIL_LIMIT);
  }, [sortedConcepts, searchQuery]);

  const selectedNode = useMemo(
    () => allNodes.find(n => n.id === selectedNodeId) || null,
    [allNodes, selectedNodeId]
  );

  // 1-hop neighborhood for the selected concept, filtered by relationship category.
  const neighborhoodData = useMemo(() => {
    if (!selectedNodeId || allNodes.length === 0) {
      return { nodes: [], links: [] };
    }

    const matchesFilter = (link) => filterType === 'all' || link.category === filterType;
    const neighborIds = new Set([selectedNodeId]);
    const localLinks = [];

    allLinks.forEach(link => {
      const sId = link.source.id || link.source;
      const tId = link.target.id || link.target;
      if (!matchesFilter(link)) return;
      if (sId === selectedNodeId) {
        neighborIds.add(tId);
        localLinks.push(link);
      } else if (tId === selectedNodeId) {
        neighborIds.add(sId);
        localLinks.push(link);
      }
    });

    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const localNodes = Array.from(neighborIds)
      .map(id => nodeMap.get(id))
      .filter(Boolean);

    return { nodes: localNodes, links: localLinks };
  }, [selectedNodeId, allNodes, allLinks, filterType]);

  // Configure forces and zoom-to-fit whenever the neighborhood changes.
  useEffect(() => {
    if (fgRef.current && neighborhoodData.nodes.length > 0) {
      const fg = fgRef.current;

      import('d3-force').then((d3) => {
        fg.d3Force('charge', d3.forceManyBody().strength(-400).distanceMax(500));
        fg.d3Force('link').distance(100);
        fg.d3Force('collision', d3.forceCollide().radius(60).strength(1));
        fg.d3ReheatSimulation();
      });

      const t = setTimeout(() => fg.zoomToFit(400, 80), 600);
      return () => clearTimeout(t);
    }
  }, [neighborhoodData]);

  const handleNodeHover = (node) => {
    const newHighlightNodes = new Set();
    const newHighlightLinks = new Set();

    if (node) {
      newHighlightNodes.add(node.id);
      neighborhoodData.links.forEach(link => {
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
    if (node.id !== selectedNodeId) {
      setSelectedNodeId(node.id);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      setHoverNode(null);
    }
  };

  const boxesOverlap = (box1, box2) => {
    return !(
      box1.right < box2.left ||
      box1.left > box2.right ||
      box1.bottom < box2.top ||
      box1.top > box2.bottom
    );
  };

  const checkLabelOverlap = (nodeId, bounds) => {
    for (const [existingId, existingBounds] of labelBounds.current.entries()) {
      if (existingId !== nodeId && boxesOverlap(bounds, existingBounds)) {
        return true;
      }
    }
    return false;
  };

  const truncateText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  const paintNode = (node, ctx, globalScale) => {
    if (nodesPainted.current === 0) {
      labelBounds.current.clear();
    }
    nodesPainted.current++;
    if (nodesPainted.current >= neighborhoodData.nodes.length) {
      nodesPainted.current = 0;
    }

    const label = node.label;
    const fontSize = 12 / globalScale;
    const isSelected = node.id === selectedNodeId;
    const nodeSize = isSelected
      ? 8 + (node.connectionCount || 0) * 0.3
      : 4 + (node.connectionCount || 0) * 0.3;

    const isFaded = highlightNodes.size > 0 && !highlightNodes.has(node.id);
    const isHovered = hoverNode && node.id === hoverNode.id;
    const nodeColor = isSelected ? PALETTE.concept2 : (isFaded ? PALETTE.ink4 : PALETTE.concept);
    const haloColor = isFaded ? PALETTE.inkLineSoft : PALETTE.conceptTint;

    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize + 6, 0, 2 * Math.PI);
    ctx.fillStyle = haloColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = nodeColor;
    ctx.fill();

    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = PALETTE.concept2;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    ctx.font = `${isSelected ? 600 : 500} ${fontSize}px "Source Sans 3", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isFaded ? PALETTE.ink4 : PALETTE.ink;

    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2;
    const padding = 2 / globalScale;

    const positions = [
      { x: node.x, y: node.y + nodeSize + fontSize, name: 'below' },
      { x: node.x, y: node.y - nodeSize - fontSize * 0.5, name: 'above' },
      { x: node.x + nodeSize + textWidth / 2 + padding * 2, y: node.y, name: 'right' },
      { x: node.x - nodeSize - textWidth / 2 - padding * 2, y: node.y, name: 'left' }
    ];

    let bestPosition = positions[0];
    let hasOverlap = false;
    let displayLabel = label;

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

    if (isHovered) {
      displayLabel = label;
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
    let linkColor;
    let linkWidth = 1;
    let dashPattern = [];

    if (highlightLinks.size > 0 && !highlightLinks.has(link)) {
      linkColor = PALETTE.inkLineSoft;
      linkWidth = 0.5;
    } else {
      linkColor = PALETTE.ink4;

      switch (link.category) {
        case 'hierarchical': linkWidth = 2.5; dashPattern = []; break;
        case 'semantic':     linkWidth = 1.5; dashPattern = [8, 4]; break;
        case 'sequential':   linkWidth = 2;   dashPattern = []; break;
        case 'influence':    linkWidth = 1.5; dashPattern = [2, 3]; break;
        case 'positional':   linkWidth = 1.5; dashPattern = [8, 3, 2, 3]; break;
        default:             linkWidth = 1;   dashPattern = [];
      }
    }

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

    if (link.category === 'hierarchical' || link.category === 'sequential' || link.category === 'positional') {
      const arrowLength = 12 / globalScale;
      const arrowWidth = 6 / globalScale;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);

      const nodeRadius = 3 + ((end.connectionCount || 0) * 0.3);
      const padding = 3 / globalScale;
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

  const neighborCount = Math.max(neighborhoodData.nodes.length - 1, 0);
  const neighborhoodEdgeCount = neighborhoodData.links.length;

  return (
    <section className="sp-relationship">
      <CrmStyles />

      <div className="sp-relationship-head">
        <div>
          <h2 className="sp-chart-title">Concept map</h2>
          <p className="sp-chart-subtitle">
            {allNodes.length > 0
              ? <>{allNodes.length} connected concept{allNodes.length === 1 ? '' : 's'} in your library.  Pick one on the left to explore its neighborhood.</>
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

      <div className="crm-layout">
        <aside className="crm-rail">
          <div className="crm-rail-search">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${allNodes.length} concepts.`}
              className="crm-rail-search-input"
            />
          </div>
          <div className="crm-rail-header">
            {searchQuery.trim()
              ? <>{railConcepts.length} match{railConcepts.length === 1 ? '' : 'es'}</>
              : <>Top {Math.min(RAIL_LIMIT, railConcepts.length)} by connections</>}
          </div>
          <ul className="crm-rail-list">
            {railConcepts.map((c) => {
              const isActive = c.id === selectedNodeId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`crm-rail-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => setSelectedNodeId(c.id)}
                  >
                    <span className="crm-rail-item-label">{c.label}</span>
                    <span className="crm-rail-item-count">{c.connectionCount}</span>
                  </button>
                </li>
              );
            })}
            {railConcepts.length === 0 && (
              <li className="crm-rail-empty">No concepts match.</li>
            )}
          </ul>
        </aside>

        <div className="crm-pane">
          <div className="crm-pane-head">
            {selectedNode ? (
              <>
                <div className="crm-pane-title-row">
                  <h3 className="crm-pane-title">{selectedNode.label}</h3>
                  <a href={`/concepts/${selectedNode.slug}`} className="crm-pane-link">
                    Open page →
                  </a>
                </div>
                <div className="crm-pane-meta">
                  <span className="sp-chip is-concept">{(selectedNode.type || 'concept').replace(/_/g, ' ')}</span>
                  <span className="sp-chip is-neutral">
                    {neighborCount} neighbor{neighborCount === 1 ? '' : 's'}
                  </span>
                  <span className="sp-chip is-neutral">
                    {neighborhoodEdgeCount} edge{neighborhoodEdgeCount === 1 ? '' : 's'}
                  </span>
                </div>
              </>
            ) : (
              <h3 className="crm-pane-title">Select a concept</h3>
            )}
          </div>
          <div className="crm-canvas">
            {neighborhoodData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={fgRef}
                graphData={neighborhoodData}
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
            ) : (
              <div className="crm-canvas-empty">
                {selectedNode
                  ? <>No {filterType === 'all' ? '' : `${filterType} `}connections from this concept.</>
                  : <>Pick a concept from the list to see its neighborhood.</>}
              </div>
            )}
          </div>
          <p className="crm-pane-hint">
            Click any neighbor to re-center the map on it.  Scroll to zoom, drag to reposition.
          </p>
        </div>
      </div>
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

      .crm-layout {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 16px;
        align-items: stretch;
      }
      @media (max-width: 760px) {
        .crm-layout {
          grid-template-columns: 1fr;
        }
      }

      .crm-rail {
        display: flex;
        flex-direction: column;
        background: var(--paper);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-md);
        min-height: 0;
        max-height: 568px;
        overflow: hidden;
      }
      .crm-rail-search {
        padding: 10px 10px 6px;
        border-bottom: 1px solid var(--ink-line-soft);
      }
      .crm-rail-search-input {
        width: 100%;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
        background: var(--paper-soft);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-sm);
        padding: 6px 10px;
        outline: none;
        transition: border-color 0.12s, background 0.12s;
      }
      .crm-rail-search-input:focus {
        background: var(--paper);
        border-color: var(--concept);
      }
      .crm-rail-search-input::placeholder { color: var(--ink-4); }

      .crm-rail-header {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-3);
        padding: 10px 12px 6px;
      }

      .crm-rail-list {
        list-style: none;
        margin: 0;
        padding: 0 6px 10px;
        overflow-y: auto;
        flex: 1 1 auto;
      }
      .crm-rail-item {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        padding: 6px 10px;
        text-align: left;
        cursor: pointer;
        transition: background 0.1s, color 0.1s, border-color 0.1s;
      }
      .crm-rail-item:hover {
        background: var(--paper-soft);
        color: var(--ink);
      }
      .crm-rail-item.is-active {
        background: var(--concept-tint);
        color: var(--concept-2, #2F7A5C);
        border-color: var(--concept);
        font-weight: 600;
      }
      .crm-rail-item-label {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .crm-rail-item-count {
        flex: 0 0 auto;
        font-size: 11px;
        color: var(--ink-3);
        background: var(--paper-soft);
        border-radius: 999px;
        padding: 1px 7px;
        font-variant-numeric: tabular-nums;
      }
      .crm-rail-item.is-active .crm-rail-item-count {
        background: var(--paper);
        color: var(--concept-2, #2F7A5C);
      }
      .crm-rail-empty {
        list-style: none;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        padding: 10px 12px;
      }

      .crm-pane {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .crm-pane-head {
        margin-bottom: 10px;
      }
      .crm-pane-title-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
      }
      .crm-pane-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        letter-spacing: -0.005em;
      }
      .crm-pane-link {
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--concept-2, #2F7A5C);
        text-decoration: none;
        white-space: nowrap;
      }
      .crm-pane-link:hover { text-decoration: underline; }
      .crm-pane-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .crm-pane-meta .sp-chip { text-transform: capitalize; }

      .crm-canvas {
        background: var(--paper);
        border: 1px solid var(--ink-line-soft);
        border-radius: var(--r-md);
        overflow: hidden;
        height: 500px;
        position: relative;
      }
      .crm-canvas-empty {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        padding: 24px;
        text-align: center;
      }

      .crm-pane-hint {
        font-family: var(--font-body);
        font-size: 11.5px;
        color: var(--ink-3);
        margin: 8px 2px 0;
      }
    `}</style>
  );
}
