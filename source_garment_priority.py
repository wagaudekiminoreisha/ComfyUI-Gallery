"""Protect guaranteed source garments before sampling manual alternative groups."""
import json
import re
from pathlib import Path
try:
    from .prompt_rules import tag_key, active_boxes, active_channels, choice_channel
    from .prompt_deduplication import _wrapper
except ImportError:
    from prompt_rules import tag_key, active_boxes, active_channels, choice_channel
    from prompt_deduplication import _wrapper
PACK=json.loads((Path(__file__).parent/'data/source-garment-priority.json').read_text(encoding='utf-8'))

def prioritize_source_garments(rows, rules=None):
    try: from .prefix_library import split_top
    except ImportError: from prefix_library import split_top
    if any(re.search(r'\bBREAK\b',row['text']) for row in rows):return rows,[]
    def key(text):
        value=tag_key(text)
        return PACK['aliases'].get(value,value)
    def fixed(text,depth=0):
        if depth>32:return []
        result=[]
        for raw in split_top(text):
            part=raw.strip();wrapped=_wrapper(part)
            if wrapped:result+=fixed(wrapped[0],depth+1)
            elif part and not part.startswith('{'):result.append(key(part))
        return result
    source=set(tag for row in rows if row.get('source') for tag in fixed(row['text']))
    anchors={}
    for tag in source:
        for slot,value in PACK['tags'].get(tag,{}).items():anchors.setdefault(slot,set()).add(value)
    def ancestors(value):
        result={value}
        while value in PACK['parents']:
            value=PACK['parents'][value];result.add(value)
        return result
    def related(a,b):return a in ancestors(b) or b in ancestors(a)
    anchors={slot:values for slot,values in anchors.items() if 'multicolored' not in values and all(related(a,b) for a in values for b in values)}
    if not anchors:return rows,[]
    layered=False;multiple=False
    for box in active_boxes(rules or []):
        for choice in box['definition'].get('choices',[]):
            if choice['id']=='bottoms' and choice_channel(box['definition'],choice) in active_channels(box,rules or []):
                value=box.get('preferences',{}).get('bottoms',choice['default'])
                layered |= value=='layered' or value.startswith(('skirt-','dress-'))
                multiple |= value=='multiple'
            if box['definition']['family']=='clothing-layers' and box.get('preferences',{}).get('layering','') in ('skirt-pants','skirt-track','skirt-leggings'):layered=True
    def permitted(slot,a,b):
        if related(a,b) or b=='multicolored':return True
        if slot!='lower':return False
        if multiple:return True
        return layered and ((a in ('skirt','dress') and (b in ('pants','jeans','track_pants','cargo_pants') or a=='skirt' and b=='leggings')) or (b in ('skirt','dress') and (a in ('pants','jeans','track_pants','cargo_pants') or b=='skirt' and a=='leggings')))
    errors=[]
    def strip_known(text,depth=0):
        if depth>32:return text
        result=[]
        for raw in split_top(text):
            part=raw.strip();wrapped=_wrapper(part)
            if wrapped:
                inner=strip_known(wrapped[0],depth+1)
                if inner:result.append(part[0]+inner+wrapped[1]+part[-1])
            elif key(part) not in source:result.append(part)
        return ', '.join(part for part in result if part)
    def rewrite(text,depth=0):
        if depth>32:raise ValueError('Source garment priority nesting exceeds 32 levels.')
        result=[]
        for raw in split_top(text):
            part=raw.strip();wrapped=_wrapper(part)
            if wrapped:
                inner=rewrite(wrapped[0],depth+1)
                if inner:result.append(part[0]+inner+wrapped[1]+part[-1])
                continue
            if not (part.startswith('{') and part.endswith('}')):
                if part:result.append(part)
                continue
            options=split_top(part[1:-1],'|')
            optional=any(not option.strip() for option in options)
            valid=[]
            for option in options:
                before=len(errors)
                value=rewrite(option,depth+1)
                if len(errors)>before:
                    del errors[before:]
                    continue
                traits=[(slot,trait) for tag in fixed(value) for slot,trait in PACK['tags'].get(tag,{}).items()]
                if any(slot in anchors and any(not permitted(slot,anchor,trait) for anchor in anchors[slot]) for slot,trait in traits):continue
                matches=any(slot in ('base','outer','lower') and slot in anchors and any(related(anchor,trait) for anchor in anchors[slot]) for slot,trait in traits)
                valid.append((strip_known(value),matches))
            chosen=[value for value,match in valid if match] if not optional and any(match for _,match in valid) else [value for value,_ in valid]
            if not chosen:
                if not optional:errors.append('No compatible alternative remains for the source outfit: '+part)
            elif any(chosen):result.append(chosen[0] if len(chosen)==1 else '{'+'|'.join(chosen)+'}')
        return ', '.join(result)
    return [{**row,'text':row['text'] if row.get('source') else rewrite(row['text'])} for row in rows],list(dict.fromkeys(errors))
