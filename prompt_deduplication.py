"""Merge matching symbolic contributions before sampling their choices."""
import re

_WEIGHT = re.compile(r'(:[+-]?(?:\d+(?:\.\d*)?|\.\d+))$')
_BREAK = re.compile(r'\bBREAK\b')
_PAIRS = {'(': ')', '[': ']', '{': '}', '<': '>'}


def _parts(text):
    """Respect escaped delimiters; leave malformed prompts opaque."""
    stack, cuts, escaped = [], [], False
    for index, char in enumerate(text):
        if escaped:
            escaped = False
        elif char == '\\':
            escaped = True
        elif char in _PAIRS:
            stack.append(_PAIRS[char])
        elif char in _PAIRS.values():
            if not stack or stack.pop() != char:
                return [text]
        elif char == ',' and not stack:
            cuts.append(index)
    if stack:
        return [text]
    result, start = [], 0
    for index in cuts:
        result.append(text[start:index])
        start = index + 1
    return [*result, text[start:]]


def _wrapper(text):
    if not text or text[0] not in '([':
        return None
    stack, escaped = [], False
    for index, char in enumerate(text):
        if escaped:
            escaped = False
            continue
        if char == '\\':
            escaped = True
        elif char in _PAIRS:
            stack.append(_PAIRS[char])
        elif char in _PAIRS.values():
            if not stack or stack.pop() != char:
                return None
            if not stack:
                if index != len(text) - 1:
                    return None
                inner, suffix = text[1:-1], ''
                if text[0] == '(':
                    weight = _WEIGHT.search(inner)
                    if weight:
                        inner, suffix = inner[:weight.start()], weight[0]
                # Scheduled prompts are opaque, not attention groups.
                if text[0] == '[' and ':' in inner:
                    return None
                return inner, suffix
    return None


def merge_prompt_contributions(contributions):
    """Coalesce matching expressions before sampling, preferring source owners.

    Alternatives are atomic: matching complete expressions share one roll, while
    different optional/alternative parents retain their independent behavior.
    """
    owners, nodes, epoch = {}, [], 0

    def parse(value, entry, context=(), depth=0):
        nonlocal epoch
        result = []
        if depth > 64:
            return [('opaque', value)]
        for raw in _parts(value):
            part = raw.strip()
            wrapper = _wrapper(part)
            if wrapper is not None:
                inner, suffix = wrapper
                result.append(('group', raw, part, inner, suffix,
                               parse(inner, entry, (*context, (part[0], suffix)), depth + 1)))
            elif _BREAK.search(part):
                epoch += 1
                result.append(('opaque', raw))
            elif part:
                key = (epoch, context, part)
                node = ('tag', raw, key, entry)
                previous = owners.get(key)
                if previous is None or contributions[entry].get('source', False) and not contributions[previous[3]].get('source', False):
                    owners[key] = node
                result.append(node)
            else:
                result.append(('opaque', raw))
        return result

    for index, row in enumerate(contributions):
        nodes.append(parse(row['text'], index))

    def render(tree):
        output, changed = [], False
        for node in tree:
            if node[0] == 'opaque':
                output.append(node[1])
            elif node[0] == 'tag':
                if owners[node[2]] is node:
                    output.append(node[1])
                else:
                    changed = True
            else:
                _, raw, part, inner, suffix, children = node
                kept = render(children)
                if kept == inner:
                    output.append(raw)
                else:
                    changed = True
                    if kept.strip():
                        output.append(part[0] + kept.strip() + suffix + part[-1])
        return ', '.join(part.strip() for part in output if part.strip()) if changed else ''.join(
            raw if at == 0 else ',' + raw for at, raw in enumerate(output))

    return [{**row, 'text': render(tree)} for row, tree in zip(contributions, nodes)]


def deduplicate_prompt(text):
    """Coalesce matching template expressions without sampling their choices."""
    return merge_prompt_contributions([{'text': text}])[0]['text']
