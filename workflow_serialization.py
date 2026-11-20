"""Read the lossless Gallery workflow archive without changing stored exports."""
import base64
import copy
import json
import zlib

MAX_BYTES = 64 * 1024 * 1024


def restore_workflow_node(node):
    if node.get('type') not in ('GalleryImageSource', 'GalleryPromptEncode', 'GalleryHybridPrompt'):
        return node
    archive = node.get('properties', {}).get('gallery_workflow_archive')
    if not archive:
        return node
    size = archive.get('bytes')
    data = archive.get('data')
    if (archive.get('version') != 1 or archive.get('codec') != 'gzip-base64'
            or type(size) is not int or not 0 <= size <= MAX_BYTES
            or not isinstance(data, str) or len(data) > MAX_BYTES * 2):
        raise ValueError('Unsupported or oversized Gallery workflow archive')
    try:
        decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
        raw = decoder.decompress(base64.b64decode(data, validate=True), size + 1)
        if len(raw) != size or not decoder.eof or decoder.unused_data:
            raise ValueError('Gallery workflow archive size mismatch')
        payload = json.loads(raw)
        if not isinstance(payload.get('properties'), dict):
            raise ValueError('Invalid Gallery workflow archive properties')
        result = copy.deepcopy(node)
        properties = result['properties']
        properties.pop('gallery_workflow_archive')
        properties.update(payload['properties'])
        pool = payload.get('metadata', [])

        def metadata(index):
            if type(index) is not int or not 0 <= index < len(pool) or not isinstance(pool[index], dict):
                raise ValueError('Invalid Gallery workflow metadata reference')
            return copy.deepcopy(pool[index])

        widgets = result.get('widgets_values', [])
        if 'hybridWidgets' in payload:
            saved=payload['hybridWidgets']
            if not isinstance(saved,list) or len(saved)!=2 or any(not isinstance(value,str) for value in saved) or len(widgets)<2:raise ValueError('Invalid hybrid workflow widget archive')
            widgets[:2]=saved
        if 'sourceMetadata' in payload:
            manifest = json.loads(widgets[0])
            for image, index in payload['sourceMetadata']:
                if type(image) is not int or not 0 <= image < len(manifest['images']):
                    raise ValueError('Invalid Gallery source image reference')
                manifest['images'][image]['metadata'] = metadata(index)
            widgets[0] = json.dumps(manifest, ensure_ascii=False)
        for image in properties.get('gallery_source_history', []):
            value = image.get('metadata') if isinstance(image, dict) else None
            ref = value.get('__gallery_archive_metadata') if isinstance(value, dict) else None
            if type(ref) is int:
                image['metadata'] = metadata(ref)
        named = properties.get('gallery_encoder_widgets', {})
        if named.get('version') == 2:
            names = ('text', 'source_mode', 'hair_policy', 'rules_state', 'prefix_snapshots', 'source_image_exclusions')
            values = {}
            for name, index in named.get('fields', {}).items():
                if name not in names or type(index) is not int or not 0 <= index < len(widgets):
                    raise ValueError('Invalid Gallery encoder widget reference')
                values[name] = widgets[index]
            properties['gallery_encoder_widgets'] = {'version': 1, 'values': values}
        return result
    except (ValueError, TypeError, KeyError, IndexError, AttributeError, zlib.error) as error:
        raise ValueError('Cannot restore Gallery workflow state: ' + str(error)) from error
