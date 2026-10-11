type Anchor = { top: number; bottom: number; left: number; width: number };
type Viewport = { top: number; left: number; width: number; height: number };

export function getSuggestionPosition(anchor: Anchor, viewport: Viewport) {
  const margin = 16;
  const gap = 6;
  const start = viewport.top + margin;
  const end = Math.max(start, viewport.top + viewport.height - margin);
  const aboveEdge = Math.max(start, Math.min(anchor.top - gap, end));
  const belowEdge = Math.max(start, Math.min(anchor.bottom + gap, end));
  const below = end - belowEdge;
  const above = aboveEdge - start;
  // Prefer the familiar dropdown direction when several rows fit below.
  const placeAbove = below < Math.min(240, above);
  const width = Math.max(0, Math.min(anchor.width, viewport.width - 2 * margin));
  return {
    left: Math.max(viewport.left + margin, Math.min(anchor.left, viewport.left + viewport.width - margin - width)),
    top: placeAbove ? aboveEdge : belowEdge,
    width,
    maxHeight: Math.min(420, placeAbove ? above : below),
    transform: placeAbove ? "translateY(-100%)" : undefined,
  };
}
