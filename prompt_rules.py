"""Versioned declarative prompt rules. Data only: never evaluates Python/JavaScript."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
ALIASES = json.loads((ROOT/'data/global-tag-rules.json').read_text(encoding='utf-8'))['aliases']
OPS = {'exclude', 'protect', 'require', 'select', 'exclusive'}


def tag_key(value):
    value = re.sub(r'\s+', '_', value.strip().lower())
    return ALIASES.get(value, value)


def validate_condition(value, depth=0):
    if depth>8 or not isinstance(value,dict):raise ValueError('Invalid or overly nested rule condition.')
    if value.get('op')=='tag':
        tag=value.get('tag')
        if not isinstance(tag,str) or not tag.strip() or len(tag)>300 or any(c in tag for c in ',{}[]<>|\n\r') or tag.strip().startswith('('):raise ValueError('Condition needs one literal tag.')
    elif value.get('op') in ('all','any','not'):
        children=value.get('children')
        if not isinstance(children,list) or len(children)>100:raise ValueError('Condition needs at most 100 child conditions.')
        for child in children:validate_condition(child,depth+1)
    else:raise ValueError('Unknown condition operation.')

def condition_matches(value,tags):
    if value is None:return True
    if value['op']=='tag':return tag_key(value['tag']) in tags
    matches=[condition_matches(child,tags) for child in value['children']]
    return all(matches) if value['op']=='all' else any(matches) if value['op']=='any' else not any(matches)

def validate_definition(value):
    if not isinstance(value, dict) or value.get('version') != 1: raise ValueError('Ruleset requires version: 1.')
    for field in ('id', 'name', 'family'):
        if not isinstance(value.get(field), str) or not 1 <= len(value[field].strip()) <= 160: raise ValueError('Ruleset requires '+field+'.')
    def rules(rows):
        if not isinstance(rows, list) or len(rows)>200: raise ValueError('At most 200 rules per list.')
        for row in rows:
            if not isinstance(row, dict) or row.get('op') not in OPS: raise ValueError('Unknown rule operation.')
            for field in ('tags', 'if_all'):
                tags = row.get(field, [])
                if not isinstance(tags, list) or len(tags)>1000 or any(not isinstance(tag,str) or not tag.strip() or len(tag)>300 or any(c in tag for c in ',{}[]<>|\n\r') or tag.strip().startswith('(') for tag in tags): raise ValueError('Rules use lists of individual literal tags.')
            if row.get('condition') is not None:validate_condition(row['condition'])
            if not row.get('tags'): raise ValueError('A rule needs tags.')
            if row['op']=='select' and (not isinstance(row.get('value'),str) or tag_key(row['value']) not in [tag_key(tag) for tag in row['tags']]): raise ValueError('Select value must belong to its tags.')
    rules(value.get('rules', []))
    choices = value.get('choices', [])
    if not isinstance(choices,list) or len(choices)>30: raise ValueError('At most 30 preferences.')
    ids=set()
    for choice in choices:
        if not isinstance(choice,dict) or not isinstance(choice.get('id'),str) or not choice['id'] or choice['id'] in ids or not isinstance(choice.get('label'),str): raise ValueError('Invalid preference ID/label.')
        ids.add(choice['id']); options=choice.get('options')
        if not isinstance(options,list) or not 1<=len(options)<=100: raise ValueError('Preference needs options.')
        option_ids=set()
        for option in options:
            if not isinstance(option,dict) or not isinstance(option.get('id'),str) or not option['id'] or option['id'] in option_ids or not isinstance(option.get('label'),str): raise ValueError('Invalid option ID/label.')
            option_ids.add(option['id']);rules(option.get('rules',[]))
        if choice.get('default') not in option_ids: raise ValueError('Preference needs a valid default.')
    value.setdefault('rules',[]);value.setdefault('choices',[])
    for choice in choices:
        for option in choice['options']:option.setdefault('rules',[])
    return value


def validate_boxes(value):
    if not isinstance(value,list) or len(value)>100: raise ValueError('At most 100 ruleset boxes.')
    for box in value:
        if not isinstance(box,dict) or not isinstance(box.get('id'),str) or not 1<=len(box['id'])<=300: raise ValueError('Invalid ruleset box.')
        definition=validate_definition(box.get('definition'))
        for field in ('enabled','collapsed'):
            if field in box and not isinstance(box[field],bool):raise ValueError('Invalid ruleset '+field+'.')
        if not isinstance(box.get('scope','main'),str) or not 1<=len(box.get('scope','main'))<=100: raise ValueError('Invalid ruleset scope.')
        if box.get('origin','encoder') not in ('global','prefix','snapshot','encoder'): raise ValueError('Invalid ruleset origin.')
        selections=box.get('preferences',{})
        if not isinstance(selections,dict): raise ValueError('Invalid preferences.')
        choices={choice['id']:choice for choice in definition.get('choices',[])}
        for key,selected_value in selections.items():
            if key not in choices or selected_value not in [option['id'] for option in choices[key]['options']]: raise ValueError('Unknown preference option.')
    return value


def active_boxes(boxes):
    boxes=validate_boxes(boxes)
    ranks={'global':0,'prefix':1,'snapshot':2,'encoder':3}
    enabled=[box for box in boxes if box.get('enabled',True)]
    ranks_by_scope={}
    for box in enabled:
        key=(box['definition']['family'],box.get('scope','main'))
        ranks_by_scope[key]=max(ranks_by_scope.get(key,-1),ranks[box.get('origin','encoder')])
    return [box for box in enabled if ranks[box.get('origin','encoder')]==ranks_by_scope[(box['definition']['family'],box.get('scope','main'))]]


def apply_rules(text, boxes):
    try: from .prefix_library import split_top
    except ImportError: from prefix_library import split_top
    def unwrap(part):
        part=part.strip()
        if part.startswith('(') and part.endswith(')'): return re.sub(r':-?\d+(?:\.\d+)?$', '',part[1:-1])
        if part.startswith('[') and part.endswith(']'): return part[1:-1]
        return part
    def leaves(value,depth=0):
        if depth>32: raise ValueError('Prompt nesting exceeds rules limit.')
        found=[]
        for part in split_top(value):
            inner=unwrap(part)
            if inner!=part.strip():found.extend(leaves(inner,depth+1))
            elif part.strip():found.append(tag_key(part))
        return found
    initial=set(leaves(text)); excluded=set(); required={}; protected=set(); exclusive=[]; trace=[]
    for box in active_boxes(boxes):
        definition=box['definition']; rows=list(definition.get('rules',[]))
        for choice in definition.get('choices',[]):
            selected=box.get('preferences',{}).get(choice['id'],choice['default'])
            rows.extend(next(option for option in choice['options'] if option['id']==selected).get('rules',[]))
        for row in rows:
            if not all(tag_key(tag) in initial for tag in row.get('if_all',[])):continue
            if not condition_matches(row.get('condition'),initial):continue
            tags={tag_key(tag) for tag in row['tags']}; op=row['op']
            if op=='protect':protected.update(tags)
            elif op=='exclude':excluded.update(tags)
            elif op=='require':
                for tag in row['tags']:required.setdefault(tag_key(tag),(tag,definition['name']))
            elif op=='select':
                selected=tag_key(row['value']);excluded.update(tags-{selected});required.setdefault(selected,(row['value'],definition['name']))
            elif op=='exclusive':exclusive.append((tags,definition['name']))
        trace.append({'name':definition['name'],'id':definition['id'],'scope':box.get('scope','main'),'origin':box.get('origin','encoder'),'preferences':box.get('preferences',{})})
    collision=excluded.intersection(required)
    if collision:raise ValueError('Rules conflict: required and excluded: '+', '.join(sorted(collision))+'. Adjust or disable a ruleset box.')
    final=(initial-excluded)|set(required)
    for tags,name in exclusive:
        competing=final.intersection(tags)
        if len(competing)>1:raise ValueError(name+' rules conflict: '+', '.join(sorted(competing))+'. Choose a deterministic preference or use alternatives.')
    def rewrite(value,depth=0):
        if depth>32:raise ValueError('Prompt nesting exceeds rules limit.')
        parts=[]
        for part in split_top(value):
            part=part.strip();inner=unwrap(part)
            if inner!=part:
                kept=rewrite(inner,depth+1)
                weight=re.search(r':-?\d+(?:\.\d+)?(?=\)$)',part)
                if kept:parts.append(part[0]+kept+(weight[0] if weight else '')+part[-1])
            elif part and tag_key(part) not in excluded:parts.append(part)
        return ', '.join(parts)
    filtered=rewrite(text) if initial.intersection(excluded) else text
    remaining=set(leaves(filtered))
    additions=[tag for key,(tag,_) in required.items() if key not in remaining]
    return ', '.join(part for part in [filtered,*additions] if part), {'rulesets':trace,'protected_tags':sorted(protected),'excluded_tags':sorted(initial.intersection(excluded)),'added_tags':additions}
