import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fitPopup } from './PopupGeometry';

/** Context menus are measured instead of assuming a particular label length. */
export function PopupMenu({ x, y, children, onClose }: { x: number; y: number; children: ReactNode; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: x, top: y });
    useLayoutEffect(() => {
        const update = () => {
            const rect = ref.current?.getBoundingClientRect();
            if (rect) { const box = fitPopup({ x, y }, rect, { width: innerWidth, height: innerHeight }); setPosition({ left: box.left, top: box.top }); }
        };
        update(); window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [x, y]);
    return createPortal(<div ref={ref} role="menu" onMouseLeave={onClose} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
        style={{ position: 'fixed', ...position, zIndex: 2147483001, boxSizing: 'border-box', maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)', overflow: 'auto', overflowWrap: 'anywhere', background: 'var(--comfy-menu-bg,#333)', color: 'var(--input-text,#ddd)', padding: 6, border: '1px solid #888', borderRadius: 6 }}>{children}</div>, document.body);
}
