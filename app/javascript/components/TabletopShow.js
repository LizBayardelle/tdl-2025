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

export default function TabletopShow({ tabletopId, embedded = false, onClose = null }) {
  const [tabletop, setTabletop] = useState(null);
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });

  const [showPicker, setShowPicker]       = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  // When set, the canvas swaps to a print-friendly layout: stage sized to
  // a single page, grid transform replaced by a fit-to-page transform.
  // Cleared after the print dialog returns.
  const [printState, setPrintState] = useState(null);

  // Tray collapse state (persisted across the session for ergonomics).
  const [trayCollapsed, setTrayCollapsed] = useState(false);

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

  // ---- Stage panning (background drag / two-finger touch) ----
  const onStageMouseDown = (e) => {
    // Only start panning from the stage background, not from items
    if (e.target !== stageRef.current && e.target.closest('.tx-stage-grid') !== e.target) {
      const onItem = e.target.closest('[data-tabletop-item-id]');
      if (onItem) return;
    }
    panStateRef.current = { startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y };
    document.addEventListener('mousemove', onStageMouseMove);
    document.addEventListener('mouseup',   onStageMouseUp, { once: true });
  };
  const onStageMouseMove = (e) => {
    const p = panStateRef.current;
    if (!p) return;
    setView(v => ({ ...v, x: p.vx + (e.clientX - p.startX), y: p.vy + (e.clientY - p.startY) }));
  };
  const onStageMouseUp = () => {
    panStateRef.current = null;
    document.removeEventListener('mousemove', onStageMouseMove);
  };

  // ---- Item drag ----
  // Modes:
  //   - 'body'    on a normal item = move (x,y)
  //   - 'body'    on an arrow      = translate both endpoints
  //   - 'start' / 'end'            = move just that endpoint of an arrow
  //   - 'resize-e' on a normal item = stretch its width from the right edge
  const onItemMouseDown = (e, itemId, mode = 'body') => {
    e.stopPropagation();
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;
    if (item.kind === 'arrow') {
      dragStateRef.current = {
        itemId, mode,
        startX: e.clientX, startY: e.clientY,
        sx: item.start_x || 0, sy: item.start_y || 0,
        ex: item.end_x   || 0, ey: item.end_y   || 0,
      };
    } else if (mode === 'resize-e') {
      dragStateRef.current = {
        itemId, mode,
        startX: e.clientX, startY: e.clientY,
        iw: item.width || (item.kind === 'note' ? NOTE_W : 240),
      };
    } else {
      dragStateRef.current = {
        itemId, mode: 'body',
        startX: e.clientX, startY: e.clientY,
        ix: item.x, iy: item.y,
      };
    }
    document.addEventListener('mousemove', onItemMouseMove);
    document.addEventListener('mouseup',   onItemMouseUp, { once: true });
  };
  const onItemMouseMove = (e) => {
    const d = dragStateRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / viewRef.current.zoom;
    const dy = (e.clientY - d.startY) / viewRef.current.zoom;
    // Alt bypasses snap for fine-tuning.
    const s = e.altKey ? (n) => n : snap;
    setItems(prev => prev.map(it => {
      if (it.id !== d.itemId) return it;
      if (it.kind === 'arrow') {
        if (d.mode === 'start') return { ...it, start_x: s(d.sx + dx), start_y: s(d.sy + dy) };
        if (d.mode === 'end')   return { ...it, end_x:   s(d.ex + dx), end_y:   s(d.ey + dy) };
        // body: snap the *delta* so the arrow keeps its shape exactly
        const sdx = s(d.sx + dx) - d.sx;
        const sdy = s(d.sy + dy) - d.sy;
        return { ...it,
          start_x: d.sx + sdx, start_y: d.sy + sdy,
          end_x:   d.ex + sdx, end_y:   d.ey + sdy,
        };
      }
      if (d.mode === 'resize-e') {
        const next = Math.max(200, Math.min(720, d.iw + dx));
        return { ...it, width: s(next) };
      }
      return { ...it, x: s(d.ix + dx), y: s(d.iy + dy) };
    }));
  };
  const onItemMouseUp = () => {
    const d = dragStateRef.current;
    if (!d) return;
    dragStateRef.current = null;
    document.removeEventListener('mousemove', onItemMouseMove);

    // Persist post-drag state from the ref (avoids stale-closure x/y).
    const it = itemsRef.current.find(i => i.id === d.itemId);
    if (!it) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => persistItem(it), 250);
  };

  async function persistItem(item) {
    try {
      await fetch(`/tabletops/${tabletopId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: {
          x: item.x, y: item.y,
          width: item.width, height: item.height,
          rotation: item.rotation, z_index: item.z_index,
          body: item.body,
          start_x: item.start_x, start_y: item.start_y,
          end_x: item.end_x, end_y: item.end_y,
          color: item.color,
        }}),
      });
    } catch (err) { console.error('Persist failed', err); }
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
    try {
      await fetch(`/tabletops/${tabletopId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: { staged: false, x, y, z_index: next_z } }),
      });
    } catch (err) { console.error('Place failed', err); }
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

    try {
      await Promise.all(updates.map(u =>
        fetch(`/tabletops/${tabletopId}/items/${u.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
          body: JSON.stringify({ item: { staged: false, x: u.x, y: u.y, z_index: u.z_index } }),
        })
      ));
    } catch (err) { console.error('Place-all failed', err); }
  }

  async function returnToTray(item) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, staged: true } : i));
    try {
      await fetch(`/tabletops/${tabletopId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ item: { staged: true } }),
      });
    } catch (err) { console.error('Stash failed', err); }
  }

  // ---- Adding notes (one-or-many) ----
  // The picker passes us an array of selected notes.  We compute a tidy grid
  // layout in the visible viewport and POST each item in parallel, then
  // refetch the tabletop so item_data lands inline.
  async function addNotesBulk(notes) {
    if (!notes || notes.length === 0) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (rect.width  / 2 - view.x) / view.zoom;
    const cy = (rect.height / 2 - view.y) / view.zoom;

    const COLS   = Math.min(3, notes.length);
    const GAP    = 24;
    const COL_W  = NOTE_W + GAP;
    const ROW_H  = 220 + GAP;
    const rows   = Math.ceil(notes.length / COLS);
    const totalW = COLS * NOTE_W + (COLS - 1) * GAP;
    const totalH = rows * 220    + (rows - 1) * GAP;
    const startX = snap(cx - totalW / 2);
    const startY = snap(cy - totalH / 2);

    setShowPicker(false);

    try {
      await Promise.all(notes.map((note, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return fetch(`/tabletops/${tabletopId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
          body: JSON.stringify({ item: {
            kind: 'note',
            item_id: note.id,
            item_type: 'Note',
            x: snap(startX + col * COL_W),
            y: snap(startY + row * ROW_H),
          }}),
        });
      }));
      fetchTabletop();
    } catch (err) {
      console.error('Bulk add failed', err);
    }
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

  // Commit inline edit (header / text body).  Persists immediately.
  function commitInlineEdit(itemId, body) {
    const it = itemsRef.current.find(i => i.id === itemId);
    setEditingItemId(null);
    if (!it) return;
    if ((it.body || '') === (body || '')) return; // no-op
    const updated = { ...it, body };
    setItems(prev => prev.map(i => i.id === itemId ? updated : i));
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
        </div>

        <div className="tx-show-bar-right">
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
      <div
        ref={stageRef}
        className="tx-stage"
        onMouseDown={onStageMouseDown}
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
          {placedItems.map(item => (
            <TabletopItemEl
              key={item.id}
              item={item}
              isEditing={editingItemId === item.id}
              onMouseDown={onItemMouseDown}
              onRemove={removeItem}
              onStartEdit={() => setEditingItemId(item.id)}
              onCommitEdit={(body) => commitInlineEdit(item.id, body)}
            />
          ))}
        </div>

        <div className="tx-stage-help" aria-hidden="true">
          Drag or scroll to pan · Pinch or ⌘/Ctrl+scroll to zoom · Hold Alt while dragging to bypass snap
        </div>
      </div>

      {stagedItems.length > 0 && (
        <TrayPanel
          items={stagedItems}
          collapsed={trayCollapsed}
          onToggleCollapse={() => setTrayCollapsed(c => !c)}
          onPlace={placeStaged}
          onPlaceAll={placeAllStaged}
          onRemove={removeItem}
        />
      )}
      </div>

      {showPicker && (
        <NotePickerModal
          excludeIds={items.filter(i => i.kind === 'note').map(i => i.item_id)}
          onClose={() => setShowPicker(false)}
          onAdd={addNotesBulk}
        />
      )}
    </div>
  );
}

// =====================================================================
// Item rendering
// =====================================================================
function TabletopItemEl({ item, isEditing, onMouseDown, onRemove, onStartEdit, onCommitEdit }) {
  // Arrows are SVG, not box-shaped — render entirely separately.
  if (item.kind === 'arrow') {
    return <ArrowItem item={item} onMouseDown={onMouseDown} onRemove={onRemove} />;
  }

  const stop = (e) => e.stopPropagation();
  return (
    <div
      data-tabletop-item-id={item.id}
      className={`tx-item tx-item-${item.kind} ${isEditing ? 'is-editing' : ''}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width || (item.kind === 'note' ? NOTE_W : undefined),
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        zIndex: item.z_index || 0,
      }}
      onMouseDown={isEditing ? stop : ((e) => onMouseDown(e, item.id))}
      onDoubleClick={(item.kind === 'header' || item.kind === 'text') ? onStartEdit : undefined}
    >
      {item.kind === 'note'   && <NoteItemBody   data={item.item_data} />}
      {item.kind === 'header' && <HeaderItemBody item={item} isEditing={isEditing} onCommit={onCommitEdit} />}
      {item.kind === 'text'   && <TextItemBody   item={item} isEditing={isEditing} onCommit={onCommitEdit} />}

      <button
        type="button"
        className="tx-item-remove sp-icon-action-quiet"
        onClick={(e) => { stop(e); onRemove(item); }}
        onMouseDown={stop}
        aria-label="Remove from tabletop"
        title="Remove"
      >
        ×
      </button>

      <div
        className="tx-resize-handle"
        onMouseDown={(e) => onMouseDown(e, item.id, 'resize-e')}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize width"
        title="Drag to resize"
      />
    </div>
  );
}

// =====================================================================
// Tray panel — the "waiting area" for items added in bulk that the user
// hasn't placed yet.  Click a card to drop it at the viewport center;
// "Place all" lays the whole tray out in a grid below the placed cluster.
// =====================================================================
function TrayPanel({ items, collapsed, onToggleCollapse, onPlace, onPlaceAll, onRemove }) {
  return (
    <aside className={`tx-tray ${collapsed ? 'is-collapsed' : ''}`} aria-label="Staging tray">
      <header className="tx-tray-head">
        <button
          type="button"
          className="tx-tray-toggle sp-icon-action-quiet"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          title={collapsed ? `Show tray (${items.length})` : 'Hide tray'}
        >
          {collapsed
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 6l4 3" /></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3l4 3-4 3" /></svg>}
        </button>
        {!collapsed && (
          <>
            <span className="tx-tray-title">Tray</span>
            <span className="tx-tray-count">{items.length}</span>
            {items.length > 1 && (
              <button type="button" className="tx-tray-place-all" onClick={onPlaceAll}>Place all</button>
            )}
          </>
        )}
        {collapsed && (
          <span className="tx-tray-collapsed-count" aria-hidden="true">{items.length}</span>
        )}
      </header>

      {!collapsed && (
        <div className="tx-tray-list">
          {items.map(it => (
            <TrayCard key={it.id} item={it} onPlace={() => onPlace(it)} onRemove={() => onRemove(it)} />
          ))}
        </div>
      )}
    </aside>
  );
}

function TrayCard({ item, onPlace, onRemove }) {
  const data = item.item_data || {};
  const type = data.note_type || item.kind || 'note';
  const stop = (e) => e.stopPropagation();
  const excerpt = !data.title && data.body
    ? plainText(data.body).slice(0, 120)
    : (data.quote_text ? `"${data.quote_text.slice(0, 120)}"` : '');

  return (
    <button type="button" className="tx-tray-card" onClick={onPlace} title="Click to place at viewport center">
      <span className="tx-tray-card-eyebrow">{labelFor(type)}</span>
      {data.title && <span className="tx-tray-card-title">{data.title}</span>}
      {!data.title && excerpt && <span className="tx-tray-card-excerpt">{excerpt}</span>}
      {data.source && <span className="tx-tray-card-source">{data.source.title}</span>}
      <button
        type="button"
        className="tx-tray-card-remove sp-icon-action-quiet"
        onClick={(e) => { stop(e); onRemove(); }}
        onMouseDown={stop}
        aria-label="Remove from tabletop"
        title="Remove"
      >×</button>
    </button>
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

// ----- Arrow -----
// Rendered as SVG positioned at (0,0) in world coords with overflow visible.
// Endpoints are absolute world coords; line + arrowhead + two grip handles.
function ArrowItem({ item, onMouseDown, onRemove }) {
  const stop = (e) => e.stopPropagation();
  const sx = item.start_x || 0, sy = item.start_y || 0;
  const ex = item.end_x   || 0, ey = item.end_y   || 0;
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
        onMouseDown={(e) => onMouseDown(e, item.id, 'body')}
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
        onMouseDown={(e) => onMouseDown(e, item.id, 'start')}
      />
      <circle
        cx={ex} cy={ey} r="6"
        className="tx-arrow-handle"
        style={{ pointerEvents: 'all', cursor: 'grab' }}
        onMouseDown={(e) => onMouseDown(e, item.id, 'end')}
      />

      {/* Remove button at midpoint, hover-revealed */}
      <foreignObject x={midX - 11} y={midY - 11} width="22" height="22" style={{ pointerEvents: 'all' }}>
        <button
          type="button"
          className="tx-arrow-remove sp-icon-action-quiet"
          onClick={(e) => { stop(e); onRemove(item); }}
          onMouseDown={stop}
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
        .tx-show.is-printing .tx-tray,
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
        color: var(--ink);
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

      /* Body row: stage takes the rest, tray sits flush right when present. */
      .tx-body {
        flex: 1;
        display: flex;
        align-items: stretch;
        min-height: 0;
        position: relative;
      }
      .tx-body > .tx-stage { flex: 1; }

      /* ============ TRAY ============ */
      .tx-tray {
        flex: 0 0 280px;
        width: 280px;
        background: var(--paper);
        border-left: 1px solid var(--ink-line);
        display: flex;
        flex-direction: column;
        min-height: 0;
        z-index: 4;
      }
      .tx-tray.is-collapsed { flex: 0 0 38px; width: 38px; }
      .tx-tray-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--ink-line);
        font-family: var(--sans);
        font-size: 12.5px;
        color: var(--ink-2);
        flex-shrink: 0;
      }
      .tx-tray.is-collapsed .tx-tray-head {
        flex-direction: column;
        padding: 10px 4px;
        gap: 6px;
      }
      .tx-tray-toggle { width: 24px; height: 24px; }
      .tx-tray-title {
        font-family: var(--sans);
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ink-3);
        flex: 1;
      }
      .tx-tray-count {
        font-family: var(--mono);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--primary);
        font-weight: 600;
      }
      .tx-tray-collapsed-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        background: var(--primary);
        color: var(--paper);
        border-radius: var(--r-pill);
        font-family: var(--mono);
        font-size: 10.5px;
        font-weight: 600;
      }
      .tx-tray-place-all {
        background: none;
        border: none;
        font-family: var(--sans);
        font-size: 11.5px;
        color: var(--primary);
        cursor: pointer;
        padding: 4px 6px;
        border-radius: var(--r-sm);
      }
      .tx-tray-place-all:hover { background: var(--hover); }

      .tx-tray-list {
        flex: 1;
        overflow-y: auto;
        padding: 10px 10px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

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
        cursor: pointer;
        font-family: var(--sans);
        transition: border-color 0.12s, box-shadow 0.12s;
      }
      .tx-tray-card:hover {
        border-color: var(--primary);
        box-shadow: 0 1px 2px rgba(21, 25, 31, 0.04), 0 6px 14px rgba(21, 25, 31, 0.06);
      }
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

      @media (max-width: 720px) {
        .tx-tray { flex: 0 0 220px; width: 220px; }
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
      }
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
        font-size: 28px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        line-height: 1.15;
        letter-spacing: -0.01em;
      }
      .tx-header-text.is-placeholder { color: var(--ink-4); font-style: italic; }
      .tx-header-input {
        width: 100%;
        font-family: var(--serif);
        font-size: 28px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.15;
        letter-spacing: -0.01em;
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
      .tx-text-display {
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
        color: var(--ink-2);
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .tx-text-display.is-placeholder { color: var(--ink-4); font-style: italic; }
      .tx-text-input {
        width: 100%;
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
        color: var(--ink-2);
        background: transparent;
        border: none;
        outline: none;
        padding: 0;
        resize: none;
        overflow: hidden;
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
