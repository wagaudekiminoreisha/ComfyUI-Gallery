"""Portable per-image prefix associations for Hydrus generation notes."""
def image_associations(library, digest, url, root='./'):
    keys={'sha256:'+digest,'local:'+root+':'+url}
    prefixes={row['id']:row for row in library.get('prefixes',[])}
    tags={row['id']:row['text'] for row in library.get('tags',[])}
    rows=[]
    for key,association in library.get('associations',{}).items():
        if key not in keys and (association.get('image')or{}).get('hash')!=digest:continue
        prefix=prefixes.get(association['prefix_id'])
        if prefix:rows.append({'prefix_id':prefix['id'],'name':prefix['name'],'terms':association.get('terms',[tags[tag] for tag in prefix['tags'] if tag in tags]),'negative_terms':association.get('negative_terms',prefix.get('negative_terms',[]))})
    for snapshot in library.get('snapshots',{}).values():
        if not any(key in keys or image.get('hash')==digest for key,image in snapshot.get('members',{}).items()):continue
        prefix=prefixes.get(snapshot['prefix_id'])
        if prefix:rows.append({'prefix_id':prefix['id'],'name':prefix['name'],'snapshot_id':snapshot['id'],'terms':snapshot['terms'],'negative_terms':snapshot.get('negative_terms',[]),'rules':snapshot.get('rules',[])})
    unique={}
    for row in rows:unique[(row['prefix_id'],row.get('snapshot_id'),tuple(row['terms']),tuple(row['negative_terms']))]=row
    return list(unique.values())
