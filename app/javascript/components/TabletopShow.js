import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SPStyles } from './SamplePage';

// =====================================================================
// TabletopShow — the canvas itself
// Infinite-pan, pinch/scroll-zoom workspace on which note (and later
// header/text/arrow) items can be dragged and arranged.  All drags
// debounce-persist to /tabletops/:id/items/:item_id.  The viewport pan
// and zoom likewise persist to /tabletops/:id/viewport so reopening
// drops you exactly where you left off.
// =====================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const NOTE_W   = 280;
const SNAP     = 8; // px — fine-grain alignment.  Hold Alt while dragging to bypass.

function snap(n) { return Math.round(n / SNAP) * SNAP; }

// World-space anchor point on a box item.  `side` picks an edge midpoint
// (n / e / s / w) or — when null/'center' — the center.
function itemAnchorPoint(item, side) {
  if (!item || item.kind === 'arrow') return null;
  const w = item.width  || (item.kind === 'note' ? NOTE_W : item.kind === 'frame' ? 480 : 200);
  const h = item.height || (item.kind === 'note' ? 220 : item.kind === 'frame' ? 320 : 60);
  const x = item.x || 0, y = item.y || 0;
  switch (side) {
    case 'n': return { cx: x + w / 2, cy: y };
    case 'e': return { cx: x + w,     cy: y + h / 2 };
    case 's': return { cx: x + w / 2, cy: y + h };
    case 'w': return { cx: x,         cy: y + h / 2 };
    default:  return { cx: x + w / 2, cy: y + h / 2 };
  }
}
function itemCenter(item) { return itemAnchorPoint(item, 'center'); }

// Midpoint of an arrow in world coords — accounts for either end being
// anchored to a box item's edge.  Used to position labels attached to
// arrows so they ride the geometric middle.
function arrowMidpoint(arrow, items) {
  if (!arrow || arrow.kind !== 'arrow') return null;
  const startA = arrow.start_anchor_id ? items.find(i => i.id === arrow.start_anchor_id) : null;
  const endA   = arrow.end_anchor_id   ? items.find(i => i.id === arrow.end_anchor_id)   : null;
  const sp = startA ? itemAnchorPoint(startA, arrow.start_anchor_side || 'center') : { cx: arrow.start_x || 0, cy: arrow.start_y || 0 };
  const ep = endA   ? itemAnchorPoint(endA,   arrow.end_anchor_side   || 'center') : { cx: arrow.end_x   || 0, cy: arrow.end_y   || 0 };
  return { cx: (sp.cx + ep.cx) / 2, cy: (sp.cy + ep.cy) / 2 };
}

// Choose an anchor side from cursor position relative to the item.
// Normalized so a non-square item picks the visually-closest edge.
function pickAnchorSide(item, worldX, worldY) {
  if (!item) return null;
  const w = item.width  || (item.kind === 'note' ? NOTE_W : item.kind === 'frame' ? 480 : 200);
  const h = item.height || (item.kind === 'note' ? 220 : item.kind === 'frame' ? 320 : 60);
  const cx = (item.x || 0) + w / 2;
  const cy = (item.y || 0) + h / 2;
  const nx = (worldX - cx) / w;
  const ny = (worldY - cy) / h;
  if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? 'e' : 'w';
  return ny > 0 ? 's' : 'n';
}

export default function TabletopShow({ tabletopId, embedded = false, onClose = null }) {
  const [tabletop, setTabletop] = useState(null);
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });

  const [showPicker, setShowPicker]       = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // When set, the canvas swaps to a print-friendly layout: stage sized to
  // a single page, grid transform replaced by a fit-to-page transform.
  // Cleared after the print dialog returns.
  const [printState, setPrintState] = useState(null);

  // Sidebar collapse + selection / active-note state.  Selection is a Set
  // of item IDs (multi-select via shift-click); the sidebar's active-note
  // view shows the *single* note when the selection contains exactly one
  // note, otherwise an empty hint.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedIds, setSelectedIds]           = useState(() => new Set());

  // Right-click context menu — declared early so the keyboard-shortcut
  // useEffect (which depends on it) runs after this binding exists.
  const [contextMenu, setContextMenu] = useState(null);

  // Box-select rectangle in world coords while shift+drag is in progress.
  const [boxSelect, setBoxSelect] = useState(null);
  const boxSelectRef = useRef(null);

  // Pointer tracking for touch.  Every pointer that came down on the
  // stage background lives in this map until pointerup/pointercancel.
  // When the count reaches 2 we switch from pan to pinch-zoom.
  const stagePointersRef = useRef(new Map());
  const pinchStateRef    = useRef(null);

  // Long-press timer used to surface the context menu on touch
  // (mouse users get the menu via native contextmenu events).
  const longPressTimerRef  = useRef(null);
  const longPressOriginRef = useRef(null);

  // Mutable refs that track the latest selection / active state so the
  // document-level mouseup handler isn't reading stale closures.
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // ---- Save status ----
  // Each persist call increments saveCounter on dispatch, decrements on
  // resolve.  saveError captures the most recent failure so the user
  // sees something when the network drops.  showJustSaved fades in for
  // a beat after the last call settles.
  const [saveCounter, setSaveCounter] = useState(0);
  const [saveError, setSaveError]     = useState(null);
  const [showJustSaved, setShowJustSaved] = useState(false);
  const justSavedTimer = useRef(null);
  const beginSave = () => setSaveCounter(c => c + 1);
  const endSave   = (ok) => {
    setSaveCounter(c => Math.max(0, c - 1));
    if (ok) {
      setSaveError(null);
      setShowJustSaved(true);
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setShowJustSaved(false), 1800);
    }
  };

  // ---- Undo stack ----
  // Session-scoped action log.  Each entry knows how to reverse itself.
  // Stored in a ref so undo doesn't trigger re-renders; we only re-render
  // when the inverse mutates state.  Capped at 200 entries.
  const undoStackRef = useRef([]);
  function pushAction(action) {
    if (!action) return;
    const stack = undoStackRef.current;
    stack.push(action);
    if (stack.length > 200) stack.shift();
  }

  // Reverse the most-recent action.  Each action stores enough info to
  // be its own inverse: a move records before/after coords, an edit
  // records the previous body string, etc.
  function undo() {
    const action = undoStackRef.current.pop();
    if (!action) return;
    if (action.type === 'move') {
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, x: action.before.x, y: action.before.y } : i));
      persistItemFields(action.itemId, { x: action.before.x, y: action.before.y });
    } else if (action.type === 'move-many') {
      setItems(prev => prev.map(i => {
        const m = action.moves.find(mv => mv.itemId === i.id);
        return m ? { ...i, x: m.before.x, y: m.before.y } : i;
      }));
      action.moves.forEach(m => persistItemFields(m.itemId, { x: m.before.x, y: m.before.y }));
    } else if (action.type === 'arrow-move' || action.type === 'arrow-endpoint') {
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, ...action.before } : i));
      persistItemFields(action.itemId, action.before);
    } else if (action.type === 'resize') {
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, width: action.before.width, height: action.before.height } : i));
      persistItemFields(action.itemId, { width: action.before.width, height: action.before.height });
    } else if (action.type === 'edit-text') {
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, body: action.before } : i));
      persistItemFields(action.itemId, { body: action.before });
    } else if (action.type === 'place') {
      // Undo a placement → return to tray.
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, staged: true } : i));
      persistItemFields(action.itemId, { staged: true });
    } else if (action.type === 'place-many') {
      setItems(prev => prev.map(i => action.itemIds.includes(i.id) ? { ...i, staged: true } : i));
      action.itemIds.forEach(id => persistItemFields(id, { staged: true }));
    } else if (action.type === 'text-anchor') {
      const before = action.before;
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, ...before } : i));
      persistItemFields(action.itemId, before);
    } else if (action.type === 'z-index') {
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, z_index: action.before } : i));
      persistItemFields(action.itemId, { z_index: action.before });
    } else if (action.type === 'color') {
      setItems(prev => prev.map(i => i.id === action.itemId ? { ...i, color: action.before } : i));
      persistItemFields(action.itemId, { color: action.before });
    }
  }

  // Canvas keyboard shortcuts.  Suppressed while the user is in any
  // text field so the OS / in-field handlers still work.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

      // ⌘Z / Ctrl+Z — undo
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
        return;
      }
      // ⌘D — duplicate the current selection
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const ids = [...selectedIdsRef.current];
        ids.forEach(id => {
          const it = itemsRef.current.find(i => i.id === id);
          if (it) duplicateItem(it);
        });
        return;
      }
      // Esc — clear selection / close context menu
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return; }
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          setSelectedIds(new Set());
        }
        return;
      }

      const ids = [...selectedIdsRef.current];
      if (ids.length === 0) return;

      // Delete / Backspace — remove selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const items = ids.map(id => itemsRef.current.find(i => i.id === id)).filter(Boolean);
        if (items.length === 0) return;
        const ok = items.length === 1
          ? window.confirm('Delete this item?  The underlying record (if any) is not deleted.')
          : window.confirm(`Delete ${items.length} items?  The underlying records (if any) are not deleted.`);
        if (!ok) return;
        Promise.all(items.map(it =>
          fetch(`/tabletops/${tabletopId}/items/${it.id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': csrf() },
          }).catch(() => {})
        ));
        setItems(prev => prev.filter(i => !ids.includes(i.id)));
        setSelectedIds(new Set());
        return;
      }

      // Arrow keys — nudge.  Shift = 1px fine-tune; otherwise SNAP step.
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : SNAP;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
        const moves = [];
        const arrowMoves = [];
        setItems(prev => prev.map(i => {
          if (!ids.includes(i.id)) return i;
          if (i.kind === 'arrow') {
            const before = { start_x: i.start_x || 0, start_y: i.start_y || 0, end_x: i.end_x || 0, end_y: i.end_y || 0 };
            const after  = { start_x: before.start_x + dx, start_y: before.start_y + dy, end_x: before.end_x + dx, end_y: before.end_y + dy };
            arrowMoves.push({ id: i.id, before, after });
            return { ...i, ...after };
          }
          const before = { x: i.x || 0, y: i.y || 0 };
          const after  = { x: before.x + dx, y: before.y + dy };
          moves.push({ itemId: i.id, before, after });
          return { ...i, ...after };
        }));
        // Single combined undoable for the keystroke.
        if (moves.length === 1 && arrowMoves.length === 0) {
          pushAction({ type: 'move', itemId: moves[0].itemId, before: moves[0].before, after: moves[0].after });
        } else if (moves.length > 0 || arrowMoves.length > 0) {
          if (moves.length > 0) pushAction({ type: 'move-many', moves });
          arrowMoves.forEach(m => pushAction({ type: 'arrow-endpoint', itemId: m.id, before: m.before, after: m.after }));
        }
        moves.forEach(m => persistItemFields(m.itemId, m.after));
        arrowMoves.forEach(m => persistItemFields(m.id, m.after));
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu]);

  // Draggable split between the active-note panel and the tray below.
  // 50% by default; clamped at [20, 80] so neither half can collapse.
  const [sidebarSplitPct, setSidebarSplitPct] = useState(50);
  const dividerDragRef = useRef(null);
  function onDividerMouseDown(e) {
    const sidebarEl = e.currentTarget.parentElement;
    if (!sidebarEl) return;
    e.preventDefault();
    e.stopPropagation();
    dividerDragRef.current = sidebarEl;
    document.addEventListener('pointermove', onDividerMove);
    document.addEventListener('pointerup', onDividerUp, { once: true });
  }
  function onDividerMove(e) {
    const el = dividerDragRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct  = ((e.clientY - rect.top) / rect.height) * 100;
    setSidebarSplitPct(Math.max(20, Math.min(80, pct)));
  }
  function onDividerUp() {
    dividerDragRef.current = null;
    document.removeEventListener('pointermove', onDividerMove);
  }

  // Drag-from-tray state.  When the user mouse-downs on a tray card we
  // start tracking the cursor; on mouseup, if the cursor is over the
  // canvas we place the item at the drop point.
  const [trayDrag, setTrayDrag] = useState(null); // { itemId, x, y, started }

  // Active drop target during an arrow-endpoint drag — drives the four
  // hover dots.  { itemId, side: 'n'|'e'|'s'|'w' } when valid.
  const [arrowDropTarget, setArrowDropTarget] = useState(null);

  // While dragging a text label over an arrow, the arrow's id sits here
  // and we render a midpoint dot so the snap target is unambiguous.
  const [textDragOverArrowId, setTextDragOverArrowId] = useState(null);

  const stageRef       = useRef(null);
  const panStateRef    = useRef(null); // { startX, startY, vx, vy }
  const dragStateRef   = useRef(null); // { itemId, startX, startY, ix, iy }
  const persistTimer   = useRef(null);
  const viewportTimer  = useRef(null);
  const isFirstView    = useRef(true);

  // Refs that always mirror the latest state, so document-level drag/up
  // handlers (registered once on mousedown) read fresh values instead of
  // stale closures.  Without these, drag persistence would PATCH the *pre*-
  // drag x/y and a refetch would snap items back to their original spots.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  // ---- Load ----
  useEffect(() => { fetchTabletop(); }, [tabletopId]);

  async function fetchTabletop() {
    setLoading(true);
    try {
      const res = await fetch(`/tabletops/${tabletopId}.json`);
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setTabletop(data);
      setItems(data.items || []);
      setView({
        x:    data.view_x    ?? 0,
        y:    data.view_y    ?? 0,
        zoom: data.view_zoom ?? 1,
      });
    } catch (err) {
      console.error('Tabletop load failed', err);
      setError('Could not load this tabletop.  Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }

  const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

  // ---- Viewport persistence (debounced) ----
  useEffect(() => {
    if (isFirstView.current) { isFirstView.current = false; return; }
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
    viewportTimer.current = setTimeout(() => {
      fetch(`/tabletops/${tabletopId}/viewport`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ view_x: view.x, view_y: view.y, view_zoom: view.zoom }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(viewportTimer.current);
  }, [view, tabletopId]);

  // ---- Zoom + pan input ----
  // Three input paths get unified into a single `applyZoom(view, cx, cy, factor)`:
  //   1. Wheel + ctrlKey (Chrome/Firefox/Edge trackpad pinch, mouse Ctrl-scroll)
  //   2. Safari gesturestart/change events (macOS Safari trackpad pinch)
  //   3. The +/- buttons in the top bar
  // Plain wheel without ctrlKey pans.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        // Pinch out (fingers spread) → deltaY < 0 → factor > 1 → zoom in.
        const factor = Math.exp(-e.deltaY * 0.0018);
        setView(v => applyZoom(v, cx, cy, factor));
      } else {
        e.preventDefault();
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };

    // Safari fires these for trackpad pinch instead of (or in addition to)
    // ctrlKey-wheel.  e.scale is cumulative since gesturestart.
    let gestureScale = 1;
    const onGestureStart = (e) => { e.preventDefault(); gestureScale = 1; };
    const onGestureChange = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.scale / gestureScale;
      gestureScale = e.scale;
      setView(v => applyZoom(v, cx, cy, factor));
    };
    const onGestureEnd = (e) => { e.preventDefault(); };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart',  onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    el.addEventListener('gestureend',    onGestureEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart',  onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend',    onGestureEnd);
    };
  }, []);

  // Multiply current zoom by `factor` while keeping the world point under
  // (cx, cy) anchored to the cursor.
  function applyZoom(v, cx, cy, factor) {
    const nextZoom   = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
    const realFactor = nextZoom / v.zoom;
    return {
      zoom: nextZoom,
      x: cx - (cx - v.x) * realFactor,
      y: cy - (cy - v.y) * realFactor,
    };
  }

  // Apply a zoom step centered on the stage (used by the +/- buttons).
  function buttonZoom(factor) {
    const el = stageRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView(v => applyZoom(v, cx, cy, factor));
  }

  // Bounding box across every item (including arrow endpoints).  Returns
  // `null` when the tabletop is empty.  Shared by Fit and Print.
  function computeBounds() {
    if (!items || items.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(it => {
      if (it.kind === 'arrow') {
        const xs = [it.start_x || 0, it.end_x || 0];
        const ys = [it.start_y || 0, it.end_y || 0];
        minX = Math.min(minX, ...xs); maxX = Math.max(maxX, ...xs);
        minY = Math.min(minY, ...ys); maxY = Math.max(maxY, ...ys);
      } else {
        const w = it.width  || (it.kind === 'note' ? NOTE_W : 200);
        const h = it.height || (it.kind === 'note' ? 220   : 60);
        minX = Math.min(minX, it.x);
        minY = Math.min(minY, it.y);
        maxX = Math.max(maxX, it.x + w);
        maxY = Math.max(maxY, it.y + h);
      }
    });
    return { minX, minY, maxX, maxY };
  }

  // Center + zoom the on-screen viewport so all items fit with a margin.
  function fitToContent() {
    const el = stageRef.current;
    const b  = computeBounds();
    if (!el || !b) { setView({ x: 0, y: 0, zoom: 1 }); return; }
    const PAD = 48;
    const cw = el.clientWidth  - PAD * 2;
    const ch = el.clientHeight - PAD * 2;
    const w  = Math.max(1, b.maxX - b.minX);
    const h  = Math.max(1, b.maxY - b.minY);
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(cw / w, ch / h, 1)));
    setView({
      x: PAD - b.minX * zoom + (cw - w * zoom) / 2,
      y: PAD - b.minY * zoom + (ch - h * zoom) / 2,
      zoom,
    });
  }

  // Print / Save as PDF.
  // We compute a world→page transform that fits the whole tabletop onto a
  // single landscape page, push it through React state so the inline
  // `transform` on the grid is the *print* transform (rather than fighting
  // the screen one with CSS specificity), and then call window.print().
  // The @media print stylesheet handles isolating the tabletop from the
  // surrounding page chrome (nav, header bars, overlay backdrop).
  function handlePrint() {
    const root = stageRef.current?.closest('.tx-show');
    const b    = computeBounds();
    if (!root || !b) { window.print(); return; }

    // Target landscape A4 with @page margin 0 ≈ 1123 × 794 CSS px.  Reserve
    // a 24px gutter inside that for breathing room.
    const PAD       = 24;
    const targetW   = 1100;
    const targetH   = 770;
    const contentW  = Math.max(1, b.maxX - b.minX);
    const contentH  = Math.max(1, b.maxY - b.minY);
    const availW    = targetW - 2 * PAD;
    const availH    = targetH - 2 * PAD;
    const scale     = Math.min(availW / contentW, availH / contentH, 1);
    const finalW    = contentW * scale + 2 * PAD;
    const finalH    = contentH * scale + 2 * PAD;
    const tx        = PAD - b.minX * scale;
    const ty        = PAD - b.minY * scale;

    setPrintState({
      w: finalW,
      h: finalH,
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    });

    // Wait two frames so React commits the print transform and width/height
    // to the DOM, then move the tabletop to be a direct child of <body>
    // for the duration of the dialog.  This lets us hide all *other* body
    // children with a single rule without ever touching the descendants
    // of .tx-show — so chip display: inline-block, flex-wrap on the meta
    // row, etc., all keep their author-set values and truncation works.
    let originalParent = null;
    let nextSibling    = null;
    let restored       = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      window.removeEventListener('afterprint', restore);
      try {
        if (originalParent) {
          if (nextSibling && nextSibling.parentNode === originalParent) {
            originalParent.insertBefore(root, nextSibling);
          } else {
            originalParent.appendChild(root);
          }
        }
      } catch (e) { console.error('Print restore failed', e); }
      document.body.classList.remove('is-printing-tabletop');
      setPrintState(null);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        originalParent = root.parentNode;
        nextSibling    = root.nextSibling;
        document.body.classList.add('is-printing-tabletop');
        document.body.appendChild(root);
        window.addEventListener('afterprint', restore);
        window.print();
        // Fallback in case afterprint doesn't fire (some browsers/OS combos).
        setTimeout(restore, 4000);
      });
    });
  }

  // Esc closes the overlay when embedded.
  useEffect(() => {
    if (!embedded || !onClose) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [embedded, onClose]);

  // ---- Right-click context menu ----
  function onStageContextMenu(e) {
    e.preventDefault();
    const stage = stageRef.current;
    const rect  = stage?.getBoundingClientRect();
    if (!rect) return;
    const v = viewRef.current;
    const worldX = (e.clientX - rect.left - v.x) / v.zoom;
    const worldY = (e.clientY - rect.top  - v.y) / v.zoom;

    // Look for an item under the click — preferring the topmost visible.
    let item = null;
    const els = document.elementsFromPoint(e.clientX, e.clientY) || [];
    for (const el of els) {
      const idEl = el.closest?.('[data-tabletop-item-id]');
      if (!idEl) continue;
      const id = Number(idEl.dataset.tabletopItemId);
      const cand = itemsRef.current.find(i => i.id === id);
      if (cand) { item = cand; break; }
    }

    setContextMenu({ x: e.clientX, y: e.clientY, item, worldX, worldY });
  }

  // ---- Long-press → touch context menu ----
  function startLongPress(e) {
    if (e.pointerType !== 'touch') return;
    cancelLongPress();
    longPressOriginRef.current = { x: e.clientX, y: e.clientY, target: e.target };
    longPressTimerRef.current = setTimeout(() => {
      const o = longPressOriginRef.current;
      longPressTimerRef.current = null;
      if (!o) return;
      onStageContextMenu({
        clientX: o.x, clientY: o.y, target: o.target,
        preventDefault: () => {}, stopPropagation: () => {},
      });
    }, 550);
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  }
  function maybeCancelLongPressFromMove(e) {
    const o = longPressOriginRef.current;
    if (!o || !longPressTimerRef.current) return;
    if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > 8) cancelLongPress();
  }

  // ---- Pinch zoom (two-finger touch) ----
  function startPinch() {
    const pts = [...stagePointersRef.current.values()];
    if (pts.length < 2) return;
    pinchStateRef.current = {
      startDistance: Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY),
      startZoom: viewRef.current.zoom,
      startCenter: {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2,
      },
    };
    document.addEventListener('pointermove', onPinchMove);
    document.addEventListener('pointerup',     onPinchEnd);
    document.addEventListener('pointercancel', onPinchEnd);
  }
  function onPinchMove(e) {
    if (stagePointersRef.current.has(e.pointerId)) {
      stagePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }
    if (!pinchStateRef.current || stagePointersRef.current.size < 2) return;
    const pts = [...stagePointersRef.current.values()];
    const d = Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY);
    const target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStateRef.current.startZoom * (d / pinchStateRef.current.startDistance)));
    const stage = stageRef.current;
    const rect  = stage?.getBoundingClientRect();
    if (!rect) return;
    const cx = pinchStateRef.current.startCenter.x - rect.left;
    const cy = pinchStateRef.current.startCenter.y - rect.top;
    setView(v => {
      const factor = target / v.zoom;
      return { zoom: target, x: cx - (cx - v.x) * factor, y: cy - (cy - v.y) * factor };
    });
  }
  function onPinchEnd(e) {
    if (e.pointerId != null) stagePointersRef.current.delete(e.pointerId);
    if (stagePointersRef.current.size < 2) {
      pinchStateRef.current = null;
      document.removeEventListener('pointermove', onPinchMove);
      document.removeEventListener('pointerup',     onPinchEnd);
      document.removeEventListener('pointercancel', onPinchEnd);
    }
  }

  // Global cleanup so the multi-pointer map can never get stuck.
  useEffect(() => {
    const cleanup = (e) => { stagePointersRef.current.delete(e.pointerId); };
    document.addEventListener('pointerup',     cleanup);
    document.addEventListener('pointercancel', cleanup);
    return () => {
      document.removeEventListener('pointerup',     cleanup);
      document.removeEventListener('pointercancel', cleanup);
    };
  }, []);

  // ---- Stage panning (background drag / two-finger touch) ----
  // Shift+drag = box-select (lasso).  Plain drag = pan.  Two touch
  // pointers on the empty stage = pinch-zoom.
  const onStageMouseDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // ignore right-click etc.
    // Only handle from the stage background, not from items
    if (e.target !== stageRef.current && e.target.closest('.tx-stage-grid') !== e.target) {
      const onItem = e.target.closest('[data-tabletop-item-id]');
      if (onItem) return;
    }

    // Track this pointer for multi-touch detection
    stagePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Second touch lands → pinch.  Cancel any in-flight single-pointer
    // gesture (pan, box-select, long-press) and start tracking distance.
    if (stagePointersRef.current.size === 2) {
      if (panStateRef.current) {
        panStateRef.current = null;
        document.removeEventListener('pointermove', onStageMouseMove);
      }
      if (boxSelectRef.current) {
        boxSelectRef.current = null;
        setBoxSelect(null);
        document.removeEventListener('pointermove', onBoxSelectMove);
      }
      cancelLongPress();
      startPinch();
      return;
    }

    // Single-pointer touch → arm the long-press timer for context menu.
    if (e.pointerType === 'touch') startLongPress(e);

    if (e.shiftKey) {
      // Begin box-select
      const stage = stageRef.current;
      const rect  = stage.getBoundingClientRect();
      const v     = viewRef.current;
      const wx = (e.clientX - rect.left - v.x) / v.zoom;
      const wy = (e.clientY - rect.top  - v.y) / v.zoom;
      boxSelectRef.current = { startWX: wx, startWY: wy };
      setBoxSelect({ x1: wx, y1: wy, x2: wx, y2: wy });
      document.addEventListener('pointermove', onBoxSelectMove);
      document.addEventListener('pointerup',   onBoxSelectUp, { once: true });
      return;
    }

    // Clicking the empty stage clears the selection.
    if (selectedIdsRef.current.size > 0) setSelectedIds(new Set());
    panStateRef.current = { startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y };
    document.addEventListener('pointermove', onStageMouseMove);
    document.addEventListener('pointerup',   onStageMouseUp, { once: true });
  };
  const onBoxSelectMove = (e) => {
    const b = boxSelectRef.current;
    if (!b) return;
    const stage = stageRef.current;
    const rect  = stage.getBoundingClientRect();
    const v     = viewRef.current;
    const wx = (e.clientX - rect.left - v.x) / v.zoom;
    const wy = (e.clientY - rect.top  - v.y) / v.zoom;
    setBoxSelect({ x1: b.startWX, y1: b.startWY, x2: wx, y2: wy });
  };
  const onBoxSelectUp = () => {
    document.removeEventListener('pointermove', onBoxSelectMove);
    const b = boxSelectRef.current;
    boxSelectRef.current = null;
    setBoxSelect(curr => {
      if (!curr || !b) return null;
      const minX = Math.min(curr.x1, curr.x2);
      const maxX = Math.max(curr.x1, curr.x2);
      const minY = Math.min(curr.y1, curr.y2);
      const maxY = Math.max(curr.y1, curr.y2);
      // Skip near-zero rectangles — treat as a click that clears.
      if (maxX - minX < 4 && maxY - minY < 4) {
        if (selectedIdsRef.current.size > 0) setSelectedIds(new Set());
        return null;
      }
      // Items whose bbox intersects the marquee → selected.  Arrows
      // qualify if either endpoint is inside.
      const next = new Set();
      itemsRef.current.forEach(it => {
        if (it.staged) return;
        if (it.kind === 'arrow') {
          const startA = it.start_anchor_id ? itemsRef.current.find(i => i.id === it.start_anchor_id) : null;
          const endA   = it.end_anchor_id   ? itemsRef.current.find(i => i.id === it.end_anchor_id)   : null;
          const sp = startA ? itemAnchorPoint(startA, it.start_anchor_side || 'center') : { cx: it.start_x || 0, cy: it.start_y || 0 };
          const ep = endA   ? itemAnchorPoint(endA,   it.end_anchor_side   || 'center') : { cx: it.end_x   || 0, cy: it.end_y   || 0 };
          if ((sp.cx >= minX && sp.cx <= maxX && sp.cy >= minY && sp.cy <= maxY) ||
              (ep.cx >= minX && ep.cx <= maxX && ep.cy >= minY && ep.cy <= maxY)) next.add(it.id);
        } else {
          const w = it.width  || (it.kind === 'note' ? NOTE_W : it.kind === 'frame' ? 480 : 200);
          const h = it.height || (it.kind === 'note' ? 220 : it.kind === 'frame' ? 320 : 60);
          const ix = it.x || 0, iy = it.y || 0;
          if (ix + w >= minX && ix <= maxX && iy + h >= minY && iy <= maxY) next.add(it.id);
        }
      });
      setSelectedIds(next);
      return null;
    });
  };
  const onStageMouseMove = (e) => {
    maybeCancelLongPressFromMove(e);
    const p = panStateRef.current;
    if (!p) return;
    setView(v => ({ ...v, x: p.vx + (e.clientX - p.startX), y: p.vy + (e.clientY - p.startY) }));
  };
  const onStageMouseUp = () => {
    panStateRef.current = null;
    document.removeEventListener('pointermove', onStageMouseMove);
    cancelLongPress();
  };

  // ---- Item drag ----
  // Modes:
  //   - 'body'    on a normal item = move (x,y)  — drags every selected item
  //                                  together if the clicked item is part
  //                                  of a multi-selection
  //   - 'body'    on an arrow      = translate both endpoints
  //   - 'start' / 'end'            = move just that endpoint of an arrow
  //   - 'resize-e' on a normal item = stretch its width from the right edge
  const onItemMouseDown = (e, itemId, mode = 'body') => {
    e.stopPropagation();
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    // Touch long-press on an item → item-targeted context menu.  We arm
    // the timer here and cancel it as soon as the user actually moves.
    if (e.pointerType === 'touch' && mode === 'body') startLongPress(e);

    // Selection update — handled here so click + shift-click work even if
    // the user immediately drags.  Resize/endpoint drags don't change the
    // selection (they're modifying the geometry, not focusing).
    if (mode === 'body') {
      const cur = selectedIdsRef.current;
      if (e.shiftKey) {
        const next = new Set(cur);
        if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
        setSelectedIds(next);
      } else if (!cur.has(itemId)) {
        setSelectedIds(new Set([itemId]));
      }
      // If already in selection without shift, leave the selection alone
      // (so a group drag can begin from any selected card).
    }

    if (item.kind === 'arrow') {
      dragStateRef.current = {
        itemId, mode,
        startX: e.clientX, startY: e.clientY,
        sx: item.start_x || 0, sy: item.start_y || 0,
        ex: item.end_x   || 0, ey: item.end_y   || 0,
        startAnchorId:   item.start_anchor_id   ?? null,
        endAnchorId:     item.end_anchor_id     ?? null,
        startAnchorSide: item.start_anchor_side ?? null,
        endAnchorSide:   item.end_anchor_side   ?? null,
      };
    } else if (mode === 'resize-e' || mode === 'resize-se') {
      dragStateRef.current = {
        itemId, mode,
        startX: e.clientX, startY: e.clientY,
        iw: item.width  || (item.kind === 'note' ? NOTE_W : item.kind === 'frame' ? 480 : 240),
        ih: item.height || (item.kind === 'frame' ? 320 : null),
      };
    } else {
      // If this is an attached-to-arrow text label, detach optimistically
      // so the user can see the label follow the cursor during the drag.
      // The visual top-left of an attached label is the arrow midpoint
      // minus half its size — set x/y to that so the drag math works.
      let workingItem = item;
      let wasAttachedToArrowId = null;
      if (item.kind === 'text' && item.start_anchor_id && item.start_anchor_side === 'midpoint') {
        const arrow = itemsRef.current.find(i => i.id === item.start_anchor_id);
        if (arrow && arrow.kind === 'arrow') {
          const mid = arrowMidpoint(arrow, itemsRef.current);
          const w   = item.width || 220;
          const h   = item.height || 36;
          const ix  = mid.cx - w / 2;
          const iy  = mid.cy - h / 2;
          wasAttachedToArrowId = item.start_anchor_id;
          setItems(prev => prev.map(i => i.id === item.id
            ? { ...i, x: ix, y: iy, start_anchor_id: null, start_anchor_side: null }
            : i));
          workingItem = { ...item, x: ix, y: iy };
        }
      }

      // Group drag: snapshot positions of every selected item that's
      // a draggable box (not an arrow).  If the clicked item isn't in
      // selection yet (handled above), it's now alone in selection.
      const sel = selectedIdsRef.current.has(itemId)
        ? Array.from(selectedIdsRef.current)
        : [itemId];
      const groupSnapshot = sel
        .map(id => itemsRef.current.find(i => i.id === id))
        .filter(Boolean)
        .filter(it => it.kind !== 'arrow')
        .map(it => ({ id: it.id, ix: it.id === itemId ? workingItem.x : it.x, iy: it.id === itemId ? workingItem.y : it.y }));

      // Frame drag: implicitly include every placed, non-arrow item whose
      // *center* lies inside the frame's bbox at drag-start.  Combined
      // with any explicit multi-selection, so dragging a selected frame
      // moves both the selection and any items the frame contains.
      const allDragged = item.kind === 'frame'
        ? (() => {
            const fw = item.width  || 480;
            const fh = item.height || 320;
            const x1 = item.x, y1 = item.y;
            const x2 = item.x + fw, y2 = item.y + fh;
            const inside = itemsRef.current
              .filter(it => it.id !== item.id && !it.staged && it.kind !== 'arrow' && it.kind !== 'frame')
              .filter(it => {
                const c = itemCenter(it);
                return c && c.cx >= x1 && c.cx <= x2 && c.cy >= y1 && c.cy <= y2;
              })
              .map(it => ({ id: it.id, ix: it.x, iy: it.y }));
            const seen = new Set(groupSnapshot.map(g => g.id));
            inside.forEach(g => { if (!seen.has(g.id)) groupSnapshot.push(g); });
            return groupSnapshot;
          })()
        : groupSnapshot;

      dragStateRef.current = {
        itemId, mode: 'body',
        startX: e.clientX, startY: e.clientY,
        ix: workingItem.x, iy: workingItem.y,
        group: allDragged,
        wasAttachedToArrowId,
      };
    }
    document.addEventListener('pointermove', onItemMouseMove);
    document.addEventListener('pointerup',   onItemMouseUp, { once: true });
  };
  const onItemMouseMove = (e) => {
    maybeCancelLongPressFromMove(e);
    const d = dragStateRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / viewRef.current.zoom;
    const dy = (e.clientY - d.startY) / viewRef.current.zoom;

    // Arrow-endpoint drag: track which item's edge is closest under the
    // cursor and surface the four edge-midpoint dots on that item.
    if (d.mode === 'start' || d.mode === 'end') {
      const dropEl = document.elementFromPoint(e.clientX, e.clientY);
      const itemEl = dropEl?.closest('[data-tabletop-item-id]');
      const targetId = itemEl ? Number(itemEl.dataset.tabletopItemId) : null;
      const target = targetId ? itemsRef.current.find(i => i.id === targetId) : null;
      if (target && target.kind !== 'arrow' && target.id !== d.itemId) {
        const stage = stageRef.current;
        const rect  = stage?.getBoundingClientRect();
        if (rect) {
          const v  = viewRef.current;
          const wx = (e.clientX - rect.left - v.x) / v.zoom;
          const wy = (e.clientY - rect.top  - v.y) / v.zoom;
          setArrowDropTarget({ itemId: target.id, side: pickAnchorSide(target, wx, wy) });
        }
      } else {
        setArrowDropTarget(null);
      }
    }

    // Text body drag: track if the cursor is over an arrow so we can
    // surface a midpoint dot showing exactly where the label will snap.
    if (d.mode === 'body') {
      const draggedItem = itemsRef.current.find(i => i.id === d.itemId);
      if (draggedItem?.kind === 'text') {
        const els = document.elementsFromPoint(e.clientX, e.clientY) || [];
        let arrowOver = null;
        for (const el of els) {
          const idEl = el.closest?.('[data-tabletop-item-id]');
          if (!idEl) continue;
          const id = Number(idEl.dataset.tabletopItemId);
          if (id === d.itemId) continue;
          const cand = itemsRef.current.find(i => i.id === id);
          if (cand?.kind === 'arrow') { arrowOver = cand; break; }
        }
        setTextDragOverArrowId(arrowOver?.id || null);
      }
    }

    // Alt bypasses snap for fine-tuning.
    const s = e.altKey ? (n) => n : snap;
    // Group move: when dragging a body that's part of a selection, snap the
    // delta and apply it uniformly to every captured group member.
    let groupDx = 0, groupDy = 0;
    if (d.group && d.group.length > 1) {
      groupDx = s(d.ix + dx) - d.ix;
      groupDy = s(d.iy + dy) - d.iy;
    }
    setItems(prev => prev.map(it => {
      if (d.group && d.group.length > 1) {
        const member = d.group.find(g => g.id === it.id);
        if (member) return { ...it, x: member.ix + groupDx, y: member.iy + groupDy };
      }
      if (it.id !== d.itemId) return it;
      if (it.kind === 'arrow') {
        if (d.mode === 'start') return { ...it, start_x: s(d.sx + dx), start_y: s(d.sy + dy) };
        if (d.mode === 'end')   return { ...it, end_x:   s(d.ex + dx), end_y:   s(d.ey + dy) };
        const sdx = s(d.sx + dx) - d.sx;
        const sdy = s(d.sy + dy) - d.sy;
        return { ...it,
          start_x: d.sx + sdx, start_y: d.sy + sdy,
          end_x:   d.ex + sdx, end_y:   d.ey + sdy,
        };
      }
      if (d.mode === 'resize-e') {
        return { ...it, width: s(d.iw + dx) };
      }
      if (d.mode === 'resize-se') {
        const baseH = d.ih ?? 200;
        return { ...it, width: s(d.iw + dx), height: s(baseH + dy) };
      }
      return { ...it, x: s(d.ix + dx), y: s(d.iy + dy) };
    }));
  };
  const onItemMouseUp = (e) => {
    cancelLongPress();
    const d = dragStateRef.current;
    if (!d) return;
    dragStateRef.current = null;
    document.removeEventListener('pointermove', onItemMouseMove);
    if (d.mode === 'start' || d.mode === 'end') setArrowDropTarget(null);
    setTextDragOverArrowId(null);

    // Read post-drag state from ref (avoids stale closure).
    const it = itemsRef.current.find(i => i.id === d.itemId);
    if (!it) return;

    // Arrow endpoint drop:
    //   - over a non-arrow box item → anchor to that item's nearest edge
    //     midpoint (side picked from cursor position; same side stored
    //     in arrowDropTarget so the dots reflect what'll happen).
    //   - over empty space         → clear any prior anchor.
    let anchorPatch = null;
    if (it.kind === 'arrow' && (d.mode === 'start' || d.mode === 'end') && e) {
      const dropEl  = document.elementFromPoint(e.clientX, e.clientY);
      const itemEl  = dropEl?.closest('[data-tabletop-item-id]');
      const targetId = itemEl ? Number(itemEl.dataset.tabletopItemId) : null;
      const target  = targetId ? itemsRef.current.find(i => i.id === targetId) : null;

      if (target && target.kind !== 'arrow' && target.id !== it.id) {
        const stage = stageRef.current;
        const rect  = stage?.getBoundingClientRect();
        const v     = viewRef.current;
        const wx    = rect ? (e.clientX - rect.left - v.x) / v.zoom : 0;
        const wy    = rect ? (e.clientY - rect.top  - v.y) / v.zoom : 0;
        const side  = pickAnchorSide(target, wx, wy);
        anchorPatch = d.mode === 'start'
          ? { start_anchor_id: target.id, start_anchor_side: side }
          : { end_anchor_id:   target.id, end_anchor_side:   side };
      } else {
        const wasAnchored = d.mode === 'start' ? !!it.start_anchor_id : !!it.end_anchor_id;
        if (wasAnchored) {
          anchorPatch = d.mode === 'start'
            ? { start_anchor_id: null, start_anchor_side: null }
            : { end_anchor_id:   null, end_anchor_side:   null };
        }
      }
      if (anchorPatch) {
        setItems(prev => prev.map(i => i.id === it.id ? { ...i, ...anchorPatch } : i));
      }
      setArrowDropTarget(null);
    }

    // Record an undoable action.
    if (d.group && d.group.length > 1) {
      const moves = d.group.map(g => {
        const cur = itemsRef.current.find(i => i.id === g.id);
        if (!cur) return null;
        return { itemId: g.id, before: { x: g.ix, y: g.iy }, after: { x: cur.x, y: cur.y } };
      }).filter(Boolean).filter(m => m.before.x !== m.after.x || m.before.y !== m.after.y);
      if (moves.length > 0) pushAction({ type: 'move-many', moves });
    } else if (it.kind === 'arrow') {
      if (d.mode === 'start' || d.mode === 'end') {
        pushAction({
          type: 'arrow-endpoint',
          itemId: it.id,
          before: {
            start_x: d.sx, start_y: d.sy, end_x: d.ex, end_y: d.ey,
            start_anchor_id:   d.startAnchorId   ?? null,
            end_anchor_id:     d.endAnchorId     ?? null,
            start_anchor_side: d.startAnchorSide ?? null,
            end_anchor_side:   d.endAnchorSide   ?? null,
          },
          after: {
            start_x: it.start_x, start_y: it.start_y, end_x: it.end_x, end_y: it.end_y,
            ...(anchorPatch || {}),
          },
        });
      } else {
        pushAction({
          type: 'arrow-move',
          itemId: it.id,
          before: { start_x: d.sx, start_y: d.sy, end_x: d.ex, end_y: d.ey },
          after:  { start_x: it.start_x, start_y: it.start_y, end_x: it.end_x, end_y: it.end_y },
        });
      }
    } else if (d.mode === 'resize-e' || d.mode === 'resize-se') {
      const beforeW = d.iw;
      const beforeH = d.ih ?? null;
      const afterW  = it.width;
      const afterH  = it.height ?? null;
      if (beforeW !== afterW || beforeH !== afterH) {
        pushAction({
          type: 'resize',
          itemId: it.id,
          before: { width: beforeW, height: beforeH },
          after:  { width: afterW,  height: afterH },
        });
      }
    } else {
      if (d.ix !== it.x || d.iy !== it.y) {
        pushAction({ type: 'move', itemId: it.id, before: { x: d.ix, y: d.iy }, after: { x: it.x, y: it.y } });
      }
    }

    // Text-on-arrow attachment: if we're releasing a text item over an
    // arrow that isn't itself, attach the label to that arrow's midpoint.
    // If the text was previously attached and was released *not* over an
    // arrow, leave it free at the release point.
    let textAnchorHandled = false;
    if (it.kind === 'text' && d.mode === 'body' && e) {
      let arrowAtCursor = null;
      const els = document.elementsFromPoint(e.clientX, e.clientY) || [];
      for (const el of els) {
        const idEl = el.closest?.('[data-tabletop-item-id]');
        if (!idEl) continue;
        const id = Number(idEl.dataset.tabletopItemId);
        if (id === it.id) continue;
        const cand = itemsRef.current.find(i => i.id === id);
        if (cand?.kind === 'arrow') { arrowAtCursor = cand; break; }
      }

      if (arrowAtCursor) {
        const attach = { start_anchor_id: arrowAtCursor.id, start_anchor_side: 'midpoint' };
        setItems(prev => prev.map(i => i.id === it.id ? { ...i, ...attach } : i));
        pushAction({
          type: 'text-anchor',
          itemId: it.id,
          before: d.wasAttachedToArrowId
            ? { start_anchor_id: d.wasAttachedToArrowId, start_anchor_side: 'midpoint' }
            : { start_anchor_id: null, start_anchor_side: null, x: d.ix, y: d.iy },
          after: attach,
        });
        persistItemFields(it.id, attach);
        textAnchorHandled = true;
      } else if (d.wasAttachedToArrowId) {
        // Was attached, released elsewhere → leave it free at release pt.
        pushAction({
          type: 'text-anchor',
          itemId: it.id,
          before: { start_anchor_id: d.wasAttachedToArrowId, start_anchor_side: 'midpoint' },
          after:  { start_anchor_id: null, start_anchor_side: null, x: it.x, y: it.y },
        });
        persistItemFields(it.id, { start_anchor_id: null, start_anchor_side: null, x: it.x, y: it.y });
        textAnchorHandled = true;
      }
    }

    if (textAnchorHandled) return;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      if (d.group && d.group.length > 1) {
        d.group.forEach(g => {
          const cur = itemsRef.current.find(i => i.id === g.id);
          if (cur && (cur.x !== g.ix || cur.y !== g.iy)) {
            persistItemFields(cur.id, { x: cur.x, y: cur.y });
          }
        });
      } else {
        const cur = itemsRef.current.find(i => i.id === d.itemId);
        if (cur) persistItem(cur);
      }
    }, 250);
  };

  async function persistItem(item) {
    return persistItemFields(item.id, {
      x: item.x, y: item.y,
      width: item.width, height: item.height,
      rotation: item.rotation, z_index: item.z_index,
      body: item.body,
      start_x: item.start_x, start_y: item.start_y,
      end_x: item.end_x, end_y: item.end_y,
      color: item.color,
      start_anchor_id:   item.start_anchor_id   ?? null,
      end_anchor_id:     item.end_anchor_id     ?? null,
      start_anchor_side: item.start_anchor_side ?? null,
      end_anchor_side:   item.end_anchor_side   ?? null,
    });
  }

  // PATCH a subset of fields — used by undo to write back specific
  // properties without serializing the whole item state.
  async function persistItemFields(itemId, fields) {
    beginSave();
    try {
      await fetch(`/tabletops/${tabletopId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: fields }),
      });
      endSave(true);
    } catch (err) {
      console.error('Persist failed', err);
      setSaveError(err);
      endSave(false);
    }
  }

  // ---- Staged vs placed split ----
  // Staged items live in the tray and are absent from the canvas until the
  // user clicks (or "Place all"-s) them out.  Everything else is placed.
  const stagedItems = items.filter(it => it.staged);
  const placedItems = items.filter(it => !it.staged);

  // Place a single staged item at the current viewport center, with a
  // small staggered offset so successive clicks fan instead of stacking.
  async function placeStaged(item) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (rect.width  / 2 - view.x) / view.zoom;
    const cy = (rect.height / 2 - view.y) / view.zoom;
    // Stagger by however many items are already placed *near* the center
    // — gives a fan-out feel when dropping several from the tray.
    const offset = (stagedItems.length % 6) * 16;
    const x = snap(cx - NOTE_W / 2 + offset);
    const y = snap(cy - 60 + offset);
    const next_z = (Math.max(0, ...items.map(i => i.z_index || 0))) + 1;

    // Optimistic update, then PATCH.
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, staged: false, x, y, z_index: next_z }
      : i));
    pushAction({ type: 'place', itemId: item.id });
    persistItemFields(item.id, { staged: false, x, y, z_index: next_z });
  }

  // Place every staged item in a tidy 3-column grid below the current
  // bottom of the placed cluster (or in the visible viewport if nothing
  // is placed yet).
  async function placeAllStaged() {
    if (stagedItems.length === 0) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const COLS  = Math.min(3, stagedItems.length);
    const GAP   = 24;
    const COL_W = NOTE_W + GAP;
    const ROW_H = 220 + GAP;

    let startX, startY;
    if (placedItems.length > 0) {
      const maxBottom = Math.max(...placedItems.map(it => {
        if (it.kind === 'arrow') return Math.max(it.start_y || 0, it.end_y || 0);
        return (it.y || 0) + (it.height || (it.kind === 'note' ? 220 : 60));
      }));
      const minLeft = Math.min(...placedItems.map(it => {
        if (it.kind === 'arrow') return Math.min(it.start_x || 0, it.end_x || 0);
        return it.x || 0;
      }));
      startX = snap(minLeft);
      startY = snap(maxBottom + 48);
    } else {
      const cx = (rect.width  / 2 - view.x) / view.zoom;
      const cy = (rect.height / 2 - view.y) / view.zoom;
      const totalW = COLS * NOTE_W + (COLS - 1) * GAP;
      const rows   = Math.ceil(stagedItems.length / COLS);
      const totalH = rows * 220 + (rows - 1) * GAP;
      startX = snap(cx - totalW / 2);
      startY = snap(cy - totalH / 2);
    }

    const baseZ = (Math.max(0, ...items.map(i => i.z_index || 0))) + 1;

    // Optimistic update first, then bulk PATCH.
    const updates = stagedItems.map((it, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        id: it.id,
        x: snap(startX + col * COL_W),
        y: snap(startY + row * ROW_H),
        z_index: baseZ + i,
      };
    });
    const updateMap = new Map(updates.map(u => [u.id, u]));
    setItems(prev => prev.map(i => updateMap.has(i.id)
      ? { ...i, staged: false, ...updateMap.get(i.id) }
      : i));
    pushAction({ type: 'place-many', itemIds: updates.map(u => u.id) });
    await Promise.all(updates.map(u => persistItemFields(u.id, { staged: false, x: u.x, y: u.y, z_index: u.z_index })));
  }

  async function returnToTray(item) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, staged: true } : i));
    if (selectedIdsRef.current.has(item.id)) {
      setSelectedIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
    try {
      await fetch(`/tabletops/${tabletopId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: { staged: true } }),
      });
    } catch (err) { console.error('Stash failed', err); }
  }

  // ---- Drag-from-tray to canvas ----
  // A tray card is mouse-downed; we follow the cursor and drop on the
  // canvas at the release point (in world coords).  Treats movement under
  // 4px as a click, so quick clicks on tray cards still place at center.
  function startTrayDrag(e, itemId) {
    e.stopPropagation();
    e.preventDefault();
    setTrayDrag({ itemId, x: e.clientX, y: e.clientY, originX: e.clientX, originY: e.clientY, started: false });
  }
  useEffect(() => {
    if (!trayDrag) return;
    const onMove = (e) => {
      const dx = e.clientX - trayDrag.originX;
      const dy = e.clientY - trayDrag.originY;
      const started = trayDrag.started || (Math.hypot(dx, dy) > 4);
      setTrayDrag(t => t ? { ...t, x: e.clientX, y: e.clientY, started } : t);
    };
    const onUp = (e) => {
      const dx = e.clientX - trayDrag.originX;
      const dy = e.clientY - trayDrag.originY;
      const moved = Math.hypot(dx, dy) > 4;
      const item = itemsRef.current.find(i => i.id === trayDrag.itemId);
      setTrayDrag(null);
      if (!item) return;

      const stage = stageRef.current;
      const rect  = stage?.getBoundingClientRect();
      const overStage = rect && e.clientX >= rect.left && e.clientX <= rect.right
                              && e.clientY >= rect.top  && e.clientY <= rect.bottom;

      if (moved && overStage) {
        const v  = viewRef.current;
        const wx = (e.clientX - rect.left - v.x) / v.zoom;
        const wy = (e.clientY - rect.top  - v.y) / v.zoom;
        const x = snap(wx - 32);
        const y = snap(wy - 14);
        const next_z = (Math.max(0, ...itemsRef.current.map(i => i.z_index || 0))) + 1;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, staged: false, x, y, z_index: next_z } : i));
        pushAction({ type: 'place', itemId: item.id });
        persistItemFields(item.id, { staged: false, x, y, z_index: next_z });
      } else if (!moved) {
        // Treat as click — place at viewport center via the existing path.
        placeStaged(item);
      }
      // Otherwise (moved but released outside canvas) the item stays in tray.
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trayDrag?.itemId]);

  // ---- Adding notes (one-or-many) ----
  // The picker passes us an array of selected notes.  All bulk-adds default
  // to the staging tray so they never dump on top of an already-curated
  // canvas.  The user pulls them out of the tray to place them.
  async function addNotesBulk(notes) {
    if (!notes || notes.length === 0) return;
    setShowPicker(false);
    try {
      await fetch(`/tabletops/${tabletopId}/import_notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ note_ids: notes.map(n => n.id), mode: 'staged' }),
      });
      fetchTabletop();
    } catch (err) { console.error('Bulk add failed', err); }
  }

  async function removeItem(item) {
    const isEntity = ['note','source','concept'].includes(item.kind);
    const msg = isEntity
      ? 'Remove this from the tabletop?  The underlying record is not deleted.'
      : 'Delete this item?';
    if (!window.confirm(msg)) return;
    try {
      await fetch(`/tabletops/${tabletopId}/items/${item.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf() },
      });
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) { console.error('Remove failed', err); }
  }

  // ---- Decorations ----
  // Headers, text labels, and arrows.  All placed at the visible viewport
  // center in world coordinates; the user drags afterward to position.
  // Headers/text auto-enter edit mode so the cursor lands ready to type.
  async function addDecoration(kind) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (rect.width  / 2 - view.x) / view.zoom;
    const cy = (rect.height / 2 - view.y) / view.zoom;

    let payload = { kind };
    if (kind === 'header') {
      payload = { ...payload, x: snap(cx - 140), y: snap(cy - 18), width: 280, body: '' };
    } else if (kind === 'text') {
      payload = { ...payload, x: snap(cx - 110), y: snap(cy - 28), width: 220, body: '' };
    } else if (kind === 'arrow') {
      payload = {
        ...payload, x: 0, y: 0,
        start_x: snap(cx - 90), start_y: snap(cy),
        end_x:   snap(cx + 90), end_y:   snap(cy),
      };
    } else if (kind === 'frame') {
      // Frames spawn LARGE so users can drop items into them right away.
      payload = {
        ...payload,
        x: snap(cx - 240), y: snap(cy - 160),
        width: 480, height: 320,
        body: '',
        // Render below other items: lower z_index than the current min.
        z_index: (Math.min(0, ...items.map(i => i.z_index || 0))) - 1,
      };
    } else {
      return;
    }

    try {
      const res = await fetch(`/tabletops/${tabletopId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: payload }),
      });
      if (!res.ok) throw new Error('add failed');
      const created = await res.json();
      setItems(prev => [...prev, created]);
      if (kind === 'header' || kind === 'text') setEditingItemId(created.id);
    } catch (err) { console.error('Add decoration failed', err); }
  }

  // ---- Context-menu actions ----
  function bringToFront(item) {
    const max = Math.max(0, ...itemsRef.current.map(i => i.z_index || 0));
    const before = item.z_index || 0;
    const after  = max + 1;
    if (before === after) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, z_index: after } : i));
    pushAction({ type: 'z-index', itemId: item.id, before, after });
    persistItemFields(item.id, { z_index: after });
  }
  function sendToBack(item) {
    const min = Math.min(0, ...itemsRef.current.map(i => i.z_index || 0));
    const before = item.z_index || 0;
    const after  = min - 1;
    if (before === after) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, z_index: after } : i));
    pushAction({ type: 'z-index', itemId: item.id, before, after });
    persistItemFields(item.id, { z_index: after });
  }

  // Duplicate a placed item with a small offset so it doesn't stack.
  // Note items keep their underlying note ref; arrow duplicates lose
  // their anchors (start fresh), since the anchored relationship is
  // semantic to the original.
  async function duplicateItem(item) {
    const offset = 24;
    const nextZ = (Math.max(0, ...itemsRef.current.map(i => i.z_index || 0))) + 1;
    const payload = {
      kind: item.kind,
      item_id: item.item_id || null,
      item_type: item.item_type || null,
      x: snap((item.x || 0) + offset),
      y: snap((item.y || 0) + offset),
      width: item.width, height: item.height,
      rotation: item.rotation || 0,
      z_index: nextZ,
      body: item.body,
      color: item.color,
    };
    if (item.kind === 'arrow') {
      payload.x = 0; payload.y = 0;
      payload.start_x = (item.start_x || 0) + offset;
      payload.start_y = (item.start_y || 0) + offset;
      payload.end_x   = (item.end_x   || 0) + offset;
      payload.end_y   = (item.end_y   || 0) + offset;
    }
    beginSave();
    try {
      const res = await fetch(`/tabletops/${tabletopId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: payload }),
      });
      if (!res.ok) throw new Error('duplicate failed');
      const created = await res.json();
      // For notes, item_data isn't in the create response — refetch the
      // tabletop so the duplicate renders with full content.
      if (item.kind === 'note') fetchTabletop();
      else setItems(prev => [...prev, created]);
      setSelectedIds(new Set([created.id]));
      endSave(true);
    } catch (err) {
      console.error('Duplicate failed', err);
      endSave(false);
    }
  }

  // Swap an arrow's endpoints (and any anchor info attached to them).
  function reverseArrow(arrow) {
    const before = {
      start_x: arrow.start_x, start_y: arrow.start_y, end_x: arrow.end_x, end_y: arrow.end_y,
      start_anchor_id:   arrow.start_anchor_id,   end_anchor_id:   arrow.end_anchor_id,
      start_anchor_side: arrow.start_anchor_side, end_anchor_side: arrow.end_anchor_side,
    };
    const after = {
      start_x: arrow.end_x, start_y: arrow.end_y, end_x: arrow.start_x, end_y: arrow.start_y,
      start_anchor_id:   arrow.end_anchor_id,   end_anchor_id:   arrow.start_anchor_id,
      start_anchor_side: arrow.end_anchor_side, end_anchor_side: arrow.start_anchor_side,
    };
    setItems(prev => prev.map(i => i.id === arrow.id ? { ...i, ...after } : i));
    pushAction({ type: 'arrow-endpoint', itemId: arrow.id, before, after });
    persistItemFields(arrow.id, after);
  }

  // Detach a single endpoint of an arrow — drops the anchor and pins
  // the static x/y to wherever the resolved point currently sits, so
  // the arrow visually doesn't jump.
  function detachArrowEnd(arrow, end /* 'start' | 'end' */) {
    const live = itemsRef.current.find(i => i.id === arrow.id) || arrow;
    const anchorItem = end === 'start'
      ? (live.start_anchor_id ? itemsRef.current.find(i => i.id === live.start_anchor_id) : null)
      : (live.end_anchor_id   ? itemsRef.current.find(i => i.id === live.end_anchor_id)   : null);
    const side = end === 'start' ? (live.start_anchor_side || 'center') : (live.end_anchor_side || 'center');
    const point = anchorItem ? itemAnchorPoint(anchorItem, side) : null;
    const fallback = end === 'start' ? { cx: live.start_x || 0, cy: live.start_y || 0 } : { cx: live.end_x || 0, cy: live.end_y || 0 };
    const p = point || fallback;
    const before = end === 'start'
      ? { start_x: live.start_x, start_y: live.start_y, start_anchor_id: live.start_anchor_id, start_anchor_side: live.start_anchor_side }
      : { end_x:   live.end_x,   end_y:   live.end_y,   end_anchor_id:   live.end_anchor_id,   end_anchor_side:   live.end_anchor_side   };
    const after = end === 'start'
      ? { start_x: p.cx, start_y: p.cy, start_anchor_id: null, start_anchor_side: null }
      : { end_x:   p.cx, end_y:   p.cy, end_anchor_id:   null, end_anchor_side:   null };
    setItems(prev => prev.map(i => i.id === arrow.id ? { ...i, ...after } : i));
    pushAction({ type: 'arrow-endpoint', itemId: arrow.id, before, after });
    persistItemFields(arrow.id, after);
  }

  // Set a categorical tint on a frame (or any colorable item).  null
  // returns it to the default navy.
  function setItemColor(item, color) {
    const before = item.color || null;
    if (before === color) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, color } : i));
    pushAction({ type: 'color', itemId: item.id, before, after: color });
    persistItemFields(item.id, { color });
  }

  // Decoration creation at a specific world point (used by canvas
  // right-click "Add … here").  Mirrors addDecoration but skips the
  // viewport-center math.
  async function addDecorationAt(kind, worldX, worldY) {
    let payload = { kind };
    if (kind === 'header') {
      payload = { ...payload, x: snap(worldX - 140), y: snap(worldY - 18), width: 280, body: '' };
    } else if (kind === 'text') {
      payload = { ...payload, x: snap(worldX - 110), y: snap(worldY - 28), width: 220, body: '' };
    } else if (kind === 'arrow') {
      payload = { ...payload, x: 0, y: 0,
        start_x: snap(worldX - 90), start_y: snap(worldY),
        end_x:   snap(worldX + 90), end_y:   snap(worldY) };
    } else if (kind === 'frame') {
      payload = { ...payload,
        x: snap(worldX - 240), y: snap(worldY - 160),
        width: 480, height: 320, body: '',
        z_index: (Math.min(0, ...items.map(i => i.z_index || 0))) - 1,
      };
    } else { return; }

    beginSave();
    try {
      const res = await fetch(`/tabletops/${tabletopId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: payload }),
      });
      if (!res.ok) throw new Error('add failed');
      const created = await res.json();
      setItems(prev => [...prev, created]);
      if (kind === 'header' || kind === 'text') setEditingItemId(created.id);
      endSave(true);
    } catch (err) { console.error('Add at point failed', err); endSave(false); }
  }

  // Commit inline edit (header / text body).  Persists immediately and
  // records an undoable action.
  function commitInlineEdit(itemId, body) {
    const it = itemsRef.current.find(i => i.id === itemId);
    setEditingItemId(null);
    if (!it) return;
    const before = it.body || '';
    if (before === (body || '')) return; // no-op
    const updated = { ...it, body };
    setItems(prev => prev.map(i => i.id === itemId ? updated : i));
    pushAction({ type: 'edit-text', itemId, before, after: body });
    persistItem(updated);
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className={`sp-root tx-show ${embedded ? "is-embedded" : ""} ${printState ? "is-printing" : ""}`}>
        <SPStyles />
        <TxShowStyles />
        <div className="tx-show-loading">Loading.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`sp-root tx-show ${embedded ? "is-embedded" : ""} ${printState ? "is-printing" : ""}`}>
        <SPStyles />
        <TxShowStyles />
        <div className="tx-show-error">{error}</div>
      </div>
    );
  }

  return (
    <div className={`sp-root tx-show ${embedded ? "is-embedded" : ""} ${printState ? "is-printing" : ""}`}>
      <SPStyles />
      <TxShowStyles />

      <header className="tx-show-bar">
        <div className="tx-show-bar-left">
          {embedded && onClose ? (
            <button type="button" className="tx-show-back" onClick={onClose} aria-label="Close tabletop overlay" title="Close (Esc)">
              <CloseIcon />
            </button>
          ) : (
            <a href="/tabletops" className="tx-show-back" aria-label="Back to tabletops" title="All tabletops">
              <BackIcon />
            </a>
          )}
          <div className="tx-show-title-block">
            <h1 className="tx-show-title">{tabletop.name}</h1>
            {tabletop.description && <p className="tx-show-desc">{tabletop.description}</p>}
          </div>
          <button
            type="button"
            className="sp-icon-action-quiet tx-show-edit-btn"
            onClick={() => setShowEditModal(true)}
            aria-label="Edit tabletop info"
            title="Edit tabletop info"
          >
            <PencilIcon />
          </button>
        </div>

        <div className="tx-show-bar-right">
          {(saveCounter > 0 || saveError || showJustSaved) && (
            <span
              className={`tx-save-pill ${saveError ? 'is-error' : saveCounter > 0 ? 'is-saving' : 'is-saved'}`}
              role="status"
              aria-live="polite"
            >
              {saveError ? "Couldn't save" : saveCounter > 0 ? 'Saving…' : 'Saved'}
            </span>
          )}
          <div className="tx-tools" role="group" aria-label="Add decoration">
            <button type="button" className="sp-icon-action-quiet tx-tool-btn" onClick={() => addDecoration('header')} title="Add header" aria-label="Add header">
              <ToolHeaderIcon />
            </button>
            <button type="button" className="sp-icon-action-quiet tx-tool-btn" onClick={() => addDecoration('text')} title="Add text" aria-label="Add text">
              <ToolTextIcon />
            </button>
            <button type="button" className="sp-icon-action-quiet tx-tool-btn" onClick={() => addDecoration('arrow')} title="Add arrow" aria-label="Add arrow">
              <ToolArrowIcon />
            </button>
            <button type="button" className="sp-icon-action-quiet tx-tool-btn" onClick={() => addDecoration('frame')} title="Add frame — drag together with its contents" aria-label="Add frame">
              <ToolFrameIcon />
            </button>
          </div>
          <div className="tx-zoom-display">
            <button type="button" className="sp-icon-action-quiet" onClick={() => buttonZoom(0.85)} aria-label="Zoom out">−</button>
            <span className="tx-zoom-value">{Math.round(view.zoom * 100)}%</span>
            <button type="button" className="sp-icon-action-quiet" onClick={() => buttonZoom(1.18)} aria-label="Zoom in">+</button>
            <button type="button" className="tx-zoom-reset" onClick={fitToContent} title="Fit all items in view">Fit</button>
          </div>
          <button
            type="button"
            className="sp-action sp-action-secondary tx-print-btn"
            onClick={handlePrint}
            title="Print or save as PDF"
          >
            <PrintIcon /> Print
          </button>
          <button type="button" className="sp-action sp-action-primary" onClick={() => setShowPicker(true)}>
            <span aria-hidden="true">+</span> Add Note
          </button>
        </div>
      </header>

      <div className="tx-body">
      <aside className={`tx-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <button
          type="button"
          className="tx-sidebar-toggle sp-icon-action-quiet"
          onClick={() => setSidebarCollapsed(c => !c)}
          aria-label={sidebarCollapsed ? 'Show sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3l4 3-4 3" /></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 6l4 3" /></svg>}
        </button>

        {!sidebarCollapsed && (
          <>
            <ActiveNotePanel
              item={(() => {
                if (selectedIds.size !== 1) return null;
                const id = [...selectedIds][0];
                const it = items.find(i => i.id === id);
                return it && it.kind === 'note' ? it : null;
              })()}
              selectionCount={selectedIds.size}
              onClear={() => setSelectedIds(new Set())}
              flexBasis={stagedItems.length > 0 ? `${sidebarSplitPct}%` : '100%'}
            />
            {stagedItems.length > 0 && (
              <>
                <div
                  className="tx-side-divider"
                  onPointerDown={onDividerMouseDown}
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize active note panel"
                  title="Drag to resize"
                />
                <TrayPanel
                  items={stagedItems}
                  onPlaceAll={placeAllStaged}
                  onRemove={removeItem}
                  onCardMouseDown={startTrayDrag}
                  draggingId={trayDrag?.itemId}
                />
              </>
            )}
          </>
        )}
        {sidebarCollapsed && stagedItems.length > 0 && (
          <span className="tx-sidebar-collapsed-count" aria-hidden="true">{stagedItems.length}</span>
        )}
      </aside>

      <div
        ref={stageRef}
        className="tx-stage"
        onPointerDown={onStageMouseDown}
        onContextMenu={onStageContextMenu}
        style={printState ? { width: `${printState.w}px`, height: `${printState.h}px`, flex: '0 0 auto' } : undefined}
      >
        <div
          className="tx-stage-grid"
          style={{
            transform: printState
              ? printState.transform
              : `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {placedItems.length === 0 && stagedItems.length === 0 && (
            <CanvasEmptyHint onAdd={() => setShowPicker(true)} />
          )}
          {placedItems
            .slice()
            .sort((a, b) => {
              // Frames render below everything else (they're containers,
              // their items sit on top).  Within each tier, respect z_index.
              const af = a.kind === 'frame' ? 0 : 1;
              const bf = b.kind === 'frame' ? 0 : 1;
              if (af !== bf) return af - bf;
              return (a.z_index || 0) - (b.z_index || 0);
            })
            .map(item => (
              <TabletopItemEl
                key={item.id}
                item={item}
                items={placedItems}
                isEditing={editingItemId === item.id}
                isActive={selectedIds.has(item.id)}
                onPointerDown={onItemMouseDown}
                onRemove={removeItem}
                onStartEdit={() => setEditingItemId(item.id)}
                onCommitEdit={(body) => commitInlineEdit(item.id, body)}
              />
            ))}

          {/* Anchor hover dots — visible only while dragging an arrow
              endpoint over a target item.  The active side glows to
              show which edge will be selected on release. */}
          {arrowDropTarget && (() => {
            const target = items.find(i => i.id === arrowDropTarget.itemId);
            if (!target || target.kind === 'arrow') return null;
            const sides = ['n','e','s','w'];
            return sides.map(side => {
              const p = itemAnchorPoint(target, side);
              if (!p) return null;
              return (
                <div
                  key={side}
                  className={`tx-anchor-dot is-${side} ${arrowDropTarget.side === side ? 'is-active' : ''}`}
                  style={{ left: p.cx, top: p.cy }}
                  aria-hidden="true"
                />
              );
            });
          })()}

          {/* Box-select marquee while shift+drag is in progress. */}
          {boxSelect && (
            <div
              className="tx-box-select"
              style={{
                left:  Math.min(boxSelect.x1, boxSelect.x2),
                top:   Math.min(boxSelect.y1, boxSelect.y2),
                width:  Math.abs(boxSelect.x2 - boxSelect.x1),
                height: Math.abs(boxSelect.y2 - boxSelect.y1),
              }}
              aria-hidden="true"
            />
          )}

          {/* Single midpoint dot — visible while a text label is dragged
              over an arrow.  Shows the exact center where the label
              will land on release. */}
          {textDragOverArrowId && (() => {
            const arrow = items.find(i => i.id === textDragOverArrowId);
            if (!arrow || arrow.kind !== 'arrow') return null;
            const mid = arrowMidpoint(arrow, items);
            if (!mid) return null;
            return (
              <div
                className="tx-anchor-dot is-active tx-anchor-dot-mid"
                style={{ left: mid.cx, top: mid.cy }}
                aria-hidden="true"
              />
            );
          })()}
        </div>

        <div className="tx-stage-help" aria-hidden="true">
          Drag or two-finger pan · Pinch or ⌘+scroll to zoom · Shift+drag to box-select · Right-click or long-press for menu · Alt to bypass snap
        </div>
      </div>

      </div>

      {trayDrag?.started && (
        <TrayDragGhost
          item={items.find(i => i.id === trayDrag.itemId)}
          x={trayDrag.x}
          y={trayDrag.y}
        />
      )}

      {showPicker && (
        <NotePickerModal
          excludeIds={items.filter(i => i.kind === 'note').map(i => i.item_id)}
          onClose={() => setShowPicker(false)}
          onAdd={addNotesBulk}
        />
      )}

      {showEditModal && (
        <EditTabletopModal
          tabletop={tabletop}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setTabletop(prev => ({ ...prev, ...updated }));
            setShowEditModal(false);
          }}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          {(() => {
            const close = () => setContextMenu(null);
            const it = contextMenu.item;
            if (!it) {
              return [
                { label: 'Add header here',  onClick: () => { addDecorationAt('header', contextMenu.worldX, contextMenu.worldY); close(); } },
                { label: 'Add text here',    onClick: () => { addDecorationAt('text',   contextMenu.worldX, contextMenu.worldY); close(); } },
                { label: 'Add arrow here',   onClick: () => { addDecorationAt('arrow',  contextMenu.worldX, contextMenu.worldY); close(); } },
                { label: 'Add frame here',   onClick: () => { addDecorationAt('frame',  contextMenu.worldX, contextMenu.worldY); close(); } },
              ];
            }
            const out = [];
            if (it.kind === 'arrow') {
              if (it.start_anchor_id) out.push({ label: 'Detach start',  onClick: () => { detachArrowEnd(it, 'start'); close(); } });
              if (it.end_anchor_id)   out.push({ label: 'Detach end',    onClick: () => { detachArrowEnd(it, 'end');   close(); } });
              out.push({ label: 'Reverse direction', onClick: () => { reverseArrow(it); close(); } });
              out.push({ divider: true });
            }
            if (it.kind === 'frame') {
              out.push({
                kind: 'colors',
                current: it.color || null,
                colors: [null, 'concept', 'source', 'person', 'warning'],
                onPick: (c) => { setItemColor(it, c); close(); },
              });
              out.push({ divider: true });
            }
            out.push({ label: 'Bring to front', onClick: () => { bringToFront(it); close(); } });
            out.push({ label: 'Send to back',   onClick: () => { sendToBack(it);   close(); } });
            out.push({ divider: true });
            out.push({ label: 'Duplicate', onClick: () => { duplicateItem(it); close(); } });
            if (it.kind === 'note') {
              out.push({ label: 'Return to tray', onClick: () => { returnToTray(it); close(); } });
            }
            out.push({ divider: true });
            out.push({ label: 'Delete', danger: true, onClick: () => { removeItem(it); close(); } });
            return out;
          })()}
        </ContextMenu>
      )}
    </div>
  );
}

// =====================================================================
// Context menu
// =====================================================================
function ContextMenu({ x, y, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDocDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  // Children is an array of { label, onClick, danger?, divider?, disabled? }
  return (
    <div ref={ref} className="tx-ctx-menu" role="menu" style={{ left: x, top: y }}>
      {children.map((it, i) => {
        if (it.divider) return <div key={`d${i}`} className="tx-ctx-divider" />;
        if (it.kind === 'colors') {
          return (
            <div key={`c${i}`} className="tx-ctx-colors">
              {it.colors.map((c, j) => (
                <button
                  key={c || 'default'}
                  type="button"
                  className={`tx-ctx-swatch ${c ? `is-${c}` : 'is-default'} ${it.current === c ? 'is-current' : ''}`}
                  title={c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Default'}
                  onClick={() => it.onPick(c)}
                />
              ))}
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            className={`tx-ctx-item ${it.danger ? 'is-danger' : ''}`}
            disabled={it.disabled}
            onClick={it.onClick}
            role="menuitem"
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// Edit-tabletop modal — name, description, and collection memberships.
// Sharing happens by linking the tabletop to a collection that's been
// shared with the desired collaborators.
// =====================================================================
function EditTabletopModal({ tabletop, onClose, onSaved }) {
  const [name, setName]               = useState(tabletop?.name || '');
  const [description, setDescription] = useState(tabletop?.description || '');
  const [collectionIds, setCollectionIds] = useState(
    () => new Set((tabletop?.collections || []).map(c => c.id))
  );
  const [allCollections, setAllCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState([]);

  useEffect(() => {
    fetch('/collections.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setAllCollections(Array.isArray(data) ? data : (data.collections || []));
        setLoadingCollections(false);
      })
      .catch(() => setLoadingCollections(false));
  }, []);

  function toggleCollection(id) {
    setCollectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const csrf = document.querySelector('[name="csrf-token"]')?.content;
      const res = await fetch(`/tabletops/${tabletop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          tabletop: {
            name,
            description,
            collection_ids: [...collectionIds],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors || ['Save failed.']);
      } else {
        onSaved(data);
      }
    } catch (err) {
      setErrors(['Save failed.  Try again.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tx-modal-backdrop" onClick={onClose}>
      <div className="tx-edit-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="tx-edit-head">
          <h2 className="tx-edit-title">Edit Tabletop</h2>
          <button type="button" className="sp-icon-action-quiet" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form className="tx-edit-body" onSubmit={submit}>
          <div className="sp-field">
            <label className="sp-label" htmlFor="tx-edit-name">Name</label>
            <input
              id="tx-edit-name"
              className="sp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="sp-field">
            <label className="sp-label" htmlFor="tx-edit-desc">Description</label>
            <textarea
              id="tx-edit-desc"
              className="sp-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this canvas for?"
            />
          </div>

          <div className="sp-field">
            <label className="sp-label">Collections</label>
            <p className="sp-help">
              Sharing happens through collections.  Add this tabletop to a collection that's been shared with collaborators to give them access.
            </p>
            <div className="tx-edit-collections">
              {loadingCollections ? (
                <p className="tx-edit-empty">Loading…</p>
              ) : allCollections.length === 0 ? (
                <p className="tx-edit-empty">
                  You haven't created any collections yet.  <a href="/collections">Create one</a> first, then come back to link.
                </p>
              ) : (
                allCollections.map(c => (
                  <label key={c.id} className="tx-edit-collection-row">
                    <input
                      type="checkbox"
                      className="sp-checkbox"
                      checked={collectionIds.has(c.id)}
                      onChange={() => toggleCollection(c.id)}
                    />
                    <span className="tx-edit-collection-name">{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {errors.length > 0 && (
            <ul className="tx-edit-errors">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}

          <div className="tx-edit-actions">
            <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="sp-action sp-action-primary" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================================
// Item rendering
// =====================================================================
function TabletopItemEl({ item, items, isEditing, isActive, onPointerDown, onRemove, onStartEdit, onCommitEdit }) {
  // Arrows are SVG, not box-shaped — render entirely separately.
  if (item.kind === 'arrow') {
    return <ArrowItem item={item} items={items} onPointerDown={onPointerDown} onRemove={onRemove} />;
  }

  const stop = (e) => e.stopPropagation();
  const handleMouseDown = (e) => {
    if (isEditing) return stop(e);
    onPointerDown(e, item.id);
  };

  // Text labels attached to an arrow's midpoint render anchored — their
  // x/y is ignored at render time in favor of the arrow's midpoint.  The
  // translate(-50%,-50%) centers the label on that point regardless of
  // the label's rendered size.
  const attachedToArrow = item.kind === 'text'
    && item.start_anchor_side === 'midpoint'
    && item.start_anchor_id
    ? items.find(i => i.id === item.start_anchor_id && i.kind === 'arrow') || null
    : null;
  let positionStyle;
  if (attachedToArrow) {
    const mid = arrowMidpoint(attachedToArrow, items);
    positionStyle = {
      left: mid.cx,
      top:  mid.cy,
      width: item.width || 220,
      transform: 'translate(-50%, -50%)' + (item.rotation ? ` rotate(${item.rotation}deg)` : ''),
      zIndex: (item.z_index || 0) + 1,
    };
  } else {
    positionStyle = {
      left: item.x,
      top: item.y,
      width: item.width || (item.kind === 'note' ? NOTE_W : item.kind === 'frame' ? 480 : undefined),
      height: item.height || (item.kind === 'frame' ? 320 : undefined),
      transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
      zIndex: item.z_index || 0,
    };
  }

  return (
    <div
      data-tabletop-item-id={item.id}
      className={`tx-item tx-item-${item.kind} ${isEditing ? 'is-editing' : ''} ${isActive ? 'is-active' : ''} ${attachedToArrow ? 'is-attached-arrow' : ''} ${item.color ? `is-color-${item.color}` : ''}`}
      style={positionStyle}
      onPointerDown={handleMouseDown}
      onDoubleClick={(item.kind === 'header' || item.kind === 'text') ? onStartEdit : undefined}
    >
      {item.kind === 'note'   && <NoteItemBody   data={item.item_data} />}
      {item.kind === 'header' && <HeaderItemBody item={item} isEditing={isEditing} onCommit={onCommitEdit} />}
      {item.kind === 'text'   && <TextItemBody   item={item} isEditing={isEditing} onCommit={onCommitEdit} />}
      {/* frame: just a box — no label */}

      <button
        type="button"
        className="tx-item-remove sp-icon-action-quiet"
        onClick={(e) => { stop(e); onRemove(item); }}
        onPointerDown={stop}
        aria-label="Remove from tabletop"
        title="Remove"
      >
        ×
      </button>

      <div
        className="tx-resize-handle"
        onPointerDown={(e) => onPointerDown(e, item.id, 'resize-e')}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize width"
        title="Drag to resize width"
      />
      <div
        className="tx-resize-handle tx-resize-handle-se"
        onPointerDown={(e) => onPointerDown(e, item.id, 'resize-se')}
        role="separator"
        aria-label="Resize"
        title="Drag to resize width and height"
      />
    </div>
  );
}

// =====================================================================
// Active-note panel — top of the left sidebar.  When the user clicks a
// placed note on the canvas, the canvas card gets a navy outline and
// this panel renders the note's full content readably (regardless of
// how small the card is on the canvas).
// =====================================================================
function ActiveNotePanel({ item, selectionCount, onClear, flexBasis }) {
  const showMulti = !item && selectionCount > 1;
  return (
    <section className="tx-side-active" style={{ flex: `0 0 ${flexBasis}` }}>
      <header className="tx-side-head">
        <span className="tx-side-eyebrow">Active Note</span>
        {(item || selectionCount > 0) && (
          <button type="button" className="tx-side-clear" onClick={onClear} title="Clear selection">Clear</button>
        )}
      </header>
      <div className="tx-side-active-body">
        {item ? <ActiveNoteView item={item} />
          : showMulti
            ? <div className="tx-side-empty"><p className="tx-side-empty-text">{selectionCount} items selected — drag any to move them all together.</p></div>
            : <ActiveNoteEmpty />}
      </div>
    </section>
  );
}

function ActiveNoteEmpty() {
  return (
    <div className="tx-side-empty">
      <p className="tx-side-empty-text">
        Click a note on the canvas to read its full content here.  Click empty space to clear.
      </p>
    </div>
  );
}

function ActiveNoteView({ item }) {
  const data = item.item_data || {};
  const type = data.note_type || item.kind || 'note';
  return (
    <article className="tx-side-note">
      <div className="tx-side-note-eyebrow">{labelFor(type)}</div>
      {data.title && <h3 className="tx-side-note-title">{data.title}</h3>}
      {data.quote_text && (
        <div className="tx-side-note-quote">
          <span className="tx-side-note-quote-glyph" aria-hidden="true">"</span>
          <span className="tx-side-note-quote-text">{data.quote_text}</span>
          {data.page_number && (
            data.source ? (
              <a
                href={`/sources/${data.source.id}/study?page=${data.page_number}`}
                className="tx-side-note-page-link"
                title={`Open source at page ${data.page_number}`}
              >Page {data.page_number} ↗</a>
            ) : (
              <span className="tx-side-note-page">Page {data.page_number}</span>
            )
          )}
        </div>
      )}
      {data.body && (
        <div className="tx-side-note-body" dangerouslySetInnerHTML={{ __html: data.body }} />
      )}
      {data.context && (
        <div className="tx-side-note-context">
          <span className="tx-side-note-context-label">Context</span>
          <span>{data.context}</span>
        </div>
      )}
      <div className="tx-side-note-chips">
        {data.source && (
          <a href={`/sources/${data.source.id}`} className="sp-chip is-source tx-side-chip">{data.source.title}</a>
        )}
        {data.concepts?.map(c => (
          <a key={`c-${c.id}`} href={`/concepts/${c.id}`} className="sp-chip is-concept tx-side-chip">{c.label}</a>
        ))}
        {data.people?.map(p => (
          <a key={`p-${p.id}`} href={`/people/${p.id}`} className="sp-chip is-person tx-side-chip">{p.full_name}</a>
        ))}
        {data.tags?.map(t => {
          const name = typeof t === 'string' ? t : t?.name;
          return name && <span key={`t-${name}`} className="sp-chip is-neutral tx-side-chip">#{name}</span>;
        })}
      </div>
      {(data.noted_on || data.created_at) && (
        <div className="tx-side-note-date">
          {new Date(data.noted_on || data.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      )}
    </article>
  );
}

// =====================================================================
// Tray panel — bottom of the left sidebar.  Click-and-drag a card onto
// the canvas to place it; click without dragging places at the viewport
// center; "Place all" lays everything out in a grid below the placed
// cluster.
// =====================================================================
function TrayPanel({ items, onPlaceAll, onRemove, onCardMouseDown, draggingId }) {
  return (
    <section className="tx-side-tray">
      <header className="tx-side-head">
        <span className="tx-side-eyebrow">Notes To Place</span>
        <span className="tx-side-tray-count">{items.length}</span>
        {items.length > 1 && (
          <button type="button" className="tx-side-tray-place-all" onClick={onPlaceAll}>Place all</button>
        )}
      </header>
      <p className="tx-side-tray-hint">Drag onto the canvas to place, or click to drop at center.</p>
      <div className="tx-side-tray-list">
        {items.map(it => (
          <TrayCard
            key={it.id}
            item={it}
            isDragging={draggingId === it.id}
            onPointerDown={(e) => onCardMouseDown(e, it.id)}
            onRemove={() => onRemove(it)}
          />
        ))}
      </div>
    </section>
  );
}

function TrayCard({ item, isDragging, onPointerDown, onRemove }) {
  const data = item.item_data || {};
  const type = data.note_type || item.kind || 'note';
  const stop = (e) => e.stopPropagation();
  const excerpt = !data.title && data.body
    ? plainText(data.body).slice(0, 120)
    : (data.quote_text ? `"${data.quote_text.slice(0, 120)}"` : '');

  return (
    <div
      className={`tx-tray-card ${isDragging ? 'is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      role="button"
      tabIndex={0}
      title="Drag onto canvas, or click to drop at center"
    >
      <span className="tx-tray-card-eyebrow">{labelFor(type)}</span>
      {data.title && <span className="tx-tray-card-title">{data.title}</span>}
      {!data.title && excerpt && <span className="tx-tray-card-excerpt">{excerpt}</span>}
      {data.source && <span className="tx-tray-card-source">{data.source.title}</span>}
      <button
        type="button"
        className="tx-tray-card-remove sp-icon-action-quiet"
        onClick={(e) => { stop(e); onRemove(); }}
        onPointerDown={stop}
        aria-label="Remove from tabletop"
        title="Remove"
      >×</button>
    </div>
  );
}

// Floating ghost that follows the cursor while dragging from the tray.
function TrayDragGhost({ item, x, y }) {
  if (!item) return null;
  const data = item.item_data || {};
  return (
    <div
      className="tx-tray-ghost"
      style={{ left: x + 8, top: y + 8 }}
      aria-hidden="true"
    >
      <span className="tx-tray-card-eyebrow">{labelFor(data.note_type || 'note')}</span>
      <span className="tx-tray-card-title">{data.title || (data.body ? plainText(data.body).slice(0, 60) : '(empty)')}</span>
    </div>
  );
}

// ----- Header -----
function HeaderItemBody({ item, isEditing, onCommit }) {
  const [draft, setDraft] = useState(item.body || '');
  useEffect(() => { if (isEditing) setDraft(item.body || ''); }, [isEditing, item.body]);
  if (isEditing) {
    return (
      <input
        autoFocus
        type="text"
        className="tx-header-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  e.target.blur();
          if (e.key === 'Escape') { setDraft(item.body || ''); e.target.blur(); }
        }}
        placeholder="Header"
      />
    );
  }
  return (
    <h3 className={`tx-header-text ${(!item.body || !item.body.trim()) ? 'is-placeholder' : ''}`}>
      {item.body && item.body.trim() ? item.body : 'Header'}
    </h3>
  );
}

// ----- Text label / sticky -----
function TextItemBody({ item, isEditing, onCommit }) {
  const [draft, setDraft] = useState(item.body || '');
  useEffect(() => { if (isEditing) setDraft(item.body || ''); }, [isEditing, item.body]);
  if (isEditing) {
    return (
      <textarea
        autoFocus
        className="tx-text-input"
        value={draft}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft.trim())}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || e.key === 'Escape') {
            if (e.key === 'Escape') setDraft(item.body || '');
            e.target.blur();
          }
        }}
        placeholder="Type a note."
      />
    );
  }
  return (
    <div className={`tx-text-display ${(!item.body || !item.body.trim()) ? 'is-placeholder' : ''}`}>
      {item.body && item.body.trim() ? item.body : 'Type a note.'}
    </div>
  );
}

// ----- Frame -----
// A translucent rectangle that contains other items.  Dragging the frame
// body brings every item whose center is inside the frame's bbox along
// for the ride.  The label is inline-editable on double-click.
function FrameItemBody({ item, isEditing, onCommit }) {
  const [draft, setDraft] = useState(item.body || '');
  useEffect(() => { if (isEditing) setDraft(item.body || ''); }, [isEditing, item.body]);
  return (
    <div className="tx-frame-label-bar">
      {isEditing ? (
        <input
          autoFocus
          type="text"
          className="tx-frame-label-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit(draft.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  e.target.blur();
            if (e.key === 'Escape') { setDraft(item.body || ''); e.target.blur(); }
          }}
          placeholder="Frame label"
        />
      ) : (
        <span className={`tx-frame-label ${(!item.body || !item.body.trim()) ? 'is-placeholder' : ''}`}>
          {item.body && item.body.trim() ? item.body : 'Frame'}
        </span>
      )}
    </div>
  );
}

// ----- Arrow -----
// Rendered as SVG positioned at (0,0) in world coords with overflow visible.
// Endpoints are absolute world coords; line + arrowhead + two grip handles.
function ArrowItem({ item, items, onPointerDown, onRemove }) {
  const stop = (e) => e.stopPropagation();
  // Resolve endpoints — anchored ones track an edge midpoint of their
  // target item.  When the item moves or resizes, the arrow follows.
  const startA = item.start_anchor_id ? items.find(i => i.id === item.start_anchor_id) : null;
  const endA   = item.end_anchor_id   ? items.find(i => i.id === item.end_anchor_id)   : null;
  const startC = startA ? itemAnchorPoint(startA, item.start_anchor_side || 'center') : null;
  const endC   = endA   ? itemAnchorPoint(endA,   item.end_anchor_side   || 'center') : null;
  const sx = startC ? startC.cx : (item.start_x || 0);
  const sy = startC ? startC.cy : (item.start_y || 0);
  const ex = endC   ? endC.cx   : (item.end_x   || 0);
  const ey = endC   ? endC.cy   : (item.end_y   || 0);
  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;

  return (
    <svg
      data-tabletop-item-id={item.id}
      className="tx-arrow"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: item.z_index || 0,
      }}
    >
      <defs>
        <marker
          id={`arrow-${item.id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="strokeWidth"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>

      {/* Wide invisible hit-target for body drag */}
      <line
        x1={sx} y1={sy} x2={ex} y2={ey}
        stroke="transparent"
        strokeWidth="14"
        style={{ pointerEvents: 'stroke', cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, item.id, 'body')}
      />
      {/* Visible line + arrowhead */}
      <line
        x1={sx} y1={sy} x2={ex} y2={ey}
        className="tx-arrow-line"
        markerEnd={`url(#arrow-${item.id})`}
        style={{ pointerEvents: 'none' }}
      />

      {/* Endpoint handles */}
      <circle
        cx={sx} cy={sy} r="6"
        className="tx-arrow-handle"
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, item.id, 'start')}
      />
      <circle
        cx={ex} cy={ey} r="6"
        className="tx-arrow-handle"
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onPointerDown={(e) => onPointerDown(e, item.id, 'end')}
      />

      {/* Remove button at midpoint, hover-revealed */}
      <foreignObject x={midX - 11} y={midY - 11} width="22" height="22" style={{ pointerEvents: 'all' }}>
        <button
          type="button"
          className="tx-arrow-remove sp-icon-action-quiet"
          onClick={(e) => { stop(e); onRemove(item); }}
          onPointerDown={stop}
          aria-label="Delete arrow"
          title="Delete"
        >×</button>
      </foreignObject>
    </svg>
  );
}

function NoteItemBody({ data }) {
  if (!data) return <div className="tx-item-missing">Note unavailable</div>;
  const type = data.note_type || 'note';
  return (
    <>
      <div className="tx-note-eyebrow">{labelFor(type)}</div>
      {data.title && <h3 className="tx-note-title">{data.title}</h3>}
      {data.quote_text && (
        <div className="tx-note-quote">
          <span className="tx-note-quote-glyph">"</span>
          <span className="tx-note-quote-text">{data.quote_text}</span>
        </div>
      )}
      {data.body && (
        <div className="tx-note-body" dangerouslySetInnerHTML={{ __html: data.body }} />
      )}
      <div className="tx-note-meta">
        {data.source && <span className="sp-chip is-source">{data.source.title}</span>}
        {data.concepts?.slice(0, 2).map(c => (
          <span key={`c-${c.id}`} className="sp-chip is-concept">{c.label}</span>
        ))}
        {data.people?.slice(0, 2).map(p => (
          <span key={`p-${p.id}`} className="sp-chip is-person">{p.full_name}</span>
        ))}
      </div>
    </>
  );
}

function labelFor(type) {
  return ({
    note: 'Note', question: 'Question', synthesis: 'Synthesis',
    connection: 'Connection', todo: 'To Do', highlight: 'Highlight'
  })[type] || 'Note';
}

// =====================================================================
// Add-notes picker — sidebar facets + card grid + multi-select
// =====================================================================
function NotePickerModal({ excludeIds, onClose, onAdd }) {
  const [notes, setNotes]                 = useState([]);
  const [allConcepts, setAllConcepts]     = useState([]);
  const [allSources, setAllSources]       = useState([]);
  const [allTags, setAllTags]             = useState([]);
  const [allCollections, setAllCollections] = useState([]);
  const [loading, setLoading]             = useState(true);

  // Filter state
  const [q, setQ] = useState('');
  const [conceptIds,    setConceptIds]    = useState([]);
  const [sourceIds,     setSourceIds]     = useState([]);
  const [tagsFilter,    setTagsFilter]    = useState([]);
  const [collectionIds, setCollectionIds] = useState([]);

  // Selection
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Expand toggle — when on, cards render full title/quote/body without clamps.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [notesRes, conceptsRes, sourcesRes, tagsRes, collectionsRes] = await Promise.all([
          fetch('/notes.json'),
          fetch('/concepts.json'),
          fetch('/sources.json?per_page=10000'),
          fetch('/tags.json'),
          fetch('/collections.json'),
        ]);
        const [notesData, conceptsData, sourcesData, tagsData, collectionsData] = await Promise.all([
          notesRes.json(), conceptsRes.json(), sourcesRes.json(), tagsRes.json(), collectionsRes.json(),
        ]);
        setNotes(Array.isArray(notesData) ? notesData : []);
        setAllConcepts(Array.isArray(conceptsData) ? conceptsData : []);
        setAllSources(Array.isArray(sourcesData) ? sourcesData : (sourcesData.sources || []));
        setAllTags(Array.isArray(tagsData) ? tagsData : []);
        setAllCollections(Array.isArray(collectionsData) ? collectionsData : (collectionsData.collections || []));
      } catch (err) { console.error('Picker load failed', err); }
      finally { setLoading(false); }
    })();
  }, []);

  const exclude = useMemo(() => new Set(excludeIds || []), [excludeIds]);

  // Facet meta — counts among notes that aren't already on the tabletop.
  const meta = useMemo(() => {
    const cm = new Map(), sm = new Map(), tm = new Map(), com = new Map();
    notes.forEach(n => {
      if (exclude.has(n.id)) return;
      n.concepts?.forEach(c => cm.set(c.id, (cm.get(c.id) || 0) + 1));
      if (n.source) sm.set(n.source.id, (sm.get(n.source.id) || 0) + 1);
      n.tags?.forEach(t => {
        const name = typeof t === 'string' ? t : t?.name;
        if (name) tm.set(name, (tm.get(name) || 0) + 1);
      });
      n.collections?.forEach(c => com.set(c.id, (com.get(c.id) || 0) + 1));
    });
    const byCount = (a, b) => b.count - a.count || (a.label || '').localeCompare(b.label || '');
    return {
      concepts:    allConcepts.filter(c => cm.has(c.id)).map(c => ({ id: c.id, label: c.label, count: cm.get(c.id) })).sort(byCount),
      sources:     allSources.filter(s => sm.has(s.id)).map(s => ({ id: s.id, label: s.title, count: sm.get(s.id) })).sort(byCount),
      tags:        [...tm.entries()].map(([name, count]) => ({ id: name, label: name, count })).sort(byCount),
      collections: allCollections.filter(c => com.has(c.id)).map(c => ({ id: c.id, label: c.name, count: com.get(c.id) })).sort(byCount),
    };
  }, [notes, exclude, allConcepts, allSources, allCollections]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes.filter(n => {
      if (exclude.has(n.id)) return false;
      if (conceptIds.length    && !n.concepts?.some(c => conceptIds.includes(c.id)))             return false;
      if (sourceIds.length     && !(n.source && sourceIds.includes(n.source.id)))                return false;
      if (tagsFilter.length    && !n.tags?.some(t => tagsFilter.includes(typeof t === 'string' ? t : t?.name))) return false;
      if (collectionIds.length && !n.collections?.some(c => collectionIds.includes(c.id)))       return false;
      if (needle) {
        const hay = `${n.title || ''} ${plainText(n.body || '')} ${n.context || ''} ${n.quote_text || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [notes, exclude, q, conceptIds, sourceIds, tagsFilter, collectionIds]);

  const activeFilterCount = conceptIds.length + sourceIds.length + tagsFilter.length + collectionIds.length;
  const hasFilters = activeFilterCount > 0 || !!q.trim();

  function clearAll() {
    setQ(''); setConceptIds([]); setSourceIds([]); setTagsFilter([]); setCollectionIds([]);
  }

  function toggleSelect(noteId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId); else next.add(noteId);
      return next;
    });
  }
  function selectAllVisible() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filtered.forEach(n => next.add(n.id));
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  function commitAdd() {
    if (selectedIds.size === 0) return;
    const order = filtered.filter(n => selectedIds.has(n.id));
    onAdd(order);
  }

  return (
    <div className="tx-modal-backdrop" onClick={onClose}>
      <div className="tx-pick2" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="tx-pick2-head">
          <div>
            <h2 className="tx-pick2-title">Add Notes to Tabletop</h2>
            <p className="tx-pick2-sub">
              {loading
                ? 'Loading.'
                : `${filtered.length.toLocaleString()} of ${notes.length - exclude.size} note${(notes.length - exclude.size) === 1 ? '' : 's'} available`}
              {hasFilters && (
                <> · <button type="button" className="tx-pick2-link" onClick={clearAll}>
                  Clear filters
                </button></>
              )}
            </p>
          </div>
          <div className="tx-pick2-head-actions">
            <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="sp-action sp-action-primary"
              onClick={commitAdd}
              disabled={selectedIds.size === 0}
            >
              {selectedIds.size === 0 ? 'Add Notes' : `Add ${selectedIds.size} ${selectedIds.size === 1 ? 'Note' : 'Notes'}`}
            </button>
          </div>
        </header>

        <div className="tx-pick2-body">
          <aside className="tx-pick2-sidebar">
            <PickFacet
              label="Concepts"
              accent="concept"
              items={meta.concepts}
              selected={conceptIds}
              onToggle={(id) => setConceptIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              noun="concepts"
            />
            <PickFacet
              label="Sources"
              accent="source"
              items={meta.sources}
              selected={sourceIds}
              onToggle={(id) => setSourceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              noun="sources"
            />
            <PickFacet
              label="Tags"
              items={meta.tags}
              selected={tagsFilter}
              onToggle={(id) => setTagsFilter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              noun="tags"
            />
            <PickFacet
              label="Collections"
              items={meta.collections}
              selected={collectionIds}
              onToggle={(id) => setCollectionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              noun="collections"
            />
          </aside>

          <main className="tx-pick2-main">
            <div className="tx-pick2-toolbar">
              <input
                autoFocus
                type="text"
                className="tx-pick2-search"
                placeholder="Search title, body, context, quote."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                type="button"
                className={`tx-pick2-expand ${expanded ? 'is-on' : ''}`}
                onClick={() => setExpanded(e => !e)}
                title={expanded ? 'Collapse all' : 'Expand all to read full content'}
                aria-pressed={expanded}
              >
                {expanded ? 'Collapse' : 'Expand'}
              </button>
              <div className="tx-pick2-bulk">
                {selectedIds.size > 0 ? (
                  <>
                    <span className="tx-pick2-bulk-count">
                      {selectedIds.size} selected
                    </span>
                    <button type="button" className="tx-pick2-link" onClick={clearSelection}>Clear</button>
                  </>
                ) : filtered.length > 0 ? (
                  <button type="button" className="tx-pick2-link" onClick={selectAllVisible}>
                    Select all {filtered.length}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="tx-pick2-grid">
              {loading ? (
                <div className="tx-pick2-empty">Loading.</div>
              ) : filtered.length === 0 ? (
                <div className="tx-pick2-empty">
                  {notes.length === exclude.size
                    ? 'Every note is already on this tabletop.'
                    : hasFilters ? 'No notes match these filters.' : 'No notes yet.'}
                </div>
              ) : filtered.map(n => (
                <NotePickCard
                  key={n.id}
                  note={n}
                  selected={selectedIds.has(n.id)}
                  onToggle={() => toggleSelect(n.id)}
                  query={q.trim()}
                  expanded={expanded}
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ----- Picker subcomponents -----
// Always renders the section (even empty) so the user sees the four filter
// rails consistently.  Search box appears as soon as there's anything to
// search through (>4 items) — sources/concepts/etc. all get the same affordance.
function PickFacet({ label, accent, items, selected, onToggle, noun }) {
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState('');
  const list = items || [];
  const showSearch = list.length > 4;
  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const n = q.toLowerCase();
    return list.filter(i => String(i.label || '').toLowerCase().includes(n));
  }, [list, q]);
  const display = useMemo(() => {
    const sel = list.filter(i => selected.includes(i.id) && !filtered.find(f => f.id === i.id));
    return [...sel, ...filtered].slice(0, 60);
  }, [list, filtered, selected]);

  return (
    <div className="tx-pick2-fs">
      <button type="button" className="tx-pick2-fs-head" onClick={() => setOpen(o => !o)}>
        {accent && <span className={`tx-pick2-fs-dot is-${accent}`} aria-hidden="true" />}
        <span className="tx-pick2-fs-label">{label}</span>
        <span className="tx-pick2-fs-caret" aria-hidden="true" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5l3 3 3-3" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="tx-pick2-fs-body">
          {showSearch && (
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${list.length} ${noun}`}
              className="tx-pick2-fs-search"
            />
          )}
          <div className="tx-pick2-fs-list">
            {list.length === 0 ? (
              <p className="tx-pick2-fs-empty">No matching {noun}.</p>
            ) : display.length === 0 ? (
              <p className="tx-pick2-fs-empty">No {noun} match "{q}".</p>
            ) : display.map(item => (
              <label key={item.id} className="tx-pick2-fs-row">
                <input type="checkbox" className="sp-checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
                <span className="tx-pick2-fs-row-label">{item.label}</span>
                <span className="tx-pick2-fs-row-count">{item.count}</span>
              </label>
            ))}
            {filtered.length > 60 && <p className="tx-pick2-fs-note">First 60.  Refine search.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function NotePickCard({ note, selected, onToggle, query, expanded }) {
  const type = note.note_type || 'note';
  // When expanded, render the body as actual HTML (so list/blockquote/etc.
  // formatting is preserved) instead of a flat plain-text excerpt.
  const bodyHtml = useMemo(() => expanded ? highlightHtmlSafe(note.body || '', query) : null, [expanded, note.body, query]);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`tx-pick2-card ${selected ? 'is-selected' : ''} ${expanded ? 'is-expanded' : ''}`}
      aria-pressed={selected}
    >
      <span className="tx-pick2-check" aria-hidden="true">
        {selected && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" />
          </svg>
        )}
      </span>
      <div className="tx-pick2-card-body">
        <div className="tx-pick2-card-eyebrow">{labelFor(type)}</div>
        {note.title && <h3 className="tx-pick2-card-title">{highlightText(note.title, query)}</h3>}
        {note.quote_text && (
          <div className="tx-pick2-card-quote">
            <span className="tx-pick2-card-quote-glyph">"</span>
            <span className="tx-pick2-card-quote-text">{highlightText(note.quote_text, query)}</span>
            {note.page_number && <span className="tx-pick2-card-quote-page">p. {note.page_number}</span>}
          </div>
        )}
        {expanded && note.body ? (
          <div
            className="tx-pick2-card-html"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : note.body && !note.title ? (
          <div className="tx-pick2-card-excerpt">{highlightText(plainText(note.body).slice(0, 160), query)}</div>
        ) : null}
        {expanded && note.context && (
          <div className="tx-pick2-card-context">
            <span className="tx-pick2-card-context-label">Context</span> {note.context}
          </div>
        )}
        <div className="tx-pick2-card-chips">
          {note.source && <span className="sp-chip is-source tx-pick2-chip">{note.source.title}</span>}
          {note.concepts?.slice(0, expanded ? 12 : 2).map(c => (
            <span key={`c-${c.id}`} className="sp-chip is-concept tx-pick2-chip">{c.label}</span>
          ))}
          {note.people?.slice(0, expanded ? 12 : 1).map(p => (
            <span key={`p-${p.id}`} className="sp-chip is-person tx-pick2-chip">{p.full_name}</span>
          ))}
          {expanded && note.tags?.map(t => {
            const name = typeof t === 'string' ? t : t?.name;
            return name && <span key={`t-${name}`} className="sp-chip is-neutral tx-pick2-chip">#{name}</span>;
          })}
        </div>
      </div>
    </button>
  );
}

// HTML-aware highlight — walks text nodes only so existing tags survive.
function highlightHtmlSafe(html, query) {
  if (!html) return '';
  const q = (query || '').trim();
  if (!q || typeof document === 'undefined') return html;
  const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const walk = (node) => {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      const span = document.createElement('span');
      const safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(re, '<mark class="tx-pick2-mark">$1</mark>');
      span.innerHTML = safe;
      const parent = node.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, node);
      parent.removeChild(node);
    } else if (node.nodeType === 1 && node.nodeName !== 'MARK') {
      Array.from(node.childNodes).forEach(walk);
    }
  };
  Array.from(tmp.childNodes).forEach(walk);
  return tmp.innerHTML;
}

// Highlight matched substrings in plain text — mirrors the helper in NotesIndex.
function highlightText(text, query) {
  if (!text || !query) return text;
  const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  return String(text).split(re).map((part, i) =>
    i % 2 === 1 ? <mark key={i} className="tx-pick2-mark">{part}</mark> : part
  );
}

function plainText(html) {
  if (!html) return '';
  if (typeof document === 'undefined') return String(html).replace(/<[^>]*>/g, ' ');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').trim();
}

// =====================================================================
// Empty stage hint
// =====================================================================
function CanvasEmptyHint({ onAdd }) {
  return (
    <div className="tx-empty-hint">
      <h3 className="tx-empty-hint-title">Empty tabletop</h3>
      <p className="tx-empty-hint-text">Pull a note onto the canvas to start arranging.</p>
      <button type="button" className="sp-action sp-action-primary" onClick={onAdd}>+ Add a Note</button>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l8 8 M12 4l-8 8" />
    </svg>
  );
}
function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6V2.5h8V6 M3 6h10v5h-2v3H5v-3H3V6z M5 9h6" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 2.5l2 2-7.5 7.5-2.5.5.5-2.5 7.5-7.5z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}
function ToolHeaderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M3.5 3v10 M9.5 3v10 M3.5 8h6" />
    </svg>
  );
}
function ToolTextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M3 4h10 M3 8h7 M3 12h9" />
    </svg>
  );
}
function ToolArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12L13 4 M9 4h4v4" />
    </svg>
  );
}
function ToolFrameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1" strokeDasharray="2 1.5" />
    </svg>
  );
}

// =====================================================================
// Styles
// =====================================================================
function TxShowStyles() {
  return (
    <style>{`
      .tx-show {
        background: var(--paper-soft);
        height: calc(100vh - 64px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      /* Overlay mode — TabletopShow renders inside a fixed full-viewport
         host on /notes; expand to fill it and lose the global-nav offset. */
      .tx-show.is-embedded { height: 100%; }
      .tx-print-btn { padding-left: 10px; padding-right: 12px; }
      .tx-print-btn svg { margin-right: 4px; }

      /* ============ PRINT ============
         handlePrint() temporarily moves .tx-show.is-printing to be a
         direct child of <body> so we can hide everything else with a
         single rule that never touches the tabletop's descendants.
         Crucially, this means the author-set display values inside the
         tabletop (chip inline-block, meta flex-wrap, item absolute
         positioning, etc.) survive — so truncation, wrapping, and the
         fit-to-page transform all work exactly the way they look on
         screen.  The fit-to-page transform itself comes from React
         state and lands as inline style on the grid + stage. */
      @media print {
        /* margin: 0 suppresses the browser's auto-injected URL / page#
           strip — we paint our own gutter inside the stage. */
        @page { size: landscape; margin: 0; }

        html, body {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Hide every direct body child except the relocated tabletop. */
        body.is-printing-tabletop > *:not(.tx-show.is-printing) {
          display: none !important;
        }

        .tx-show.is-printing {
          background: white !important;
          height: auto !important;
          min-height: 0 !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* Strip interaction chrome from the canvas. */
        .tx-show.is-printing .tx-show-bar,
        .tx-show.is-printing .tx-stage-help,
        .tx-show.is-printing .tx-item-remove,
        .tx-show.is-printing .tx-arrow-remove,
        .tx-show.is-printing .tx-arrow-handle,
        .tx-show.is-printing .tx-resize-handle,
        .tx-show.is-printing .tx-sidebar,
        .tx-show.is-printing .tx-box-select,
        .tx-show.is-printing .tx-anchor-dot,
        .tx-ctx-menu,
        .tx-show.is-printing .nx-card-actions {
          display: none !important;
        }
        .tx-show.is-printing .tx-stage {
          background: white !important;
          background-image: none !important;
          overflow: hidden !important;
          margin: 0 auto !important;
          cursor: default !important;
          flex: 0 0 auto !important;
        }
        .tx-show.is-printing .tx-item {
          box-shadow: none !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
      .tx-show-loading,
      .tx-show-error {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--sans);
        color: var(--ink-3);
      }
      .tx-show-error { color: var(--error); }

      /* ============ TOP BAR ============ */
      .tx-show-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 18px;
        background: var(--paper);
        border-bottom: 1px solid var(--ink-line);
        flex-shrink: 0;
        z-index: 5;
      }
      .tx-show-bar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .tx-show-back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        color: var(--ink-2);
        text-decoration: none;
        flex-shrink: 0;
      }
      .tx-show-back:hover { background: var(--hover); color: var(--ink); }
      .tx-show-title-block { min-width: 0; }
      .tx-show-title {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--primary);
        line-height: 1.2;
        margin: 0;
        max-width: 480px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tx-show-desc {
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink-3);
        margin: 2px 0 0;
        max-width: 480px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tx-show-bar-right { display: flex; align-items: center; gap: 10px; }

      .tx-show-edit-btn {
        width: 26px;
        height: 26px;
        flex-shrink: 0;
        margin-left: 4px;
        opacity: 0.7;
      }
      .tx-show-edit-btn:hover { opacity: 1; color: var(--primary); }

      /* ============ EDIT-TABLETOP MODAL ============ */
      .tx-edit-modal {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-lg);
        box-shadow: 0 24px 60px rgba(21, 25, 31, 0.18);
        width: 100%;
        max-width: 520px;
        max-height: 86vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .tx-edit-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px 12px;
        border-bottom: 1px solid var(--ink-line-soft);
      }
      .tx-edit-title {
        font-family: var(--serif);
        font-size: 22px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--ink);
        margin: 0;
      }
      .tx-edit-body {
        padding: 18px 22px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        overflow-y: auto;
      }
      .tx-edit-collections {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 6px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
      }
      .tx-edit-collection-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
        border-radius: var(--r-sm);
      }
      .tx-edit-collection-row:hover { background: var(--hover); color: var(--ink); }
      .tx-edit-collection-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tx-edit-empty {
        margin: 0;
        padding: 14px 8px;
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-3);
        text-align: center;
      }
      .tx-edit-empty a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
      .tx-edit-errors {
        margin: 0;
        padding: 10px 14px;
        list-style: none;
        background: rgba(122, 46, 46, 0.06);
        color: var(--error);
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 12.5px;
      }
      .tx-edit-actions { display: flex; justify-content: flex-end; gap: 8px; }

      /* Saved-state pill — sits left of the tool group, fades to "Saved"
         a beat after the last persist resolves. */
      .tx-save-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 24px;
        padding: 0 10px;
        border-radius: var(--r-pill);
        font-family: var(--mono);
        font-size: 10.5px;
        letter-spacing: 0.04em;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        color: var(--ink-3);
      }
      .tx-save-pill.is-saving { color: var(--ink-2); }
      .tx-save-pill.is-saved {
        background: var(--concept-tint);
        border-color: var(--concept);
        color: var(--concept-2);
      }
      .tx-save-pill.is-error {
        background: rgba(122, 46, 46, 0.06);
        border-color: var(--error);
        color: var(--error);
      }

      /* Body row: stage takes the rest, tray sits flush right when present. */
      .tx-body {
        flex: 1;
        display: flex;
        align-items: stretch;
        min-height: 0;
        position: relative;
      }
      .tx-body > .tx-stage { flex: 1; }

      /* ============ LEFT SIDEBAR ============
         Top half: active-note panel (full content, scrollable).
         Bottom half: staging tray (drag onto canvas to place).
         Single collapse toggle; collapsed state shows a slim rail with
         a count badge so the user still sees that there are staged
         items waiting. */
      .tx-sidebar {
        flex: 0 0 320px;
        width: 320px;
        background: var(--paper);
        border-right: 1px solid var(--ink-line);
        display: flex;
        flex-direction: column;
        min-height: 0;
        position: relative;
        z-index: 4;
      }
      .tx-sidebar.is-collapsed { flex: 0 0 38px; width: 38px; }
      .tx-sidebar-toggle {
        position: absolute;
        top: 8px;
        right: -14px;
        width: 26px;
        height: 26px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-pill);
        z-index: 3;
        box-shadow: 0 1px 2px rgba(21, 25, 31, 0.06);
      }
      .tx-sidebar-toggle:hover { color: var(--primary); border-color: var(--primary); }
      .tx-sidebar-collapsed-count {
        position: absolute;
        top: 44px;
        left: 50%;
        transform: translateX(-50%);
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--primary);
        color: var(--paper);
        border-radius: var(--r-pill);
        font-family: var(--mono);
        font-size: 10.5px;
        font-weight: 600;
      }

      .tx-side-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px 8px;
        flex-shrink: 0;
      }
      .tx-side-eyebrow {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ink-3);
        flex: 1;
      }
      .tx-side-clear {
        background: none;
        border: none;
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--ink-3);
        cursor: pointer;
        padding: 2px 6px;
        border-radius: var(--r-sm);
      }
      .tx-side-clear:hover { color: var(--ink); background: var(--hover); }

      /* Active-note panel */
      .tx-side-active {
        flex: 0 0 50%;
        display: flex;
        flex-direction: column;
        min-height: 120px;
      }

      /* Draggable divider between active panel and tray. */
      .tx-side-divider {
        flex: 0 0 7px;
        background: var(--ink-line);
        cursor: ns-resize;
        position: relative;
        transition: background 0.12s;
      }
      .tx-side-divider::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 28px;
        height: 2px;
        background: var(--ink-3);
        border-radius: 1px;
        pointer-events: none;
      }
      .tx-side-divider:hover { background: var(--paper-warm); }
      .tx-side-divider:hover::after { background: var(--primary); }
      .tx-side-active-body {
        flex: 1;
        overflow-y: auto;
        padding: 0 14px 14px;
      }
      .tx-side-empty {
        padding: 28px 12px;
        text-align: center;
      }
      .tx-side-empty-text {
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-3);
        line-height: 1.5;
        margin: 0;
      }

      .tx-side-note { display: flex; flex-direction: column; gap: 8px; }
      .tx-side-note-eyebrow {
        font-family: var(--sans);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--ink-3);
      }
      .tx-side-note-title {
        font-family: var(--serif);
        font-size: 17px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.25;
        margin: 0;
      }
      .tx-side-note-quote {
        background: var(--source-tint);
        border-left: 2px solid var(--source);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        padding: 8px 10px;
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--source-2);
        line-height: 1.5;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tx-side-note-quote-glyph {
        font-family: var(--serif);
        font-size: 16px;
        color: var(--source);
        opacity: 0.6;
        margin-right: 4px;
      }
      .tx-side-note-page,
      .tx-side-note-page-link {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--source-2);
        opacity: 0.8;
        align-self: flex-end;
      }
      .tx-side-note-page-link { text-decoration: underline; text-underline-offset: 2px; }
      .tx-side-note-page-link:hover { color: var(--source); opacity: 1; }
      .tx-side-note-body {
        font-family: var(--sans);
        font-size: 13.5px;
        color: var(--ink-2);
        line-height: 1.6;
      }
      .tx-side-note-body p { margin: 0 0 6px; }
      .tx-side-note-body p:last-child { margin: 0; }
      .tx-side-note-body ul { list-style: disc; padding-left: 18px; margin: 0 0 6px; }
      .tx-side-note-body ol { list-style: decimal; padding-left: 18px; margin: 0 0 6px; }
      .tx-side-note-body blockquote {
        margin: 0 0 6px;
        padding-left: 10px;
        border-left: 2px solid var(--ink-line);
        color: var(--ink-3);
      }
      .tx-side-note-body code {
        font-family: var(--mono);
        font-size: 12px;
        background: var(--paper-warm);
        padding: 1px 4px;
        border-radius: 2px;
      }
      .tx-side-note-body a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
      .tx-side-note-body strong { color: var(--ink); font-weight: 600; }

      .tx-side-note-context {
        display: flex;
        gap: 8px;
        align-items: baseline;
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink-3);
        line-height: 1.5;
      }
      .tx-side-note-context-label {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ink-3);
        flex-shrink: 0;
      }
      .tx-side-note-chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .tx-side-chip {
        max-width: 100%;
        display: inline-block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.5;
      }
      .tx-side-note-date {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
        margin-top: 4px;
      }

      /* Active item ring on the canvas — bigger ring so it reads at any
         zoom level even when the card is small. */
      .tx-item.is-active {
        border-color: var(--primary) !important;
        box-shadow: 0 0 0 4px var(--primary), 0 0 0 6px rgba(31, 59, 115, 0.18), var(--shadow-card);
      }

      /* Tray section — fills the remainder under the divider. */
      .tx-side-tray {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 140px;
      }
      .tx-side-tray-count {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--primary);
        font-weight: 600;
      }
      .tx-side-tray-place-all {
        background: none;
        border: none;
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--primary);
        cursor: pointer;
        padding: 2px 6px;
        border-radius: var(--r-sm);
      }
      .tx-side-tray-place-all:hover { background: var(--hover); }
      .tx-side-tray-hint {
        margin: 0 14px 6px;
        font-family: var(--sans);
        font-size: 11px;
        color: var(--ink-3);
        line-height: 1.4;
      }
      .tx-side-tray-list {
        flex: 1;
        overflow-y: auto;
        padding: 4px 10px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* Tray cards */
      .tx-tray-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--primary);
        border-radius: var(--r-sm);
        padding: 8px 28px 8px 10px;
        text-align: left;
        cursor: grab;
        font-family: var(--sans);
        transition: border-color 0.12s, box-shadow 0.12s, opacity 0.12s;
        user-select: none;
      }
      .tx-tray-card:hover {
        border-color: var(--primary);
        box-shadow: 0 1px 2px rgba(21, 25, 31, 0.04), 0 6px 14px rgba(21, 25, 31, 0.06);
      }
      .tx-tray-card:active { cursor: grabbing; }
      .tx-tray-card.is-dragging { opacity: 0.4; }
      .tx-tray-card-eyebrow {
        font-family: var(--sans);
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ink-3);
      }
      .tx-tray-card-title {
        font-family: var(--serif);
        font-size: 13.5px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.25;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tx-tray-card-excerpt {
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--ink-2);
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tx-tray-card-source {
        font-family: var(--sans);
        font-size: 11px;
        color: var(--source-2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tx-tray-card-remove {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        font-size: 13px;
        line-height: 1;
        opacity: 0;
        transition: opacity 0.12s;
      }
      .tx-tray-card:hover .tx-tray-card-remove { opacity: 1; }
      @media (hover: none) { .tx-tray-card-remove { opacity: 1; } }

      /* Drag ghost — follows the cursor while dragging from tray */
      .tx-tray-ghost {
        position: fixed;
        z-index: 9999;
        width: 220px;
        background: var(--paper);
        border: 1px solid var(--primary);
        border-top: 3px solid var(--primary);
        border-radius: var(--r-sm);
        padding: 6px 10px;
        box-shadow: 0 8px 24px rgba(21, 25, 31, 0.18);
        display: flex;
        flex-direction: column;
        gap: 2px;
        pointer-events: none;
        font-family: var(--sans);
      }
      .tx-tray-ghost .tx-tray-card-title {
        font-family: var(--serif);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.25;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      @media (max-width: 900px) {
        .tx-sidebar { flex: 0 0 260px; width: 260px; }
      }

      /* Decoration tool group */
      .tx-tools {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 32px;
        padding: 0 4px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
      }
      .tx-tool-btn { width: 26px; height: 26px; }
      .tx-zoom-display {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 32px;
        padding: 0 6px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--mono);
        font-size: 11.5px;
      }
      .tx-zoom-value {
        min-width: 42px;
        text-align: center;
        color: var(--ink-2);
      }
      .tx-zoom-reset {
        background: none;
        border: none;
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--ink-3);
        cursor: pointer;
        padding: 0 6px;
      }
      .tx-zoom-reset:hover { color: var(--ink); }

      /* ============ STAGE ============ */
      .tx-stage {
        flex: 1;
        position: relative;
        overflow: hidden;
        cursor: grab;
        background:
          radial-gradient(circle, rgba(15, 18, 23, 0.06) 1px, transparent 1px) 0 0 / 24px 24px,
          var(--paper-soft);
        /* We own all pan/pinch gestures — keep the browser out of it. */
        touch-action: none;
        -webkit-user-select: none;
        user-select: none;
      }
      /* Items mustn't trigger native long-press / callout selection on iPad. */
      .tx-item, .tx-arrow, .tx-tray-card { touch-action: none; -webkit-touch-callout: none; }
      .tx-stage:active { cursor: grabbing; }
      .tx-stage-grid {
        position: absolute;
        top: 0;
        left: 0;
        width: 1px;   /* anchor; children render in absolute world coords */
        height: 1px;
        will-change: transform;
      }

      .tx-stage-help {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--ink-3);
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-pill);
        padding: 4px 12px;
        pointer-events: none;
        opacity: 0.85;
      }

      /* ============ ITEM ============ */
      .tx-item {
        position: absolute;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--primary);
        border-radius: var(--r-lg);
        padding: 14px 16px 16px;
        box-shadow:
          0 1px 2px rgba(21, 25, 31, 0.04),
          0 12px 28px rgba(21, 25, 31, 0.08);
        cursor: grab;
        user-select: none;
      }
      .tx-item:hover { border-color: var(--primary); }
      .tx-item:active { cursor: grabbing; }
      .tx-item-remove {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 22px;
        height: 22px;
        font-size: 14px;
        line-height: 1;
        opacity: 0;
        transition: opacity 0.12s;
      }

      /* Right-edge resize grip — hover-revealed, drag horizontally to
         stretch the card (200..720px, snapped). */
      .tx-resize-handle {
        position: absolute;
        top: 8px;
        bottom: 8px;
        right: -5px;
        width: 10px;
        cursor: ew-resize;
        z-index: 2;
        opacity: 0;
        transition: opacity 0.12s;
      }
      .tx-resize-handle::after {
        content: '';
        position: absolute;
        top: 50%;
        right: 3px;
        transform: translateY(-50%);
        width: 4px;
        height: 32px;
        background: var(--ink-line);
        border-radius: 2px;
        transition: background 0.12s;
      }
      .tx-item:hover .tx-resize-handle,
      .tx-item:focus-within .tx-resize-handle { opacity: 1; }
      .tx-resize-handle:hover::after { background: var(--primary); }
      @media (hover: none) { .tx-resize-handle { opacity: 1; } }
      /* No resize while inline-editing a header/text — would conflict
         with text selection / cursor placement. */
      .tx-item.is-editing .tx-resize-handle { display: none; }

      /* Bottom-right corner handle — drag to resize both width and height. */
      .tx-resize-handle-se {
        top: auto;
        bottom: -5px;
        right: -5px;
        left: auto;
        width: 16px;
        height: 16px;
        cursor: nwse-resize;
      }
      .tx-resize-handle-se::after {
        top: auto;
        right: 2px;
        bottom: 2px;
        transform: none;
        width: 10px;
        height: 10px;
        background: transparent;
        border-right: 2px solid var(--ink-line);
        border-bottom: 2px solid var(--ink-line);
        border-radius: 0;
      }
      .tx-resize-handle-se:hover::after {
        border-right-color: var(--primary);
        border-bottom-color: var(--primary);
        background: transparent;
      }
      /* Frames are pure containers — make their corner handle always-on
         since the dashed border edge is the only other affordance. */
      .tx-item-frame .tx-resize-handle-se { opacity: 1; }
      .tx-item-frame .tx-resize-handle-se::after {
        border-right-color: var(--primary);
        border-bottom-color: var(--primary);
      }
      .tx-item:hover .tx-item-remove,
      .tx-item:focus-within .tx-item-remove { opacity: 1; }
      @media (hover: none) { .tx-item-remove { opacity: 1; } }

      .tx-item-missing {
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink-3);
        font-style: italic;
      }

      .tx-note-eyebrow {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--ink-3);
        margin-bottom: 4px;
      }
      .tx-note-title {
        font-family: var(--serif);
        font-size: 15px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.25;
        margin: 0 0 6px;
      }
      .tx-note-quote {
        background: var(--source-tint);
        border-left: 2px solid var(--source);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        padding: 6px 10px;
        margin-bottom: 6px;
        font-family: var(--sans);
        font-size: 12px;
        color: var(--source-2);
        line-height: 1.45;
      }
      .tx-note-quote-glyph {
        font-family: var(--serif);
        font-size: 14px;
        color: var(--source);
        opacity: 0.6;
        margin-right: 4px;
      }
      .tx-note-body {
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.5;
        margin-bottom: 6px;
      }
      /* Prose niceties so the full HTML body renders cleanly inside cards */
      .tx-note-body p { margin: 0 0 6px; }
      .tx-note-body p:last-child { margin: 0; }
      .tx-note-body ul { list-style: disc; padding-left: 18px; margin: 0 0 6px; }
      .tx-note-body ol { list-style: decimal; padding-left: 18px; margin: 0 0 6px; }
      .tx-note-body blockquote {
        margin: 0 0 6px;
        padding-left: 10px;
        border-left: 2px solid var(--ink-line);
        color: var(--ink-3);
      }
      .tx-note-body code {
        font-family: var(--mono);
        font-size: 11.5px;
        background: var(--paper-warm);
        padding: 1px 4px;
        border-radius: 2px;
      }
      .tx-note-body a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
      .tx-note-body img { max-width: 100%; border-radius: var(--r-sm); }
      .tx-note-body strong { color: var(--ink); font-weight: 600; }
      .tx-note-body p { margin: 0 0 4px; }
      .tx-note-body p:last-child { margin: 0; }
      .tx-note-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        min-width: 0;
      }
      /* Long source/concept/person names must not break out of the card */
      .tx-note-meta .sp-chip {
        max-width: 100%;
        display: inline-block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.5;
      }

      /* ============ HEADER decoration ============
         No card chrome — just type on the canvas. */
      .tx-item-header {
        background: transparent;
        border: 1px dashed transparent;
        border-radius: var(--r-md);
        box-shadow: none;
        padding: 4px 10px;
      }
      .tx-item-header:hover { border-color: var(--ink-line); }
      .tx-item-header.is-editing { border-color: var(--primary); background: var(--paper); }
      .tx-header-text {
        font-family: var(--serif);
        font-size: 36px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        line-height: 1.1;
        letter-spacing: -0.015em;
      }
      .tx-header-text.is-placeholder { color: var(--ink-4); font-style: italic; }
      .tx-header-input {
        width: 100%;
        font-family: var(--serif);
        font-size: 36px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.1;
        letter-spacing: -0.015em;
        background: transparent;
        border: none;
        outline: none;
        padding: 0;
      }

      /* ============ TEXT — plain inline label (annotation, arrow caption) ============ */
      .tx-item-text {
        background: transparent;
        border: 1px dashed transparent;
        border-radius: var(--r-md);
        box-shadow: none;
        padding: 4px 8px;
      }
      .tx-item-text:hover { border-color: var(--ink-line); }
      .tx-item-text.is-editing { border-color: var(--primary); background: var(--paper); }
      /* Label attached to an arrow midpoint — solid background so it
         occludes the line, centered text, light border, slight padding
         bump.  The opaque background is the whole point: the label
         can't read against the arrow stroke without one. */
      .tx-item-text.is-attached-arrow {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        padding: 4px 12px;
        text-align: center;
      }
      .tx-item-text.is-attached-arrow:hover { border-color: var(--primary); }
      .tx-item-text.is-attached-arrow .tx-text-display,
      .tx-item-text.is-attached-arrow .tx-text-input {
        text-align: center;
      }
      .tx-text-display {
        font-family: var(--sans);
        font-size: 16px;
        line-height: 1.5;
        color: var(--ink-2);
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .tx-text-display.is-placeholder { color: var(--ink-4); font-style: italic; }
      .tx-text-input {
        width: 100%;
        font-family: var(--sans);
        font-size: 16px;
        line-height: 1.5;
        color: var(--ink-2);
        background: transparent;
        border: none;
        outline: none;
        padding: 0;
        resize: none;
        overflow: hidden;
      }

      /* ============ FRAME ============
         Translucent box; items sit on top.  No label, no chrome — just
         a draggable, resizable container.  Dashed primary border so the
         frame is visible even when empty. */
      .tx-item-frame {
        background: rgba(31, 59, 115, 0.04);
        border: 2px dashed var(--primary);
        border-radius: var(--r-md);
        padding: 0;
        box-shadow: none;
      }
      .tx-item-frame:hover { background: rgba(31, 59, 115, 0.06); box-shadow: none; }
      .tx-item-frame.is-active { background: rgba(31, 59, 115, 0.08); }
      /* Categorical color tints — keep the dashed border but switch to
         the category's hue for both border and tinted fill. */
      .tx-item-frame.is-color-concept {
        background: rgba(72, 162, 126, 0.05);
        border-color: var(--concept);
      }
      .tx-item-frame.is-color-concept:hover { background: rgba(72, 162, 126, 0.08); }
      .tx-item-frame.is-color-source {
        background: rgba(73, 118, 177, 0.05);
        border-color: var(--source);
      }
      .tx-item-frame.is-color-source:hover { background: rgba(73, 118, 177, 0.08); }
      .tx-item-frame.is-color-person {
        background: rgba(97, 68, 152, 0.05);
        border-color: var(--person);
      }
      .tx-item-frame.is-color-person:hover { background: rgba(97, 68, 152, 0.08); }
      .tx-item-frame.is-color-warning {
        background: rgba(139, 90, 60, 0.05);
        border-color: var(--warning);
      }
      .tx-item-frame.is-color-warning:hover { background: rgba(139, 90, 60, 0.08); }
      /* Frame corner handle echoes its current color. */
      .tx-item-frame.is-color-concept .tx-resize-handle-se::after { border-color: var(--concept); }
      .tx-item-frame.is-color-source  .tx-resize-handle-se::after { border-color: var(--source);  }
      .tx-item-frame.is-color-person  .tx-resize-handle-se::after { border-color: var(--person);  }
      .tx-item-frame.is-color-warning .tx-resize-handle-se::after { border-color: var(--warning); }
      /* The remove × on a frame should be visible since the frame body
         isn't an obvious click target. */
      .tx-item-frame .tx-item-remove { opacity: 0.8; }
      .tx-item-frame .tx-item-remove:hover { opacity: 1; }

      /* ============ CONTEXT MENU ============ */
      .tx-ctx-menu {
        position: fixed;
        z-index: 9000;
        min-width: 180px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: 0 12px 32px rgba(21, 25, 31, 0.18);
        padding: 4px 0;
        font-family: var(--sans);
      }
      .tx-ctx-item {
        display: block;
        width: 100%;
        background: none;
        border: none;
        padding: 7px 14px;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
        text-align: left;
        cursor: pointer;
      }
      .tx-ctx-item:hover { background: var(--hover); }
      .tx-ctx-item.is-danger { color: var(--error); }
      .tx-ctx-item.is-danger:hover { background: rgba(122, 46, 46, 0.06); }
      .tx-ctx-item:disabled { color: var(--ink-4); cursor: default; background: transparent; }
      .tx-ctx-divider { height: 1px; background: var(--ink-line-soft); margin: 4px 0; }
      /* Swatch row — picks a categorical tint for frames. */
      .tx-ctx-colors { display: flex; gap: 6px; padding: 8px 14px; }
      .tx-ctx-swatch {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 1.5px solid var(--ink-line);
        background: var(--paper);
        cursor: pointer;
        padding: 0;
        transition: transform 0.1s, box-shadow 0.1s;
      }
      .tx-ctx-swatch:hover  { transform: scale(1.15); }
      .tx-ctx-swatch.is-default { background: var(--primary); border-color: var(--primary); }
      .tx-ctx-swatch.is-concept { background: var(--concept); border-color: var(--concept); }
      .tx-ctx-swatch.is-source  { background: var(--source);  border-color: var(--source);  }
      .tx-ctx-swatch.is-person  { background: var(--person);  border-color: var(--person);  }
      .tx-ctx-swatch.is-warning { background: var(--warning); border-color: var(--warning); }
      .tx-ctx-swatch.is-current { box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--ink); }

      /* ============ BOX-SELECT MARQUEE ============ */
      .tx-box-select {
        position: absolute;
        border: 1px dashed var(--primary);
        background: rgba(31, 59, 115, 0.06);
        pointer-events: none;
        z-index: 60;
      }

      /* ============ ANCHOR DOTS ============
         Surface during arrow-endpoint drag at the four edge midpoints
         of the hovered target item.  Translated by their own transform
         (centered on the anchor point). */
      .tx-anchor-dot {
        position: absolute;
        width: 12px;
        height: 12px;
        margin-left: -6px;
        margin-top: -6px;
        border-radius: 50%;
        background: var(--paper);
        border: 2px solid var(--primary);
        box-shadow: 0 1px 3px rgba(21, 25, 31, 0.18);
        z-index: 50;
        pointer-events: none;
        transition: transform 0.08s ease-out, background 0.1s, border-color 0.1s;
      }
      .tx-anchor-dot.is-active {
        background: var(--primary);
        border-color: var(--primary);
        transform: scale(1.4);
      }

      /* ============ ARROW ============ */
      .tx-arrow { color: var(--ink-2); }
      .tx-arrow-line {
        stroke: currentColor;
        stroke-width: 1.6;
        fill: none;
        vector-effect: non-scaling-stroke;
      }
      .tx-arrow-handle {
        fill: var(--paper);
        stroke: var(--primary);
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
        opacity: 0;
        transition: opacity 0.12s;
      }
      .tx-arrow:hover .tx-arrow-handle,
      .tx-arrow:focus-within .tx-arrow-handle { opacity: 1; }
      @media (hover: none) { .tx-arrow-handle { opacity: 1; } }
      .tx-arrow-handle:hover { fill: var(--primary); }
      .tx-arrow-remove {
        width: 22px;
        height: 22px;
        font-size: 14px;
        line-height: 1;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.12s;
        color: var(--ink-3);
      }
      .tx-arrow:hover .tx-arrow-remove,
      .tx-arrow:focus-within .tx-arrow-remove { opacity: 1; }
      @media (hover: none) { .tx-arrow-remove { opacity: 1; } }
      .tx-arrow-remove:hover { color: var(--error); border-color: var(--error); }

      /* ============ EMPTY HINT ============ */
      .tx-empty-hint {
        position: absolute;
        top: 80px;
        left: 80px;
        max-width: 360px;
        padding: 22px 26px;
        background: var(--paper);
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-lg);
        font-family: var(--sans);
        text-align: center;
        pointer-events: auto;
      }
      .tx-empty-hint-title {
        font-family: var(--serif);
        font-size: 18px;
        font-weight: 600;
        color: var(--ink);
        margin: 0 0 6px;
      }
      .tx-empty-hint-text {
        font-size: 13px;
        color: var(--ink-3);
        margin: 0 0 14px;
      }

      /* ============ MODAL ============ */
      .tx-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 18, 23, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 500;
        padding: 24px;
      }
      /* ============ PICKER (rich) ============ */
      .tx-pick2 {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-lg);
        box-shadow: 0 24px 60px rgba(21, 25, 31, 0.18);
        width: 100%;
        max-width: 1080px;
        height: 80vh;
        max-height: 820px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      /* Picker header — section-title scale per the style guide:
         serif 600 22/1.2 for the heading, sans 13/1.5 ink-3 for the meta
         line.  Same padding rhythm as the page-level headers on /notes
         and /sources. */
      .tx-pick2-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        padding: 22px 24px 16px;
        border-bottom: 1px solid var(--ink-line);
        flex-wrap: wrap;
      }
      .tx-pick2-title {
        font-family: var(--serif);
        font-size: 22px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--ink);
        margin: 0 0 4px;
      }
      .tx-pick2-sub {
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
        color: var(--ink-3);
        margin: 0;
      }
      .tx-pick2-link {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        color: var(--ink);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      .tx-pick2-link:hover { color: var(--primary); }
      .tx-pick2-head-actions { display: flex; gap: 8px; align-items: center; }

      .tx-pick2-body {
        flex: 1;
        display: grid;
        grid-template-columns: 240px 1fr;
        min-height: 0;
      }

      /* Sidebar */
      .tx-pick2-sidebar {
        border-right: 1px solid var(--ink-line);
        padding: 14px 14px 22px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: var(--paper-soft);
      }
      .tx-pick2-fs { display: flex; flex-direction: column; gap: 6px; }
      .tx-pick2-fs-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 4px;
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
      }
      .tx-pick2-fs-head:hover { color: var(--ink); }
      .tx-pick2-fs-label { flex: 1; }
      .tx-pick2-fs-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--ink-3);
        flex-shrink: 0;
      }
      .tx-pick2-fs-dot.is-concept { background: var(--concept); }
      .tx-pick2-fs-dot.is-source  { background: var(--source);  }
      .tx-pick2-fs-dot.is-person  { background: var(--person);  }
      .tx-pick2-fs-caret { display: inline-flex; color: var(--ink-3); transition: transform 0.15s; }
      .tx-pick2-fs-body { display: flex; flex-direction: column; gap: 4px; }
      .tx-pick2-fs-search {
        width: 100%;
        height: 28px;
        padding: 0 8px;
        margin-bottom: 4px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink);
        outline: none;
      }
      .tx-pick2-fs-search:focus { border-color: var(--ink-2); background: var(--paper); }
      .tx-pick2-fs-list {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 4px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        box-shadow: inset 0 -8px 8px -8px rgba(15, 23, 35, 0.08);
      }
      .tx-pick2-fs-list::-webkit-scrollbar { width: 8px; }
      .tx-pick2-fs-list::-webkit-scrollbar-track { background: transparent; }
      .tx-pick2-fs-list::-webkit-scrollbar-thumb { background: var(--ink-line); border-radius: 4px; }
      .tx-pick2-fs-list::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }
      .tx-pick2-fs-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 6px;
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-2);
        cursor: pointer;
      }
      .tx-pick2-fs-row:hover { background: var(--hover); color: var(--ink); }
      .tx-pick2-fs-row-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tx-pick2-fs-row-count {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
      }
      .tx-pick2-fs-note {
        margin: 4px 0 0 6px;
        font-family: var(--sans);
        font-size: 11px;
        font-style: italic;
        color: var(--ink-3);
      }
      .tx-pick2-fs-empty {
        margin: 0;
        padding: 6px 8px;
        font-family: var(--sans);
        font-size: 11.5px;
        font-style: italic;
        color: var(--ink-3);
      }

      /* Main */
      .tx-pick2-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }
      .tx-pick2-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        border-bottom: 1px solid var(--ink-line-soft);
      }
      .tx-pick2-search {
        flex: 1;
        height: 36px;
        padding: 0 12px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink);
      }
      .tx-pick2-search:focus { outline: none; border-color: var(--ink-2); background: var(--paper); }
      .tx-pick2-bulk {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--sans);
        font-size: 12px;
        color: var(--ink-3);
      }
      .tx-pick2-bulk-count {
        font-family: var(--mono);
        font-variant-numeric: tabular-nums;
        color: var(--primary);
        font-weight: 600;
      }
      .tx-pick2-expand {
        height: 28px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--sans);
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-2);
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
      }
      .tx-pick2-expand:hover { background: var(--hover); color: var(--ink); border-color: var(--ink-3); }
      .tx-pick2-expand.is-on {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--paper);
      }
      .tx-pick2-expand.is-on:hover { background: var(--primary-dark, #142A57); }

      /* Card grid */
      .tx-pick2-grid {
        flex: 1;
        overflow-y: auto;
        padding: 16px 18px 24px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 12px;
        align-content: start;
      }
      /* Expanded mode = wider cards so prose breathes; one column on small modals */
      .tx-pick2-grid:has(.tx-pick2-card.is-expanded) {
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      }
      .tx-pick2-empty {
        grid-column: 1 / -1;
        padding: 64px 16px;
        text-align: center;
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-3);
      }

      /* Card */
      .tx-pick2-card {
        position: relative;
        text-align: left;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-top: 3px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 12px 14px 12px 32px;
        cursor: pointer;
        transition: border-color 0.12s, box-shadow 0.12s;
        font-family: var(--sans);
      }
      .tx-pick2-card:hover { border-color: var(--ink-3); box-shadow: var(--shadow-card); }
      .tx-pick2-card.is-selected {
        border-color: var(--primary);
        border-top-color: var(--primary);
        background: rgba(31, 59, 115, 0.03);
      }
      .tx-pick2-card.is-selected:hover { box-shadow: 0 0 0 1px var(--primary); }
      .tx-pick2-check {
        position: absolute;
        top: 12px;
        left: 10px;
        width: 14px;
        height: 14px;
        border: 1px solid var(--ink-3);
        border-radius: 2px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--paper);
        color: var(--paper);
        flex-shrink: 0;
      }
      .tx-pick2-card.is-selected .tx-pick2-check {
        background: var(--primary);
        border-color: var(--primary);
      }
      .tx-pick2-card-body { display: flex; flex-direction: column; gap: 6px; }
      .tx-pick2-card-eyebrow {
        font-family: var(--sans);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--ink-3);
      }
      .tx-pick2-card-title {
        font-family: var(--serif);
        font-size: 15px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.25;
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tx-pick2-card.is-expanded .tx-pick2-card-title {
        display: block;
        -webkit-line-clamp: unset;
        overflow: visible;
      }
      .tx-pick2-card-quote {
        background: var(--source-tint);
        border-left: 2px solid var(--source);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        padding: 4px 8px;
        font-size: 12px;
        color: var(--source-2);
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .tx-pick2-card.is-expanded .tx-pick2-card-quote {
        display: block;
        -webkit-line-clamp: unset;
        overflow: visible;
      }
      .tx-pick2-card-quote-glyph {
        font-family: var(--serif);
        color: var(--source);
        opacity: 0.6;
        margin-right: 3px;
      }
      .tx-pick2-card-quote-page {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--source-2);
        opacity: 0.75;
        margin-left: 6px;
      }
      .tx-pick2-card-excerpt {
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      /* Full HTML body when expanded — same prose styling as note cards on /notes */
      .tx-pick2-card-html {
        font-family: var(--sans);
        font-size: 13px;
        color: var(--ink-2);
        line-height: 1.55;
      }
      .tx-pick2-card-html p { margin: 0 0 6px; }
      .tx-pick2-card-html p:last-child { margin: 0; }
      .tx-pick2-card-html ul { list-style: disc; padding-left: 18px; margin: 0 0 6px; }
      .tx-pick2-card-html ol { list-style: decimal; padding-left: 18px; margin: 0 0 6px; }
      .tx-pick2-card-html blockquote {
        margin: 0 0 6px;
        padding-left: 10px;
        border-left: 2px solid var(--ink-line);
        color: var(--ink-3);
      }
      .tx-pick2-card-html code {
        font-family: var(--mono);
        font-size: 12px;
        background: var(--paper-warm);
        padding: 1px 4px;
        border-radius: 2px;
      }
      .tx-pick2-card-html a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
      .tx-pick2-card-html img { max-width: 100%; border-radius: var(--r-sm); }
      .tx-pick2-card-html strong { color: var(--ink); font-weight: 600; }
      .tx-pick2-card-context {
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--ink-3);
        line-height: 1.5;
      }
      .tx-pick2-card-context-label {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
        margin-right: 6px;
      }
      .tx-pick2-card-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 2px;
      }
      .tx-pick2-chip {
        max-width: 100%;
        display: inline-block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.5;
        font-size: 11px;
      }
      .tx-pick2-mark {
        background: #FBE7A1;
        color: inherit;
        padding: 0 1px;
        border-radius: 1px;
      }

      @media (max-width: 800px) {
        .tx-pick2 { height: 92vh; }
        .tx-pick2-body { grid-template-columns: 1fr; }
        .tx-pick2-sidebar {
          border-right: none;
          border-bottom: 1px solid var(--ink-line);
          max-height: 200px;
        }
      }
    `}</style>
  );
}
