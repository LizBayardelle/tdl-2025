import React, { useState, useEffect, useMemo } from 'react';

// =====================================================================
// ConceptMapRadial
// Calm, static radial concept map.  Mirrors the SamplePage relationship
// chart but reads real concept + connection data from the API.
//
// Layout: a center concept (the most-connected one), an inner ring of
// up to 6 of its top-connected neighbors at 60° intervals, and an outer
// ring of one second-degree neighbor per inner spoke when available.
// =====================================================================

const INNER_R = 130;
const OUTER_R = 215;
const W = 760;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const MAX_INNER = 6;

export default function ConceptMapRadial() {
  const [concepts, setConcepts] = useState(null);
  const [connections, setConnections] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/concepts.json').then((r) => r.json()),
      fetch('/connections.json').then((r) => r.json()),
    ])
      .then(([c, k]) => {
        setConcepts(c);
        setConnections(k);
      })
      .catch((err) => {
        console.error(err);
        setError('Could not load the concept map.');
      });
  }, []);

  const layout = useMemo(() => {
    if (!concepts || !connections) return null;
    return computeLayout(concepts, connections);
  }, [concepts, connections]);

  return (
    <section className="sp-relationship">
      <div className="sp-relationship-head">
        <div>
          <h2 className="sp-chart-title">Concept map</h2>
          <p className="sp-chart-subtitle">
            {layout && layout.center
              ? <>Direct and adjacent connections to <em>{layout.center.label}</em>.</>
              : 'A view of how your concepts connect.'}
          </p>
        </div>
        <div className="sp-legend">
          <span className="sp-legend-item is-concept"><span className="sp-legend-dot" /> Concept</span>
        </div>
      </div>

      <div className="sp-relationship-canvas">
        {error ? (
          <EmptyMessage>{error}</EmptyMessage>
        ) : !layout ? (
          <EmptyMessage>Loading.</EmptyMessage>
        ) : !layout.center ? (
          <EmptyMessage>
            No concept connections yet.  Add a few concepts and link them to see your map.
          </EmptyMessage>
        ) : (
          <RadialSvg layout={layout} />
        )}
      </div>
    </section>
  );
}

function EmptyMessage({ children }) {
  return (
    <div
      style={{
        height: 340,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        fontFamily: 'var(--font-body)',
        fontSize: 13.5,
        color: 'var(--ink-3)',
        lineHeight: 1.55,
        maxWidth: 360,
        margin: '0 auto',
      }}
    >
      {children}
    </div>
  );
}

function RadialSvg({ layout }) {
  const { center, inner, outer } = layout;
  const polar = (r, deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };
  const innerCount = inner.length;
  // Distribute inner nodes around the circle starting at -90° (top), then evenly.
  const innerAngle = (i) => -90 + (360 / Math.max(innerCount, 1)) * i;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sp-svg-net" preserveAspectRatio="xMidYMid meet">
      {/* Concentric guide rings */}
      <circle cx={CX} cy={CY} r={INNER_R} className="sp-net-ring" />
      {outer.length > 0 && <circle cx={CX} cy={CY} r={OUTER_R} className="sp-net-ring" />}

      {/* Inner spokes */}
      {inner.map((n, i) => {
        const p = polar(INNER_R, innerAngle(i));
        return <line key={`is-${i}`} x1={CX} y1={CY} x2={p.x} y2={p.y} className="sp-net-edge" />;
      })}

      {/* Outer connectors (each outer node tied to its parent inner) */}
      {outer.map((n, i) => {
        const inP = polar(INNER_R, innerAngle(n.parent));
        const ouP = polar(OUTER_R, innerAngle(n.parent));
        return <line key={`os-${i}`} x1={inP.x} y1={inP.y} x2={ouP.x} y2={ouP.y} className="sp-net-edge sp-net-edge-faint" />;
      })}

      {/* Outer nodes (drawn first so inner halos can overlap if anything) */}
      {outer.map((n, i) => {
        const p = polar(OUTER_R, innerAngle(n.parent));
        return <NetNode key={`o-${i}`} x={p.x} y={p.y} label={n.label} type="concept" size="sm" />;
      })}

      {/* Inner nodes */}
      {inner.map((n, i) => {
        const p = polar(INNER_R, innerAngle(i));
        return <NetNode key={`i-${i}`} x={p.x} y={p.y} label={n.label} type="concept" size="md" />;
      })}

      {/* Center */}
      <NetNode x={CX} y={CY} label={center.label} type="concept" size="lg" />
    </svg>
  );
}

function NetNode({ x, y, label, type, size }) {
  const r = size === 'lg' ? 9 : size === 'md' ? 6 : 4;
  const haloR = r + 6;
  const labelDy = size === 'lg' ? 28 : size === 'md' ? 22 : 16;
  const trimmed = label && label.length > 22 ? label.slice(0, 21) + '…' : label;
  return (
    <g>
      <circle cx={x} cy={y} r={haloR} className={`sp-net-halo is-${type}`} />
      <circle cx={x} cy={y} r={r} className={`sp-net-node is-${type}`} />
      <text
        x={x}
        y={y + labelDy}
        textAnchor="middle"
        className={`sp-net-label sp-net-label-${size}`}
      >
        {trimmed}
      </text>
    </g>
  );
}

// =====================================================================
// Layout computation
// =====================================================================

function computeLayout(concepts, connections) {
  if (!Array.isArray(concepts) || !Array.isArray(connections) || concepts.length === 0) {
    return { center: null, inner: [], outer: [] };
  }

  // Build adjacency: concept_id -> Set of neighbor ids
  const adjacency = new Map();
  concepts.forEach((c) => adjacency.set(c.id, new Set()));
  connections.forEach((k) => {
    if (adjacency.has(k.src_concept_id) && adjacency.has(k.dst_concept_id)) {
      adjacency.get(k.src_concept_id).add(k.dst_concept_id);
      adjacency.get(k.dst_concept_id).add(k.src_concept_id);
    }
  });

  // Pick the most-connected concept as the center
  const sorted = [...concepts].sort(
    (a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0)
  );
  const center = sorted[0];
  if (!center || (adjacency.get(center.id)?.size || 0) === 0) {
    return { center: null, inner: [], outer: [] };
  }

  const conceptsById = new Map(concepts.map((c) => [c.id, c]));

  // Inner ring: center's top neighbors (by their own connection count)
  const innerIds = Array.from(adjacency.get(center.id))
    .sort((a, b) => (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0))
    .slice(0, MAX_INNER);
  const inner = innerIds.map((id) => conceptsById.get(id)).filter(Boolean);

  // Outer ring: one second-degree neighbor per inner spoke
  const used = new Set([center.id, ...innerIds]);
  const outer = [];
  inner.forEach((innerNode, parentIdx) => {
    const candidates = Array.from(adjacency.get(innerNode.id) || [])
      .filter((id) => !used.has(id))
      .sort((a, b) => (adjacency.get(b)?.size || 0) - (adjacency.get(a)?.size || 0));
    if (candidates.length > 0) {
      const pick = candidates[0];
      used.add(pick);
      outer.push({ ...conceptsById.get(pick), parent: parentIdx });
    }
  });

  return { center, inner, outer };
}
