"""One user-scoped Prompt Library file, shared by the gallery and prefix nodes."""
import hashlib
import asyncio
import json
import os
from pathlib import Path
import re
import tempfile
import threading
import uuid
from urllib.parse import urlsplit
from aiohttp import web

LOCK = threading.RLock()
SERVER_SESSION = uuid.uuid4().hex


def association_ids(item):
    return item.get('prefix_ids', [item['prefix_id']])


def set_association(library, key, ids, reference=None):
    associations = library.setdefault('associations', {})
    prefixes = {row['id']: row for row in library['prefixes']}
    ids = [id for id in ids if id in prefixes]
    if not ids:
        associations.pop(key, None)
        return
    existing = associations.get(key, {})
    prefix = prefixes[ids[0]]
    if existing.get('prefix_id') == prefix['id']:
        terms = existing['terms']
    else:
        texts = {tag['id']: tag['text'] for tag in library['tags']}
        terms = [texts[tag] for tag in prefix['tags']]
    image = existing.get('image') if reference is None else reference
    associations[key] = {
        'prefix_id': prefix['id'], 'terms': terms,
        'negative_terms': prefix.get('negative_terms', []),
        **({'prefix_ids': ids} if len(ids) > 1 else {}),
        **({'image': image} if image is not None else {}),
        **({'prefer_snapshots': [id for id in existing.get('prefer_snapshots', []) if id in ids]} if existing.get('prefer_snapshots') else {}),
    }


def add_association(library, key, prefix_id, reference=None):
    item = library.get('associations', {}).get(key)
    ids = list(dict.fromkeys([*(association_ids(item) if item else []), prefix_id]))
    set_association(library, key, ids, reference)


def validate(value):
    if not isinstance(value, dict) or value.get('version') not in (1, 2):
        raise ValueError('Unsupported Prompt Library format.')
    result = {'version': 2, 'tags': value.get('tags'), 'prefixes': value.get('prefixes')}
    for kind in ('tags', 'prefixes'):
        rows = result[kind]
        if not isinstance(rows, list) or len(rows) > 200000:
            raise ValueError('Invalid library entries.')
        ids = set()
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not row['id'] or row['id'] in ids or not isinstance(row.get('name'), str) or not row['name'].strip():
                raise ValueError('Invalid or duplicate library entry.')
            ids.add(row['id'])
            if kind == 'tags' and (not isinstance(row.get('text'), str) or not row['text'].strip()):
                raise ValueError('Tag text cannot be empty.')
    tags = {row['id'] for row in result['tags']}
    for row in result['prefixes']:
        if not isinstance(row.get('tags'), list) or any(not isinstance(tag, str) or tag not in tags for tag in row['tags']) or len(set(row['tags'])) != len(row['tags']):
            raise ValueError('A prefix refers to invalid tags.')
        negatives = row.get('negative_terms', [])
        if not isinstance(negatives, list) or len(negatives) > 500 or any(not isinstance(term, str) or len(term) > 1024 for term in negatives):
            raise ValueError('Invalid negative prefix terms.')
    if 'hybrid' in value:
        try:from .hybrid_prompt import validate_extension
        except ImportError:from hybrid_prompt import validate_extension
        result['hybrid']=validate_extension(value['hybrid'])
    associations = value.get('associations', {})
    if not isinstance(associations, dict) or len(associations) > 50000:
        raise ValueError('Invalid image associations.')
    for key, item in associations.items():
        if not isinstance(key, str) or len(key) > 4096 or not isinstance(item, dict) or not isinstance(item.get('prefix_id'), str) or not isinstance(item.get('terms'), list) or len(item['terms']) > 500 or any(not isinstance(term, str) or len(term) > 1024 for term in item['terms']):
            raise ValueError('Invalid image association.')
        ids = association_ids(item)
        if (not isinstance(ids, list) or not ids or ids[0] != item['prefix_id']
                or any(not isinstance(id, str) or not id for id in ids) or len(set(ids)) != len(ids)):
            raise ValueError('Invalid associated prefixes.')
        preferred=item.get('prefer_snapshots',[])
        if not isinstance(preferred,list) or any(not isinstance(id,str) or id not in ids for id in preferred) or len(set(preferred))!=len(preferred):raise ValueError('Invalid snapshot defaults.')
        negatives = item.get('negative_terms', [])
        if not isinstance(negatives, list) or len(negatives) > 500 or any(not isinstance(term, str) or len(term) > 1024 for term in negatives):
            raise ValueError('Invalid associated negative prompts.')
        image = item.get('image')
        if image is not None and (not isinstance(image, dict) or any(not isinstance(v, str) or len(v) > 4096 for v in image.values())):
            raise ValueError('Invalid associated image reference.')
    if associations: result['associations'] = associations
    if 'snapshots' in value:
        try:from .prefix_snapshots import validate_snapshots
        except ImportError:from prefix_snapshots import validate_snapshots
        result['snapshots']=validate_snapshots(value['snapshots'])
    return result


def read(path):
    try:
        raw = path.read_bytes()
        if len(raw) > 16 * 1024 * 1024:
            raise ValueError('Prompt Library exceeds 16 MiB.')
        value = validate(json.loads(raw))
    except FileNotFoundError:
        value = {'version': 2, 'tags': [], 'prefixes': []}
        raw = b''
    return value, hashlib.sha256(raw).hexdigest()


def update(path, data):
    with LOCK:
        library, revision = read(path)
        if data.get('revision') != revision:
            raise FileExistsError('The shared library changed. Refresh it before saving; your draft has been kept.')
        action = data.get('action')
        if action in ('hybrid_save','hybrid_import','hybrid_delete','hybrid_associate'):
            try:from .hybrid_prompt import validate_component,validate_extension
            except ImportError:from hybrid_prompt import validate_component,validate_extension
            extension=library.setdefault('hybrid',{'version':1,'components':{}})
            if action=='hybrid_save':
                row=validate_component(data.get('component'));extension['components'][row['id']]=row
            elif action=='hybrid_import':
                incoming=validate_extension(data.get('hybrid'))
                portable=data.get('library')
                if portable is not None:
                    portable=validate(portable)
                    for field in ('tags','prefixes'):
                        existing={row['id']:row for row in library[field]}
                        for row in portable[field]:
                            if row['id'] in existing and existing[row['id']]!=row:raise ValueError('Portable '+field+' ID collision: '+row['id'])
                            if row['id'] not in existing:library[field].append(row);existing[row['id']]=row
                for id,row in incoming['components'].items():
                    if id in extension['components'] and extension['components'][id]!=row:raise ValueError('Reusable component ID collision: '+id+'. Rename the imported ID or explicitly save over it.')
                    extension['components'][id]=row
                for key,ids in incoming.get('images',{}).items():extension.setdefault('images',{})[key]=list(dict.fromkeys([*extension.get('images',{}).get(key,[]),*ids]))
            elif action=='hybrid_delete':
                id=data.get('id')
                if not isinstance(id,str) or len(id)>160:raise ValueError('Invalid reusable component ID.')
                extension['components'].pop(id,None)
                for key,ids in list(extension.get('images',{}).items()):extension['images'][key]=[ref for ref in ids if ref!=id]
            else:
                keys=data.get('image_keys');ids=data.get('components')
                if not isinstance(keys,list) or not 1<=len(keys)<=256 or any(not isinstance(key,str) or len(key)>4096 for key in keys) or not isinstance(ids,list) or len(ids)>100 or any(not isinstance(id,str) or id not in extension['components'] for id in ids):raise ValueError('Invalid image component associations.')
                for key in keys:extension.setdefault('images',{})[key]=list(dict.fromkeys(ids))
            validate(library)
        elif action == 'migrate':
            if library['tags'] or library['prefixes']:
                raise ValueError('Migration only applies to an empty shared library.')
            library = validate(data.get('library'))
        elif action == 'delete':
            library['prefixes'] = [prefix for prefix in library['prefixes'] if prefix['id'] != data.get('id')]
            for key, item in list(library.get('associations', {}).items()):
                ids = association_ids(item)
                if data.get('id') in ids:
                    set_association(library, key, [id for id in ids if id != data.get('id')])
            library.setdefault('associations', {})
        elif action == 'snapshot':
            try:from .prefix_snapshots import capture_snapshot
            except ImportError:from prefix_snapshots import capture_snapshot
            baseline=[]
            rules_path=path.parent/'gallery-rulesets.json'
            if rules_path.is_file():
                try:
                    try:from .rules_library import read_library, global_rule_policy
                    except ImportError:from rules_library import read_library, global_rule_policy
                    rules,_=read_library(rules_path)
                    policy=global_rule_policy(rules)
                    baseline=policy['globals']+[box for box in rules.get('prefixes',{}).get(data.get('prefix_id'),[])
                                                 if box['definition']['id'] not in policy['disabled']]
                except ImportError:pass
            snapshot_id=capture_snapshot(library,data,baseline)
            validate(library)
        elif action == 'save':
            name, terms = data.get('name'), data.get('terms')
            if not isinstance(name, str) or not name.strip() or len(name) > 200:
                raise ValueError('Enter a prefix name of up to 200 characters.')
            if not isinstance(terms, list) or not 0 <= len(terms) <= 500 or any(not isinstance(term, str) or not term.strip() or len(term) > 1024 for term in terms):
                raise ValueError('Choose 1–500 nonempty terms, each at most 1,024 characters.')
            negatives = data.get('negative_terms')
            if negatives is not None and (not isinstance(negatives, list) or len(negatives) > 500 or any(not isinstance(term, str) or not term.strip() or len(term) > 1024 for term in negatives)):
                raise ValueError('Invalid negative prefix terms.')
            if not terms and not negatives:
                raise ValueError('Choose at least one positive or negative term.')
            name = name.strip()
            existing = next((p for p in library['prefixes'] if p['name'].casefold() == name.casefold()), None)
            ids = []
            for term in dict.fromkeys(term.strip() for term in terms):
                tag = next((t for t in library['tags'] if t['text'] == term), None)
                if tag is None:
                    tag = {'id': str(uuid.uuid4()), 'name': term, 'text': term}
                    library['tags'].append(tag)
                ids.append(tag['id'])
            if existing:
                existing['tags'] = ids
            else:
                library['prefixes'].append({'id': str(uuid.uuid4()), 'name': name, 'tags': ids})
            saved = next(p for p in library['prefixes'] if p['name'].casefold() == name.casefold())
            if negatives is not None: saved['negative_terms'] = list(dict.fromkeys(term.strip() for term in negatives))
            # Existing image pairings follow edits, including edits made without an image seed.
            for item in library.get('associations', {}).values():
                if item['prefix_id'] == saved['id']:
                    item['terms'] = list(dict.fromkeys(term.strip() for term in terms))
                    item['negative_terms'] = saved.get('negative_terms', [])
            references = data.get('image_refs', {})
            if not isinstance(references, dict) or len(references) > 64: raise ValueError('Invalid image references.')
            image_keys = data.get('image_keys', [])
            if not isinstance(image_keys, list) or len(image_keys) > 64 or any(not isinstance(key, str) or not key or len(key) > 4096 for key in image_keys):
                raise ValueError('Invalid image keys.')
            if image_keys:
                for key in image_keys:
                    add_association(library, key, saved['id'], references.get(key))
                validate(library)
        elif action == 'snapshot_default':
            keys=data.get('image_keys',[]);id=data.get('prefix_id');enabled=data.get('enabled')
            if not isinstance(keys,list) or not 1<=len(keys)<=256 or any(not isinstance(key,str) or len(key)>4096 for key in keys) or not isinstance(enabled,bool):raise ValueError('Invalid snapshot default operation.')
            for key in keys:
                item=library.get('associations',{}).get(key)
                if not item or id not in association_ids(item):raise ValueError('Pair these images with the prefix first.')
                preferred=[value for value in item.get('prefer_snapshots',[]) if value!=id]
                if enabled:preferred.append(id)
                if preferred:item['prefer_snapshots']=preferred
                else:item.pop('prefer_snapshots',None)
            validate(library)
        elif action in ('associate', 'dissociate'):
            # Pair images with a saved prefix (or unpair them) without touching the prefix's terms.
            image_keys = data.get('image_keys', [])
            if not isinstance(image_keys, list) or not 1 <= len(image_keys) <= 256 or any(not isinstance(key, str) or not key or len(key) > 4096 for key in image_keys):
                raise ValueError('Choose 1–256 images.')
            associations = library.setdefault('associations', {})
            if action == 'dissociate':
                prefix_id = data.get('prefix_id')
                for key in image_keys:
                    item = associations.get(key)
                    if not prefix_id:
                        associations.pop(key, None)
                    elif item and prefix_id in association_ids(item):
                        set_association(library, key, [id for id in association_ids(item) if id != prefix_id])
                if not associations: library.pop('associations', None)
            else:
                prefix = next((p for p in library['prefixes'] if p['id'] == data.get('prefix_id')), None)
                if prefix is None: raise ValueError('That prefix no longer exists. Refresh the library.')
                references = data.get('image_refs', {})
                if not isinstance(references, dict) or len(references) > 256: raise ValueError('Invalid image references.')
                for key in image_keys:
                    add_association(library, key, prefix['id'], references.get(key))
            validate(library)
        else:
            raise ValueError('Invalid library action.')
        raw = json.dumps(library, ensure_ascii=False, indent=2).encode()
        if len(raw) > 16 * 1024 * 1024:
            raise ValueError('Prompt Library exceeds 16 MiB.')
        path.parent.mkdir(parents=True, exist_ok=True)
        if action.startswith('hybrid_'):
            backup=path.with_name(path.name+'.pre-hybrid.bak')
            if not backup.exists():
                original=path.read_bytes() if path.exists() else json.dumps({'version':2,'tags':[],'prefixes':[]}).encode()
                try:
                    with backup.open('xb') as stream:stream.write(original);stream.flush();os.fsync(stream.fileno())
                except FileExistsError:pass
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)
        return {'library': library, 'revision': hashlib.sha256(raw).hexdigest(), **({'snapshot_id':snapshot_id} if action=='snapshot' else {})}


def register_prefix_routes(routes, get_path):
    @routes.post('/Gallery/hybrid/compile')
    @routes.get('/Gallery/prefixes')
    @routes.post('/Gallery/prefixes')
    async def library(request):
        try:
            origin = request.headers.get('Origin')
            if request.method == 'POST' and (request.headers.get('Sec-Fetch-Site') == 'cross-site' or origin and urlsplit(origin).netloc.lower() != request.host.lower()):
                return web.json_response({'error': 'Cross-origin library writes are not allowed.'}, status=403)
            resolved = get_path(request)
            if not resolved:
                raise ValueError('The current ComfyUI user is unavailable.')
            path = Path(resolved)
            if request.method == 'GET':
                with LOCK:
                    value, revision = read(path)
                result = {'library': value, 'revision': revision}
            else:
                data = await request.json()
                if not isinstance(data, dict):
                    raise ValueError('Expected a library operation.')
                if request.path=='/Gallery/hybrid/compile':
                    try:
                        from .hybrid_prompt import compile_hybrid,library_subset,validate_document
                        from .rules_library import read_library,validate_library
                    except ImportError:
                        from hybrid_prompt import compile_hybrid,library_subset,validate_document
                        from rules_library import read_library,validate_library
                    value,revision=await asyncio.to_thread(read,path)
                    fallback=data.get('fallback_library',{})
                    if not isinstance(fallback,dict):raise ValueError('Invalid fallback library.')
                    portable=validate({'version':2,'tags':fallback.get('tags',[]),'prefixes':fallback.get('prefixes',[]),'snapshots':fallback.get('snapshots',{})})
                    value['snapshots']={**portable.get('snapshots',{}),**value.get('snapshots',{})}
                    # Missing portable references can be restored without importing or writing a library.
                    for field in ('tags','prefixes'):
                        known={row['id'] for row in value[field]}
                        value[field]=value[field]+[row for row in portable[field] if row['id'] not in known]
                    frozen=fallback.get('hybrid',{'version':1,'components':{}})
                    try:from .hybrid_prompt import validate_extension
                    except ImportError:from hybrid_prompt import validate_extension
                    frozen=validate_extension(frozen)
                    current=value.get('hybrid',{'version':1,'components':{}})
                    value['hybrid']={'version':1,'components':{**frozen['components'],**current['components']},'images':{**frozen.get('images',{}),**current.get('images',{})}}
                    document=validate_document(data.get('document'))
                    rules,_=await asyncio.to_thread(read_library,path.parent/'gallery-rulesets.json')
                    frozen_rules=fallback.get('rule_library',{})
                    if not isinstance(frozen_rules,dict):raise ValueError('Invalid portable rules library.')
                    if frozen_rules:validate_library(frozen_rules)
                    rules={**rules,'prefixes':{**frozen_rules.get('prefixes',{}),**rules.get('prefixes',{})}}
                    result=await asyncio.to_thread(compile_hybrid,document,value,data.get('sources'),rules)
                    subset=await asyncio.to_thread(library_subset,document,value)
                    ids={row['id'] for row in subset['prefixes']}|{'snapshot:'+id for id in subset.get('snapshots',{})}
                    subset['rule_library']={'version':1,'globals':rules.get('globals',[]),'availability':rules.get('availability',{}),'prefixes':{id:rows for id,rows in rules.get('prefixes',{}).items() if id in ids}}
                    return web.json_response({**result,'library':subset,'revision':revision},headers={'Cache-Control':'no-store'})
                result = update(path, data)
            return web.json_response({**result,'session_id':SERVER_SESSION}, headers={'Cache-Control': 'no-store'})
        except FileExistsError as error:
            return web.json_response({'error': str(error)}, status=409)
        except (ValueError, KeyError) as error:
            return web.json_response({'error': str(error)}, status=400)
        except OSError:
            return web.json_response({'error': 'Cannot access the shared Prompt Library file.'}, status=500)


class GalleryPromptLibrary:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'prefix': ('STRING', {'multiline': True, 'default': ''})}}

    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('prefix',)
    FUNCTION = 'output_prefix'
    CATEGORY = 'prompt/library'

    def output_prefix(self, prefix):
        return (prefix,)


# The Gallery Prompt Encode node compiles its tag boxes into one string. The connected
# `source_text` is its own box; its position is marked in that string and replaced here,
# when the workflow runs and the source text is finally known.
SOURCE_MARKER = '\u27e6source\u27e7'
SOURCE_MODES = ('after', 'before', 'replace', 'boxes')
SOURCE_INPUT_NAMES = ('source_text',) + tuple('source_text_' + str(index) for index in range(2, 9))
# Saved images get a `gallery_prompts` text chunk: per encoder node, the prompt before and after
# {a|b|c} choices were made. It travels into the Hydrus note with the rest of the metadata.
RESOLVED_KEY = 'gallery_prompts'


# Tags removed from the source box ride inside the marker: ⟦source -["tag a","tag b"]⟧ (a JSON list).
SOURCE_MARKER_PATTERN = re.compile(r'⟦source(?::(?P<input>source_text(?:_[2-8])?))?(?: -(?P<excluded>\[[^⟧]*\]))?⟧')


def split_top(text, separator=','):
    """Split on a separator outside (), [], {} and <>; unbalanced text falls back to a plain split."""
    depth, cuts, balanced = 0, [], True
    for index, char in enumerate(text):
        if char in '([{<': depth += 1
        elif char in ')]}>':
            depth -= 1
            if depth < 0: balanced, depth = False, 0
        elif char == separator and depth == 0: cuts.append(index)
    if depth or not balanced: return text.split(separator)
    parts, start = [], 0
    for index in cuts:
        parts.append(text[start:index]); start = index + 1
    parts.append(text[start:])
    return parts


def source_key(tag):
    return re.sub(r'\s+', ' ', tag.strip().lower().replace('_', ' '))


def marker_excluded(match):
    try:
        value = json.loads(match.group('excluded')) if match.group('excluded') else []
    except ValueError:
        return []
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


def filter_source(source, excluded):
    if not excluded: return source
    drop = {source_key(tag) for tag in excluded}
    return ','.join(part for part in split_top(source) if source_key(part) not in drop)


def source_exclusions(text):
    """Every tag removed from the source box(es) of a compiled prompt."""
    return [tag for match in SOURCE_MARKER_PATTERN.finditer(text or '') for tag in marker_excluded(match)]


def edit_source_text(source, excluded, replacements):
    return ','.join(replacements.get(source_key(part), part) for part in split_top(filter_source(source, excluded)))


def apply_source_exclusions(source, raw, trace=None):
    """Edit images independently, then aggregate and filter this source only."""
    try: data=json.loads(raw) if isinstance(raw,str) else raw
    except ValueError: raise ValueError('Invalid per-image source exclusions.')
    if not data:return source
    try: from .source_prompt_policy import merge_prompt_texts, filter_source_categories
    except ImportError: from source_prompt_policy import merge_prompt_texts, filter_source_categories
    def valid_replacements(value):
        return isinstance(value,dict) and all(isinstance(key,str) and isinstance(text,str) for key,text in value.items())
    if not isinstance(data,dict):raise ValueError('Invalid per-image source exclusions.')
    if 'segments' not in data and (valid_replacements(data.get('replacements')) or 'category_exclusions' in data):
        if not valid_replacements(data.get('replacements',{})):raise ValueError('Invalid source replacements.')
        result=edit_source_text(source or '',[],data.get('replacements',{}))
    else:
        if not isinstance(data.get('segments'),list) or len(data['segments'])>256:raise ValueError('Invalid per-image source exclusions.')
        segments=data['segments']
        for segment in segments:
            if not isinstance(segment,dict) or not isinstance(segment.get('key'),str) or not isinstance(segment.get('text'),str) or not isinstance(segment.get('excluded'),list) or any(not isinstance(tag,str) for tag in segment['excluded']) or not valid_replacements(segment.get('replacements',{})):raise ValueError('Invalid per-image source exclusions.')
        merge=data.get('merge',{})
        if not isinstance(merge,dict):raise ValueError('Invalid source merge policy.')
        mode,percent=merge.get('mode','append'),merge.get('min_percent',60)
        expected=merge_prompt_texts([segment['text'] for segment in segments],mode,percent)
        if (source or '')!=expected:raise ValueError('Source image prompts changed. Refresh the encoder before queuing again.')
        result=merge_prompt_texts([edit_source_text(segment['text'],segment['excluded'],segment.get('replacements',{})).strip() for segment in segments],mode,percent)
        if trace is not None and mode!='append':trace['merge']={'mode':mode,'min_percent':percent,'images':len(segments)}
    result,removed=filter_source_categories(result,data.get('category_exclusions',[]))
    if trace is not None and data.get('category_exclusions'):
        trace.update(excluded_categories=data['category_exclusions'],removed_tags=removed)
    return result


def compose_prompt(text, source_text=None, source_mode='after', sources=None):
    if source_mode not in SOURCE_MODES: raise ValueError('Invalid source prompt order.')
    if source_mode == 'boxes':
        source = (source_text or '').strip().strip(',').strip()
        def resolve_source(match):
            name = match.group('input') or 'source_text'
            value = sources.get(name, '') if sources is not None else source if name == 'source_text' else ''
            return filter_source(value or '', marker_excluded(match)).strip()
        joined = SOURCE_MARKER_PATTERN.sub(resolve_source, text or '')
        joined = re.sub(r'(?:\s*,\s*){2,}', ', ', joined)
        return joined.strip().strip(',').strip()
    return text if source_text is None else source_text if source_mode == 'replace' else ', '.join(part.strip() for part in ([source_text, text] if source_mode == 'before' else [text, source_text]) if part.strip())


def compose_shared_prompt(text, source_text=None, source_mode='after', sources=None, rules=None):
    """The editor's source-first merge, repeated for runtime-only source values."""
    try: from .prompt_deduplication import merge_prompt_contributions
    except ImportError: from prompt_deduplication import merge_prompt_contributions
    rows = []
    if source_mode == 'boxes':
        start = 0
        for match in SOURCE_MARKER_PATTERN.finditer(text or ''):
            # Unusual API templates may place a marker inside an attention group.
            # Keep that whole expression intact rather than splitting its syntax.
            left, right = (text or '')[:match.start()].rstrip(), (text or '')[match.end():].lstrip()
            if left and left[-1] != ',' or right and right[0] != ',':
                return merge_prompt_contributions([{'text': compose_prompt(text, source_text, source_mode, sources)}])[0]['text']
            rows.append({'text': text[start:match.start()].strip().strip(',').strip()})
            name = match.group('input') or 'source_text'
            value = sources.get(name, '') if sources is not None else source_text if name == 'source_text' else ''
            rows.append({'text': filter_source(value or '', marker_excluded(match)).strip(), 'source': True})
            start = match.end()
        rows.append({'text': (text or '')[start:].strip().strip(',').strip()})
    elif source_mode == 'replace' and source_text is not None:
        rows = [{'text': source_text, 'source': True}]
    elif source_mode in ('before', 'after') and source_text is not None:
        rows = [{'text': text}, {'text': source_text, 'source': True}]
        if source_mode == 'before':
            rows.reverse()
    else:
        rows = [{'text': compose_prompt(text, source_text, source_mode, sources)}]
    try: from .source_garment_priority import prioritize_source_garments
    except ImportError: from source_garment_priority import prioritize_source_garments
    rows,errors=prioritize_source_garments(rows,rules)
    if errors:raise ValueError('; '.join(errors))
    return ', '.join(row['text'].strip() for row in merge_prompt_contributions(rows) if row['text'].strip())


def resolve_dynamic(text, rng=None):
    """Pick one option of every {a|b|c} group, innermost first, like ComfyUI's dynamic prompts.

    The encoder keeps both its own template and runtime source templates unresolved
    until source-first merging has completed. Returns the resolved text and the
    choices made here, so matching expressions share one recorded roll.
    """
    import random
    rng = rng or random
    choices = []
    prompt = text or ''
    for _ in range(10000):
        end = next((i for i, c in enumerate(prompt) if c == '}' and (i == 0 or prompt[i - 1] != '\\')), -1)
        if end < 0: break
        start = next((i for i in range(end - 1, -1, -1) if prompt[i] == '{' and (i == 0 or prompt[i - 1] != '\\')), -1)
        if start < 0: break
        options = prompt[start + 1:end].split('|')
        chosen = rng.choice(options)
        choices.append({'options': [option.strip() for option in options], 'chosen': chosen.strip()})
        prompt = prompt[:start] + chosen + prompt[end + 1:]
    prompt = re.sub(r'(?:\s*,\s*){2,}', ', ', prompt).strip().strip(',').strip()
    return prompt, choices


try: from .hair_policy import clean_policy, filter_hair_prompt
except ImportError: from hair_policy import clean_policy, filter_hair_prompt


class GalleryPromptEncode:
    """Prompt boxes + shared library picker, compatible with standard CLIP conditioning."""
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'clip': ('CLIP',), 'text': ('STRING', {'multiline': True, 'dynamicPrompts': False, 'default': ''})},
                'optional': {'source_text': ('STRING', {'forceInput': True}), **{name: ('STRING', {'forceInput': True}) for name in SOURCE_INPUT_NAMES[1:]}, 'source_mode': (list(SOURCE_MODES), {'default': 'after'}), 'hair_policy': ('STRING', {'default': '{}'}), 'rules_state': ('STRING', {'default': '[]'}), 'prefix_snapshots': ('STRING', {'default': '[]'}), 'source_image_exclusions': ('STRING', {'default': '{}'}), 'rules_policy': ('STRING', {'default': '', 'advanced': True})},
                'hidden': {'extra_pnginfo': 'EXTRA_PNGINFO', 'unique_id': 'UNIQUE_ID'}}

    RETURN_TYPES = ('CONDITIONING', 'STRING')
    RETURN_NAMES = ('conditioning', 'text')
    FUNCTION = 'encode'
    CATEGORY = 'prompt/library'

    @classmethod
    def IS_CHANGED(cls, text='', source_text=None, source_mode='after', **kwargs):
        # Unresolved {a|b} groups are picked here each run, so the result must not be cached.
        return float('nan') if '{' in (text or '') + (source_text or '') + ''.join(kwargs.get(name) or '' for name in SOURCE_INPUT_NAMES[1:]) or 'one' in str(kwargs.get('hair_policy','')) else ''

    def encode(self, clip, text, source_text=None, source_mode='after', extra_pnginfo=None, unique_id=None, hair_policy='{}', rules_state='[]', prefix_snapshots='[]', source_image_exclusions='{}', rules_policy='', **sources):
        snapshots=json.loads(prefix_snapshots) if isinstance(prefix_snapshots,str) else prefix_snapshots
        if not isinstance(snapshots,list) or len(snapshots)>100 or any(not isinstance(row,dict) or not isinstance(row.get('prefix_id'),str) or row.get('snapshot_id') is not None and (not isinstance(row['snapshot_id'],str) or not re.fullmatch('[a-f0-9]{64}',row['snapshot_id'])) for row in snapshots):raise ValueError('Invalid prefix snapshot list.')
        if clip is None:
            raise ValueError('Connect a CLIP text encoder to Gallery Prompt Encode.')
        raw_sources = {'source_text': source_text, **{name: sources[name] for name in SOURCE_INPUT_NAMES[1:] if name in sources}}
        scoped_sources = dict(raw_sources)
        source_filters = {}
        edits = json.loads(source_image_exclusions) if isinstance(source_image_exclusions, str) else source_image_exclusions
        if source_mode == 'boxes':
            if isinstance(edits, dict) and 'sources' in edits:
                if not isinstance(edits['sources'], dict) or any(name not in SOURCE_INPUT_NAMES for name in edits['sources']):
                    raise ValueError('Invalid named source edits.')
                for name, value in raw_sources.items():
                    if value is not None:
                        scoped_sources[name] = apply_source_exclusions(value, edits['sources'].get(name, {}), source_filters.setdefault(name,{}))
            elif source_text is not None:
                scoped_sources['source_text'] = apply_source_exclusions(source_text, edits, source_filters.setdefault('source_text',{}))
        raw_source = ', '.join(value for value in raw_sources.values() if value) if any(value is not None for value in raw_sources.values()) else None
        scoped_source = ', '.join(value for value in scoped_sources.values() if value) if raw_source is not None else None
        composed = compose_prompt(text, scoped_source, source_mode, scoped_sources)
        try: from .hair_policy import sample_policy
        except ImportError: from hair_policy import sample_policy
        policy = sample_policy(hair_policy)
        try: from .prompt_rules import apply_rules, validate_boxes
        except ImportError: from prompt_rules import apply_rules, validate_boxes
        try: rules = json.loads(rules_state) if isinstance(rules_state, str) else rules_state
        except ValueError: raise ValueError('Invalid encoder rules JSON.')
        if rules_policy:
            availability = json.loads(rules_policy)
            if (not isinstance(availability, dict) or not isinstance(availability.get('disabled'), list)
                    or any(not isinstance(id, str) for id in availability['disabled'])):
                raise ValueError('Invalid encoder rules policy.')
            disabled = set(availability['disabled'])
            rules = validate_boxes(availability.get('globals')) + [box for box in validate_boxes(rules)
                                                if box.get('origin') != 'global' and box['definition']['id'] not in disabled]
        sampling_template = compose_shared_prompt(text, scoped_source, source_mode, scoped_sources,rules)
        effective, choices = resolve_dynamic(sampling_template)
        effective = filter_hair_prompt(effective, policy)
        before_rules = effective
        effective, rules_trace = apply_rules(effective, rules)
        record_resolution(extra_pnginfo, unique_id, composed, effective, choices, raw_source, source_exclusions(text) if source_mode == 'boxes' else None)
        if isinstance(extra_pnginfo, dict) and isinstance(extra_pnginfo.get(RESOLVED_KEY), dict) and str(unique_id) in extra_pnginfo[RESOLVED_KEY]:
            extra_pnginfo[RESOLVED_KEY][str(unique_id)]['sampling_template'] = sampling_template
            extra_pnginfo[RESOLVED_KEY][str(unique_id)]['hair_policy'] = policy
            extra_pnginfo[RESOLVED_KEY][str(unique_id)]['rules_applied'] = rules_trace
            extra_pnginfo[RESOLVED_KEY][str(unique_id)]['rules_program'] = rules
            extra_pnginfo[RESOLVED_KEY][str(unique_id)]['prefix_snapshots'] = snapshots
            extra_pnginfo[RESOLVED_KEY][str(unique_id)]['source_filters'] = {name:trace for name,trace in source_filters.items() if trace}
            extra_pnginfo[RESOLVED_KEY][str(unique_id)]['source_excluded_by_image'] = json.loads(source_image_exclusions) if isinstance(source_image_exclusions,str) else source_image_exclusions
        tokens = clip.tokenize(effective)
        try: from .load_report import encoder_load
        except ImportError: from load_report import encoder_load
        load = encoder_load(clip, effective, tokens)
        try: from .prompt_load import prompt_groups
        except ImportError: from prompt_load import prompt_groups
        groups = prompt_groups(extra_pnginfo, unique_id, scoped_sources)
        if not groups:
            groups = [{'name': 'Encoder prompt', 'kind': 'box', 'syntax': composed}]
        diagnostic_context = {'effective': effective, 'before_rules': before_rules, 'rules': rules, 'groups': groups}
        if isinstance(extra_pnginfo, dict) and unique_id is not None:
            extra_pnginfo.get(RESOLVED_KEY, {}).get(str(unique_id), {})['token_load'] = load
            extra_pnginfo.get(RESOLVED_KEY, {}).get(str(unique_id), {})['diagnostic_context'] = diagnostic_context
        conditioning = clip.encode_from_tokens_scheduled(tokens)
        if isinstance(conditioning, list):
            conditioning = [[row[0], {**row[1], 'gallery_load': {'node_id': str(unique_id), 'token_streams': load, 'rules_applied': len(rules_trace.get('rulesets', [])), 'diagnostic_context': diagnostic_context, 'source_filters': {name:trace for name,trace in source_filters.items() if trace}}}]
                            if isinstance(row, (list, tuple)) and len(row) == 2 and isinstance(row[1], dict) else row for row in conditioning]
        return {'ui': {'effective_prompt': [effective], 'source_text': [source_text or ''], 'source_texts': [raw_sources], 'token_load': [load]}, 'result': (conditioning, effective)}


def record_resolution(extra_pnginfo, unique_id, composed, effective, choices, source_text=None, source_excluded=None):
    """Store what this encoder actually encoded. SaveImage writes every extra_pnginfo key as a PNG text chunk."""
    if not isinstance(extra_pnginfo, dict) or unique_id is None: return
    try:
        entry = {'text': composed, 'resolved': effective}
        if choices: entry['choices'] = choices
        if source_text: entry['source_text'] = source_text
        if source_excluded: entry['source_excluded'] = source_excluded
        extra_pnginfo.setdefault(RESOLVED_KEY, {})[str(unique_id)] = entry
    except (TypeError, AttributeError):
        pass
