"""Reviewed garment slots for source-owned choices; modifiers are left alone."""
import csv,gzip,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with gzip.open(ROOT/'data/danbooru.csv.gz','rt',encoding='utf-8') as stream:
    general={row[0] for row in csv.reader(stream) if len(row)>1 and row[1]=='0'}
families={
 'base':{'shirt':['shirt','collared_shirt','sleeveless_shirt','dress_shirt','off-shoulder_shirt','crop_top'], 't-shirt':['t-shirt'], 'blouse':['blouse'], 'camisole':['camisole'], 'tank_top':['tank_top'], 'sweater':['sweater','turtleneck','turtleneck_sweater','sleeveless_turtleneck','sweater_vest']},
 'outer':{'jacket':['jacket','track_jacket','bomber_jacket','blazer','denim_jacket'], 'coat':['coat','long_coat','trench_coat','raincoat','winter_coat'], 'cardigan':['cardigan'], 'hoodie':['hoodie'], 'cape':['cape','capelet','cloak','poncho'], 'vest':['vest','waistcoat'], 'armor':['armor','breastplate','chainmail'], 'robe':['robe','bathrobe']},
 'lower':{'pants':['pants'], 'jeans':['jeans'], 'track_pants':['track_pants','sweatpants'], 'cargo_pants':['cargo_pants'], 'shorts':['shorts','short_shorts','denim_shorts','bike_shorts'], 'skirt':['skirt','pleated_skirt','pencil_skirt','miniskirt','long_skirt','microskirt'], 'leggings':['leggings']},
}
parents={'t-shirt':'shirt','blouse':'shirt','camisole':'shirt','tank_top':'shirt','jeans':'pants','track_pants':'pants','cargo_pants':'pants'}
tags={}
for slot,values in families.items():
 for value,names in values.items():
  for name in names:
   if name in general:tags.setdefault(name,{})[slot]=value
for value,names in {'dress':['dress','sundress','wedding_dress','evening_gown','cocktail_dress','sweater_dress'],'jumpsuit':['jumpsuit','romper'],'bodysuit':['bodysuit','leotard'],'kimono':['kimono','yukata']}.items():
 for name in names:
  if name in general:tags[name]={'base':value,'lower':value}
colours='aqua black blue brown green grey orange pink purple red white yellow gold silver multicolored'.split()
for name,traits in list(tags.items()):
 for colour in colours:
  candidate=colour+'_'+name
  if candidate in general:tags[candidate]={**traits,(('shirt' if traits.get('base') in ('shirt','t-shirt','blouse','camisole','tank_top') else next(iter(traits.values())))+'-colour'):colour}
result={'parents':parents,'tags':dict(sorted(tags.items())),'aliases':{'tshirt':'t-shirt','t_shirt':'t-shirt'}}
(ROOT/'data/source-garment-priority.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built',len(tags),'literal garment/colour mappings; accessories, underwear and modifiers stay independent.')
