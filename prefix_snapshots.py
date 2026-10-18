"""Content-addressed prefix variants. Parent definitions and pairings stay unchanged."""
import hashlib
import json
import re
import time

def terms(values):
    try:from .prefix_library import split_top
    except ImportError:from prefix_library import split_top
    def canonical(term):
        return ''.join(part if part.startswith('<') else re.sub(r'\s+',' ',part.lower().replace('_',' ')) for part in re.split('(<[^>]*>)',term.strip()))
    return sorted(set(canonical(term) for value in values for term in split_top(value) if term.strip()))

def program(boxes):
    try:from .prompt_rules import active_boxes,tag_key
    except ImportError:from prompt_rules import active_boxes,tag_key
    rows=[]
    for box in active_boxes(boxes):
        definition=box['definition'];rules=list(definition.get('rules',[]))
        for choice in definition.get('choices',[]):
            selected=box.get('preferences',{}).get(choice['id'],choice['default'])
            rules.extend(next(option for option in choice['options'] if option['id']==selected).get('rules',[]))
        if rules:rows.append({'family':definition['family'],'scope':box.get('scope','main'),'rules':sorted([dict(rule, tags=sorted(set(tag_key(tag) for tag in rule['tags']))) for rule in rules],key=lambda rule:json.dumps(rule,sort_keys=True))})
    return sorted(rows,key=lambda row:json.dumps(row,sort_keys=True))

def prefix_terms(library,prefix,seen=None):
    seen=set() if seen is None else set(seen)
    if prefix['id'] in seen or len(seen)>30:return []
    seen.add(prefix['id']);texts={row['id']:row['text'] for row in library['tags']};result=[]
    for key in prefix['tags']:
        text=texts.get(key,'');child=next((row for row in library['prefixes'] if '@'+row['name'].lower()==text.strip().lower()),None)
        result.extend(prefix_terms(library,child,seen) if child else [text])
    return result

def capture_snapshot(library,data,baseline_boxes=None):
    try:from .prompt_rules import validate_boxes
    except ImportError:from prompt_rules import validate_boxes
    prefix=next((row for row in library['prefixes'] if row['id']==data.get('prefix_id')),None)
    if prefix is None:raise ValueError('The parent prefix no longer exists.')
    positive=data.get('terms',[]);negative=data.get('negative_terms',[])
    for values in (positive,negative):
        if not isinstance(values,list) or len(values)>500 or any(not isinstance(value,str) or not value.strip() or len(value)>32768 for value in values):raise ValueError('Invalid snapshot tags.')
    boxes=validate_boxes(data.get('rules',[]));hair=data.get('hair_policy') or {}
    if not isinstance(hair,dict):raise ValueError('Invalid snapshot hair policy.')
    try:from .hair_policy import clean_policy
    except ImportError:from hair_policy import clean_policy
    hair=clean_policy(hair);hair['attributes']=sorted(hair['attributes']);hair={} if hair['mode']=='specific' and not hair.get('singleColour') else hair
    signature={'prefix_id':prefix['id'],'positive':terms(positive),'negative':terms(negative),'rules':program(boxes),'hair':hair}
    base={'prefix_id':prefix['id'],'positive':terms(prefix_terms(library,prefix)),'negative':terms(prefix.get('negative_terms',[])),'rules':program(baseline_boxes or []),'hair':{}}
    if signature==base:
        keys=data.get('image_keys',[]);references=data.get('image_refs',{})
        if not isinstance(keys,list) or len(keys)>256 or any(not isinstance(key,str) or len(key)>4096 for key in keys) or not isinstance(references,dict):raise ValueError('Invalid snapshot image membership.')
        for key in keys:
            reference=references.get(key,{})
            if not isinstance(reference,dict) or any(not isinstance(value,str) or len(value)>4096 for value in reference.values()):raise ValueError('Invalid associated image reference.')
            library.setdefault('associations',{})[key]={'prefix_id':prefix['id'],'terms':prefix_terms(library,prefix),'negative_terms':prefix.get('negative_terms',[]),**({'image':reference} if reference else {})}
        return None
    identifier=hashlib.sha256(json.dumps(signature,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    snapshots=library.setdefault('snapshots',{})
    if identifier not in snapshots:snapshots[identifier]={'id':identifier,'prefix_id':prefix['id'],'name':str(data.get('name') or '')[:160],'terms':positive,'negative_terms':negative,'rules':boxes,'hair_policy':hair,'members':{},'created_at':time.time()}
    keys=data.get('image_keys',[]);references=data.get('image_refs',{})
    if not isinstance(keys,list) or len(keys)>256 or any(not isinstance(key,str) or len(key)>4096 for key in keys) or not isinstance(references,dict):raise ValueError('Invalid snapshot image membership.')
    for key in keys:
        reference=references.get(key,{})
        if not isinstance(reference,dict) or any(not isinstance(value,str) or len(value)>32768 for value in reference.values()):raise ValueError('Invalid snapshot image reference.')
        snapshots[identifier]['members'][key]=reference
    return identifier

def validate_snapshots(rows):
    try:from .prompt_rules import validate_boxes
    except ImportError:from prompt_rules import validate_boxes
    if not isinstance(rows,dict) or len(rows)>10000:raise ValueError('Invalid prefix snapshots.')
    for key,row in rows.items():
        if not re.fullmatch('[a-f0-9]{64}',key) or not isinstance(row,dict) or row.get('id')!=key or not isinstance(row.get('prefix_id'),str):raise ValueError('Invalid snapshot identity.')
        for field in ('terms','negative_terms'):
            values=row.get(field,[])
            if not isinstance(values,list) or len(values)>500 or any(not isinstance(value,str) or len(value)>32768 for value in values):raise ValueError('Invalid snapshot terms.')
        validate_boxes(row.get('rules',[]))
        members=row.get('members',{})
        if not isinstance(members,dict) or len(members)>50000:raise ValueError('Invalid snapshot members.')
        for member,reference in members.items():
            if not isinstance(member,str) or len(member)>4096 or not isinstance(reference,dict) or any(not isinstance(value,str) or len(value)>32768 for value in reference.values()):raise ValueError('Invalid snapshot image reference.')
        if not isinstance(row.get('name',''),str) or len(row.get('name',''))>160:raise ValueError('Invalid snapshot name.')
    return rows
