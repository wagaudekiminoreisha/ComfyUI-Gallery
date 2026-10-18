"""User-scoped, revision-checked ruleset library and prefix attachments."""
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
    value=json.loads(raw) if raw else json.loads((Path(__file__).parent/'data/prompt-rulesets.json').read_text(encoding='utf-8'))
    return validate_library(value),hashlib.sha256(raw).hexdigest()


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
