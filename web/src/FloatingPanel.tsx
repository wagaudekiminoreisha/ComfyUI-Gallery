import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, Space, theme, ConfigProvider, type ModalProps } from 'antd';

const panels = new Map<string, { base: number; order: number; setLayer: (value: number) => void }>();
let order = 0;
export const focusPanel = (key: string) => requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('gallery-focus-panel', { detail: key })));
function raisePanel(id: string) {
    const panel = panels.get(id); if (!panel) return;
    panel.order = ++order;
    const base = Math.max(3010, ...[...panels.values()].map(item => item.base));
    [...panels.values()].sort((a, b) => a.order - b.order).forEach((item, index) => item.setLayer(base + index));
}
type Box = { x: number; y: number; width: number; height: number };
function fit(box: Box): Box {
    const width = Math.min(Math.max(320, box.width), Math.max(200, innerWidth - 16));
    const height = Math.min(Math.max(180, box.height), Math.max(120, innerHeight - 16));
    return { width, height, x: Math.max(8, Math.min(box.x, innerWidth - width - 8)), y: Math.max(8, Math.min(box.y, innerHeight - height - 8)) };
}
const SETTINGS_KEY = 'comfy-ui-gallery-settings';
/** Gallery setting "Window mode": read straight from storage so panels work wherever they are mounted. */
const readCoverSetting = () => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')?.panelMode === 'cover'; } catch { return false; } };
/** Non-modal workspace window: interacting with references does not dismiss an editor. In "cover" mode (a gallery setting, or the maximize button) it fills the page instead. */
/** `initialSize` is the first (and reset) size; `bodyStyle` replaces the content area's padding/layout (the viewer fills it edge to edge). */
export function FloatingPanel({ panelKey, title, open, onCancel, children, footer, width = 850, className = '', afterOpenChange, initialSize, bodyStyle, zIndex = 3010, focusKey }: ModalProps & { panelKey: string; focusKey?: unknown; initialSize?: { width: number; height: number }; bodyStyle?: CSSProperties }) {
    const { token } = theme.useToken();
    const id = useId(); const [layer, setLayer] = useState(zIndex); const root = useRef<HTMLDivElement>(null);
    const initial = (): Box => {
        const w = initialSize?.width ?? (typeof width === 'number' ? width : Math.min(1000, innerWidth * .8));
        const h = initialSize?.height ?? innerHeight * .82;
        return fit({ x: (innerWidth - w) / 2, y: Math.max(8, Math.min(60, innerHeight - h - 8)), width: w, height: h });
    };
    const [box, setBox] = useState<Box>(() => { try { const saved = JSON.parse(localStorage.getItem('gallery-panel:' + panelKey) || 'null'); if (saved && ['x','y','width','height'].every(key => Number.isFinite(saved[key])) &&
        // A window with a preferred size (the viewer) does not come back at a fraction of it.
        !(initialSize && (saved.width < initialSize.width * .5 || saved.height < initialSize.height * .5))) return fit(saved); } catch { /* Use default layout. */ } return initial(); });
    const latest = useRef(box); latest.current = box;
    const [collapsed, setCollapsed] = useState(false);
    const [coverSetting, setCoverSetting] = useState(readCoverSetting);
    const [maximized, setMaximized] = useState(false);
    const cover = coverSetting || maximized;
    const folded = collapsed && !cover;
    useEffect(() => { const refresh = () => setCoverSetting(readCoverSetting()); window.addEventListener('storage', refresh); return () => window.removeEventListener('storage', refresh); }, []);
    const drag = useRef<{ x: number; y: number; box: Box; resize: boolean } | undefined>(undefined);
    const persist = (value: Box) => { try { localStorage.setItem('gallery-panel:' + panelKey, JSON.stringify(value)); } catch { /* Layout persistence is optional. */ } };
    const place = (value: Box) => { const next = fit(value); setBox(next); persist(next); };
    const raise = () => raisePanel(id);
    useEffect(() => {
        if (!open) return;
        panels.set(id, { base: zIndex, order: ++order, setLayer });
        const focus = (event: Event) => { if ((event as CustomEvent).detail === panelKey) { setCollapsed(false); raise(); root.current?.focus(); } };
        window.addEventListener('gallery-focus-panel', focus);
        raise();
        return () => { panels.delete(id); window.removeEventListener('gallery-focus-panel', focus); };
    }, [open, zIndex, id, panelKey]);
    useEffect(() => { if (open) { setCollapsed(false); raise(); } }, [focusKey, open]);
    useEffect(() => { if (!open) return; setCollapsed(false); setMaximized(false); setBox(value => fit(value)); const frame = requestAnimationFrame(() => { raise(); root.current?.focus(); afterOpenChange?.(true); }); return () => cancelAnimationFrame(frame); }, [open]);
    useEffect(() => { const resize = () => setBox(value => fit(value)); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
    const start = (event: PointerEvent<HTMLElement>, resize = false) => {
        if (cover || event.button !== 0 || (!resize && (event.target as HTMLElement).closest('button,input,a'))) return;
        event.preventDefault(); raise(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, box: latest.current, resize };
    };
    const move = (event: PointerEvent<HTMLElement>) => { const state = drag.current; if (!state) return; const dx = event.clientX - state.x, dy = event.clientY - state.y; setBox(fit(state.resize ? { ...state.box, width: state.box.width + dx, height: state.box.height + dy } : { ...state.box, x: state.box.x + dx, y: state.box.y + dy })); };
    const stop = () => { if (drag.current) persist(latest.current); drag.current = undefined; };
    const collapse = () => { if (!collapsed) root.current?.querySelectorAll('video,audio').forEach(media => (media as HTMLMediaElement).pause()); setCollapsed(value => !value); };
    if (!open) return null;
    const frame = cover
        ? { left: 0, top: 0, width: '100vw', height: '100vh', maxHeight: '100vh', borderRadius: 0 }
        : { left: box.x, top: box.y, width: box.width, height: folded ? 'auto' : box.height, maxHeight: 'calc(100vh - 16px)', borderRadius: 10 };
    return createPortal(<div ref={root} role="dialog" aria-modal="false" aria-labelledby={id} tabIndex={-1} data-panel-key={panelKey} data-panel-mode={cover ? 'cover' : 'floating'} className={'cg-floating-panel ' + className}
        onPointerDownCapture={event => { if (root.current?.contains(event.target as Node)) raise(); }} onFocusCapture={event => { if (root.current?.contains(event.target as Node)) raise(); }} onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented && !(event.target as HTMLElement).closest('input,textarea,[role=combobox],[role=menu]')) { event.stopPropagation(); onCancel?.(event as any); } }}
        style={{ position:'fixed', ...frame, display:'flex', flexDirection:'column', zIndex:layer, background:token.colorBgElevated, color:token.colorText, border:'1px solid ' + token.colorBorder, boxShadow:'0 8px 32px #0008', overflow:'hidden', fontSize:token.fontSize }}>
        <div onPointerDown={event => start(event)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onDoubleClick={event => { if (!cover && !(event.target as HTMLElement).closest('button')) collapse(); }} style={{ cursor: cover ? 'default' : 'move', touchAction:'none', display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:token.colorFillAlter, flexShrink:0 }}>
            <strong id={id} style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={cover ? undefined : 'Drag to move; double-click to collapse'}>{title}</strong>
            <Space size={3}>
                {!cover && <Button size="small" title="Place on left half" aria-label="Place panel left" onClick={() => place({x:8,y:8,width:innerWidth/2-12,height:innerHeight-16})}>◧</Button>}
                {!cover && <Button size="small" title="Place on right half" aria-label="Place panel right" onClick={() => place({x:innerWidth/2+4,y:8,width:innerWidth/2-12,height:innerHeight-16})}>◨</Button>}
                {!cover && <Button size="small" title="Reset panel layout" aria-label="Reset panel layout" onClick={() => place(initial())}>↺</Button>}
                {!coverSetting && <Button size="small" title={maximized ? 'Restore the floating window' : 'Cover the whole page'} aria-label={maximized ? 'Restore panel' : 'Maximize panel'} onClick={() => setMaximized(value => !value)}>{maximized ? '❐' : '⛶'}</Button>}
                {!cover && <Button size="small" aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} onClick={collapse}>{collapsed ? '+' : '−'}</Button>}
                <Button size="small" aria-label="Close" onClick={onCancel}>×</Button>
            </Space>
        </div>
        <div style={{ display:'block', overflow:'auto', minHeight:0, flex:1, padding:16, ...bodyStyle, ...(folded ? { display:'none' } : {}) }}><ConfigProvider theme={{ token: { zIndexPopupBase: layer + 10 } }}>{children}</ConfigProvider></div>
        {!folded && footer && <div style={{padding:'8px 16px',borderTop:'1px solid '+token.colorBorder,flexShrink:0}}>{typeof footer === 'function' ? null : footer}</div>}
        {!folded && !cover && <div role="separator" aria-label="Resize panel" title="Drag to resize" onPointerDown={event => start(event,true)} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} style={{position:'absolute',right:0,bottom:0,width:18,height:18,cursor:'nwse-resize',touchAction:'none',background:'linear-gradient(135deg,transparent 55%, '+token.colorBorder+' 55%, '+token.colorBorder+' 65%, transparent 65%)'}} />}
    </div>, document.body);
}
