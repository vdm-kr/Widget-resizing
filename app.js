'use strict';

// ===== STATE =====

let idSeed = 10;
const uid = () => 'w' + (++idSeed);

// Layout: rows of widgets, each widget has { id, name, flex }
// flex is proportional — widgets fill their row via flexbox
const state = {
  rows: [
    [
      { id: 'w1', name: 'Revenue Overview',    flex: 6 },
      { id: 'w2', name: 'User Growth',          flex: 6 },
    ],
    [
      { id: 'w3', name: 'Sales Performance',   flex: 12 },
    ],
    [
      { id: 'w4', name: 'Traffic Sources',     flex: 4 },
      { id: 'w5', name: 'Conversion Rate',     flex: 4 },
      { id: 'w6', name: 'Customer Retention',  flex: 4 },
    ],
  ],
};


// ===== FIND WIDGET =====

function findWidget(id) {
  for (let ri = 0; ri < state.rows.length; ri++) {
    const row = state.rows[ri];
    for (let wi = 0; wi < row.length; wi++) {
      if (row[wi].id === id) return { row, ri, wi, widget: row[wi] };
    }
  }
  return null;
}

// ===== ICONS =====

const ICON_DRAG = `<svg viewBox="0 0 18 14" width="16" height="12" fill="none" aria-hidden="true">
  <line x1="1" y1="1"  x2="17" y2="1"  stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="1" y1="7"  x2="17" y2="7"  stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="1" y1="13" x2="17" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

const ICON_EXPAND = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
  <path d="M2.5 6.5V2.5H6.5M9.5 2.5H13.5V6.5M13.5 9.5V13.5H9.5M6.5 13.5H2.5V9.5"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ICON_MORE = `<svg viewBox="0 0 16 4" width="15" height="4" aria-hidden="true">
  <circle cx="2"  cy="2" r="1.6" fill="currentColor"/>
  <circle cx="8"  cy="2" r="1.6" fill="currentColor"/>
  <circle cx="14" cy="2" r="1.6" fill="currentColor"/>
</svg>`;

// ===== RENDER =====

function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  state.rows.forEach((row, ri) => {
    if (row.length === 0) return;

    const rowEl = document.createElement('div');
    rowEl.className = 'grid-row';
    rowEl.dataset.ri = ri;

    row.forEach((w, wi) => {
      if (wi > 0) {
        rowEl.appendChild(makeResizeHandle(ri, row[wi - 1], w));
      }
      rowEl.appendChild(makeWidget(w, ri, wi));
    });

    grid.appendChild(rowEl);
  });

  attachEvents();
}

function makeWidget(w, ri, wi) {
  const el = document.createElement('div');
  el.className = 'widget';
  el.dataset.id = w.id;
  el.dataset.ri = ri;
  el.dataset.wi = wi;
  el.style.flexGrow = w.flex;
  el.style.flexShrink = '1';
  el.style.flexBasis = '0';

  el.innerHTML = `
    <div class="widget-header">
      <div class="widget-name">${escHtml(w.name)}</div>
      <button class="drag-handle" data-id="${w.id}" title="Drag to reorder">
        ${ICON_DRAG}
      </button>
      <div class="widget-actions">
        <button class="action-btn expand-btn" title="Expand">${ICON_EXPAND}</button>
        <button class="action-btn more-btn" data-id="${w.id}" title="More options">${ICON_MORE}</button>
      </div>
    </div>
    <div class="widget-body"></div>`;

  return el;
}

function makeResizeHandle(ri, leftW, rightW) {
  const el = document.createElement('div');
  el.className = 'resize-handle';
  el.dataset.ri = ri;
  el.dataset.leftId = leftW.id;
  el.dataset.rightId = rightW.id;
  return el;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== ATTACH EVENTS =====

function attachEvents() {
  document.querySelectorAll('.more-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showCtxMenu(btn.dataset.id, btn);
    });
  });

  document.querySelectorAll('.drag-handle').forEach(btn => {
    btn.addEventListener('mousedown', onDragStart);
  });

  document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', onResizeStart);
  });
}

// ===== RESIZE =====

let resizing = null;

function onResizeStart(e) {
  e.preventDefault();
  const handle = e.currentTarget;
  const leftId = handle.dataset.leftId;
  const rightId = handle.dataset.rightId;

  const leftFound  = findWidget(leftId);
  const rightFound = findWidget(rightId);
  if (!leftFound || !rightFound) return;

  const rowEl = handle.closest('.grid-row');
  const allHandles = rowEl.querySelectorAll('.resize-handle');
  const availableW = rowEl.getBoundingClientRect().width - allHandles.length * 20;

  const leftEl  = handle.previousElementSibling;
  const rightEl = handle.nextElementSibling;

  // Disable flex transitions on these two widgets during drag
  if (leftEl)  leftEl.style.transition  = 'none';
  if (rightEl) rightEl.style.transition = 'none';

  handle.classList.add('active');
  document.body.style.cursor     = 'col-resize';
  document.body.style.userSelect = 'none';

  resizing = {
    handle,
    leftWidget:     leftFound.widget,
    rightWidget:    rightFound.widget,
    startX:         e.clientX,
    startLeftFlex:  leftFound.widget.flex,
    startRightFlex: rightFound.widget.flex,
    totalFlex:      leftFound.widget.flex + rightFound.widget.flex,
    availableW,
    leftEl,
    rightEl,
  };
}

// ===== DRAG & DROP =====

let dragging    = null;
let dropTarget  = null;
const dragGhost = document.getElementById('dragGhost');

function onDragStart(e) {
  e.preventDefault();
  const widgetId = e.currentTarget.dataset.id;
  const widgetEl = document.querySelector(`.widget[data-id="${widgetId}"]`);
  if (!widgetEl) return;

  const found = findWidget(widgetId);
  if (!found) return;

  const rect = widgetEl.getBoundingClientRect();

  dragging = {
    id:      widgetId,
    ri:      found.ri,
    wi:      found.wi,
    offsetX: Math.min(e.clientX - rect.left, 180), // cap at ghost half-width
    offsetY: Math.min(e.clientY - rect.top,  30),  // cap near the header
  };

  // Build ghost
  dragGhost.innerHTML = `
    <div class="widget-header">
      <div class="widget-name">${escHtml(found.widget.name)}</div>
      <div class="drag-handle-ghost">${ICON_DRAG}</div>
      <div class="widget-actions">
        <button class="action-btn more-btn" style="color:var(--accent)">${ICON_MORE}</button>
      </div>
    </div>
    <div class="widget-body"></div>`;

  positionGhost(e);
  dragGhost.classList.add('active');

  widgetEl.classList.add('widget--dragging');
  document.body.style.userSelect = 'none';
  document.body.style.cursor     = 'grabbing';
}

function positionGhost(e) {
  dragGhost.style.left = (e.clientX - dragging.offsetX) + 'px';
  dragGhost.style.top  = (e.clientY - dragging.offsetY) + 'px';
}

// ===== GLOBAL MOUSE EVENTS =====

document.addEventListener('mousemove', e => {

  // — Resize —
  if (resizing) {
    const dx    = e.clientX - resizing.startX;
    const dFlex = (dx / resizing.availableW) * resizing.totalFlex;
    const min   = resizing.totalFlex * 0.15;
    const max   = resizing.totalFlex * 0.85;
    const newL  = Math.max(min, Math.min(max, resizing.startLeftFlex + dFlex));
    const newR  = resizing.totalFlex - newL;

    resizing.leftWidget.flex  = newL;
    resizing.rightWidget.flex = newR;

    if (resizing.leftEl)  resizing.leftEl.style.flexGrow  = newL;
    if (resizing.rightEl) resizing.rightEl.style.flexGrow = newR;
    return;
  }

  // — Drag —
  if (dragging) {
    positionGhost(e);

    // Temporarily make ghost non-interactive to hit-test underneath it
    dragGhost.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    dragGhost.style.pointerEvents = '';

    const targetEl  = el?.closest('.widget:not(.widget--dragging)');
    const newTarget = targetEl?.dataset.id ?? null;

    if (newTarget !== dropTarget) {
      if (dropTarget) {
        document.querySelector(`.widget[data-id="${dropTarget}"]`)?.classList.remove('widget--drop-target');
      }
      dropTarget = newTarget;
      if (dropTarget) {
        document.querySelector(`.widget[data-id="${dropTarget}"]`)?.classList.add('widget--drop-target');
      }
    }
  }
});

document.addEventListener('mouseup', () => {

  // — End resize —
  if (resizing) {
    const { handle, leftEl, rightEl } = resizing;

    // Re-enable transitions
    if (leftEl)  leftEl.style.transition  = '';
    if (rightEl) rightEl.style.transition = '';

    handle.classList.remove('active');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    resizing = null;
  }

  // — End drag —
  if (dragging) {
    if (dropTarget) {
      swapWidgets(dragging.id, dropTarget);
      document.querySelector(`.widget[data-id="${dropTarget}"]`)?.classList.remove('widget--drop-target');
    }

    dragGhost.classList.remove('active');
    document.querySelector(`.widget[data-id="${dragging.id}"]`)?.classList.remove('widget--dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor     = '';

    dragging   = null;
    dropTarget = null;

    if (dropTarget !== null) render(); // already null here; render conditionally
    render();
  }
});

function swapWidgets(idA, idB) {
  const a = findWidget(idA);
  const b = findWidget(idB);
  if (!a || !b) return;

  // Swap widget names; flex stays in the slot (slot-based swap)
  const tmpName = a.widget.name;
  a.widget.name = b.widget.name;
  b.widget.name = tmpName;

}

// ===== CONTEXT MENU =====

let activeCtxId = null;

function showCtxMenu(widgetId, anchorEl) {
  const menu    = document.getElementById('ctxMenu');
  const btnRect = anchorEl.getBoundingClientRect();

  // Position below the button, aligned to its right edge
  const menuWidth = 176;
  const right     = window.innerWidth - btnRect.right;
  menu.style.right  = right + 'px';
  menu.style.left   = 'auto';
  menu.style.top    = (btnRect.bottom + 6) + 'px';

  menu.classList.add('active');
  activeCtxId = widgetId;
}

function hideCtxMenu() {
  document.getElementById('ctxMenu').classList.remove('active');
  activeCtxId = null;
}

document.getElementById('ctxMenu').addEventListener('click', e => {
  const item = e.target.closest('.ctx-item[data-action]');
  if (!item || !activeCtxId) return;

  const action = item.dataset.action;
  const found  = findWidget(activeCtxId);
  if (!found) return;

  const { row, ri, wi, widget } = found;

  switch (action) {

    case 'small': {
      if (row.length < 2) break;
      const rowTotal   = row.reduce((s, w) => s + w.flex, 0);
      const targetFlex = rowTotal / (row.length * 2.5); // shrink below equal share
      const diff       = widget.flex - targetFlex;
      if (diff <= 0) break;
      widget.flex = Math.max(targetFlex, 0.5);
      // Distribute reclaimed flex to siblings proportionally
      const siblings  = row.filter((_, i) => i !== wi);
      const sibTotal  = siblings.reduce((s, w) => s + w.flex, 0);
      siblings.forEach(s => { s.flex += diff * (s.flex / sibTotal); });
      break;
    }

    case 'big': {
      if (row.length < 2) break;
      const rowTotal   = row.reduce((s, w) => s + w.flex, 0);
      const targetFlex = rowTotal * 0.65;
      const diff       = targetFlex - widget.flex;
      if (diff <= 0) break;
      widget.flex = targetFlex;
      const siblings  = row.filter((_, i) => i !== wi);
      const sibTotal  = siblings.reduce((s, w) => s + w.flex, 0);
      siblings.forEach(s => {
        s.flex -= diff * (s.flex / sibTotal);
        s.flex  = Math.max(s.flex, 0.5);
      });
      break;
    }

    case 'duplicate': {
      const clone = { id: uid(), name: widget.name + ' (copy)', flex: widget.flex / 2 };
      widget.flex = widget.flex / 2;
      row.splice(wi + 1, 0, clone);

      break;
    }

    case 'remove': {
      if (row.length === 1) {
        state.rows.splice(ri, 1);
      } else {
        const removedFlex = widget.flex;
        row.splice(wi, 1);
        // Give reclaimed flex to nearest neighbor
        const neighbor = row[Math.min(wi, row.length - 1)];
        if (neighbor) neighbor.flex += removedFlex;
      }
      // Clean up empty rows
      for (let i = state.rows.length - 1; i >= 0; i--) {
        if (state.rows[i].length === 0) state.rows.splice(i, 1);
      }
      break;
    }

    case 'rename': {
      const newName = prompt('Rename widget:', widget.name);
      if (newName?.trim()) widget.name = newName.trim();
      break;
    }

    case 'info':
    default:
      break;
  }

  hideCtxMenu();
  render();
});

// Close ctx menu on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#ctxMenu') && !e.target.closest('.more-btn')) {
    hideCtxMenu();
  }
});

// Cancel drag on Escape
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  hideCtxMenu();
  if (dragging) {
    dragGhost.classList.remove('active');
    document.querySelector(`.widget[data-id="${dragging.id}"]`)?.classList.remove('widget--dragging');
    if (dropTarget) {
      document.querySelector(`.widget[data-id="${dropTarget}"]`)?.classList.remove('widget--drop-target');
    }
    dragging   = null;
    dropTarget = null;
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  }
});

// ===== BOOT =====
render();
