"""Read-only workflow diagnostics. No model loading, tensor copies or allocator resets."""
import json
import math
import os


def token_load(tokens):
    """Keep tokenizer streams separate; encoded slots include special/padding tokens."""
    if not isinstance(tokens, dict):
        return []
    rows = []
    for stream, batches in tokens.items():
        if not isinstance(batches, (list, tuple)):
            continue
        batches = [batch for batch in batches if isinstance(batch, (list, tuple))]
        if not batches:
            continue
        sizes = [len(batch) for batch in batches]
        triples = all(isinstance(token, (tuple, list)) and len(token) >= 3
                      and isinstance(token[2], int) for batch in batches for token in batch)
        row = {'stream': str(stream), 'chunks': len(batches), 'chunk_sizes': sizes,
               'encoded_slots': sum(sizes)}
        if triples:
            row['content_tokens'] = sum(token[2] > 0 for batch in batches for token in batch)
        rows.append(row)
    return rows


def encoder_load(clip, text, tokens):
    # Word IDs distinguish actual prompt tokens from padding on supported tokenizers.
    try:
        detailed = clip.tokenize(text, return_word_ids=True)
        rows = token_load(detailed)
    except Exception:
        rows = []
    return rows or token_load(tokens)


def hardware_snapshot(device=None):
    result = {}
    try:
        import psutil
        ram = psutil.virtual_memory()
        result.update(ram_total_bytes=ram.total, ram_available_bytes=ram.available)
    except Exception:
        pass
    try:
        import comfy.model_management as mm
        device = device if device is not None else mm.get_torch_device()
        result.update(device=mm.get_torch_device_name(device), device_type=str(getattr(device, 'type', 'unknown')))
        # ComfyUI currently exposes placeholder capacity for DirectML.
        if getattr(mm, 'directml_enabled', False):
            result['memory_note'] = 'Device memory capacity is unavailable for DirectML.'
        else:
            result.update(device_total_bytes=int(mm.get_total_memory(device)),
                          device_available_bytes=int(mm.get_free_memory(device)))
            if getattr(device, 'type', None) in ('cpu', 'mps'):
                result['memory_note'] = 'Device capacity uses system/shared memory on this backend.'
    except Exception:
        result['memory_note'] = 'ComfyUI device memory information is unavailable.'
    return result


def upstream_nodes(prompt, node_id):
    if not isinstance(prompt, dict):
        return {}
    visited, pending = {}, [str(node_id)]
    while pending:
        key = pending.pop()
        if key in visited or key not in prompt:
            continue
        node = prompt[key]
        if not isinstance(node, dict):
            continue
        visited[key] = node
        for value in node.get('inputs', {}).values():
            if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str) and type(value[1]) is int:
                pending.append(value[0])
    return visited


def graph_inventory(nodes):
    processes, sources, files, samplers = [], [], [], []
    file_inputs = {'ckpt_name': 'checkpoints', 'unet_name': 'diffusion_models',
                   'control_net_name': 'controlnet', 'lora_name': 'loras',
                   'clip_name': 'text_encoders', 'vae_name': 'vae',
                   'clip_vision': 'clip_vision', 'ipadapter_file': 'ipadapter'}
    for key, node in nodes.items():
        kind, inputs = str(node.get('class_type', 'Unknown')), node.get('inputs', {})
        lower = kind.lower()
        if any(name in lower for name in ('controlnet', 'ipadapter', 'lora', 'cliptextencode', 'gallerypromptencode')):
            processes.append({'node_id': key, 'type': kind, 'parameters': {name: inputs[name] for name in
                              ('strength', 'strength_model', 'strength_clip', 'weight', 'start_percent', 'end_percent', 'start_at', 'end_at')
                              if isinstance(inputs.get(name), (int, float, str))}})
        if 'sampler' in lower:
            samplers.append({'node_id': key, 'type': kind, **{name: inputs[name] for name in
                             ('steps', 'cfg', 'denoise', 'sampler_name', 'scheduler')
                             if isinstance(inputs.get(name), (int, float, str))}})
        if kind == 'GalleryImageSource':
            try:
                manifest = json.loads(inputs.get('sources', '{}'))
                images = manifest.get('images', [])
                if manifest.get('layout', 'single') == 'single':
                    active = manifest.get('active_index', 0)
                    images = images[active:active + 1]
                names = [str(image.get('input_name', '')) for image in images if isinstance(image, dict)]
                sizes = []
                for name in names:
                    try:
                        import folder_paths
                        from PIL import Image
                        try: from .image_source import resolve_input
                        except ImportError: from image_source import resolve_input
                        with Image.open(resolve_input(folder_paths.get_input_directory(), name)) as image:
                            sizes.append({'name': name, 'width': image.width, 'height': image.height})
                    except Exception:
                        pass
                sources.append({'node_id': key, 'images': len(images), 'layout': manifest.get('layout', 'single'),
                                'names': names, 'sizes': sizes})
            except (ValueError, TypeError, AttributeError):
                sources.append({'node_id': key, 'note': 'Source manifest unavailable.'})
        for name, category in file_inputs.items():
            value = inputs.get(name)
            if not isinstance(value, str):
                continue
            record = {'node_id': key, 'category': category, 'name': value}
            try:
                import folder_paths
                path = folder_paths.get_full_path(category, value)
                if path and os.path.isfile(path):
                    record['disk_bytes'] = os.path.getsize(path)
            except Exception:
                pass
            files.append(record)
    return {'processes': processes, 'source_images': sources, 'model_files': files, 'samplers': samplers}


def tensor_info(tensor):
    shape = [int(size) for size in getattr(tensor, 'shape', ())]
    result = {'shape': shape}
    try:
        result['bytes'] = int(tensor.numel() * tensor.element_size())
    except (AttributeError, TypeError):
        pass
    return result


def model_assessment(model, latent, hardware, conditioning_batch_factor=1):
    result = {}
    if model is None:
        return {'note': 'Connect MODEL for model size and hardware-relative memory estimates.'}
    try:
        result['weight_bytes'] = int(model.model_size())
        result['dtype'] = str(model.model_dtype())
    except Exception:
        result['note'] = 'Connected model does not expose its weight size or dtype.'
    try:
        result['loaded_weight_bytes'] = int(model.loaded_size())
    except Exception:
        pass
    samples = latent.get('samples') if isinstance(latent, dict) else None
    if samples is not None:
        result['latent'] = tensor_info(samples)
        try:
            shape = list(samples.shape)
            shape[0] *= conditioning_batch_factor
            result['conditioning_batch_factor'] = conditioning_batch_factor
            estimate = float(model.memory_required(shape))
            if math.isfinite(estimate) and estimate >= 0:
                result['sampler_estimate_bytes'] = int(estimate)
        except Exception:
            pass
    if 'weight_bytes' in result and 'sampler_estimate_bytes' in result:
        base = result['weight_bytes'] + result['sampler_estimate_bytes']
        result['base_estimate_bytes'] = base
        total = hardware.get('device_total_bytes')
        if total:
            result['capacity_fraction'] = base / total
            result['assessment'] = ('Base estimate exceeds device capacity; offloading may be needed.' if base > total else
                                    'Base estimate is within device capacity; auxiliary models and peaks are not included.')
    result['estimate_note'] = f'Model-reported estimate for the latent batch with {conditioning_batch_factor} conditioning branch(es) together. ComfyUI may serialize branches. Excludes ControlNet/IPAdapter, CLIP, VAE, long-context attention overhead, previews and allocator peaks. Not a fit guarantee.'
    return result


def auxiliary_load(model, positive, negative):
    """Inspect live ControlNet and IPAdapter Plus objects without moving their tensors."""
    models, contexts, seen_models, seen_contexts = [], [], set(), set()
    for conditioning in (positive, negative):
        for row in conditioning or []:
            if not isinstance(row, (list, tuple)) or len(row) != 2 or not isinstance(row[1], dict):
                continue
            control = row[1].get('control')
            if control is None:
                continue
            try:
                for wrapped in control.get_models():
                    if id(wrapped) in seen_models:
                        continue
                    seen_models.add(id(wrapped))
                    models.append({'kind': 'ControlNet', 'weight_bytes': int(wrapped.model_size())})
            except Exception:
                pass
    try:
        patches = model.model_options.get('transformer_options', {}).get('patches_replace', {}).get('attn2', {})
        for patch in patches.values():
            for options in getattr(patch, 'kwargs', []):
                if not isinstance(options, dict):
                    continue
                adapter = options.get('ipadapter')
                if adapter is None:
                    continue
                if id(adapter) not in seen_models:
                    seen_models.add(id(adapter))
                    tensors = {id(tensor): tensor for tensor in list(adapter.parameters()) + list(adapter.buffers())}
                    models.append({'kind': 'IPAdapter Plus', 'weight_bytes': sum(tensor.numel() * tensor.element_size() for tensor in tensors.values())})
                for side in ('cond', 'uncond'):
                    embedding = options.get(side)
                    if embedding is None or id(embedding) in seen_contexts:
                        continue
                    seen_contexts.add(id(embedding))
                    info = tensor_info(embedding)
                    contexts.append({'kind': 'IPAdapter Plus', 'side': side, **info,
                                     'image_context_slots': info['shape'][-2] if len(info['shape']) >= 3 else None})
    except Exception:
        pass
    return {'auxiliary_models': models, 'image_contexts': contexts}


class GalleryLoadReport:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'images': ('IMAGE',)},
                'optional': {'model': ('MODEL',), 'latent': ('LATENT',), 'positive': ('CONDITIONING',), 'negative': ('CONDITIONING',), 'clip': ('CLIP',)},
                'hidden': {'prompt': 'PROMPT', 'extra_pnginfo': 'EXTRA_PNGINFO', 'unique_id': 'UNIQUE_ID'}}

    RETURN_TYPES = ('IMAGE', 'STRING')
    RETURN_NAMES = ('images', 'report_json')
    FUNCTION = 'report'
    CATEGORY = 'utils/gallery'
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float('nan')  # Hardware availability is a fresh snapshot on every queue.

    def report(self, images, model=None, latent=None, positive=None, negative=None, clip=None, prompt=None, extra_pnginfo=None, unique_id=None):
        nodes = upstream_nodes(prompt, unique_id)
        # Use the same key as Gallery Prompt Encode, including cached encoder metadata.
        try:
            from .prefix_library import RESOLVED_KEY
        except ImportError:
            from prefix_library import RESOLVED_KEY
        metadata = (extra_pnginfo or {}).get(RESOLVED_KEY, {})
        encoders = []
        for key, node in nodes.items():
            if node.get('class_type') != 'GalleryPromptEncode':
                continue
            entry = metadata.get(key, {})
            encoders.append({'node_id': key, 'token_streams': entry.get('token_load', []),
                             'rules_applied': len(entry.get('rules_applied', {}).get('rulesets', [])),
                             'diagnostic_context': entry.get('diagnostic_context'),
                             'note': '' if entry.get('token_load') else 'No runtime token measurement available; rerun this encoder.'})
        for side, conditioning in [('positive', positive), ('negative', negative)]:
            for row in conditioning or []:
                entry = row[1].get('gallery_load') if isinstance(row, (list, tuple)) and len(row) == 2 and isinstance(row[1], dict) else None
                if isinstance(entry, dict):
                    key = entry.get('node_id')
                    encoders = [item for item in encoders if item['node_id'] != key]
                    encoders.append({**entry, 'side': side, 'conditioning': tensor_info(row[0]),
                                     'note': 'Measured when this conditioning was encoded; retained through cache.'})
        for encoder in encoders:
            context = encoder.pop('diagnostic_context', None)
            if clip is not None and context:
                try:
                    try: from .prompt_load import diagnose_prompt
                    except ImportError: from prompt_load import diagnose_prompt
                    encoder['diagnostics'] = diagnose_prompt(context, clip, encoder.get('token_streams', []))
                except Exception as error:
                    encoder['diagnostics'] = {'note': 'Prompt attribution unavailable: ' + str(error)}
            else:
                encoder['diagnostics'] = {'note': 'Connect the same CLIP used by this encoder for group/ruleset attribution.' if context else 'Rerun this encoder to record group provenance.'}
        hardware = hardware_snapshot(getattr(model, 'load_device', None))
        cfg_values = [node.get('inputs', {}).get('cfg') for node in nodes.values()]
        branch_factor = 2 if any(isinstance(cfg, (int, float)) and cfg > 1 for cfg in cfg_values) else 1
        report = {'version': 1, 'hardware': hardware, 'encoders': encoders, 'output_images': tensor_info(images),
                  'model': model_assessment(model, latent, hardware, branch_factor), **graph_inventory(nodes),
                  **auxiliary_load(model, positive, negative),
                  'notes': ['Token counts are per text encoder stream, not a combined context limit.',
                            'Encoded slots include special tokens and padding; content counts exclude them when the tokenizer supplies word IDs.',
                            'Source image pixels and image-context slots are not text tokens. Live auxiliary weights are reported when supported objects are connected; other adapters remain graph inventory. Process rows are not measured runtime or model residency.',
                            'File sizes are storage bytes, not GPU memory. Available memory is the ComfyUI host snapshot when this report executes.']}
        encoded = json.dumps(report, ensure_ascii=False, allow_nan=False)
        return {'ui': {'load_report': [report]}, 'result': (images, encoded)}
