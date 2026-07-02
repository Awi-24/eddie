import {
  applyMagnet,
  buildSnapTargets,
  dockedRect,
  expandDockFromBubble,
  nearestSnapTarget,
  panelMargin,
  panelWidthForHost,
  shouldSnap,
  type PanelDock,
  type PanelPoint,
} from "./floating-panel-magnet";

export interface FloatingPanelChromeHandle {
  setMinimized: (value: boolean) => void;
  isMinimized: () => boolean;
  resetPosition: () => void;
  relayout: () => void;
}

interface FloatingPanelChromeOptions {
  panel: HTMLElement;
  dragHandle: HTMLElement;
  minimizeBtn: HTMLElement;
  bubbleBtn: HTMLElement;
  host: HTMLElement;
  initialMinimized: boolean;
  initialDock: PanelDock;
  initialPosition: PanelPoint | null;
  onMinimizedChange: (minimized: boolean) => void;
  onDockChange: (dock: PanelDock) => void;
  onPositionChange: (pos: PanelPoint | null) => void;
}

const BUBBLE_SIZE = 44;
const DRAG_THRESHOLD = 4;

/** Drag-to-move, magnetic snap, and minimize-to-bubble for floating panels. */
export function attachFloatingPanelChrome(
  options: FloatingPanelChromeOptions
): FloatingPanelChromeHandle {
  const {
    panel,
    dragHandle,
    minimizeBtn,
    bubbleBtn,
    host,
    initialMinimized,
    initialDock,
    initialPosition,
    onMinimizedChange,
    onDockChange,
    onPositionChange,
  } = options;

  let minimized = initialMinimized;
  let dock: PanelDock = initialDock;
  let freePos: PanelPoint | null = initialPosition;
  let dragging = false;
  let moved = false;
  let dragOnBubble = false;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;

  const boundsHost = (): HTMLElement =>
    (panel.offsetParent as HTMLElement) ?? host;

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

  const layoutMetrics = () => {
    const host = boundsHost().getBoundingClientRect();
    const margin = panelMargin(host.width);
    const panelWidth = panelWidthForHost(host.width);
    const panelHeight = Math.max(160, host.height - margin * 2);
    return {
      margin,
      hostWidth: host.width,
      hostHeight: host.height,
      panelWidth,
      panelHeight,
      bubbleSize: BUBBLE_SIZE,
      minimized,
    };
  };

  const clearInlinePosition = (): void => {
    panel.style.top = "";
    panel.style.left = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.width = "";
    panel.style.height = "";
  };

  const setDockClass = (value: PanelDock): void => {
    panel.classList.toggle("floating-panel--dock-left", value === "left");
    panel.classList.toggle("floating-panel--dock-right", value === "right");
    panel.classList.toggle("floating-panel--dock-free", value === "free");
  };

  const syncBubbleSize = (): void => {
    panel.style.width = `${BUBBLE_SIZE}px`;
    panel.style.height = `${BUBBLE_SIZE}px`;
    panel.style.bottom = "auto";
  };

  const applyFreePosition = (pos: PanelPoint): void => {
    const layout = layoutMetrics();
    const width = minimized ? BUBBLE_SIZE : layout.panelWidth;
    const height = minimized ? BUBBLE_SIZE : layout.panelHeight;
    const x = clamp(pos.x, 0, Math.max(0, layout.hostWidth - width));
    const y = clamp(pos.y, 0, Math.max(0, layout.hostHeight - height));

    clearInlinePosition();
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    if (minimized) {
      syncBubbleSize();
    } else {
      panel.style.width = `${layout.panelWidth}px`;
      panel.style.height = `${layout.panelHeight}px`;
    }

    freePos = { x, y };
    dock = "free";
    setDockClass("free");
    onDockChange("free");
    onPositionChange(freePos);
  };

  const applyDock = (value: PanelDock, persist = true): void => {
    dock = value;
    setDockClass(value);

    if (value === "free") {
      if (freePos) {
        applyFreePosition(freePos);
      }
      return;
    }

    clearInlinePosition();
    freePos = null;
    if (persist) {
      onDockChange(value);
      onPositionChange(null);
    }
  };

  const applyMinimized = (value: boolean): void => {
    minimized = value;
    panel.classList.toggle("floating-panel--minimized", value);
    if (value) {
      syncBubbleSize();
    } else {
      panel.style.width = "";
      panel.style.height = "";
    }
    onMinimizedChange(value);
  };

  const relayout = (): void => {
    if (minimized) {
      if (freePos) applyFreePosition(freePos);
      return;
    }
    if (dock === "free" && freePos) {
      applyFreePosition(freePos);
      return;
    }
    if (dock === "left" || dock === "right") {
      applyDock(dock, false);
    }
  };

  const resetPosition = (): void => {
    freePos = null;
    applyDock("left");
  };

  const bubblePointFromPanel = (): PanelPoint => {
    const host = boundsHost().getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    return { x: rect.left - host.left, y: rect.top - host.top };
  };

  /** Bubble position: keep last free point, or snap to nearest corner when docked. */
  const resolveBubblePosition = (): PanelPoint => {
    const layout = layoutMetrics();

    if (dock === "left" || dock === "right") {
      const rect = dockedRect(dock, layout);
      const targets = buildSnapTargets({ ...layout, minimized: true });
      return nearestSnapTarget({ x: rect.x, y: rect.y }, targets);
    }

    if (freePos) {
      return { ...freePos };
    }

    return bubblePointFromPanel();
  };

  const minimizePanel = (): void => {
    const point = resolveBubblePosition();
    applyMinimized(true);
    applyFreePosition(point);
  };

  const freePointFromPointer = (clientX: number, clientY: number): PanelPoint => {
    const host = boundsHost().getBoundingClientRect();
    const layout = layoutMetrics();
    const width = minimized ? BUBBLE_SIZE : layout.panelWidth;
    const height = minimized ? BUBBLE_SIZE : layout.panelHeight;
    return {
      x: clamp(
        clientX - host.left - offsetX,
        0,
        Math.max(0, layout.hostWidth - width)
      ),
      y: clamp(
        clientY - host.top - offsetY,
        0,
        Math.max(0, layout.hostHeight - height)
      ),
    };
  };

  const paintFreeDrag = (point: PanelPoint): void => {
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = `${point.x}px`;
    panel.style.top = `${point.y}px`;
    if (!minimized) {
      const layout = layoutMetrics();
      panel.style.width = `${layout.panelWidth}px`;
      panel.style.height = `${layout.panelHeight}px`;
    }
  };

  minimizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    minimizePanel();
  });

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (
      !minimized &&
      target.closest(
        ".folder-panel-actions button, .folder-panel-crumb, .icon-btn"
      )
    ) {
      return;
    }

    dragging = true;
    moved = false;
    dragOnBubble = minimized && !!target.closest(".floating-panel-bubble");
    startX = e.clientX;
    startY = e.clientY;

    if (dock !== "free" && !minimized) {
      const rect = dockedRect(dock, layoutMetrics());
      freePos = { x: rect.x, y: rect.y };
      applyFreePosition(freePos);
    }

    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    panel.setPointerCapture(e.pointerId);
    panel.classList.add("floating-panel--dragging");
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      moved = true;
    }

    const raw = freePointFromPointer(e.clientX, e.clientY);
    const targets = buildSnapTargets(layoutMetrics());
    const { point } = applyMagnet(raw, targets);
    paintFreeDrag(point);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove("floating-panel--dragging");
    panel.releasePointerCapture(e.pointerId);

    if (!moved && dragOnBubble) {
      const point = bubblePointFromPanel();
      applyMinimized(false);
      const nextDock = expandDockFromBubble(point, layoutMetrics().hostWidth);
      if (nextDock === "free") {
        applyFreePosition(point);
      } else {
        applyDock(nextDock);
      }
      moved = false;
      dragOnBubble = false;
      return;
    }

    if (moved) {
      const host = boundsHost().getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      const point = {
        x: rect.left - host.left,
        y: rect.top - host.top,
      };
      const targets = buildSnapTargets(layoutMetrics());
      const { target } = applyMagnet(point, targets);

      if (!minimized && target?.dock && shouldSnap(target, point)) {
        applyDock(target.dock);
      } else if (minimized && target && shouldSnap(target, point)) {
        applyFreePosition({ x: target.x, y: target.y });
      } else {
        applyFreePosition(point);
      }
    }

    moved = false;
    dragOnBubble = false;
  };

  dragHandle.addEventListener("pointerdown", onPointerDown);
  bubbleBtn.addEventListener("pointerdown", onPointerDown);
  panel.addEventListener("pointermove", onPointerMove);
  panel.addEventListener("pointerup", onPointerUp);
  panel.addEventListener("pointercancel", onPointerUp);

  const resizeObserver = new ResizeObserver(() => relayout());
  resizeObserver.observe(boundsHost());

  applyMinimized(initialMinimized);
  if (initialMinimized && initialPosition) {
    applyFreePosition(initialPosition);
  } else if (initialDock === "free" && initialPosition) {
    applyFreePosition(initialPosition);
  } else {
    applyDock(initialDock);
  }

  return {
    setMinimized: (value: boolean) => {
      if (value) {
        if (!minimized) minimizePanel();
        return;
      }
      applyMinimized(false);
      relayout();
    },
    isMinimized: () => minimized,
    resetPosition,
    relayout,
  };
}
