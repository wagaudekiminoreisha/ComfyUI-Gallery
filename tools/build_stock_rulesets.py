"""Build reviewed stock policies using only the pinned dictionary's general-tag category."""
import csv,gzip,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with gzip.open(ROOT/'data/danbooru.csv.gz','rt',encoding='utf-8') as stream:
    vocabulary=[row for row in csv.reader(stream) if len(row)>1]
GENERAL={row[0] for row in vocabulary if row[1]=='0'}
canonical_names={row[0] for row in vocabulary}
alias_targets={}
for row in vocabulary:
    for alias in row[3].split(',') if len(row)>3 else []:
        if alias:
            alias_targets.setdefault(alias, set()).add(row[0])
GROUPS=json.loads((ROOT/'data/danbooru-groups.json').read_text(encoding='utf-8'))['groups']
def pool(values):return list(dict.fromkeys(tag for tag in values if tag in GENERAL))
def group(name):return pool(GROUPS.get('tag_group:'+name,{}).get('tags',[]))
def rule(op,tags,**extra):return {'op':op,'tags':tags,**extra}
def preference(key,label,tags,additive=False):
    tags=pool(tags)
    if not tags:raise ValueError(label+' has no dictionary matches')
    return {'id':key,'label':label,'default':'keep','options':[{'id':'keep','label':'Keep supplied','rules':[]},{'id':'omit','label':'Leave unspecified','rules':[rule('exclude',tags)]}]+[{'id':tag,'label':('Add ' if additive else 'Use ')+tag.replace('_',' '),'rules':[rule('require' if additive else 'select',[tag] if additive else tags,**({} if additive else {'value':tag}))]} for tag in tags]}
def profiles(key,label,options):return {'id':key,'label':label,'default':'keep','options':[{'id':'keep','label':'Keep supplied','rules':[]}]+[{'id':id,'label':title,'rules':rules} for id,title,rules in options]}
def definition(id,name,choices):return {'version':1,'id':'stock-'+id,'name':name,'family':id,'rules':[],'choices':choices}
COLORS=['aqua','black','blue','brown','green','grey','orange','pink','purple','red','white','yellow','gold','silver']
rows=[]
rows.append(definition('eyes','Eyes',[preference('colour','Eye colour',[c+'_eyes' for c in COLORS]),preference('eyelids','Eyelids',['closed_eyes','half-closed_eyes','one_eye_closed']),preference('gaze','Gaze',['looking_at_viewer','looking_away'])]))
rows.append(definition('expression','Expression',[preference('mood','Mouth expression',['smile','grin','frown','pout','expressionless']),preference('mouth','Mouth opening',['closed_mouth','open_mouth','parted_lips']),preference('extras','Expression details',['blush','tears','sweat','nose_blush'],True)]))
rows.append(definition('framing','Framing and viewpoint',[preference('crop','Framing',['close-up','portrait','upper_body','cowboy_shot','full_body']),preference('angle','Camera elevation',['from_above','from_below','eye-level']),preference('view','Body view',['front_view','side_view','back'])]))
rows.append(definition('subject-count','Subject counts',[preference('female','Female count',['1girl','2girls','3girls','4girls','5girls','6+girls']),preference('male','Male count',['1boy','2boys','3boys','4boys','5boys','6+boys']),profiles('composition','Composition',[('solo','Single subject',[rule('require',pool(['solo'])),rule('exclude',pool(['2girls','3girls','4girls','5girls','6+girls','2boys','3boys','4boys','5boys','6+boys','multiple_girls','multiple_boys','crowd']))]),('unspecified','Leave counts unspecified',[rule('exclude',pool(['solo','1girl','2girls','3girls','4girls','5girls','6+girls','1boy','2boys','3boys','4boys','5boys','6+boys','multiple_girls','multiple_boys','crowd']))])])]))
rows.append(definition('hair-arrangement','Hair arrangement and texture',[preference('arrangement','Arrangement',['hair_down','ponytail','high_ponytail','low_ponytail','twintails','braid','single_braid','twin_braids','hair_bun','double_bun','bob_cut','hime_cut']),preference('texture','Texture',['straight_hair','wavy_hair','curly_hair','messy_hair']),preference('details','Add hair detail',['bangs','sidelocks','ahoge','hair_between_eyes'],True)]))
rows.append(definition('skin','Skin appearance',[preference('tone','Skin tone',['pale_skin','dark_skin','very_dark_skin','tan']),preference('fantasy','Fantasy skin',[c+'_skin' for c in COLORS]),preference('detail','Add skin detail',['freckles','mole','scar','tattoo','shiny_skin'],True)]))
rows.append(definition('lighting','Lighting',[preference('direction','Add lighting',['backlighting','rim_lighting','sidelighting','sunlight','moonlight','candlelight','dim_lighting'],True),profiles('strip','Lighting vocabulary',[('omit','Leave named lighting unspecified',[rule('exclude',group('lighting'))])])]))
rows.append(definition('background','Background',[preference('colour','Simple background colour',[c+'_background' for c in COLORS]),preference('scene','Add scene',['indoors','outdoors','bedroom','classroom','street','forest','beach','garden'],True),profiles('simplify','Background detail',[('simple','Simple background',[rule('exclude',[tag for tag in group('backgrounds') if tag not in ['simple_background']+[c+'_background' for c in COLORS]]),rule('require',pool(['simple_background']))]),('omit','Leave background unspecified',[rule('exclude',group('backgrounds'))])])]))
rows.append(definition('clothing-layers','Clothing layers',[preference('top','Add upper layer',['shirt','t-shirt','blouse','hoodie','sweater','jacket','coat','cardigan'],True),preference('bottom','Add lower layer',['skirt','pleated_skirt','pants','jeans','shorts','leggings','track_pants'],True),profiles('layering','Layer combinations',[('skirt-leggings','Skirt over leggings',[rule('require',pool(['skirt','leggings']))]),('skirt-pants','Skirt over pants',[rule('require',pool(['skirt','pants']))]),('skirt-track','Skirt over track pants',[rule('require',pool(['skirt','track_pants']))]),('dress-cardigan','Dress with cardigan',[rule('require',pool(['dress','cardigan']))])])]))
rows.append(definition('clothing-pattern','Clothing pattern',[preference('pattern','Add clothing pattern',['striped_clothes','polka_dot','plaid','checkered_clothes','floral_print','animal_print'],True),preference('material','Add clothing material',['denim','leather','latex','lace','knit','velvet','silk'],True)]))
rows.append(definition('accessories','Accessories',[preference('head','Add head accessory',['hat','cap','hairband','hair_ribbon','hair_bow','hairclip','headband'],True),preference('jewelry','Add jewelry',['earrings','necklace','bracelet','ring','choker'],True),profiles('clear','Accessory cleanup',[('hair','Omit hair accessories',[rule('exclude',pool(['hairband','hair_ribbon','hair_bow','hairclip','hair_ornament','hair_flower','scrunchie']))]),('eyewear','Omit eyewear',[rule('exclude',group('eyewear'))])])]))
rows.append(definition('footwear','Footwear',[preference('type','Add footwear',['boots','high_heels','sneakers','sandals','loafers','barefoot'],True),preference('legwear','Add legwear',['socks','thighhighs','pantyhose','leggings','kneehighs','fishnets'],True)]))
rows.append(definition('chest','Chest attributes',[preference('size','Chest size',['flat_chest','small_breasts','medium_breasts','large_breasts','huge_breasts','gigantic_breasts'])]))
rows.append(definition('nudity','Nudity tags',[preference('state','Nudity description',['nude','topless','bottomless','completely_nude'],True),profiles('cleanup','Prompt cleanup',[('omit','Omit nudity and exposed anatomy tags',[rule('exclude',pool(['nude','topless','bottomless','completely_nude','nipples','areolae','penis','testicles','vulva','pussy','anus','erection']))])])]))
rows.append(definition('adult-acts','Adult act tags',[profiles('cleanup','Prompt act tags',[('omit','Leave sexual acts unspecified',[rule('exclude',group('sex_acts')+group('simulated_sex_acts'))])]),preference('act','Add act',['sex','masturbation','fellatio','cunnilingus','vaginal','anal','handjob','paizuri'],True)]))
rows.append(definition('batch-protections','Common batch protections',[profiles('protect','Protect from batch conversion',[('composition','Composition and counts',[rule('protect',pool(['solo','1girl','1boy','2girls','2boys','multiple_girls','multiple_boys','full_body','upper_body','portrait']))]),('identity-neutral','Anatomy and appearance',[rule('protect',pool(['blonde_hair','brown_hair','black_hair','blue_eyes','green_eyes','brown_eyes','dark_skin','pale_skin','freckles','mole']))])])]))

def omit_tags(key, label, tags):
    tags = pool(tags)
    selected = set(tags)
    # Rules normalize a subset of the dictionary's aliases. Include known spellings
    # here so common inputs such as "gore" work in both preview and execution.
    aliases = sorted(alias for alias, targets in alias_targets.items()
                     if alias not in canonical_names and len(targets) == 1 and targets <= selected)
    return profiles(key, label, [('omit', 'Omit tags', [rule('exclude', tags + aliases)])])


rows.append(definition('injury-gore-filter', 'Injury and gore filter', [
    omit_tags('amputation', 'Amputation and missing limbs', [
        'amputee', 'armless_amputee', 'legless_amputee', 'double_amputee',
        'triple_amputee', 'quadruple_amputee', 'missing_limb', 'stump_cover',
    ]),
    omit_tags('gore', 'Gore and body horror', [
        'guro', 'ero_guro', 'candy_gore', 'body_horror', 'mutilation', 'dismemberment',
        'decapitation', 'disembowelment', 'impaled', 'skinned',
        'severed_head', 'severed_limb', 'severed_arm', 'severed_leg', 'severed_hand',
        'severed_finger', 'severed_torso', 'severed_tail', 'severed_ear', 'severed_penis',
        'entrails', 'intestines', 'exposed_brain', 'exposed_bone', 'exposed_muscle',
    ]),
    omit_tags('injury-blood', 'Injuries and visible blood', [
        'injury', 'implied_injury', 'eye_injury', 'deep_wound', 'gunshot_wound',
        'broken_arm', 'broken_leg', 'broken_bone', 'bruise', 'bruise_on_face',
        'bruised_eye', 'bruise_on_arm', 'bruise_on_leg', 'bruise_on_neck',
        'bruise_on_shoulder', 'bruise_on_chest', 'bruised_chest', 'bruise_on_stomach',
        'bruise_on_ass', 'blood', 'fake_blood', 'stylized_blood', 'dried_blood',
        'blood_stain', 'blood_splatter', 'blood_spray', 'blood_drip', 'blood_drop',
        'pool_of_blood', 'blood_trail', 'smeared_blood', 'nosebleed', 'excessive_nosebleed',
        'aroused_nosebleed', 'blood_from_mouth', 'blood_from_eyes', 'blood_from_ears',
        'blood_in_mouth', 'blood_on_face', 'blood_on_hands', 'blood_on_body',
        'blood_in_hair', 'blood_on_clothes', 'blood_on_bandages', 'blood_on_weapon',
        'blood_on_knife', 'blood_on_armor', 'blood_on_axe', 'blood_on_ground',
        'blood_on_wall', 'blood_on_arm', 'blood_on_leg', 'blood_on_neck',
        'blood_on_chest', 'blood_on_breasts', 'blood_on_back', 'blood_on_cheek',
        'coughing_blood', 'spitting_blood', 'vomiting_blood', 'drooling_blood',
    ]),
]))

rows.append(definition('disturbing-content-filter', 'Disturbing content filter', [
    omit_tags('violence-death', 'Violence, death and self-harm', [
        'violence', 'censored_violence', 'corpse', 'pile_of_corpses', 'dead_animal',
        'necrophilia', 'murder', 'implied_murder', 'imminent_murder', 'execution',
        'strangling', 'strangulation_mark', 'drowning', 'self-harm', 'self-harm_scar',
        'suicide', 'implied_suicide', 'attempted_suicide', 'imminent_suicide',
        'suicide_pact', 'suicide_bomb',
    ]),
    omit_tags('coercion-abuse', 'Coercion and abuse', [
        'abuse', 'domestic_violence', 'animal_abuse', 'child_abuse', 'kidnapping',
        'torture', 'torture_instruments', 'rape', 'imminent_rape', 'implied_rape',
        'assisted_rape', 'after_rape', 'rape_face', 'you_gonna_get_raped',
        'molestation', 'sleep_molestation', 'compensated_molestation',
        'bestiality', 'implied_bestiality', 'imminent_bestiality',
    ]),
    omit_tags('waste-vomit', 'Bodily waste and vomit', [
        'scat', 'poop', 'defecating', 'diarrhea', 'peeing', 'peeing_self',
        'public_urination', 'implied_peeing', 'assisted_peeing', 'peeing_in_cup',
        'peeing_in_bottle', 'peeing_on_viewer', 'peeing_on_penis', 'piss_bottle',
        'human_toilet', 'vomit', 'vomiting', 'imminent_vomiting', 'vomiting_cum',
    ]),
    omit_tags('infestation-decay', 'Infestation and decay', [
        'parasite', 'maggot', 'leech', 'rotting',
    ]),
]))

rows.append(definition('fetish-content-filter', 'Fetish content filter', [
    omit_tags('bdsm', 'BDSM and power play', [
        'bdsm', 'bondage', 'shibari', 'shibari_over_clothes', 'shibari_under_clothes',
        'breast_bondage', 'ribbon_bondage', 'tape_bondage', 'snake_bondage',
        'predicament_bondage', 'public_bondage', 'self_bondage', 'implied_bondage',
        'hair_bondage', 'stealth_bondage', 'tail_bondage', 'vine_bondage',
        'mummification_(bound)', 'femdom', 'dominatrix', 'dominator_(bdsm)',
        'domination', 'submission', 'sadism', 'masochism', 'humiliation',
        'small_penis_humiliation', 'human_furniture', 'orgasm_denial', 'forced_orgasm',
        'chastity_cage', 'flat_chastity_cage', 'nub_chastity_cage', 'chastity_belt',
        'chastity_bra', 'bondage_gear', 'x-cross_(bdsm)', 'yoke_(bdsm)', 'shibari_marks',
    ]),
    omit_tags('restraints', 'Restraints, gags and blindfolds', [
        'bound', 'bound_wrists', 'bound_arms', 'bound_legs', 'bound_ankles',
        'bound_thighs', 'bound_torso', 'bound_together', 'bound_toes', 'bound_fingers',
        'bound_thumbs', 'bound_knees', 'bound_leg', 'bound_feet', 'bound_wings',
        'bound_tail', 'bound_penis', 'restraints', 'stationary_restraints',
        'upright_restraints', 'standing_restraints', 'hogtie', 'spreader_bar',
        'stocks', 'pillory', 'handcuffs', 'fuzzy_handcuffs', 'shared_handcuffs',
        'gag', 'gagged', 'ball_gag', 'bit_gag', 'cloth_gag', 'tape_gag', 'ring_gag',
        'wiffle_gag', 'gag_harness', 'cleave_gag', 'over_the_nose_gag',
        'over_the_mouth_gag', 'clothes_gag', 'panty_gag', 'dildo_gag', 'plug_gag',
        'panel_gag', 'spider_gag', 'rope_gag', 'dental_gag', 'knot_gag', 'linked_gag',
        'improvised_gag', 'hand_gagged', 'blindfold', 'black_blindfold',
        'white_blindfold', 'red_blindfold', 'blue_blindfold', 'pink_blindfold',
        'purple_blindfold', 'green_blindfold',
    ]),
    omit_tags('pain-sensation', 'Pain and sensation play', [
        'spanking', 'spanked', 'spanking_self', 'imminent_spanking', 'whip_marks',
        'tickle_torture', 'nipple_torture', 'clitoris_torture', 'nipple_clamps',
        'corset_piercing', 'wax_play', 'electrostimulation', 'breathplay',
    ]),
    omit_tags('fetish-roleplay', 'Fetish clothing and roleplay', [
        'bondage_outfit', 'bondage_mittens', 'gimp_mask', 'gimp_suit',
        'pet_play', 'pony_play', 'viewer_on_leash', 'clitoris_leash', 'nipple_leash',
    ]),
    omit_tags('body-part-acts', 'Foot and armpit fetish acts', [
        'footjob', 'two-footed_footjob', 'reverse_footjob', 'simulated_footjob',
        'after_footjob', 'footjob_over_clothes', 'cooperative_footjob',
        'female_footjob', 'footjob_from_behind', 'implied_footjob', 'double_footjob',
        'footjob_under_table', 'under-stirrup_footjob', 'stealth_footjob',
        'foot_worship', 'licking_foot', 'mutual_foot_licking', 'smelling_feet',
        'armpit_sex', 'licking_armpit', 'smelling_armpit',
    ]),
    omit_tags('vore', 'Vore and unbirthing', [
        'vore', 'imminent_vore', 'anal_vore', 'tail_vore', 'unbirthing',
    ]),
    omit_tags('expansion', 'Inflation and body expansion', [
        'inflation', 'cum_inflation', 'breast_expansion', 'ass_expansion', 'penis_growth',
    ]),
    omit_tags('insertion-play', 'Insertion and medical play', [
        'urethral_insertion', 'urethral_fingering', 'urethral_penetration',
        'urethral_beads', 'sounding', 'sounding_rod', 'enema', 'alcohol_enema',
        'fisting', 'anal_fisting', 'self_fisting', 'milking_machine', 'prostate_milking',
    ]),
    omit_tags('adult-baby', 'Adult baby and diaper play', [
        'adult_baby', 'diaper', 'diaper_changing',
    ]),
]))

path=ROOT/'data/prompt-rulesets.json';library=json.loads(path.read_text(encoding='utf-8'))
generated = {row['id']: row for row in rows}
library['definitions'] = [generated.pop(row['id'], row) for row in library['definitions']]
library['definitions'].extend(generated.values())
path.write_text(json.dumps(library,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built',len(rows),'stock rulesets from general-category vocabulary; no global attachments added.')
