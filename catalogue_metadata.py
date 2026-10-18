"""Small browse/search metadata projections; originals and full metadata stay intact."""
import asyncio
import json
import re
from pathlib import Path
from aiohttp import web

DROP = {'metadata', 'gallery_source_history', 'rules_state', 'rules_program', 'rulesets', 'gallery_inherited_rules'}

def project(value, depth=0):
    if depth > 40: return None
    if isinstance(value, str):
        if value.startswith('data:') and len(value)>4096: return None
        # PNG prompt/workflow and source manifests may all be JSON strings.
        if value.lstrip().startswith(('{','[')):
            try:
                parsed=json.loads(value)
                if isinstance(parsed,(dict,list)):return json.dumps(project(parsed,depth+1),ensure_ascii=False)
            except ValueError: pass
        return value
    if isinstance(value, list):return [project(item,depth+1) for item in value]
    if isinstance(value, dict):
        result={key:project(item,depth+1) for key,item in value.items() if key not in DROP}
        metadata=value.get('metadata')
        if isinstance(metadata,dict) and isinstance(metadata.get('gallery_prefix'),dict):result['metadata']={'gallery_prefix':project(metadata['gallery_prefix'],depth+1)}
        return result
    return value

def object_value(value):
    if isinstance(value,str):
        try:value=json.loads(value)
        except ValueError:return {}
    return value if isinstance(value,dict) else {}

PROMPT_INPUT=re.compile(r'^(?:(?:positive|negative|pos|neg)(?:_prompt|_conditioning)?|text(?:_\w+)?|prompt(?:_\w+)?|wildcard(?:_text)?|populated_text|prefix|value|string|conditioning(?:_\w+)?|conditioning\d*|source_text|source_mode|sources|clip_l|clip_g|t5xxl)$',re.I)

def compact_metadata(metadata):
    if not isinstance(metadata,dict):return {}
    result={key:project(metadata[key]) for key in ('fileinfo','gallery_prompts','gallery_associations','parameters','positive','negative','positive_prompt','negative_prompt','tags') if key in metadata}
    graph=object_value(metadata.get('prompt'))
    api=any(isinstance(node,dict) and 'inputs' in node for node in graph.values())
    if api:
        # Only conditioning/text edges participate in prompt extraction. Model settings,
        # UI geometry and embedded reference histories are not catalogue data.
        result['prompt']={key:{'class_type':node.get('class_type',''),'_meta':{'title':object_value(node.get('_meta')).get('title','')},'inputs':{name:project(value) for name,value in object_value(node.get('inputs')).items() if PROMPT_INPUT.match(name)}} for key,node in graph.items() if isinstance(node,dict) and any(PROMPT_INPUT.match(name) for name in object_value(node.get('inputs')))}
    elif graph:result['prompt']=project(graph)
    workflow=object_value(metadata.get('workflow'))
    nodes=workflow.get('nodes',[])
    if isinstance(nodes,list):
        kept=[]
        for node in nodes:
            if not isinstance(node,dict) or api and node.get('type')!='GalleryPromptEncode':continue
            record={key:project(node[key]) for key in ('id','type','title','inputs') if key in node}
            if not api:record['widgets_values']=project(node.get('widgets_values',[]))
            boxes=object_value(node.get('properties')).get('prompt_boxes')
            if boxes:record['properties']={'prompt_boxes':project(boxes)}
            kept.append(record)
        if kept:result['workflow']={'nodes':kept,**({'links':workflow.get('links',[])} if not api else {})}
    if isinstance(metadata.get('hydrus'),dict):result['hydrus']={key:project(value) for key,value in metadata['hydrus'].items() if key not in ('notes','workflow','prompt','metadata')}
    result['gallery_metadata_deferred']=True
    return result

def register_metadata_routes(routes,get_root):
    @routes.get('/Gallery/local-metadata')
    async def metadata(request):
        from .local_library import local_path
        from .metadata_extractor import buildMetadata
        try:
            path=local_path(Path(get_root(request)).resolve(),request.query.get('url'))
            image,_,value=await asyncio.to_thread(buildMetadata,str(path))
            image.close()
            return web.json_response({'metadata':value},headers={'Cache-Control':'no-store'})
        except (ValueError,TypeError,OSError):return web.json_response({'error':'Local metadata is unavailable or outside the library root.'},status=400)
