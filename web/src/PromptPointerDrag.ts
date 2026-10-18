/** Pointer-driven drop events avoid relying on native dragging inside a canvas overlay. */
export const PROMPT_DRAG_EVENT = 'gallery-prompt-drag';
type Trash = { owner: string; remove?: () => void };
let trash: Trash | undefined;
let cancel: (() => void) | undefined;
export const promptDragTrash = () => trash;
export function clearPromptDrag() { cancel?.(); }

export function startPromptPointerDrag(event: PointerEvent, element: HTMLElement, text: string, type: string, payload: string, remove: (()=>void) | undefined, begin: ()=>void, end: ()=>void) {
    if (event.button !== 0) return;
    clearPromptDrag();
    const owner = element.closest<HTMLElement>('[data-prompt-editor]')?.dataset.promptEditor || '';
    const x = event.clientX, y = event.clientY;
    let active = false, done = false, previous: Element | null = null, ghost: HTMLDivElement | undefined;
    const transfer = new DataTransfer();transfer.effectAllowed = 'copyMove';transfer.setData(type,payload);transfer.setData('text/plain',text);
    const emit = (target: Element, kind: string, pointer: PointerEvent) => {
        const drag = new DragEvent(kind, { bubbles:true, cancelable:true, clientX:pointer.clientX, clientY:pointer.clientY, dataTransfer:transfer });
        target.dispatchEvent(drag);return drag.defaultPrevented;
    };
    const finish = () => {
        if (done) return;done=true;
        document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',finish,true);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',finish);
        ghost?.remove();cancel=undefined;
        if (active) { trash=undefined;end();window.dispatchEvent(new Event(PROMPT_DRAG_EVENT)); }
    };
    const move = (pointer: PointerEvent) => {
        if (pointer.pointerId !== event.pointerId) return;
        if (!element.isConnected) { finish();return; }
        if (!active && Math.hypot(pointer.clientX-x,pointer.clientY-y)<6) return;
        pointer.preventDefault();pointer.stopImmediatePropagation();
        if (!active) {
            active=true;begin();trash={owner,remove};window.dispatchEvent(new Event(PROMPT_DRAG_EVENT));
            if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
            ghost=document.createElement('div');ghost.textContent=text;
            const look=getComputedStyle(element);
            ghost.style.cssText='position:fixed;pointer-events:none;z-index:2147483001;padding:5px 9px;border:1px solid #888;border-radius:8px;max-width:260px;overflow-wrap:anywhere;font:12px system-ui;opacity:.85';
            ghost.style.background=look.backgroundColor;ghost.style.color=look.color;document.body.append(ghost);
        }
        if (ghost) { ghost.style.left=pointer.clientX+12+'px';ghost.style.top=pointer.clientY+12+'px'; }
        const target=document.elementFromPoint(pointer.clientX,pointer.clientY)?.closest('[data-prompt-drop]') || null;
        if (previous && previous!==target) emit(previous,'dragleave',pointer);
        previous=target;if(target)emit(target,'dragover',pointer);
    };
    const up = (pointer: PointerEvent) => {
        if (pointer.pointerId !== event.pointerId) return;
        if (active) {
            pointer.preventDefault();pointer.stopImmediatePropagation();
            const target=document.elementFromPoint(pointer.clientX,pointer.clientY)?.closest('[data-prompt-drop]') || null;
            if(target && emit(target,'dragover',pointer)) emit(target,'drop',pointer);
            const click=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();document.removeEventListener('click',click,true);};
            document.addEventListener('click',click,true);setTimeout(()=>document.removeEventListener('click',click,true),0);
        }
        finish();
    };
    const key = (event: KeyboardEvent) => { if(event.key==='Escape'){if(active){event.preventDefault();event.stopImmediatePropagation();}finish();} };
    cancel=finish;
    document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',finish,true);document.addEventListener('keydown',key,true);window.addEventListener('blur',finish);
}
