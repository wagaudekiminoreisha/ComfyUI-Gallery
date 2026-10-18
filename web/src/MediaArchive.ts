import { useCallback, useEffect, useRef, useState } from 'react';
import { ComfyAppApi } from './ComfyAppApi';

const EMPTY_ARCHIVE=new Set<string>();

export function useMediaArchive(root: string) {
    const [state, setState] = useState<{ root: string; urls: Set<string> }>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const currentRoot = useRef(root); currentRoot.current = root;
    const revision = useRef(0);
    const writing = useRef(false);
    const channel = useRef<BroadcastChannel | undefined>(undefined);
    const reload = useCallback(async () => {
        const request = ++revision.current;
        try {
            const urls = await ComfyAppApi.archive(root);
            if (request === revision.current && currentRoot.current === root) { setState({ root, urls: new Set(urls) }); setError(''); }
        } catch (error) { if (request === revision.current && currentRoot.current === root) { setError(String(error)); setState(previous=>previous?.root===root?previous:{root,urls:EMPTY_ARCHIVE}); } }
    }, [root]);
    useEffect(() => {
        void reload();
        const refresh = () => { void reload(); };
        window.addEventListener('focus', refresh);
        if (typeof BroadcastChannel !== 'undefined') {
            channel.current = new BroadcastChannel('gallery-archive');
            channel.current.onmessage = refresh;
        }
        return () => { revision.current++; window.removeEventListener('focus', refresh); channel.current?.close(); channel.current = undefined; };
    }, [reload]);
    const update = useCallback(async (urls: string[], archived: boolean) => {
        if (writing.current) throw new Error('An archive operation is already running');
        writing.current = true;
        ++revision.current;
        setBusy(true);
        try {
            const result = await ComfyAppApi.archive(root, urls, archived);
            if (currentRoot.current === root) { ++revision.current; setState({ root, urls: new Set(result) }); setError(''); }
            channel.current?.postMessage('changed');
        } finally { writing.current = false; setBusy(false); }
    }, [root]);
    return { urls: state?.root === root ? state.urls : EMPTY_ARCHIVE, ready: state?.root === root, busy, error, update };
}
