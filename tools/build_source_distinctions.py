"""Curated source-transfer distinctions over the pinned general-tag vocabulary.

These are application filtering sets, not Danbooru categories or exclusivity claims.
Existing IDs, presets and manually reviewed attire sets are retained.
"""
import csv
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
with gzip.open(ROOT/'data/danbooru.csv.gz', 'rt', encoding='utf-8') as stream:
    general = {row[0] for row in csv.reader(stream) if len(row)>1 and row[1]=='0'}

# Parent, id, label, facet references, additional literal tags. No runtime guessing.
DISTINCTIONS = [
    ('hair','colour','Colour and dye distribution','hair.colour hair.distribution',''),
    ('hair','silhouette','Length and silhouette','hair.length hair.presence hair.bangs-length',''),
    ('hair','arrangement','Arrangement and grooming','hair.arrangement hair.details hair.alteration',''),
    ('hair','texture','Hair texture','hair.texture',''),
    ('eyes','colour','Iris colour','eyes.colour',''),
    ('eyes','details','Iris and pupil details','eyes.details',''),
    ('skin-body','tone','Skin tone','skin.colour',''),
    ('skin-body','build','Build and anatomy','body.build body.features',''),
    ('skin-body','marks','Distinguishing skin marks','','freckles mole scar tattoo birthmark'),
    ('skin-body','surface','Surface state and body paint','','sweat wet shiny_skin tanlines bodypaint colored_skin'),
    ('pose','stance','Body support and stance','pose.support pose.lying-direction',''),
    ('pose','motion','Locomotion and movement','pose.gait',''),
    ('pose','limbs','Arm and leg arrangement','pose.arms pose.legs',''),
    ('pose','hands','Hand gestures','pose.hand',''),
    ('framing','crop','Crop and visible extent','composition.crop',''),
    ('framing','view','Camera position and angle','composition.azimuth composition.elevation composition.angle',''),
    ('framing','gaze','Gaze direction','gaze.direction',''),
    ('framing','layout','Layout and subject focus','composition.layout composition.focus',''),
    ('expression','emotion','Emotion and facial expression','expression.emotion',''),
    ('expression','openness','Eye and mouth openness','eyes.aperture mouth.openness',''),
    ('background','place','Location and enclosure','scene.place scene.location',''),
    ('background','time','Time and season','scene.time scene.season',''),
    ('background','weather','Weather and atmosphere','scene.weather',''),
    ('background','treatment','Background treatment','scene.background',''),
    ('lighting','source','Light source','light.source',''),
    ('lighting','direction','Light direction','light.direction',''),
    ('lighting','quality','Light quality','light.quality',''),
    ('art','medium','Medium and rendering','art.medium art.technique',''),
    ('art','palette','Palette and colour treatment','art.palette',''),
    ('props-interaction','objects','Objects and props','','sword gun bow_(weapon) spear staff shield chair table bed couch bench car bicycle motorcycle train airplane boat'),
    ('props-interaction','creatures','Companion creatures','','cat dog bird horse fish'),
    ('props-interaction','plants','Plants and vegetation','','flower tree grass'),
    ('props-interaction','action','Contact and interaction','interaction.action',''),
]

path=ROOT/'data/source-tag-categories.json'
catalog=json.loads(path.read_text(encoding='utf-8'))
for id,label in [('art','Rendering and palette'),('props-interaction','Props and interaction')]:
    if not any(row['id']==id for row in catalog['categories']):
        catalog['categories'].append({'id':id,'label':label,'families':[],'facets':[]})
for parent,id,label,facets,tags in DISTINCTIONS:
    row={'id':parent+'-'+id,'parent':parent,'label':label,'families':[],'facets':facets.split()}
    if tags:row['tags']=sorted(set(tags.split()) & general)
    existing=next((index for index,value in enumerate(catalog['categories']) if value['id']==row['id']),None)
    if existing is None:catalog['categories'].append(row)
    else:catalog['categories'][existing]=row
attire=next(row for row in catalog['categories'] if row['id']=='clothing')
attire['refinementLabel']='Refine attire'
attire['note']='Categories can overlap. Casual is a style tag; ordinary garments are not assumed to be casual.'
# Reuse reviewed garment facets as well as the wider curated vocabulary.
garment_facets={
    'tops':['clothes.upper'], 'bottoms':['clothes.lower','clothes.pants-colour','clothes.skirt-colour','clothes.skirt-length'],
    'outerwear':['clothes.outer'], 'full-outfits':['clothes.dress','clothes.ensemble'],
    'legwear':['clothes.legwear'], 'footwear':['clothes.footwear','clothes.shoe-colour'], 'headwear':['clothes.headwear'],
}
for suffix, facets in garment_facets.items():
    next(row for row in catalog['categories'] if row['id']=='clothing-'+suffix)['facets']=facets
path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built',len(DISTINCTIONS),'source-transfer distinctions; existing presets unchanged.')
