"""Exact prompt-tag identities, derived from dictionary and saved definitions, never image prose."""
import re
from functools import lru_cache
try:
    from .tag_dictionary import dictionary
    from .prefix_library import split_top
except ImportError:
    from tag_dictionary import dictionary
    from prefix_library import split_top

def identity(text):return re.sub(r'\s+',' ',text.strip().lower().replace('_',' ').replace('\\(', '(').replace('\\)', ')'))

@lru_cache(maxsize=1)
def dictionary_identities():return {identity(alias):identity(canonical) for alias,canonical in dictionary().items()}

def literal_tags(text,depth=0):
    if not isinstance(text,str) or depth>32:return []
    result=[]
    for raw in split_top(text):
        part=raw.strip()
        if not part or part=='BREAK' or part.startswith(('<','@','⟦')):continue
        if part.startswith('{') and part.endswith('}'):
            for option in split_top(part[1:-1],'|'):result.extend(literal_tags(option,depth+1))
        elif part.startswith(('(','[')) and part.endswith((')',']')):
            result.extend(literal_tags(re.sub(r':[-+]?\d+(?:\.\d+)?$','',part[1:-1]),depth+1))
        elif not any(char in part for char in ',{}[]<>|\r\n') and len(part)<=1024:result.append(identity(part))
    return result

def custom_identities(library=None):
    result={};known=dictionary_identities();library=library or {}
    def add(row):
        if not isinstance(row,dict) or row.get('type')=='prose' or row.get('kind')=='prose':return
        for text in literal_tags(row.get('text','')):
            if text not in known:result.setdefault(text,text)
    for row in library.get('tags',[]):add(row)
    def walk(row,depth=0):
        if not isinstance(row,dict) or depth>32:return
        if row.get('type')=='tags':add(row)
        for child in row.get('children',[]):walk(child,depth+1)
    for row in library.get('hybrid',{}).get('components',{}).values():walk(row)
    return result

def build_vocabulary(library=None):
    return {**dictionary_identities(),**custom_identities(library)}

def recognized_tags(text,vocabulary=None):
    # Keep unresolved choices out: only actually emitted complete tags can be indexed.
    try:from .hydrus_sync import tag_phrases
    except ImportError:from hydrus_sync import tag_phrases
    vocabulary=dictionary_identities() if vocabulary is None else vocabulary
    return list(dict.fromkeys(vocabulary[identity(term)] for term in tag_phrases(text) if identity(term) in vocabulary))
