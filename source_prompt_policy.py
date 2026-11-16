"""Opt-in prompt selection, consensus and source-local category masks."""
import json
import math
import re
from pathlib import Path
try:
    from .prompt_rules import tag_key
except ImportError:
    from prompt_rules import tag_key

ROOT = Path(__file__).parent
CATALOG = json.loads((ROOT/'data/source-tag-categories.json').read_text(encoding='utf-8'))
STOCK = json.loads((ROOT/'data/prompt-rulesets.json').read_text(encoding='utf-8'))
GLOBAL = json.loads((ROOT/'data/global-tag-rules.json').read_text(encoding='utf-8'))
CATEGORY_TAGS = {}
for category in CATALOG['categories']:
    tags = set()
    for definition in STOCK['definitions']:
        if definition['family'] not in category['families']:
            continue
        rows = list(definition.get('rules', []))
        rows += [row for choice in definition.get('choices', []) for option in choice['options'] for row in option.get('rules', [])]
        tags.update(tag_key(tag) for row in rows for tag in row.get('tags', []))
    tags.update(tag_key(member['tag']) for facet in GLOBAL['facets'] if any(facet['id'].startswith(prefix) for prefix in category['facets']) for member in facet.get('members',[]))
    CATEGORY_TAGS[category['id']] = tags


def merge_prompt_texts(texts, mode='append', min_percent=60):
    try: from .prefix_library import split_top, source_key
    except ImportError: from prefix_library import split_top, source_key
    if mode not in ('append','union','common','frequency') or type(min_percent) is not int or not 1 <= min_percent <= 100:
        raise ValueError('Invalid source prompt merge settings.')
    if mode == 'append':
        return ', '.join(text for text in texts if text)
    terms, counts = {}, {}
    for text in texts:
        seen = set()
        for part in split_top(text):
            part = part.strip()
            if not part:
                continue
            key = source_key(part)
            terms.setdefault(key,part)
            if key not in seen:
                counts[key] = counts.get(key,0)+1
                seen.add(key)
    threshold = 1 if mode == 'union' else len(texts) if mode == 'common' else math.ceil(len(texts)*min_percent/100)
    return ', '.join(term for key,term in terms.items() if counts[key] >= threshold)


def prompt_source_images(manifest):
    selection = manifest.get('prompt_selection','layout')
    if selection not in ('layout','active','batch','all'):
        raise ValueError('Invalid prompt image selection.')
    images = manifest['images']
    if selection == 'batch':
        return [images[index] for index in manifest.get('batch_indices',range(len(images)))]
    if selection == 'active' or selection == 'layout' and manifest['layout'] == 'single':
        return images[manifest.get('active_index',0):manifest.get('active_index',0)+1]
    return images


def filter_source_categories(text, excluded):
    try: from .prefix_library import split_top
    except ImportError: from prefix_library import split_top
    if not isinstance(excluded,list) or any(not isinstance(category,str) or category not in CATEGORY_TAGS for category in excluded):
        raise ValueError('Invalid source tag categories.')
    removed = {}
    def wraps(value,left,right):
        if not value.startswith(left) or not value.endswith(right):return False
        depth = 0
        for at,char in enumerate(value):
            if char == left:depth += 1
            elif char == right:depth -= 1
            if depth == 0 and at != len(value)-1:return False
        return depth == 0
    def rewrite(value,depth=0):
        if depth > 32:raise ValueError('Source prompt nesting exceeds filter limit.')
        kept = []
        for part in split_top(value):
            part = part.strip()
            if not part:continue
            if wraps(part,'{','}'):
                options = [rewrite(option,depth+1) for option in split_top(part[1:-1],'|')]
                if any(options):kept.append('{'+ '|'.join(options)+'}')
            elif wraps(part,'(',')') or wraps(part,'[',']'):
                weight = re.search(r':-?\d+(?:\.\d+)?(?=\)$)',part)
                inner = part[1:-1]
                if weight:inner = inner[:-len(weight[0])]
                result = rewrite(inner,depth+1)
                if result:kept.append(part[0]+result+(weight[0] if weight else '')+part[-1])
            else:
                categories = [category for category in excluded if tag_key(part) in CATEGORY_TAGS[category]]
                if categories:removed.setdefault(part,categories)
                else:kept.append(part)
        return ', '.join(kept)
    return rewrite(text) if excluded else text, [{'tag':tag,'categories':categories} for tag,categories in removed.items()]
