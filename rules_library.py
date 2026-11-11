"""User-scoped, revision-checked ruleset library and prefix attachments."""
import asyncio
from contextvars import ContextVar
import hashlib
import json
import os
from pathlib import Path
import tempfile
import threading
from urllib.parse import urlsplit
from aiohttp import web
from .prompt_rules import validate_definition, validate_boxes

LOCK=threading.RLock()
RULESET_MODES = ('global', 'on-demand', 'disabled')


def global_rule_policy(library):
    availability = library.get('availability', {})
    return {
        'globals': [dict(box, origin='global') for box in library.get('globals', [])
                    if availability.get(box['definition']['id'], 'global') == 'global'],
        'disabled': [id for id, mode in availability.items() if mode == 'disabled'],
    }


def validate_library(value):
    if not isinstance(value,dict) or value.get('version')!=1:raise ValueError('Invalid rules library version.')
    definitions=value.get('definitions',[])
    if not isinstance(definitions,list) or len(definitions)>500:raise ValueError('At most 500 rulesets.')
    ids=set()
    for definition in definitions:
        validate_definition(definition)
        if definition['id'] in ids:raise ValueError('Duplicate ruleset ID.')
        ids.add(definition['id'])
    validate_boxes(value.get('globals',[]))
    availability = value.get('availability', {})
    if (not isinstance(availability, dict) or len(availability) > 500
            or any(not isinstance(id, str) or not 1 <= len(id.strip()) <= 160 or mode not in RULESET_MODES
                   for id, mode in availability.items())):
        raise ValueError('Invalid ruleset availability.')
    bindings=value.get('prefixes',{})
    if not isinstance(bindings,dict) or len(bindings)>5000:raise ValueError('Invalid prefix bindings.')
    for key,boxes in bindings.items():
        if not isinstance(key,str) or len(key)>200:raise ValueError('Invalid prefix ID.')
        validate_boxes(boxes)
    return value


def read_library(path):
    try:raw=Path(path).read_bytes()
    except FileNotFoundError:raw=b''
    if len(raw)>8*1024*1024:raise ValueError('Rules library exceeds 8 MiB.')
    shipped=json.loads((Path(__file__).parent/'data/prompt-rulesets.json').read_text(encoding='utf-8'))
    # Offer newly shipped definitions without rewriting custom definitions or pinned attachments.
    value=validate_library(json.loads(raw) if raw else shipped)
    known={definition['id'] for definition in value['definitions']}
    value['definitions'] += [definition for definition in shipped['definitions'] if definition['id'] not in known][:max(0,500-len(value['definitions']))]
    return value,hashlib.sha256(raw).hexdigest()


def install_prompt_rules(server, get_path):
    """Bind the queue hook to the requesting ComfyUI user's rules library."""
    policy = ContextVar('gallery_prompt_rules', default=None)

    @web.middleware
    async def with_rules(request, handler):
        if request.method != 'POST' or request.path not in ('/prompt', '/api/prompt'):
            return await handler(request)
        try:
            payload = await request.json()
            prompt = payload.get('prompt', {}) if isinstance(payload, dict) else {}
            if not isinstance(prompt, dict) or not any(
                    isinstance(node, dict) and node.get('class_type') == 'GalleryPromptEncode' for node in prompt.values()):
                return await handler(request)
            path = get_path(request)
            if not path:
                return await handler(request)
            library, _ = await asyncio.to_thread(read_library, path)
        except (OSError, ValueError):
            return await handler(request)
        token = policy.set(json.dumps(global_rule_policy(library), ensure_ascii=False))
        try:
            return await handler(request)
        finally:
            policy.reset(token)

    def apply_policy(payload):
        encoded = policy.get()
        prompt = payload.get('prompt') if isinstance(payload, dict) else None
        if encoded is not None and isinstance(prompt, dict):
            for node in prompt.values():
                if (isinstance(node, dict) and node.get('class_type') == 'GalleryPromptEncode'
                        and isinstance(node.get('inputs'), dict)):
                    node['inputs']['rules_policy'] = encoded
        return payload

    server.app.middlewares.append(with_rules)
    server.add_on_prompt_handler(apply_policy)


def register_rules_routes(routes,get_path):
    @routes.get('/Gallery/rulesets')
    @routes.post('/Gallery/rulesets')
    async def library(request):
        try:
            origin=request.headers.get('Origin')
            if request.method=='POST' and (request.headers.get('Sec-Fetch-Site')=='cross-site' or origin and urlsplit(origin).netloc.lower()!=request.host.lower()):return web.json_response({'error':'Cross-origin rules writes are not allowed.'},status=403)
            path=get_path(request)
            if not path:raise ValueError('Current ComfyUI user is unavailable.')
            path=Path(path)
            body=await request.json() if request.method=='POST' else None
            with LOCK:
                value,revision=read_library(path)
                if body is not None:
                    if not isinstance(body,dict) or body.get('revision')!=revision:return web.json_response({'error':'Rules library changed. Reload before saving; keep your draft.'},status=409)
                    value=validate_library(body.get('library'));raw=json.dumps(value,ensure_ascii=False,indent=2).encode()
                    if len(raw)>8*1024*1024:raise ValueError('Rules library exceeds 8 MiB.')
                    path.parent.mkdir(parents=True,exist_ok=True)
                    temporary=None
                    try:
                        with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as stream:temporary=stream.name;stream.write(raw)
                        os.replace(temporary,path)
                    finally:
                        if temporary and os.path.exists(temporary):os.unlink(temporary)
                    revision=hashlib.sha256(raw).hexdigest()
            return web.json_response({'library':value,'revision':revision},headers={'Cache-Control':'no-store'})
        except (ValueError,TypeError) as error:return web.json_response({'error':str(error)},status=400)
        except OSError:return web.json_response({'error':'Cannot access the rules library.'},status=500)
