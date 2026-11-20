"""Literal prose + legacy tags, compiled deterministically without a model dependency."""
import copy
import hashlib
import json
import re
import random
from pathlib import Path

KINDS={'tags','prose','group','prefix','reference','source'}
ROLES=('identity','appearance','clothing','pose','expression','composition','environment','lighting','style','unassigned')
INPUTS=('source_text',)+tuple('source_text_'+str(i) for i in range(2,9))
MAX_BYTES=4*1024*1024

def _object(value):
    if isinstance(value,str):
        if len(value.encode('utf-8'))>MAX_BYTES:raise ValueError('Hybrid document exceeds 4 MiB.')
        try:value=json.loads(value)
        except (ValueError,TypeError):raise ValueError('Invalid hybrid JSON.')
    if not isinstance(value,dict):raise ValueError('Expected a hybrid object.')
    return copy.deepcopy(value)

def _text(value,label,limit=100000):
    if not isinstance(value,str) or len(value)>limit:raise ValueError('Invalid '+label+'.')
    return value

def validate_component(value,depth=0,budget=None):
    budget=budget if budget is not None else [0];budget[0]+=1
    if depth>32 or budget[0]>5000:raise ValueError('Hybrid component tree exceeds limits.')
    if not isinstance(value,dict) or not isinstance(value.get('type'),str) or value.get('type') not in KINDS:raise ValueError('Unknown hybrid component type.')
    if not _text(value.get('id'),'component ID',160).strip():raise ValueError('A component needs an ID.')
    _text(value.get('name',''),'component name',200)
    if 'role' in value and (not isinstance(value['role'],str) or value['role'] not in ROLES):raise ValueError('Invalid component role.')
    if 'subject' in value:_text(value['subject'],'component subject',120)
    if 'source_roles' in value:
        roles=value['source_roles']
        if not isinstance(roles,list) or len(roles)>len(ROLES) or any(not isinstance(role,str) or role not in ROLES for role in roles):raise ValueError('Invalid source roles.')
    for key in ('enabled','inherit_rules','source_text_enabled','source_components_enabled'):
        if key in value and not isinstance(value[key],bool):raise ValueError('Invalid component '+key+'.')
    if value.get('side','positive') not in ('positive','negative'):raise ValueError('Invalid component polarity.')
    if value.get('placement','body') not in ('prefix','body','suffix'):raise ValueError('Invalid component placement.')
    if value.get('mode','on-demand') not in ('global','on-demand','disabled'):raise ValueError('Invalid component availability.')
    if value['type'] in ('tags','prose'):_text(value.get('text',''),'component text')
    if value['type'] in ('reference','prefix'):_text(value.get('ref'),'component reference',160)
    if value['type']=='source':
        if value.get('input') not in INPUTS:raise ValueError('Invalid source input.')
        if value.get('format','tags') not in ('tags','prose'):raise ValueError('Invalid source format.')
    if value['type']!='group' and 'children' in value:raise ValueError('Only groups can contain children.')
    if value['type']=='group':
        if value.get('selection','all') not in ('all','optional','one','optional-one'):raise ValueError('Invalid group activation mode.')
        chance=value.get('chance',0.5)
        if isinstance(chance,bool) or not isinstance(chance,(float,int)) or not 0<=chance<=1:raise ValueError('Invalid optional group chance.')
        children=value.get('children',[])
        if not isinstance(children,list):raise ValueError('Invalid group children.')
        for child in children:validate_component(child,depth+1,budget)
    for field in ('aliases','categories','image_keys'):
        rows=value.get(field,[])
        if not isinstance(rows,list) or len(rows)>256 or any(not isinstance(row,str) or len(row)>4096 for row in rows):raise ValueError('Invalid component '+field+'.')
    _text(value.get('description',''),'component description',10000)
    if any(field in value for field in ('rules','tag_rules','negative_tag_rules')):validate_document({'version':1,'components':[],**{field:value[field] for field in ('rules','tag_rules','negative_tag_rules') if field in value}})
    return value

def validate_document(value):
    value=_object(value)
    if type(value.get('version')) is not int or value.get('version')!=1:raise ValueError('Unsupported hybrid document version.')
    components=value.get('components',[])
    if not isinstance(components,list):raise ValueError('Invalid hybrid components.')
    budget=[0];ids=set()
    def check(row):
        if row['id'] in ids:raise ValueError('Duplicate document component ID: '+row['id'])
        ids.add(row['id'])
        for child in row.get('children',[]):check(child)
    for row in components:validate_component(row,budget=budget);check(row)
    for field in ('tag_rules','negative_tag_rules'):
        try:from .prompt_rules import validate_boxes
        except ImportError:from prompt_rules import validate_boxes
        validate_boxes(value.get(field,[]))
    rules=value.get('rules',[])
    if not isinstance(rules,list) or len(rules)>100:raise ValueError('At most 100 component rules.')
    rule_ids=set()
    for rule in rules:
        if not isinstance(rule,dict) or not isinstance(rule.get('id'),str) or rule['id'] in rule_ids:raise ValueError('Invalid or duplicate component rule ID.')
        rule_ids.add(rule['id'])
        if rule.get('action') not in ('enable','disable'):raise ValueError('Unknown component rule action.')
        _text(rule.get('target'),'rule target',160)
        priority=rule.get('priority',0)
        if isinstance(priority,bool) or not isinstance(priority,int) or not -10000<=priority<=10000:raise ValueError('Invalid component rule priority.')
        for field in ('tags','components','unless'):
            rows=rule.get(field,[])
            if not isinstance(rows,list) or len(rows)>100 or any(not isinstance(row,str) or len(row)>300 for row in rows):raise ValueError('Invalid rule '+field+'.')
        if 'enabled' in rule and not isinstance(rule['enabled'],bool):raise ValueError('Invalid rule activation.')
    override=value.get('override',{})
    if not isinstance(override,dict) or not isinstance(override.get('enabled',False),bool):raise ValueError('Invalid prompt override.')
    for side in ('positive','negative'):_text(override.get(side,''),'override text')
    source_images=value.get('source_images',{})
    if not isinstance(source_images,dict) or any(name not in INPUTS or not isinstance(keys,list) or len(keys)>256 or any(not isinstance(key,str) or len(key)>4096 for key in keys) for name,keys in source_images.items()):raise ValueError('Invalid source image associations.')
    for field in ('source_prefixes','source_snapshots'):
        refs=value.get(field,{})
        if not isinstance(refs,dict) or any(name not in INPUTS or not isinstance(ids,list) or len(ids)>100 or any(not isinstance(id,str) or len(id)>160 for id in ids) for name,ids in refs.items()):raise ValueError('Invalid '+field+'.')
    seed=value.get('seed',0)
    if isinstance(seed,bool) or not isinstance(seed,int) or not 0<=seed<=9007199254740991:raise ValueError('Invalid hybrid seed.')
    if len(json.dumps(value,ensure_ascii=False).encode('utf-8'))>MAX_BYTES:raise ValueError('Hybrid document exceeds 4 MiB.')
    return value

def validate_extension(value):
    value=_object(value)
    if type(value.get('version')) is not int or value.get('version')!=1:raise ValueError('Unsupported hybrid library version.')
    components=value.get('components',{})
    if not isinstance(components,dict) or len(components)>5000:raise ValueError('Invalid hybrid library components.')
    for key,row in components.items():
        if not isinstance(row,dict) or key!=row.get('id'):raise ValueError('Component library key must match ID.')
        validate_component(row)
    pairs=value.get('images',{})
    if not isinstance(pairs,dict) or len(pairs)>50000:raise ValueError('Invalid hybrid image associations.')
    for key,refs in pairs.items():
        if not isinstance(key,str) or len(key)>4096 or not isinstance(refs,list) or len(refs)>100 or any(not isinstance(ref,str) or ref not in components for ref in refs):raise ValueError('Invalid hybrid image component reference.')
    return value

def prefix_terms(library,id,negative=False,stack=(),budget=None):
    budget=budget if budget is not None else [0]
    if id in stack or len(stack)>32:raise ValueError('Circular or overly nested prefix reference.')
    prefix=next((row for row in library.get('prefixes',[]) if row['id']==id),None)
    if prefix is None:raise ValueError('Missing prefix: '+id)
    texts={row['id']:row['text'] for row in library.get('tags',[])}
    values=prefix.get('negative_terms',[]) if negative else [texts[tag] for tag in prefix['tags']]
    out=[]
    for text in values:
        budget[0]+=1
        if budget[0]>5000:raise ValueError('Expanded prefix exceeds 5000 terms.')
        if text.strip().startswith('@'):
            child=next((row for row in library.get('prefixes',[]) if row['name'].lower()==text.strip()[1:].lower()),None)
            if not child:raise ValueError('Missing nested prefix: '+text)
            out.extend(prefix_terms(library,child['id'],negative,(*stack,id),budget))
        else:out.append(text)
    return out

def library_subset(document,library):
    """Freeze only the referenced records for portable workflows; no image history copies."""
    document=validate_document(document);hybrid=library.get('hybrid',{'version':1,'components':{}})
    components={};prefix_ids=set();images={};snapshots={};seen=set()
    def walk(row,depth=0):
        if depth>32:raise ValueError('Reference depth exceeds 32.')
        if row.get('mode')=='disabled':return
        if row['type']=='reference':
            id=row['ref']
            if id in seen:return
            seen.add(id)
            if id not in hybrid.get('components',{}):raise ValueError('Missing reusable component: '+id)
            components[id]=hybrid['components'][id];walk(components[id],depth+1)
        if row['type']=='prefix':
            id=row['ref']
            if id not in prefix_ids:
                prefix_ids.add(id);prefix_terms(library,id)
                prefix=next(p for p in library.get('prefixes',[]) if p['id']==id)
                texts={t['id']:t['text'] for t in library.get('tags',[])}
                for tag in prefix['tags']:
                    text=texts[tag]
                    if text.startswith('@'):
                        child=next((p for p in library['prefixes'] if p['name'].lower()==text[1:].lower()),None)
                        if child:walk({'type':'prefix','ref':child['id']},depth+1)
        if row['type']=='source':
            for id in document.get('source_prefixes',{}).get(row['input'],[]):
                if any(prefix['id']==id for prefix in library.get('prefixes',[])):walk({'type':'prefix','ref':id},depth+1)
            for id in document.get('source_snapshots',{}).get(row['input'],[]):
                if id in library.get('snapshots',{}):snapshots[id]={**library['snapshots'][id],'members':{}}
            for key in row.get('image_keys') or document.get('source_images',{}).get(row['input'],[]):
                if key in hybrid.get('images',{}):
                    images[key]=hybrid['images'][key]
                    for id in images[key]:walk({'type':'reference','ref':id},depth+1)
        for child in row.get('children',[]):walk(child,depth+1)
    for row in document.get('components',[]):walk(row)
    for id,row in hybrid.get('components',{}).items():
        if row.get('mode')=='global':walk({'type':'reference','ref':id})
    prefixes=[p for p in library.get('prefixes',[]) if p['id'] in prefix_ids];tags={id for p in prefixes for id in p['tags']}
    return {'version':2,'tags':[t for t in library.get('tags',[]) if t['id'] in tags],'prefixes':prefixes,**({'snapshots':snapshots} if snapshots else {}),'hybrid':{'version':1,'components':components,'images':images}}

def compile_hybrid(document,library=None,sources=None,rule_library=None):
    document=validate_document(document);library=library or {'version':2,'tags':[],'prefixes':[]};sources=sources or {};rule_library=rule_library or {}
    try:
        from .prefix_library import split_top
        from .prompt_rules import apply_rules,tag_key,validate_boxes,active_channels,choice_channel
        from .prompt_deduplication import merge_prompt_contributions
        from .source_garment_priority import prioritize_source_garments

    except ImportError:
        from prefix_library import split_top
        from prompt_rules import apply_rules,tag_key,validate_boxes,active_channels,choice_channel
        from prompt_deduplication import merge_prompt_contributions
        from source_garment_priority import prioritize_source_garments

    if not isinstance(sources,dict) or any(key not in INPUTS or not isinstance(value,str) or len(value)>1000000 for key,value in sources.items()):raise ValueError('Invalid hybrid source strings.')
    hybrid=validate_extension(library.get('hybrid',{'version':1,'components':{}}));nodes=[];expanded_by_uid={};prefix_ids=set();trace=[];counter=[0]
    def expand(row,parent=None,side='positive',placement='body',stack=(),editor_id=None):
        counter[0]+=1
        if counter[0]>5000 or len(stack)>32:raise ValueError('Expanded hybrid tree exceeds limits.')
        ancestor=expanded_by_uid.get(parent,{})
        record={**row,'uid':str(counter[0]),'parent':parent,'side':row.get('side',side),'placement':row.get('placement',placement),'role':row.get('role',ancestor.get('role','unassigned')),'subject':row.get('subject',ancestor.get('subject','')),'editor_id':editor_id or row['id']};nodes.append(record)
        uid=record['uid'];side=record['side'];placement=record['placement']
        if parent in expanded_by_uid and expanded_by_uid[parent].get('source'):
            record['source']=True;record.setdefault('image_keys',ancestor.get('image_keys',[]));record['source_uid']=ancestor.get('source_uid',parent)
        expanded_by_uid[uid]=record
        if row.get('mode')=='disabled':return
        if row['type']=='reference':
            id=row['ref']
            if id in stack:raise ValueError('Circular component reference: '+id)
            target=hybrid['components'].get(id)
            if not target:raise ValueError('Missing reusable component: '+id)
            expand({**target,**({key:row[key] for key in ('side','placement','role','subject') if key in row})},uid,side,placement,(*stack,id),record['editor_id'])
        elif row['type']=='group':
            for child in row.get('children',[]):expand(child,uid,side,placement,stack,editor_id)
        elif row['type']=='prefix':
            record['prefix_ref']=row['ref'];record['text']=', '.join(prefix_terms(library,row['ref'],side=='negative'));record['type']='tags'
        elif row['type']=='source':
            record['text']=sources.get(row['input'],'');record['source']=True;record['type']=row.get('format','tags');record['image_keys']=row.get('image_keys') or document.get('source_images',{}).get(row['input'],[])
            ids=set()
            for key in record['image_keys']:
                for id in hybrid.get('images',{}).get(key,[]):
                    if id not in ids:expand({'id':'image:'+id,'type':'reference','ref':id},uid,side,placement,stack,record['editor_id']);ids.add(id)
    referenced=set()
    def refs(row):
        if row['type']=='reference' and row['ref'] not in referenced:
            referenced.add(row['ref'])
            if row['ref'] in hybrid['components']:refs(hybrid['components'][row['ref']])
        for child in row.get('children',[]):refs(child)
    for row in document.get('components',[]):refs(row)
    for id,row in hybrid['components'].items():
        if row.get('mode')=='global' and id not in referenced:expand({'id':'global:'+id,'type':'reference','ref':id})
    for row in document.get('components',[]):expand(row)
    expanded_bytes=0
    for row in nodes:
        expanded_bytes+=len(row.get('text','').encode('utf-8'))
        if expanded_bytes>MAX_BYTES:raise ValueError('Expanded hybrid prompt exceeds 4 MiB.')
    by_uid={row['uid']:row for row in nodes};base={row['uid']:row.get('enabled',True) for row in nodes};rng=random.Random(document.get('seed',0))
    def source_owner(row):return by_uid.get(row.get('source_uid'),row if row.get('input') in INPUTS else {})
    def contribution_reason(row):
        owner=source_owner(row)
        if not owner:return None
        if row['uid']!=owner['uid'] and not owner.get('source_components_enabled',True):return 'Associated components excluded'
        if row['type'] not in ('tags','prose'):return None
        if row['uid']==owner['uid'] and not owner.get('source_text_enabled',True):return 'Raw source text excluded'
        if 'source_roles' in owner and row['role'] not in owner['source_roles']:return 'Role excluded by source'
        return None
    children_by_uid={row['uid']:[] for row in nodes}
    for row in nodes:
        if row['parent'] is not None:children_by_uid[row['parent']].append(row)
    def eligible(row):
        if contribution_reason(row) is not None:return False
        if source_owner(row) and row['type'] not in ('tags','prose'):
            return any(eligible(child) for child in children_by_uid[row['uid']])
        return True
    def candidate(row):
        if row.get('mode')=='disabled' or not base[row['uid']]:return False
        if row['type'] in ('tags','prose') and eligible(row) and row.get('text','').strip():return True
        return any(candidate(child) for child in children_by_uid[row['uid']])

    for row in nodes:
        if row['type']!='group':continue
        selection=row.get('selection','all');children=[child for child in children_by_uid[row['uid']] if (candidate(child) if source_owner(row) and 'source_roles' in source_owner(row) else base[child['uid']] and child.get('mode')!='disabled')]
        if selection=='optional':base[row['uid']]=base[row['uid']] and rng.random()<row.get('chance',0.5)
        elif selection in ('one','optional-one') and children:
            chosen=rng.choice(children+([None] if selection=='optional-one' else []))
            for child in children:base[child['uid']]=child is chosen
            trace.append({'stage':'group-choice','group':row['id'],'selection':selection,'selected':chosen['id'] if chosen else None})
    states=dict(base)
    def active(row,state):return row.get('mode')!='disabled' and state[row['uid']] and (not row.get('source_uid') or source_owner(row).get('source_components_enabled',True)) and (row['parent'] is None or active(by_uid[row['parent']],state))
    def tag_values(state):return {tag_key(tag) for row in nodes if active(row,state) and eligible(row) and row['type']=='tags' for tag in split_top(row.get('text','')) if tag.strip()}
    owned_rules=[(rule,None) for rule in document.get('rules',[])]+[(rule,row) for row in nodes for rule in row.get('rules',[])]
    component_rules=[rule for rule,owner in owned_rules]
    known={row['id'] for row in nodes}
    for rule in component_rules:
        if rule['target'] not in known:raise ValueError('Unknown component rule target: '+rule['target'])
    seen=set();fired=[]
    for _ in range(64):
        signature=tuple(states.items())
        if signature in seen:raise ValueError('Component rule activation cycle. Review the rule trace and dependencies.')
        seen.add(signature);tags=tag_values(states);enabled={row['id'] for row in nodes if active(row,states) and eligible(row)};decisions={};fired=[]
        for rule,owner in owned_rules:
            if owner is not None and (not active(owner,states) or not eligible(owner)):continue
            if rule.get('enabled',True) is False or not all(tag_key(tag) in tags for tag in rule.get('tags',[])) or not all(id in enabled for id in rule.get('components',[])) or any(id in enabled for id in rule.get('unless',[])):continue
            target=rule['target'];decision=(rule.get('priority',0),rule['action']=='enable');prior=decisions.get(target)
            if prior and prior[0]==decision[0] and prior[1]!=decision[1]:raise ValueError('Conflicting component rules at equal priority: '+target)
            if prior is None or decision[0]>prior[0]:decisions[target]=decision
            fired.append({'rule':rule['id'],'target':target,'action':rule['action'],'priority':decision[0]})
        next_states={row['uid']:decisions.get(row['id'],(0,base[row['uid']]))[1] for row in nodes}
        if next_states==states:break
        states=next_states
    else:raise ValueError('Component rules did not stabilize.')
    trace.extend({'stage':'component',**row} for row in fired)
    availability=rule_library.get('availability',{})
    policy={'globals':[dict(box,origin='global') for box in rule_library.get('globals',[]) if availability.get(box['definition']['id'],'global')=='global'],'disabled':[id for id,mode in availability.items() if mode=='disabled']}
    prefix_ids={row['prefix_ref'] for row in nodes if row.get('prefix_ref') and active(row,states) and eligible(row)}
    def inherit_source_rules(row):return row.get('inherit_rules','source_roles' not in row or set(row['source_roles'])==set(ROLES))
    source_nodes=[row for row in nodes if row.get('input') in INPUTS and row['side']=='positive' and inherit_source_rules(row) and active(row,states)]
    trace.extend({'stage':'source-policy','component':row['id'],'input':row['input'],'roles':row.get('source_roles',list(ROLES)),'raw_text':row.get('source_text_enabled',True),'associated_components':row.get('source_components_enabled',True),'inherit_rules':inherit_source_rules(row)} for row in nodes if row.get('input') in INPUTS and active(row,states))
    prefix_ids.update(id for row in source_nodes for id in document.get('source_prefixes',{}).get(row['input'],[]))
    inherited=[dict(box,origin='prefix') for id in sorted(prefix_ids) for box in rule_library.get('prefixes',{}).get(id,[])]
    snapshot_ids={id for row in source_nodes for id in document.get('source_snapshots',{}).get(row['input'],[])}
    global_ids={box['id'] for box in rule_library.get('globals',[])}
    for id in sorted(snapshot_ids):
        snapshot=library.get('snapshots',{}).get(id,{})
        boxes=rule_library.get('prefixes',{}).get('snapshot:'+id,snapshot.get('rules',[]))
        boxes=[box for box in boxes if box.get('origin')!='global' and not any(box['id']==global_id or box['id'].endswith(':'+global_id) for global_id in global_ids)]
        validate_boxes(boxes)
        for box in boxes:
            channels=active_channels(box,boxes)
            if not channels:continue
            definition=box['definition'];choices=[choice for choice in definition.get('choices',[]) if choice_channel(definition,choice) in channels]
            inherited.append({**box,'origin':'snapshot','definition':{**definition,'rules':definition['rules'] if definition['family'] in channels else [],'choices':choices},'preferences':{key:value for key,value in box.get('preferences',{}).items() if key in {choice['id'] for choice in choices}}})
    tag_rules=[box for box in [*policy['globals'],*inherited,*document.get('tag_rules',[]),*[rule for row in nodes if active(row,states) and eligible(row) for rule in row.get('tag_rules',[])]] if box['definition']['id'] not in policy['disabled']]
    validate_boxes(tag_rules)
    # Seeded tag alternatives use a local RNG. Literal prose never enters this grammar.
    def sample(text,depth=0):
        if depth>32:raise ValueError('Tag alternative nesting exceeds 32.')
        start=text.find('{')
        if start<0:return text
        nesting=0;end=None
        for i in range(start,len(text)):
            if text[i]=='{':nesting+=1
            elif text[i]=='}':
                nesting-=1
                if nesting==0:end=i;break
        if end is None:raise ValueError('Unclosed tag alternative.')
        options=split_top(text[start+1:end],'|')
        return text[:start]+sample(rng.choice(options),depth+1)+sample(text[end+1:],depth+1)
    outputs={};components=[]
    for side in ('positive','negative'):
        selected=[row for place in ('prefix','body','suffix') for row in nodes if active(row,states) and eligible(row) and row['side']==side and row['placement']==place and row['type'] in ('tags','prose')]
        rows=[{'text':row.get('text',''),'source':row.get('source',False)} for row in selected if row['type']=='tags']
        rules=tag_rules if side=='positive' else document.get('negative_tag_rules',[])+[rule for row in nodes if active(row,states) and eligible(row) for rule in row.get('negative_tag_rules',[])]
        rules=[box for box in rules if box['definition']['id'] not in policy['disabled']]
        rows,errors=prioritize_source_garments(rows,rules)
        if errors:raise ValueError('; '.join(errors))
        for row in rows:
            seen_tags=set();unique=[]
            for part in split_top(row['text']):
                key=tag_key(part)
                if key and key not in seen_tags:unique.append(part.strip());seen_tags.add(key)
            row['text']=', '.join(unique)
        rows=merge_prompt_contributions(rows);rows=[{**row,'text':sample(row['text'])} for row in rows];iterator=iter(rows);literals={};parts=[]
        digest=hashlib.sha256(json.dumps(document,sort_keys=True).encode()).hexdigest()
        for row in selected:
            text=next(iterator)['text'] if row['type']=='tags' else row.get('text','')
            components.append({'id':row['id'],'uid':row['uid'],'editor_id':row['editor_id'],'role':row['role'],'subject':row['subject'],'name':row.get('name',row['id']),'type':row['type'],'side':side,'source':row.get('source',False),'text':text,'image_keys':row.get('image_keys',[]),**({'prefix_id':row['prefix_ref']} if row.get('prefix_ref') else {})})
            if not text.strip():continue
            if row['type']=='prose':
                marker='__gallery_literal_'+digest+'_'+str(len(literals))+'__';literals[marker]=text;parts.append(marker)
            else:parts.append(text)
        before=', '.join(parts);after,rule_trace=apply_rules(before,rules);paragraphs=[];tags=[]
        def flush():
            if tags:paragraphs.append(', '.join(tags));tags.clear()
        for part in split_top(after):
            if part.strip() in literals:flush();paragraphs.append(literals[part.strip()])
            elif part.strip():tags.append(part.strip())
        flush();outputs[side]='\n\n'.join(paragraphs)
        trace.append({'stage':'tag-rules','side':side,'rules':rule_trace,'changed':before!=after,'before_tags':[part.strip() for part in split_top(before) if part.strip() not in literals],'after_tags':[part.strip() for part in split_top(after) if part.strip() not in literals]})
    if sum(len(text.encode('utf-8')) for text in outputs.values())>MAX_BYTES:raise ValueError('Compiled hybrid prompt exceeds 4 MiB.')
    compiled=dict(outputs)
    if document.get('override',{}).get('enabled'):
        outputs={side:document['override'].get(side,'') for side in ('positive','negative')};trace.append({'stage':'override','message':'Final text override active; components retained.'})
    contributions={row['uid']:row for row in components};inspection=[]
    for row in nodes:
        if row['type'] not in ('tags','prose'):continue
        compiled_row=contributions.get(row['uid']);reason=contribution_reason(row)
        if not reason and not active(row,states):
            reason='Disabled component or parent' if row.get('mode')=='disabled' or not row.get('enabled',True) else 'Inactive group, choice or component rule'
        if not reason and not (compiled_row or {}).get('text','').strip():reason='Empty or merged duplicate contribution'
        inspection.append({'uid':row['uid'],'id':row['id'],'editor_id':row['editor_id'],'name':row.get('name',row['id']),'type':row['type'],'side':row['side'],'role':row['role'],'subject':row['subject'],'source':row.get('source',False),'input':source_owner(row).get('input'),'image_keys':row.get('image_keys',[]),'status':'suppressed' if reason else 'included','reason':reason or 'Included before final tag rules','text':(compiled_row or row).get('text',''),'overridden':bool(document.get('override',{}).get('enabled'))})
    order={row['uid']:i for i,row in enumerate(components)}
    inspection.sort(key=lambda row:order.get(row['uid'],len(components)+int(row['uid'])))
    return {**outputs,'compiled':compiled,'trace':trace,'components':components,'inspection':inspection,'active_components':sorted({row['id'] for row in nodes if active(row,states)}),'warnings':['Anima weighting and token limits are handled by the selected conditioning node; no SDXL defaults are applied.']+['Source '+row['input']+' is not available in this preview; its wire is resolved at execution.' for row in nodes if row.get('input') in INPUTS and row['input'] not in sources and active(row,states)]}

class GalleryHybridPrompt:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required':{'document':('STRING',{'default':'{"version":1,"components":[]}','multiline':True,'dynamicPrompts':False}),'library':('STRING',{'default':'{"version":2,"tags":[],"prefixes":[]}','multiline':True,'dynamicPrompts':False})},'optional':{**{name:('STRING',{'forceInput':True}) for name in INPUTS},'rules_policy':('STRING',{'default':'','forceInput':True})},'hidden':{'extra_pnginfo':'EXTRA_PNGINFO','unique_id':'UNIQUE_ID'}}
    RETURN_TYPES=('STRING','STRING','STRING')
    RETURN_NAMES=('positive','negative','report')
    FUNCTION='compose'
    CATEGORY='prompt/library'
    @classmethod
    def IS_CHANGED(cls,**kwargs):
        # Run this inexpensive composition step for every image so generation metadata is recorded even when conditioning can be cached.
        return float('nan')
    def compose(self,document,library,extra_pnginfo=None,unique_id=None,rules_policy='',**sources):
        # The library widget is a portable subset, not the whole user library.
        lib=_object(library);rule_library=lib.pop('rule_library',{})
        try:
            from .rules_library import policy
            live=policy.get()
        except ImportError:live=None
        if rules_policy or live:
            current=json.loads(rules_policy or live);rule_library={**rule_library,'globals':current.get('globals',[]),'availability':{id:'disabled' for id in current.get('disabled',[])}}
        result=compile_hybrid(document,lib,sources,rule_library)
        ids=sorted({row['prefix_id'] for row in result['components'] if row.get('prefix_id')})
        prefix_refs=[{'prefix_id':id,'prefix_name':next((row['name'] for row in lib.get('prefixes',[]) if row['id']==id),id),'snapshot_id':None} for id in ids]
        if isinstance(extra_pnginfo,dict):extra_pnginfo.setdefault('gallery_prompts',{})[str(unique_id or 'hybrid')]={'hybrid':True,'overridden':validate_document(document).get('override',{}).get('enabled',False),'resolved':result['positive'],'negative':result['negative'],'components':result['components'],'trace':result['trace'],'prefix_snapshots':prefix_refs,'document_version':1}
        return {'ui':{'text':[json.dumps(result,ensure_ascii=False)]},'result':(result['positive'],result['negative'],json.dumps(result,ensure_ascii=False))}
