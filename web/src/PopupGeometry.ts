/** Fixed popups use border-box dimensions and an inset on every viewport edge. */
export function fitPopup(point: { x: number; y: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
    const margin = 8;
    const width = Math.min(size.width, Math.max(0, viewport.width - margin * 2));
    const height = Math.min(size.height, Math.max(0, viewport.height - margin * 2));
    return { left: Math.max(margin, Math.min(point.x, viewport.width - width - margin)),
        top: Math.max(margin, Math.min(point.y, viewport.height - height - margin)), width, height };
}

export function suggestionPlacement(anchor: { left: number; top: number; bottom: number; width: number }, viewport: { width: number; height: number }) {
    const below = Math.max(0, viewport.height - anchor.bottom - 10);
    const above = Math.max(0, anchor.top - 10);
    const down = below >= 180 || below >= above;
    const maxHeight = Math.min(180, down ? below : above);
    const box = fitPopup({ x: anchor.left, y: down ? anchor.bottom + 2 : anchor.top - maxHeight - 2 },
        { width: Math.max(anchor.width, 200), height: maxHeight }, viewport);
    return { left: box.left, width: box.width, top: down ? box.top : undefined,
        bottom: down ? undefined : viewport.height - anchor.top + 2, maxHeight };
}
