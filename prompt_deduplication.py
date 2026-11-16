"""Remove repeated resolved tags without changing their attention syntax."""
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


def deduplicate_prompt(text):
    """Keep the first exact tag in each attention context, after choices resolve.

    Case, underscores, explicit weights and nesting remain distinct. BREAK resets
    the lookup so intentional repetitions in separate CLIP chunks survive.
    """
    seen = set()

    def visit(value, context=(), depth=0):
        if depth > 64:
            return value
        result, changed = [], False
        for raw in _parts(value):
            part = raw.strip()
            wrapper = _wrapper(part)
            if wrapper is not None:
                inner, suffix = wrapper
                kept = visit(inner, (*context, (part[0], suffix)), depth + 1)
                if kept == inner:
                    result.append(raw)
                    continue
                changed = True
                if kept.strip():
                    result.append(part[0] + kept.strip() + suffix + part[-1])
            elif _BREAK.search(part):
                seen.clear()
                result.append(raw)
            else:
                key = (context, part)
                if part and key in seen:
                    changed = True
                else:
                    if part:
                        seen.add(key)
                    result.append(raw)
        return ', '.join(part.strip() for part in result if part.strip()) if changed else value

    return visit(text)
