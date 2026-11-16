import { useEffect, useState } from 'react';

export const POPUP_ALIGN = { overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true }, htmlRegion: 'visible' as const };

/** Give the popup aligner its actual width, including after a window resize. */
export function usePopupWidth(preferred: number) {
    const [viewport, setViewport] = useState(() => innerWidth);
    useEffect(() => { const resize = () => setViewport(innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
    return Math.min(preferred, Math.max(1, viewport - 16));
}
