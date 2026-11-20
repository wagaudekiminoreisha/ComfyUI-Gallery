import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fitPopup } from './PopupGeometry';

/** Context menus are measured instead of assuming a particular label length. */
export function PopupMenu({ x, y, children, onClose }: { x: number; y: number; children: ReactNode; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const close=useRef(onClose);close.current=onClose;
    useLayoutEffect(()=>{
        const previous=document.activeElement as HTMLElement|null;
        ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({preventScroll:true});
        const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))close.current();};
        document.addEventListener('pointerdown',outside,true);
        return()=>{document.removeEventListener('pointerdown',outside,true);if(ref.current?.contains(document.activeElement)||document.activeElement===document.body)previous?.focus({preventScroll:true});};
    },[]);
    const [position, setPosition] = useState({ left: x, top: y });
    useLayoutEffect(() => {
        const update = () => {
            const rect = ref.current?.getBoundingClientRect();
            if (rect) { const box = fitPopup({ x, y }, rect, { width: innerWidth, height: innerHeight }); setPosition({ left: box.left, top: box.top }); }
        };
        update(); window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [x, y]);
    return createPortal(<div ref={ref} role="menu" onPointerDown={event=>event.stopPropagation()} onContextMenu={event=>event.preventDefault()} onKeyDown={event => {
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
        else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
            event.preventDefault();event.stopPropagation();const items=[...ref.current!.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')];const at=items.indexOf(document.activeElement as HTMLElement);
            items[event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
        }else if(event.key==='Tab')onClose();
    }}
        style={{ position: 'fixed', ...position, zIndex: 2147483001, boxSizing: 'border-box', maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)', overflow: 'auto', overflowWrap: 'anywhere', background: 'var(--comfy-menu-bg,#333)', color: 'var(--input-text,#ddd)', padding: 6, border: '1px solid #888', borderRadius: 6 }}>{children}</div>, document.body);
}
