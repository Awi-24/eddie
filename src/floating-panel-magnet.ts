export type PanelDock = "left" | "right" | "free";

export interface PanelPoint {
  x: number;
  y: number;
}

export interface SnapTarget {
  id: string;
  x: number;
  y: number;
  dock?: PanelDock;
  guide?: "left" | "right" | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br";
}

export interface MagnetLayout {
  margin: number;
  hostWidth: number;
  hostHeight: number;
  panelWidth: number;
  panelHeight: number;
  bubbleSize: number;
  minimized: boolean;
}

const PULL_RADIUS = 88;
const SNAP_RADIUS = 36;

export function panelWidthForHost(hostWidth: number): number {
  const margin = panelMargin(hostWidth);
  const vw = hostWidth * 0.28;
  return Math.round(Math.min(320, Math.max(200, vw), hostWidth - margin * 2));
}

export function panelMargin(hostWidth: number): number {
  return hostWidth < 480 ? 6 : 10;
}

export function buildSnapTargets(layout: MagnetLayout): SnapTarget[] {
  const { margin, hostWidth, hostHeight, panelWidth, panelHeight, bubbleSize, minimized } =
    layout;

  if (minimized) {
    const maxX = Math.max(margin, hostWidth - bubbleSize - margin);
    const maxY = Math.max(margin, hostHeight - bubbleSize - margin);
    return [
      { id: "corner-tl", x: margin, y: margin, guide: "corner-tl" },
      { id: "corner-tr", x: maxX, y: margin, guide: "corner-tr" },
      { id: "corner-bl", x: margin, y: maxY, guide: "corner-bl" },
      { id: "corner-br", x: maxX, y: maxY, guide: "corner-br" },
    ];
  }

  const maxY = Math.max(margin, hostHeight - panelHeight - margin);
  const midY = Math.round(maxY / 2);
  const rightX = Math.max(margin, hostWidth - panelWidth - margin);

  return [
    {
      id: "dock-left",
      x: margin,
      y: midY,
      dock: "left",
      guide: "left",
    },
    {
      id: "dock-right",
      x: rightX,
      y: midY,
      dock: "right",
      guide: "right",
    },
  ];
}

export function dockedRect(
  dock: PanelDock,
  layout: MagnetLayout
): PanelPoint & { width: number; height: number } {
  const { margin, hostWidth, hostHeight, panelWidth } = layout;
  const height = Math.max(160, hostHeight - margin * 2);
  if (dock === "right") {
    return {
      x: Math.max(margin, hostWidth - panelWidth - margin),
      y: margin,
      width: panelWidth,
      height,
    };
  }
  return { x: margin, y: margin, width: panelWidth, height };
}

export function applyMagnet(
  raw: PanelPoint,
  targets: SnapTarget[]
): { point: PanelPoint; target: SnapTarget | null } {
  let best: SnapTarget | null = null;
  let bestDist = Infinity;

  for (const target of targets) {
    const dx = raw.x - target.x;
    const dy = raw.y - target.y;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  }

  if (!best || bestDist > PULL_RADIUS) {
    return { point: raw, target: null };
  }

  const t = 1 - bestDist / PULL_RADIUS;
  const pull = t * t * 0.82;
  return {
    point: {
      x: raw.x + (best.x - raw.x) * pull,
      y: raw.y + (best.y - raw.y) * pull,
    },
    target: best,
  };
}

export function shouldSnap(target: SnapTarget | null, point: PanelPoint): boolean {
  if (!target) return false;
  return Math.hypot(point.x - target.x, point.y - target.y) <= SNAP_RADIUS;
}

export function nearestSnapTarget(
  point: PanelPoint,
  targets: SnapTarget[]
): PanelPoint {
  if (!targets.length) return point;
  let best = targets[0]!;
  let bestDist = Infinity;
  for (const target of targets) {
    const dist = Math.hypot(point.x - target.x, point.y - target.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = target;
    }
  }
  return { x: best.x, y: best.y };
}

export function inferDockFromPosition(
  pos: PanelPoint | null,
  hostWidth: number,
  panelWidth: number
): PanelDock {
  if (!pos) return "left";
  const margin = panelMargin(hostWidth);
  if (pos.x <= margin + 24) return "left";
  if (pos.x >= hostWidth - panelWidth - margin - 24) return "right";
  return "free";
}

export function expandDockFromBubble(
  bubble: PanelPoint,
  hostWidth: number
): PanelDock {
  if (bubble.x < hostWidth * 0.28) return "left";
  if (bubble.x > hostWidth * 0.72) return "right";
  return "free";
}
