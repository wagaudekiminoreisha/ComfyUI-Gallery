"""Conservative scalp-hair filtering; shared vocabulary with the browser preview."""
import json
import re
from pathlib import Path

PACK = json.loads((Path(__file__).parent / 'data/global-tag-rules.json').read_text(encoding='utf-8'))
ATTRIBUTES = {'length', 'colour', 'distribution', 'presence', 'arrangement', 'texture', 'details', 'alteration', 'bangs-length', 'material'}
FACETS = json.loads((Path(__file__).parent / 'data/hair-prompt-tags.json').read_text(encoding='utf-8'))['tags']


def clean_policy(value):
    if isinstance(value, str):
        try: value = json.loads(value)
        except ValueError: value = {}
    value = value if isinstance(value, dict) else {}
    attributes = value.get('attributes', ['length'])
    return {'mode': value.get('mode') if value.get('mode') in ('natural', 'minimal') else 'specific',
            'attributes': [key for key in attributes if isinstance(key, str) and key in ATTRIBUTES] if isinstance(attributes, list) else ['length'],
            'singleColour': value.get('singleColour') is True}


def filter_hair_prompt(text, policy, depth=0):
    # Lazy import avoids the encoder/library import cycle and uses exactly its separator rules.
    try: from .prefix_library import split_top
    except ImportError: from prefix_library import split_top
    policy = clean_policy(policy)
    if policy['mode'] == 'specific' or depth > 32: return text
    def wrapped(value, left, right):
        if not value.startswith(left) or not value.endswith(right): return False
        level = 0
        for i, char in enumerate(value):
            if char == left: level += 1
            elif char == right:
                level -= 1
                if level == 0 and i < len(value) - 1: return False
        return level == 0
    result = []
    for part in split_top(text.replace('\n', ' ')):
        part = part.strip()
        if not part: continue
        if wrapped(part, '(', ')') or wrapped(part, '[', ']'):
            inner, suffix = part[1:-1], ''
            weight = re.match(r'^([\s\S]+)(:-?\d+(?:\.\d+)?)$', inner) if part[0] == '(' else None
            if weight: inner, suffix = weight.groups()
            filtered = filter_hair_prompt(inner, policy, depth + 1)
            if filtered: result.append(part[0] + filtered + suffix + part[-1])
        elif wrapped(part, '{', '}') and len(split_top(part[1:-1], '|')) > 1:
            options = [filter_hair_prompt(option, policy, depth + 1) for option in split_top(part[1:-1], '|')]
            kept = list(dict.fromkeys(option for option in options if option))
            if kept: result.append('{' + '|'.join(kept + ([''] if '' in options else [])) + '}' if len(kept) > 1 or '' in options else kept[0])
        else:
            key = re.sub(r'\s+', '_', part.lower())
            facet = FACETS.get(PACK['aliases'].get(key, key))
            if facet is None or policy['mode'] == 'minimal' and facet in policy['attributes']: result.append(part)
    return ', '.join(result)
