import type { FileDetails } from './types';

/** Keep identity URLs unchanged; version only requests for mutable local media. */
export function localMediaUrl(file: Pick<FileDetails, 'url' | 'timestamp' | 'revision'>, root = ''): string {
    if (!file.url.startsWith('/static_gallery/') && !file.url.startsWith('/view?') && !file.url.startsWith('/Gallery/output-file?')) return file.url;
    const [address, fragment] = file.url.split('#', 2), at = address.indexOf('?');
    const path = at < 0 ? address : address.slice(0, at);
    const params = new URLSearchParams(at < 0 ? '' : address.slice(at + 1));
    params.set('gallery_revision', JSON.stringify([root, file.revision || String(file.timestamp || 0)]));
    return path + '?' + params.toString() + (fragment === undefined ? '' : '#' + fragment);
}
