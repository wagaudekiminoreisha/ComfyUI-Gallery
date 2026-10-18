/** Measure intrinsic content rather than the editor stretched to its canvas widget. */
export function editorContentHeight(host: HTMLElement): number {
    const content = host.firstElementChild as HTMLElement | null;
    if (!content) return 320;
    const style = getComputedStyle(content), number = (value: string) => Number.parseFloat(value) || 0;
    const children = [...content.children].filter((element): element is HTMLElement => element instanceof HTMLElement && getComputedStyle(element).display !== 'none');
    return Math.ceil(children.reduce((height, child) => {
        const look = getComputedStyle(child);
        return height + child.offsetHeight + number(look.marginTop) + number(look.marginBottom);
    }, 0) + Math.max(0, children.length - 1) * number(style.rowGap) + number(style.paddingTop) + number(style.paddingBottom));
}

/** Fit after React/canvas layout settles; preserve width and manual extra height otherwise. */
export function encoderSizing(node: any, host: HTMLElement) {
    let height = 320, overhead = 80, shrink = false, disposed = false, frame = 0, settle = 0;
    const options = { serialize: false, hideOnZoom: false, getMinHeight: () => 240, getHeight: () => height };
    const fit = () => {
        if (disposed || !host.isConnected) return;
        height = Math.max(240, Math.min(680, editorContentHeight(host)));
        const wanted = Math.max(300, height + overhead), current = Number(node.size?.[1]) || 460;
        if (shrink || Math.abs(wanted-current)>1) {
            if (Math.abs(wanted-current)>1) node.setSize?.([Math.max(400, Number(node.size?.[0]) || 400), wanted]);
            node.setDirtyCanvas?.(true, true);
        }
    };
    const request = (allowShrink = false) => {
        shrink ||= allowShrink;cancelAnimationFrame(frame);clearTimeout(settle);
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(fit); });
        settle = window.setTimeout(() => { fit();shrink = false; }, 120);
    };
    const changes = new MutationObserver(() => request());
    changes.observe(host, { childList: true, subtree: true, attributes: true, characterData: true });
    const widths = new ResizeObserver(() => request());widths.observe(host);
    return {
        options,
        calibrate() { const measured = Number(node.computeSize?.()[1]);if (Number.isFinite(measured) && measured > height) overhead = Math.min(300, Math.max(60, measured-height)); },
        request,
        dispose() { disposed=true;cancelAnimationFrame(frame);clearTimeout(settle);changes.disconnect();widths.disconnect(); },
    };
}
