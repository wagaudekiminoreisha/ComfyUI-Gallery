"""Validated, reproducible SQLite catalog for the bundled global rule candidates.

No downloads, import-time writes, user-settings migrations, or executable rule strings.
Runtime UI consumes the same JSON pack. The database is a searchable offline projection.
"""
import argparse
import csv
import gzip
import json
import os
from pathlib import Path
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parent
KINDS = {'distinct_values', 'compatible_values', 'cross_values', 'compatible_facets', 'solo_total'}
SCOPES = {'subject', 'region', 'garment', 'scene', 'frame', 'view', 'image', 'target'}


def validate_pack(pack, vocabulary):
    if not isinstance(pack, dict) or pack.get('version') != 1 or pack.get('id') != 'gallery-global-rules':
        raise ValueError('Unsupported global rule pack.')
    if not isinstance(pack.get('revision'), str) or not pack['revision']:
        raise ValueError('Missing pack revision.')
    facets, rules = pack.get('facets'), pack.get('rules')
    if not isinstance(facets, list) or not isinstance(rules, list) or len(facets) > 2000 or len(rules) > 10000:
        raise ValueError('Invalid facet/rule list.')
    facet_ids, rule_ids = set(), set()
    def text(value):
        if not isinstance(value, str) or not value or len(value) > 2000:
            raise ValueError('Expected bounded nonempty text.')
    def scope(value):
        if not isinstance(value, list) or len(value) != len(set(value)) or any(key not in SCOPES for key in value):
            raise ValueError('Unknown or duplicate scope.')
    for facet in facets:
        for key in ('id', 'label', 'rationale'): text(facet.get(key))
        if facet['id'] in facet_ids or facet.get('mode') not in {'one','many','mix','layer'}:
            raise ValueError('Duplicate facet or unknown cardinality.')
        facet_ids.add(facet['id']); scope(facet.get('scope'))
        members = facet.get('members')
        if not isinstance(members, list) or len(members) > 10000: raise ValueError('Invalid facet members.')
        seen = set()
        for member in members:
            tag = member.get('tag'); text(member.get('value'))
            if tag not in vocabulary or tag in seen: raise ValueError('Unknown or duplicate facet tag.')
            seen.add(tag)
    by_id = {facet['id']: facet for facet in facets}
    aliases = pack.get('aliases', {})
    if not isinstance(aliases, dict) or any(not isinstance(alias,str) or not alias or target not in vocabulary for alias,target in aliases.items()):
        raise ValueError('Invalid canonical alias mapping.')
    for rule in rules:
        for key in ('id', 'label', 'rationale'): text(rule.get(key))
        if rule['id'] in rule_ids or rule.get('kind') not in KINDS: raise ValueError('Duplicate rule or unknown kind.')
        rule_ids.add(rule['id']); scope(rule.get('scope'))
        if rule.get('policy') not in {'warn','inform'} or rule.get('status') != 'candidate':
            raise ValueError('This candidate pack cannot enforce or assert human review.')
        refs = rule.get('facets')
        if not isinstance(refs, list) or not refs or len(refs) != len(set(refs)) or any(ref not in facet_ids for ref in refs):
            raise ValueError('Invalid rule facet reference.')
        kind = rule['kind']
        if len(refs) != (4 if kind == 'solo_total' else 2 if kind in {'cross_values','compatible_facets'} else 1):
            raise ValueError('Wrong rule arity.')
        if kind == 'distinct_values' and by_id[refs[0]]['mode'] != 'one':
            raise ValueError('An exclusion rule cannot be inferred from a multi-valued facet.')
        if kind == 'compatible_values' and by_id[refs[0]]['mode'] != 'mix':
            raise ValueError('Compatible values require a mix facet.')
        exceptions = rule.get('exceptions')
        if not isinstance(exceptions, list) or len(exceptions) != len(set(exceptions)) or any(tag not in vocabulary for tag in exceptions):
            raise ValueError('Unknown or duplicate exception tag.')
        guards = rule.get('exception_values', {})
        if not isinstance(guards, dict): raise ValueError('Invalid exception guard.')
        for tag, values in guards.items():
            if tag not in exceptions or not isinstance(values,list) or any(value not in {m['value'] for m in by_id[refs[0]]['members']} for value in values):
                raise ValueError('Unknown exception guard tag or values.')
        if kind == 'cross_values':
            values = rule.get('values')
            if not isinstance(values, list) or len(values) != 2: raise ValueError('Cross-rule values need two selectors.')
            for ref, allowed in zip(refs, values):
                if not isinstance(allowed, list) or any(value not in {m['value'] for m in by_id[ref]['members']} for value in allowed):
                    raise ValueError('Unknown facet value selector.')
    return pack


def load_vocabulary():
    with gzip.open(ROOT/'data/danbooru.csv.gz', 'rt', encoding='utf-8') as stream:
        return {row[0]: row[3].split(',') if len(row) > 3 and row[3] else [] for row in csv.reader(stream) if row[1] == '0'}


def populate_database(connection, pack=None):
    vocabulary = load_vocabulary()
    if pack is None: pack = json.loads((ROOT/'data/global-tag-rules.json').read_text(encoding='utf-8'))
    validate_pack(pack, vocabulary)
    # Validate before creating tables. Callers supply a new database, not a user catalog.
    connection.executescript((ROOT/'data/tag-rules-schema.sql').read_text(encoding='utf-8'))
    with connection:
        metadata = {key: value for key,value in pack.items() if key not in {'facets','rules'}}
        connection.execute('INSERT INTO pack VALUES (?,?,?)', (pack['id'], pack['revision'], json.dumps(metadata)))
        ids = {name: i for i,name in enumerate(sorted(vocabulary), 1)}
        connection.executemany('INSERT INTO tag VALUES (?,?,0)', [(id,name) for name,id in ids.items()])
        connection.executemany('INSERT INTO alias VALUES (?,?)', sorted({(alias,ids[name]) for name,aliases in vocabulary.items() for alias in aliases}))
        connection.executemany('INSERT INTO tag_search(rowid,name,aliases) VALUES (?,?,?)', [(ids[name],name,' '.join(aliases)) for name,aliases in vocabulary.items()])
        for facet in pack['facets']:
            connection.execute('INSERT INTO facet VALUES (?,?,?,?,?)', (facet['id'],facet['label'],facet['mode'],json.dumps(facet['scope']),facet['rationale']))
            connection.executemany('INSERT INTO facet_member VALUES (?,?,?)', [(facet['id'],ids[member['tag']],member['value']) for member in facet['members']])
        for rule in pack['rules']:
            connection.execute('INSERT INTO rule VALUES (?,?,?,?,?,?,?,?)', (rule['id'],rule['label'],rule['kind'],rule['policy'],rule['status'],json.dumps(rule['scope']),json.dumps({'facets':rule['facets'],'values':rule.get('values',[])}),rule['rationale']))
            connection.executemany('INSERT INTO rule_facet VALUES (?,?)', [(rule['id'],id) for id in rule['facets']])
            connection.executemany('INSERT INTO rule_exception VALUES (?,?,?)', [(rule['id'],ids[tag],json.dumps({'values':rule.get('exception_values',{}).get(tag,[])})) for tag in rule['exceptions']])
        groups = json.loads((ROOT/'data/danbooru-groups.json').read_text(encoding='utf-8'))['groups']
        for id, group in groups.items():
            connection.execute('INSERT INTO topic VALUES (?,?,?)', (id,group['label'],json.dumps({key:value for key,value in group.items() if key != 'tags'})))
            connection.executemany('INSERT INTO topic_member VALUES (?,?)', [(id,ids[tag]) for tag in sorted(set(group['tags'])) if tag in ids])
    if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or connection.execute('PRAGMA foreign_key_check').fetchall():
        raise ValueError('Catalog integrity check failed.')
    return {name: connection.execute('SELECT count(*) FROM '+name).fetchone()[0] for name in ('tag','alias','facet','facet_member','rule','topic','topic_member')}


def build_database(path, replace=False):
    path = Path(path).resolve()
    if path.exists() and not replace: raise ValueError('Destination already exists; explicitly pass --replace to rebuild it.')
    path.parent.mkdir(parents=True,exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix='.global-rules-', suffix='.sqlite3',dir=path.parent)
    os.close(handle)
    connection = None
    try:
        connection = sqlite3.connect(temporary)
        stats = populate_database(connection)
        connection.close()
        connection = None
        os.replace(temporary,path)
        return stats
    finally:
        if connection is not None: connection.close()
        Path(temporary).unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'data/global-tag-rules.sqlite3')
    parser.add_argument('--replace',action='store_true')
    arguments = parser.parse_args()
    print(json.dumps(build_database(arguments.output, arguments.replace),indent=2))
