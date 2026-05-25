import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force';
import { RELATIONSHIP_CATEGORIES, getRelTypeText } from './InlineRelTypeSelect';
import { toTitleCase } from '../utils/titleCase';

// =====================================================================
// ConceptRelationships — /concepts/:id/relationships
//
// Read-only spatial view of the focal concept's 1-hop neighborhood.
// Focal pinned at center, neighbors arranged by force simulation, edges
// colored by category, verbs revealed on hover/tap.  Inter-neighbor
// edges (faint) give the cloud internal structure; densely-connected
// sub-groups get a soft tinted blob behind them as a "theory family"
// signal.  Mobile: pinch-zoom + tap to reveal a verb.
// =====================================================================

const CATEGORY_ORDER = ['Hierarchical', 'Lineage', 'Semantic', 'Clinical', 'Positional', 'Other'];

// Map rel_type → category from the central RELATIONSHIP_CATEGORIES list.
// Computed once at module load.
const REL_TYPE_TO_CATEGORY = (() => {
  const m = {};
  RELATIONSHIP_CATEGORIES.forEach((cat) => {
    cat.types.forEach((t) => { m[t.value] = cat.label; });
  });
  return m;
})();

function categoryOf(relType) {
  return REL_TYPE_TO_CATEGORY[relType] || 'Other';
}

// For a single hierarchical edge, decide whether the *other* concept
// (the one that isn't focal) sits above (parent) or below (child) the
// focal in the taxonomy.  Returns 'parent', 'child', or null.
//
// Mirrors the mapping in ConceptShow's HierarchyTree:
//   parent_of   outgoing → focal is parent (other is child)
//   parent_of   incoming → focal is child  (other is parent)
//   child_of    outgoing → focal is child  (other is parent)
//   child_of    incoming → focal is parent (other is child)
//   is_a        outgoing → focal is child  (other is parent)
//   is_a        incoming → focal is parent (other is child)
//   categorizes outgoing → focal is parent (other is child)
//   categorizes incoming → focal is child  (other is parent)
function hierarchicalRoleOfOther(edge, focalId) {
  const focalIsSrc = edge.src_id === focalId;
  switch (edge.rel_type) {
    case 'parent_of':   return focalIsSrc ? 'child'  : 'parent';
    case 'child_of':    return focalIsSrc ? 'parent' : 'child';
    case 'is_a':        return focalIsSrc ? 'parent' : 'child';
    case 'categorizes': return focalIsSrc ? 'child'  : 'parent';
    default:            return null;
  }
}

// Neighbor maturity → node radius.  Capped at both ends so a 0-source
// stub is still visible and a 200-source megaconcept doesn't dwarf the
// rest of the cloud.
function nodeRadius(neighbor) {
  const maturity = (neighbor.sources_count || 0)
                 + (neighbor.notes_count || 0)
                 + (neighbor.connections_count || 0);
  // Log-scale so a 50-source concept isn't 10x bigger than a 5-source one.
  const r = 9 + Math.min(14, Math.log2(1 + maturity) * 2);
  return r;
}

// Simple connected-components cluster detection on the inter-neighbor
// subgraph.  Components with ≥3 members are flagged as clusters; the
// rest are singletons that don't get a blob.
function detectClusters(neighborIds, interEdges) {
  const adj = new Map();
  neighborIds.forEach((id) => adj.set(id, new Set()));
  interEdges.forEach((e) => {
    if (adj.has(e.src_id) && adj.has(e.dst_id)) {
      adj.get(e.src_id).add(e.dst_id);
      adj.get(e.dst_id).add(e.src_id);
    }
  });

  const seen = new Set();
  const clusters = [];
  for (const id of neighborIds) {
    if (seen.has(id)) continue;
    const stack = [id];
    const member = [];
    while (stack.length) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      member.push(cur);
      for (const nb of adj.get(cur)) {
        if (!seen.has(nb)) stack.push(nb);
      }
    }
    if (member.length >= 3) clusters.push(member);
  }
  return clusters;
}

// Convex-hull-ish blob: takes the cluster's node positions and returns
// an SVG path string that wraps them with a generous padding.  Uses a
// simple bounding ellipse rather than a true hull — visually softer and
// avoids the geometric complexity of Graham-scan + corner smoothing.
function clusterBlobPath(positions, padding = 28) {
  if (positions.length === 0) return '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  positions.forEach(({ x, y }) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(40, (maxX - minX) / 2 + padding);
  const ry = Math.max(40, (maxY - minY) / 2 + padding);
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
}

// SVG <text> has no built-in wrap.  We split the label into up to two
// lines on word boundaries; if a long word doesn't fit at all, we let
// it overflow rather than mid-word break (reads cleaner for concept
// labels like "Self-Determination" which shouldn't split).
function wrapLabel(s, maxCharsPerLine = 18, maxLines = 2) {
  if (!s) return [];
  const cleaned = toTitleCase(s);
  if (cleaned.length <= maxCharsPerLine) return [cleaned];

  const words = cleaned.split(/\s+/);
  const lines = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        // Last allowed line — pack remaining words even if it overflows.
        const remaining = words.slice(i).join(' ');
        lines.push(remaining);
        current = '';
        break;
      }
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export default function ConceptRelationships({ conceptId, conceptLabel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategories, setActiveCategories] = useState(new Set(CATEGORY_ORDER));
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Live positions from the force simulation.  Updated on each tick so
  // React re-renders the SVG (cheap for ≤30 nodes).
  const [positions, setPositions] = useState({});
  const simRef = useRef(null);
  const containerRef = useRef(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });

  // Resize observer for the SVG container so the viewBox tracks the
  // available width (mobile in particular).
  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      setViewport({
        w: e.contentRect.width,
        h: Math.max(420, Math.min(720, e.contentRect.width * 0.75)),
      });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fetch the graph.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/concepts/${conceptId}/relationship_graph.json`);
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (e) {
        console.error('Relationship graph load failed', e);
        if (!cancelled) {
          setError('Could not load the relationship map.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [conceptId]);

  // Categorise edges once data lands.
  const categorisedEdges = useMemo(() => {
    if (!data) return [];
    return data.edges.map((e) => ({ ...e, category: categoryOf(e.rel_type) }));
  }, [data]);

  // Filter edges by active categories.  Inter-neighbor edges are kept
  // when EITHER endpoint's focal-edge category is active OR the inter
  // edge's own category is active — keeps the cloud's internal
  // structure visible even when the user filters categories.
  const visibleEdges = useMemo(() => {
    return categorisedEdges.filter((e) => activeCategories.has(e.category));
  }, [categorisedEdges, activeCategories]);

  // Hidden neighbors are those whose only edges to focal got filtered
  // out.  Keep them faded but in the layout so the map doesn't reflow.
  const dimmedNeighborIds = useMemo(() => {
    if (!data) return new Set();
    const reachable = new Set([data.focal.id]);
    visibleEdges.forEach((e) => {
      if (!e.inter_neighbor) { reachable.add(e.src_id); reachable.add(e.dst_id); }
    });
    const all = new Set(data.neighbors.map((n) => n.id));
    return new Set([...all].filter((id) => !reachable.has(id)));
  }, [data, visibleEdges]);

  // Run / restart the simulation when the data or viewport changes.
  useEffect(() => {
    if (!data) return;

    const cx = viewport.w / 2;
    const cy = viewport.h / 2;
    const HIERARCHY_OFFSET = Math.max(160, viewport.h * 0.28);

    // Per-neighbor hierarchical role (only set if a hierarchical edge
    // connects this neighbor to the focal).  Used to bias y-position so
    // parents float above the focal and children sink below.
    const hierarchyRole = {};
    data.edges.forEach((e) => {
      if (e.inter_neighbor) return;
      const role = hierarchicalRoleOfOther(e, data.focal.id);
      if (!role) return;
      const otherId = e.src_id === data.focal.id ? e.dst_id : e.src_id;
      // If a neighbor is connected via multiple hierarchical edges with
      // conflicting roles, the first-seen wins (rare and not worth a
      // tiebreak heuristic).
      if (!hierarchyRole[otherId]) hierarchyRole[otherId] = role;
    });

    // Build sim nodes.  Focal is pinned at center via fx/fy.
    const focalNode = {
      id: data.focal.id, isFocal: true,
      fx: cx, fy: cy,
      x: cx, y: cy,
    };
    const neighborNodes = data.neighbors.map((n) => {
      const role = hierarchyRole[n.id];
      // Seed initial position above / below focal so the sim starts in
      // roughly the right band — keeps the up-down read stable.
      const seedY = role === 'parent' ? cy - HIERARCHY_OFFSET
                  : role === 'child'  ? cy + HIERARCHY_OFFSET
                  : cy + (Math.random() - 0.5) * 200;
      return {
        id: n.id,
        isFocal: false,
        hierarchyRole: role,
        x: cx + (Math.random() - 0.5) * 200,
        y: seedY + (Math.random() - 0.5) * 60,
      };
    });
    const allNodes = [focalNode, ...neighborNodes];

    // Sim edges use Object refs (d3-force mutates them in place).
    const allEdges = data.edges.map((e) => ({
      ...e,
      source: e.src_id,
      target: e.dst_id,
    }));

    const sim = forceSimulation(allNodes)
      .force('link', forceLink(allEdges).id((d) => d.id)
        .distance((d) => d.inter_neighbor ? 80 : 180)
        .strength((d) => d.inter_neighbor ? 0.15 : 0.55))
      .force('charge', forceManyBody().strength(-620))
      .force('center', forceCenter(cx, cy))
      .force('collide', forceCollide().radius((d) => d.isFocal ? 60 : 56))
      .force('x', forceX(cx).strength(0.03))
      .force('y', forceY((d) => {
        if (d.hierarchyRole === 'parent') return cy - HIERARCHY_OFFSET;
        if (d.hierarchyRole === 'child')  return cy + HIERARCHY_OFFSET;
        return cy;
      }).strength((d) => d.hierarchyRole ? 0.35 : 0.03))
      .alpha(1)
      .alphaDecay(0.04);  // settles in ~80 ticks

    simRef.current = sim;

    // Drive React updates from the simulation tick.  Throttle via
    // requestAnimationFrame so we don't setState 60+ times/sec.
    let frame = null;
    sim.on('tick', () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const next = {};
        allNodes.forEach((n) => { next[n.id] = { x: n.x, y: n.y }; });
        setPositions(next);
      });
    });

    sim.on('end', () => {
      // Final flush in case the last tick was throttled out.
      const next = {};
      allNodes.forEach((n) => { next[n.id] = { x: n.x, y: n.y }; });
      setPositions(next);
    });

    return () => {
      sim.stop();
      if (frame) cancelAnimationFrame(frame);
    };
    // viewport intentionally not a dep — resizes don't re-run sim;
    // they just rescale the viewBox.  Re-running on resize would be
    // jarring (everything jumps to new positions).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Clusters: detected once data is in, positions update reactively.  We
  // drop clusters that swallow >70% of the neighborhood — at that point
  // it's not a "theory family", it's just "everything is connected", and
  // a blob around almost-all-nodes carries no signal.
  const clusters = useMemo(() => {
    if (!data) return [];
    const neighborIds = data.neighbors.map((n) => n.id);
    const interEdges = categorisedEdges.filter((e) => e.inter_neighbor);
    const found = detectClusters(neighborIds, interEdges);
    const cap = Math.max(3, Math.floor(neighborIds.length * 0.7));
    return found.filter((c) => c.length <= cap);
  }, [data, categorisedEdges]);

  const clusterPaths = useMemo(() => {
    return clusters.map((memberIds) => {
      const pts = memberIds.map((id) => positions[id]).filter(Boolean);
      return { memberIds, path: clusterBlobPath(pts) };
    });
  }, [clusters, positions]);

  const toggleCategory = (cat) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      // Don't allow zero — keeps the map meaningful.
      if (next.size === 0) return prev;
      return next;
    });
  };

  // Counts per category, used to label the filter chips.
  const categoryCounts = useMemo(() => {
    const c = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0]));
    categorisedEdges.forEach((e) => {
      if (!e.inter_neighbor) c[e.category] = (c[e.category] || 0) + 1;
    });
    return c;
  }, [categorisedEdges]);

  const neighborById = useMemo(() => {
    const m = new Map();
    (data?.neighbors || []).forEach((n) => m.set(n.id, n));
    return m;
  }, [data]);

  // What to render for the hover affordance: prefer hovered edge; fall
  // back to hovered node's most-prominent edge.
  const hoveredEdge = useMemo(() => {
    if (!data) return null;
    if (hoveredEdgeId) return categorisedEdges.find((e) => e.id === hoveredEdgeId) || null;
    if (hoveredNodeId) {
      // First focal-edge involving the node.
      return categorisedEdges.find((e) => !e.inter_neighbor &&
        (e.src_id === hoveredNodeId || e.dst_id === hoveredNodeId)) || null;
    }
    return null;
  }, [hoveredEdgeId, hoveredNodeId, categorisedEdges, data]);

  if (loading) {
    return (
      <div className="cr-loading">
        <CRStyles />
        Loading map.
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cr-loading">
        <CRStyles />
        <p>{error || 'No data.'}</p>
        <a href={`/concepts/${conceptId}`} className="cr-back">← Back to Concept</a>
      </div>
    );
  }

  const focalLabel = data.focal.label || conceptLabel || 'Concept';

  return (
    <div className="cr-page">
      <CRStyles />

      <header className="cr-header">
        <a href={`/concepts/${conceptId}`} className="cr-back">← Back to {toTitleCase(focalLabel)}</a>
        <h1 className="cr-title">
          Relationships of{' '}
          <a href={`/concepts/${conceptId}`} className="cr-title-chip" title="Back to concept">
            <i className="fas fa-lightbulb cr-title-chip-icon" aria-hidden="true" />
            <span className="cr-title-chip-label">{toTitleCase(focalLabel)}</span>
          </a>
        </h1>
        <p className="cr-sub">
          {data.neighbors.length === 0
            ? 'No relationships yet — head back and add some.'
            : `${data.neighbors.length} connected concept${data.neighbors.length === 1 ? '' : 's'}`}
          {data.truncated && (
            <> · <span className="cr-truncated">showing top {data.neighbor_cap} of {data.total_neighbors}</span></>
          )}
        </p>
      </header>

      {data.neighbors.length > 0 && (
        <>
          <div className="cr-filter-bar">
            {CATEGORY_ORDER.map((cat) => {
              const count = categoryCounts[cat] || 0;
              if (count === 0) return null;
              const active = activeCategories.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  className={`cr-filter-chip${active ? ' is-active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={active}
                >
                  <span>{cat}</span>
                  <span className="cr-filter-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div ref={containerRef} className="cr-canvas-wrap">
            <svg
              className="cr-canvas"
              viewBox={`0 0 ${viewport.w} ${viewport.h}`}
              width="100%"
              height={viewport.h}
              role="img"
              aria-label={`Relationship map for ${focalLabel}`}
              onClick={() => { setHoveredEdgeId(null); setHoveredNodeId(null); }}
            >
              {/* Soft cluster blobs (drawn first so they sit behind everything) */}
              <g className="cr-clusters">
                {clusterPaths.map((c, i) => (
                  <path
                    key={i}
                    d={c.path}
                    className="cr-cluster-blob"
                  />
                ))}
              </g>

              {/* Edges */}
              <g className="cr-edges">
                {visibleEdges.map((e) => {
                  const src = positions[e.src_id];
                  const dst = positions[e.dst_id];
                  if (!src || !dst) return null;
                  const isHovered = hoveredEdgeId === e.id ||
                    (hoveredNodeId && (e.src_id === hoveredNodeId || e.dst_id === hoveredNodeId));
                  return (
                    <line
                      key={e.id}
                      x1={src.x} y1={src.y}
                      x2={dst.x} y2={dst.y}
                      className={`cr-edge${e.inter_neighbor ? ' is-inter' : ''}${isHovered ? ' is-hovered' : ''}`}
                      onMouseEnter={() => setHoveredEdgeId(e.id)}
                      onMouseLeave={() => setHoveredEdgeId(null)}
                    />
                  );
                })}
              </g>

              {/* Verb label for the currently hovered edge */}
              {hoveredEdge && positions[hoveredEdge.src_id] && positions[hoveredEdge.dst_id] && (() => {
                const s = positions[hoveredEdge.src_id];
                const t = positions[hoveredEdge.dst_id];
                const mx = (s.x + t.x) / 2;
                const my = (s.y + t.y) / 2;
                const text = hoveredEdge.relationship_label || getRelTypeText(hoveredEdge.rel_type) || hoveredEdge.rel_type;
                return (
                  <g className="cr-edge-label" transform={`translate(${mx}, ${my})`}>
                    <rect
                      x={-(text.length * 3.4 + 8)}
                      y={-9}
                      width={text.length * 6.8 + 16}
                      height={18}
                      rx={9}
                      className="cr-edge-label-bg"
                    />
                    <text className="cr-edge-label-text" textAnchor="middle" dy="0.32em">
                      {text}
                    </text>
                  </g>
                );
              })()}

              {/* Nodes */}
              <g className="cr-nodes">
                {/* Focal */}
                {positions[data.focal.id] && (() => {
                  const lines = wrapLabel(focalLabel, 14, 2);
                  return (
                    <g
                      className="cr-node is-focal"
                      transform={`translate(${positions[data.focal.id].x}, ${positions[data.focal.id].y})`}
                    >
                      <circle r={30} className="cr-node-circle" />
                      <text className="cr-focal-label" textAnchor="middle">
                        {lines.map((line, i) => (
                          <tspan
                            key={i}
                            x="0"
                            dy={lines.length === 1 ? '0.35em' : (i === 0 ? `${-0.2 * (lines.length - 1)}em` : '1.15em')}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                })()}

                {/* Neighbors — labels positioned radially outward from focal so
                    a node above the focal gets its label above (not below where
                    it'd collide with the focal). */}
                {data.neighbors.map((n) => {
                  const pos = positions[n.id];
                  const focalPos = positions[data.focal.id];
                  if (!pos || !focalPos) return null;
                  const r = nodeRadius(n);
                  const dimmed = dimmedNeighborIds.has(n.id);
                  const hovered = hoveredNodeId === n.id;

                  // Outward direction (from focal to this neighbor).  Label is
                  // anchored outside the node along this vector.
                  const dx = pos.x - focalPos.x;
                  const dy = pos.y - focalPos.y;
                  const mag = Math.max(1, Math.hypot(dx, dy));
                  const ux = dx / mag;
                  const uy = dy / mag;
                  const labelDist = r + 14;
                  const lx = ux * labelDist;
                  const ly = uy * labelDist;
                  // Pick the text-anchor based on which side of the focal we're on
                  // so multi-word labels never tuck back toward the centre.
                  const anchor = ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle';

                  return (
                    <g
                      key={n.id}
                      className={`cr-node${dimmed ? ' is-dimmed' : ''}${hovered ? ' is-hovered' : ''}`}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hoveredNodeId === n.id) {
                          window.location.href = `/concepts/${n.id}`;
                        } else {
                          setHoveredNodeId(n.id);
                          setHoveredEdgeId(null);
                        }
                      }}
                      onMouseEnter={() => setHoveredNodeId(n.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      <circle r={r} className="cr-node-circle" />
                      {(() => {
                        const lines = wrapLabel(n.label, 20, 2);
                        return (
                          <text
                            className="cr-node-label"
                            textAnchor={anchor}
                            x={lx}
                            y={ly}
                          >
                            {lines.map((line, i) => (
                              <tspan
                                key={i}
                                x={lx}
                                dy={lines.length === 1 ? '0.35em' : (i === 0 ? `${-0.2 * (lines.length - 1)}em` : '1.15em')}
                              >
                                {line}
                              </tspan>
                            ))}
                          </text>
                        );
                      })()}
                    </g>
                  );
                })}
              </g>
            </svg>

            <p className="cr-hint">
              <i className="fas fa-info-circle" />{' '}
              Hover a node or edge to see the relationship verb.  Click a neighbor twice to open it.
              {clusters.length > 0 && <> · {clusters.length} tightly-connected group{clusters.length === 1 ? '' : 's'} highlighted.</>}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function CRStyles() {
  return (
    <style>{`
      .cr-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 24px;
        gap: 12px;
        font-family: var(--font-body);
        color: var(--ink-3);
      }

      .cr-page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 16px 32px 80px;
      }

      .cr-back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
        text-decoration: none;
        margin-bottom: 12px;
        transition: color 0.12s;
      }
      .cr-back:hover { color: var(--concept); }

      .cr-header { margin-bottom: 18px; }
      .cr-title {
        font-family: var(--font-display);
        font-size: 30px;
        font-weight: 600;
        color: var(--concept);
        margin: 0;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }
      .cr-title-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 14px 4px 12px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--concept) 10%, var(--paper));
        border: 1.5px solid color-mix(in srgb, var(--concept) 35%, transparent);
        color: var(--concept);
        font-family: var(--font-display);
        font-size: 0.75em;
        font-weight: 600;
        line-height: 1.2;
        text-decoration: none;
        vertical-align: middle;
        position: relative;
        top: -3px;
        transition: background 0.15s, border-color 0.15s, transform 0.15s;
        max-width: 100%;
      }
      .cr-title-chip:hover {
        background: color-mix(in srgb, var(--concept) 18%, var(--paper));
        border-color: color-mix(in srgb, var(--concept) 55%, transparent);
        transform: translateY(-1px);
      }
      .cr-title-chip-icon { font-size: 0.85em; opacity: 0.85; }
      .cr-title-chip-label {
        max-width: 320px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cr-sub {
        margin: 6px 0 0;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
      }
      .cr-truncated { color: var(--ink-3); font-style: italic; }

      .cr-filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 14px;
      }
      .cr-filter-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        border: 1.5px solid var(--ink-line);
        background: var(--paper);
        color: var(--ink-2);
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.12s, opacity 0.12s, border-color 0.12s;
      }
      .cr-filter-chip:hover { background: var(--paper-soft); }
      .cr-filter-chip.is-active {
        background: color-mix(in srgb, var(--source) 12%, var(--paper));
        color: var(--source);
        border-color: color-mix(in srgb, var(--source) 55%, transparent);
      }
      .cr-filter-chip:not(.is-active) { opacity: 0.5; }
      .cr-filter-count {
        font-family: var(--font-mono);
        font-size: 10.5px;
        opacity: 0.7;
        margin-left: 2px;
      }

      .cr-canvas-wrap {
        position: relative;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
      }
      .cr-canvas {
        display: block;
        width: 100%;
        height: auto;
        touch-action: pan-x pan-y;
        user-select: none;
      }

      .cr-cluster-blob {
        fill: color-mix(in srgb, var(--concept) 8%, transparent);
        stroke: color-mix(in srgb, var(--concept) 18%, transparent);
        stroke-width: 1.5;
        stroke-dasharray: 3 4;
      }

      .cr-edge {
        stroke: var(--concept);
        stroke-width: 1.6;
        stroke-opacity: 0.6;
        transition: stroke-width 0.15s, stroke-opacity 0.15s;
        cursor: pointer;
      }
      .cr-edge.is-inter {
        stroke: var(--ink-3);
        stroke-width: 1;
        stroke-opacity: 0.18;
        stroke-dasharray: 2 3;
      }
      .cr-edge.is-hovered {
        stroke: var(--source);
        stroke-width: 2.6;
        stroke-opacity: 1;
        stroke-dasharray: none;
      }

      .cr-edge-label-bg {
        fill: var(--source);
        opacity: 0.95;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.18));
      }
      .cr-edge-label-text {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        fill: var(--paper);
        pointer-events: none;
      }

      .cr-node {
        cursor: pointer;
        transition: transform 0.15s;
      }
      .cr-node.is-dimmed { opacity: 0.25; }
      .cr-node-circle {
        fill: color-mix(in srgb, var(--concept) 12%, var(--paper));
        stroke: var(--concept);
        stroke-width: 1.8;
        transition: fill 0.15s, stroke-width 0.15s;
      }
      .cr-node.is-focal .cr-node-circle {
        fill: var(--concept);
        stroke: var(--concept);
        stroke-width: 0;
      }
      .cr-node.is-hovered .cr-node-circle {
        fill: color-mix(in srgb, var(--concept) 28%, var(--paper));
        stroke-width: 2.6;
      }
      .cr-node-label {
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 500;
        fill: var(--ink-2);
        pointer-events: none;
        paint-order: stroke;
        stroke: var(--paper);
        stroke-width: 3.5px;
        stroke-linejoin: round;
      }
      .cr-focal-label {
        font-family: var(--font-display);
        font-size: 12.5px;
        font-weight: 700;
        fill: var(--ink);
        pointer-events: none;
        text-anchor: middle;
        paint-order: stroke;
        stroke: var(--paper);
        stroke-width: 3.5px;
        stroke-linejoin: round;
      }
      .cr-node.is-hovered .cr-node-label { fill: var(--ink); font-weight: 600; }

      .cr-hint {
        margin: 12px 4px 0;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        line-height: 1.5;
      }
      .cr-hint i { color: var(--concept); margin-right: 2px; }

      @media (max-width: 768px) {
        .cr-page { padding: 12px 14px 56px; }
        .cr-title { font-size: 22px; }
        .cr-title-chip-label { max-width: 180px; }
        .cr-filter-chip { font-size: 11px; padding: 3px 8px; }
        .cr-node-label { font-size: 10.5px; }
      }
    `}</style>
  );
}
