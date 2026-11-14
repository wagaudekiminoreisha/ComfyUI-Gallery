"""Tokenizer-only attribution of final prompt text; never runs CLIP encoding."""
import re
import time

try:
    from .prefix_library import split_top
    from .prompt_rules import tag_key, apply_rules, active_boxes
except ImportError:
    from prefix_library import split_top
    from prompt_rules import tag_key, apply_rules, active_boxes


def inner_text(part):
    part = part.strip()
    if part.startswith('(') and part.endswith(')'):
        return re.sub(r':-?\d+(?:\.\d+)?$', '', part[1:-1])
    if part.startswith('[') and part.endswith(']'):
        return part[1:-1]
    return part


def leaf_names(text, depth=0):
    if depth > 32:
        return []
    found = []
    for option in split_top(text, '|'):
        for part in split_top(option):
            inner = inner_text(part)
            if inner != part.strip():
                found.extend(leaf_names(inner, depth + 1))
            elif inner.startswith('{') and inner.endswith('}'):
                found.extend(leaf_names(inner[1:-1], depth + 1))
            elif inner:
                found.append(inner)
    return found


def project_text(text, keys, keep=True, depth=0):
    """Keep whole surviving literal leaves and their original emphasis/weights."""
    if depth > 32:
        return ''
    parts = []
    for part in split_top(text):
        part = part.strip()
        inner = inner_text(part)
        if inner != part:
            kept = project_text(inner, keys, keep, depth + 1)
            weight = re.search(r':-?\d+(?:\.\d+)?(?=\)$)', part)
            if kept:
                parts.append(part[0] + kept + (weight[0] if weight else '') + part[-1])
        elif part and ((tag_key(part) in keys) == keep):
            parts.append(part)
    return ', '.join(parts)


def prompt_groups(extra_pnginfo, unique_id, source_text):
    nodes = (extra_pnginfo or {}).get('workflow', {}).get('nodes', [])
    node = next((node for node in nodes if str(node.get('id')) == str(unique_id)), {})
    boxes = node.get('properties', {}).get('prompt_boxes', {}).get('boxes', [])
    groups = []
    for box in boxes:
        if not box.get('enabled', True):
            continue
        if box.get('kind') == 'source':
            if source_text:
                groups.append({'name': 'Source tags', 'kind': 'source', 'syntax': source_text})
                for index, part in enumerate(split_top(source_text)):
                    if '{' in part:
                        groups.append({'name': 'Source group ' + str(index + 1), 'kind': 'group', 'syntax': part.strip()})
        elif box.get('kind') == 'group':
            syntax = []
            name = box.get('name') or 'Tag box'
            for index, chip in enumerate(box.get('chips', [])):
                if not chip.get('enabled', True):
                    continue
                if chip.get('kind') == 'or':
                    text = '{' + '|'.join(chip.get('options', [])) + ('|' if chip.get('optional') else '') + '}'
                else:
                    text = chip.get('text', '')
                if chip.get('weight') is not None and chip.get('weight') != 1:
                    text = '(' + text + ':' + str(chip['weight']) + ')'
                syntax.append(text)
                if chip.get('kind') == 'or':
                    groups.append({'name': name + ' · group ' + str(index + 1), 'kind': 'group', 'syntax': text})
            if syntax:
                groups.append({'name': name, 'kind': 'box', 'syntax': ', '.join(syntax)})
    # External text providers and old workflows still get meaningful top-level groups.
    if not groups and source_text:
        groups.append({'name': 'Source tags', 'kind': 'source', 'syntax': source_text})
    return groups


def diagnose_prompt(context, clip, expected_streams, max_groups=64, max_rules=32):
    try:
        from .load_report import encoder_load
    except ImportError:
        from load_report import encoder_load
    start = time.perf_counter()
    memo = {}
    def measure(text):
        if text not in memo:
            tokens = clip.tokenize(text)
            memo[text] = encoder_load(clip, text, tokens)
        return memo[text]
    final = context.get('effective', '')
    baseline = measure(final)
    # Reject an obviously different tokenizer instead of mixing its costs into this encoder.
    def signature(rows):
        return [(row['stream'], row.get('content_tokens'), row['encoded_slots']) for row in rows]
    if not baseline or signature(baseline) != signature(expected_streams):
        return {'note': 'Connected CLIP does not reproduce this encoder measurement. Connect the same CLIP used by this encoder.'}
    base = {row['stream']: row for row in baseline}
    def differences(other):
        rows = []
        for row in other:
            ref = base.get(row['stream'])
            if ref is None:
                continue
            diff = {'stream': row['stream'], 'slot_delta': ref['encoded_slots'] - row['encoded_slots'],
                    'chunk_delta': ref['chunks'] - row['chunks']}
            if 'content_tokens' in row and 'content_tokens' in ref:
                diff['token_delta'] = ref['content_tokens'] - row['content_tokens']
            rows.append(diff)
        return rows
    groups = context.get('groups', [])
    associations = [{tag_key(tag) for tag in leaf_names(group['syntax'])} for group in groups]
    final_keys = {tag_key(tag) for tag in leaf_names(final)}
    group_rows = []
    for index, group in enumerate(groups[:max_groups]):
        keys = associations[index] & final_keys
        shared = set().union(*(other for at, other in enumerate(associations)
                               if at != index and groups[at]['kind'] == group['kind'])) if len(groups) > 1 else set()
        text = project_text(final, keys)
        group_rows.append({**group, 'syntax_characters': len(group['syntax']), 'resolved_text': text,
                           'shared_tags': sorted(keys & shared), 'streams': measure(text),
                           'without_group_delta': differences(measure(project_text(final, keys, False)))})
    rule_rows = []
    rules = context.get('rules', [])
    for box in active_boxes(rules)[:max_rules]:
        row = {'name': box['definition']['name'], 'id': box['definition']['id'],
               'scope': box.get('scope', 'main'), 'origin': box.get('origin', 'encoder')}
        try:
            without, _ = apply_rules(context.get('before_rules', ''), [other for other in rules if other is not box])
            row['delta'] = differences(measure(without))
            row['without_text'] = without
        except ValueError as error:
            row['note'] = 'Cannot compare: ' + str(error)
        rule_rows.append(row)
    return {'groups': group_rows, 'rulesets': rule_rows, 'analysis_ms': round((time.perf_counter() - start) * 1000, 2),
            'coverage': {'groups_analyzed': len(group_rows), 'groups_total': len(groups),
                         'rulesets_analyzed': len(rule_rows), 'rulesets_total': len(active_boxes(rules))},
            'notes': ['Group attribution matches final tags to their saved group vocabulary; repeated/shared tags and nested parent boxes overlap. Rows are not additive.',
                      'Group deltas remove all final tags associated with that row. Ruleset deltas compare against disabling that ruleset, with remaining rules evaluated normally.',
                      'Positive rule delta means added token load; negative means saved tokens. Counterfactual conflicts are shown rather than guessed.',
                      'Chunks and padded slots matter more to encoder tensor size than raw syntax characters. Alternatives not chosen this run do not contribute encoded tokens.',
                      'Tokenizer-only analysis is not per-tag GPU time or VRAM profiling. It is limited to 64 groups and 32 active rulesets per encoder.']}
