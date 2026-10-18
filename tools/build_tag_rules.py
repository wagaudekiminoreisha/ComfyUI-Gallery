"""Build the offline global rule pack from explicit, auditable facet definitions.

Only names in the pinned general-tag vocabulary are admitted. A topic group is
never converted to an exclusion set. All generated semantic rules are candidates,
with warn/inform policy, rather than claims of human-reviewed universal truth.
"""
import csv
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACETS = []


def facet(id, label, scope, groups, mode='many', exceptions='', rationale=''):
    FACETS.append(dict(id=id, label=label, scope=scope.split(), mode=mode,
                       values={key: names.split() for key, names in groups.items()},
                       exceptions=exceptions.split(), rationale=rationale or
                       'Different values may need separate instances, regions or views; scope must be established before enforcement.'))


def define_facets():
    facet('hair.length', 'Hair length', 'subject region frame', {
        'short': 'very_short_hair short_hair', 'medium': 'medium_hair',
        'long': 'long_hair very_long_hair absurdly_long_hair'}, 'one',
        'short_hair_with_long_locks hair_extensions asymmetrical_hair',
        'Primary lengths compete only for the same hair region; longer subtypes are not mutually exclusive with long hair.')
    facet('hair.colour', 'Hair colour', 'subject region frame', {c: c+'_hair' for c in
        'black blonde brown blue aqua green grey orange pink purple red white silver light_brown light_blue light_purple light_green dark_blue dark_green'.split()}, 'mix',
        'multicolored_hair two-tone_hair gradient_hair streaked_hair colored_inner_hair split-color_hair',
        'Multiple colours can describe dyed sections, gradients or different subjects. Colour is not globally exclusive.')
    facet('hair.distribution', 'Hair colour distribution', 'subject region frame', {
        'mixed': 'multicolored_hair two-tone_hair split-color_hair', 'gradient': 'gradient_hair',
        'streaks': 'streaked_hair', 'inner': 'colored_inner_hair'})
    facet('hair.presence', 'Scalp hair presence', 'subject region frame', {'absent': 'bald', 'partial': 'balding'})
    facet('hair.arrangement', 'Hair arrangement', 'subject region frame', {
        'ponytail': 'ponytail high_ponytail low_ponytail side_ponytail', 'tails': 'twintails low_twintails short_twintails',
        'braid': 'braid single_braid twin_braids side_braid french_braid crown_braid',
        'bun': 'hair_bun double_bun single_hair_bun', 'loose': 'hair_down', 'up': 'updo'})
    facet('hair.texture', 'Hair texture', 'subject region frame', {'straight': 'straight_hair', 'wavy': 'wavy_hair', 'curly': 'curly_hair', 'drill': 'drill_hair', 'messy': 'messy_hair'})
    facet('hair.details', 'Hair details', 'subject region frame', {'locks': 'sidelocks long_sidelocks short_sidelocks', 'bangs': 'bangs blunt_bangs parted_bangs swept_bangs asymmetrical_bangs', 'strands': 'ahoge antenna_hair hair_flaps'})
    facet('hair.alteration', 'Hair additions and regional differences', 'subject region frame', {'added': 'wig hair_extensions', 'regional': 'short_hair_with_long_locks asymmetrical_hair'})
    facet('hair.bangs-length', 'Bangs length', 'subject region frame', {'short': 'short_bangs', 'long': 'long_bangs'}, 'one', 'asymmetrical_bangs')
    facet('eyes.colour', 'Eye colour', 'subject region frame', {c: c+'_eyes' for c in
        'black blue brown green grey orange pink purple red white yellow aqua gold silver'.split()}, 'mix',
        'heterochromia multicolored_eyes', 'Different eyes and multicoloured irises permit multiple colours.')
    facet('eyes.aperture', 'Eye openness', 'subject region frame', {'closed': 'closed_eyes', 'open': 'wide-eyed'}, 'one',
        'one_eye_closed wink', 'Different eyes can differ; warnings assume the same eye and instant.')
    facet('eyes.details', 'Eye details', 'subject region frame', {'mixed': 'heterochromia multicolored_eyes', 'pupils': 'slit_pupils horizontal_pupils heart-shaped_pupils star-shaped_pupils', 'lashes': 'eyelashes long_eyelashes', 'eyewear': 'glasses sunglasses monocle'})
    facet('mouth.openness', 'Mouth openness', 'subject region frame', {'open': 'open_mouth', 'closed': 'closed_mouth'}, 'one')
    facet('expression.emotion', 'Expression and emotion', 'subject region frame', {
        'happy': 'smile grin laughing happy', 'sad': 'sad crying tears', 'angry': 'angry frown scowl',
        'surprised': 'surprised shocked', 'embarrassed': 'blush embarrassed', 'calm': 'expressionless bored sleepy',
        'mixed': 'crying_with_eyes_open nervous_smile evil_smile smug'}, rationale='Emotions can blend; crying and smiling are deliberately compatible.')
    facet('skin.colour', 'Skin colour', 'subject region frame', {c: names for c, names in {
        'light': 'pale_skin fair_skin', 'dark': 'dark_skin dark-skinned_female dark-skinned_male',
        'tan': 'tan tanned_skin', 'blue': 'blue_skin', 'green': 'green_skin', 'red': 'red_skin',
        'grey': 'grey_skin', 'white': 'white_skin', 'purple': 'purple_skin'}.items()}, 'mix', 'multicolored_skin')
    facet('skin.details', 'Skin details', 'subject region frame', {'marks': 'freckles mole scar tattoo birthmark', 'surface': 'sweat wet shiny_skin', 'pattern': 'tanlines bodypaint colored_skin'})
    facet('body.build', 'Body build', 'subject frame', {'slim': 'slim skinny', 'muscular': 'muscular muscular_female muscular_male', 'soft': 'chubby plump fat', 'tall': 'tall tall_female tall_male', 'short': 'short short_female short_male'})
    facet('body.features', 'Body features', 'subject region frame', {'ears': 'pointy_ears animal_ears cat_ears fox_ears rabbit_ears', 'horns': 'horns antlers', 'tail': 'tail multiple_tails', 'wings': 'wings multiple_wings', 'artificial': 'prosthesis mechanical_arms mechanical_legs'}, rationale='Fantasy, hybrid anatomy and prostheses are not contradictions with human features.')
    facet('body.handedness', 'Handedness', 'subject frame', {'left': 'left-handed', 'right': 'right-handed', 'both': 'ambidextrous'})
    facet('body.visibility', 'Visible body regions', 'subject view frame', {'face': 'face head', 'hands': 'hands hand', 'feet': 'feet foot', 'torso': 'torso', 'legs': 'legs leg', 'arms': 'arms arm'})

    facet('pose.support', 'Primary body support', 'subject frame', {
        'standing': 'standing', 'sitting': 'sitting', 'lying': 'lying', 'kneeling': 'kneeling',
        'squatting': 'squatting', 'crouching': 'crouching'}, 'one',
        'multiple_views multiple_timeframes motion_sequence seiza on_one_knee',
        'Primary support differs only for one body at one instant; transitional poses and kneeling seats require context.')
    facet('pose.lying-direction', 'Lying direction', 'subject frame', {'back': 'on_back', 'front': 'on_stomach', 'side': 'on_side'}, 'one', 'multiple_views multiple_timeframes')
    facet('pose.gait', 'Movement', 'subject frame', {'walking': 'walking', 'running': 'running', 'jumping': 'jumping', 'flying': 'flying', 'swimming': 'swimming', 'dancing': 'dancing'}, rationale='Actions can overlap or be transitional; this is not an exclusive list.')
    facet('pose.arms', 'Arm pose', 'subject region frame', {'up': 'arms_up arm_up', 'down': 'arms_at_sides', 'crossed': 'crossed_arms', 'behind': 'arms_behind_back arms_behind_head', 'forward': 'outstretched_arms reaching_out'})
    facet('pose.legs', 'Leg pose', 'subject region frame', {'crossed': 'crossed_legs', 'spread': 'spread_legs', 'together': 'legs_together', 'raised': 'leg_up raised_leg', 'bent': 'bent_knees'})
    facet('pose.hand', 'Hand gestures', 'subject region frame', {'fist': 'fist clenched_hand', 'open': 'open_hand spread_fingers', 'point': 'pointing pointing_at_viewer', 'sign': 'peace_sign v double_v thumbs_up finger_gun', 'hold': 'holding holding_hands'}, rationale='Gestures belong to individual hands; two hands can perform different gestures.')
    facet('gaze.direction', 'Gaze direction', 'subject region view frame', {'viewer': 'looking_at_viewer', 'away': 'looking_away', 'up': 'looking_up', 'down': 'looking_down', 'side': 'looking_to_the_side', 'back': 'looking_back'}, rationale='Head direction, eye direction and different eyes are not conflated into an exclusive list.')
    facet('interaction.action', 'Interactions', 'subject target frame', {'embrace': 'hug hugging', 'kiss': 'kiss kissing', 'fight': 'fighting', 'carry': 'carrying princess_carry piggyback', 'touch': 'hand_on_another\'s_head headpat', 'talk': 'talking'})

    colours = 'black white grey brown blue green red pink purple yellow orange aqua beige cream gold silver multicolored'.split()
    for part, label, suffix in [('clothes.upper-colour', 'Upper garment colour', 'shirt'), ('clothes.skirt-colour', 'Skirt colour', 'skirt'), ('clothes.dress-colour', 'Dress colour', 'dress'), ('clothes.pants-colour', 'Trouser colour', 'pants'), ('clothes.outer-colour', 'Outerwear colour', 'jacket'), ('clothes.shoe-colour', 'Footwear colour', 'footwear'), ('clothes.legwear-colour', 'Legwear colour', 'legwear'), ('clothes.headwear-colour', 'Headwear colour', 'headwear'), ('accessory.ribbon-colour', 'Ribbon colour', 'ribbon')]:
        facet(part, label, 'subject garment region frame', {c: c+'_'+suffix for c in colours}, 'mix', rationale='Colours may occupy separate panels, layers or accessories, including one patterned garment.')
    facet('clothes.upper', 'Upper garments', 'subject garment frame', {'shirt': 'shirt collared_shirt t-shirt blouse camisole tank_top crop_top', 'knit': 'sweater cardigan pullover turtleneck', 'hoodie': 'hoodie', 'vest': 'vest waistcoat', 'bodice': 'corset bustier'}, rationale='Multiple upper garments are commonly layered. Garment identity must precede any local restriction.')
    facet('clothes.lower', 'Lower garments', 'subject garment frame', {'skirt': 'skirt miniskirt long_skirt pleated_skirt pencil_skirt', 'pants': 'pants trousers jeans sweatpants track_pants cargo_pants', 'shorts': 'shorts bike_shorts short_shorts', 'leggings': 'leggings'}, 'layer', rationale='Skirts over trousers or shorts are valid; ask for layer order rather than prohibit the pair.')
    facet('clothes.dress', 'Dresses and one-piece garments', 'subject garment frame', {'dress': 'dress sundress evening_gown cocktail_dress', 'onepiece': 'jumpsuit romper leotard bodysuit', 'robe': 'robe kimono yukata'}, rationale='An outer dress or robe may coexist with inner garments.')
    facet('clothes.ensemble', 'Ensembles', 'subject garment frame', {'tracksuit': 'tracksuit', 'suit': 'suit business_suit pantsuit', 'uniform': 'school_uniform military_uniform police_uniform nurse uniform', 'traditional': 'kimono yukata hanfu cheongsam', 'costume': 'maid wedding_dress santa_costume'}, rationale='Ensembles have parts and can be remixed; membership does not occupy a single exclusive slot.')
    facet('clothes.outer', 'Outer layers', 'subject garment frame', {'jacket': 'jacket track_jacket bomber_jacket blazer denim_jacket', 'coat': 'coat long_coat trench_coat', 'cape': 'cape capelet cloak poncho', 'protective': 'armor breastplate raincoat'})
    facet('clothes.legwear', 'Legwear', 'subject garment region frame', {'tights': 'pantyhose tights', 'stockings': 'stockings thighhighs kneehighs', 'socks': 'socks ankle_socks loose_socks', 'warmers': 'leg_warmers'}, rationale='Different layers and legs can have different legwear; socks over tights are allowed.')
    facet('clothes.footwear', 'Footwear', 'subject garment region frame', {'boots': 'boots ankle_boots knee_boots thigh_boots', 'shoes': 'shoes sneakers loafers mary_janes', 'sandals': 'sandals flip-flops', 'heels': 'high_heels pumps stilettos', 'none': 'barefoot'}, rationale='Barefoot may refer to one foot or a removed shoe. No unscoped footwear exclusion.')
    facet('clothes.headwear', 'Headwear', 'subject garment region frame', {'hat': 'hat cap baseball_cap beret fedora sun_hat top_hat', 'hood': 'hood hood_up', 'helmet': 'helmet', 'ornament': 'hairband headband tiara crown hair_bow hair_ornament'}, rationale='Headwear, ornaments and hoods can layer or be carried.')
    facet('clothes.handwear', 'Handwear', 'subject garment region frame', {'gloves': 'gloves fingerless_gloves elbow_gloves mittens', 'sleeves': 'detached_sleeves arm_warmers', 'none': 'bare_hands'}, rationale='Handwear can differ between hands or be partly removed.')
    facet('clothes.material', 'Clothing material', 'subject garment region frame', {'denim': 'denim', 'leather': 'leather', 'latex': 'latex', 'lace': 'lace', 'silk': 'silk', 'knit': 'knit_sweater cable_knit', 'fur': 'fur fur_trim', 'metal': 'metal_armor'}, rationale='Mixed materials and trim are compatible; material values are not global alternatives.')
    facet('clothes.pattern', 'Clothing patterns', 'subject garment region frame', {'stripes': 'striped striped_clothes pinstripe', 'checks': 'checkered plaid tartan', 'dots': 'polka_dot polka_dot_clothes', 'floral': 'floral_print', 'animal': 'animal_print leopard_print tiger_print', 'plain': 'solid_color'}, rationale='Patterns can coexist on panels or layers; no global pattern exclusion.')
    facet('clothes.sleeve-length', 'Sleeve length', 'subject garment region frame', {'none': 'sleeveless', 'short': 'short_sleeves', 'long': 'long_sleeves'}, 'one', 'asymmetrical_clothes single_sleeve detached_sleeves', 'Only the same sleeve of the same garment competes. An inner long sleeve and outer sleeveless garment are valid.')
    facet('clothes.skirt-length', 'Skirt length', 'subject garment region frame', {'short': 'miniskirt microskirt', 'long': 'long_skirt'}, 'one', 'asymmetrical_clothes layered_skirt', 'Different skirts and asymmetrical hems are exceptions; ordinary skirt is a compatible superclass.')
    facet('clothes.fit', 'Clothing fit', 'subject garment region frame', {'tight': 'tight_clothes skintight', 'loose': 'baggy_clothes oversized_clothes loose_clothes'}, 'one', 'asymmetrical_clothes', 'Fit is local to a garment and body region; tight inner and loose outer layers can coexist.')
    facet('clothes.fastening', 'Garment fastening', 'subject garment region frame', {'open': 'open_clothes unbuttoned unzipped', 'closed': 'buttoned zipped_up'}, 'one', 'partially_unbuttoned partially_unzipped', 'Different fasteners and partial opening require local context.')
    facet('clothes.condition', 'Clothing condition', 'subject garment region frame', {'wet': 'wet_clothes', 'torn': 'torn_clothes ripped_clothes', 'dirty': 'dirty_clothes', 'transparent': 'see-through', 'lifted': 'clothes_lift shirt_lift skirt_lift', 'removed': 'clothes_removed'}, rationale='Condition and removal describe states or actions, not a prohibition on garment tags.')
    facet('accessory.items', 'Accessories', 'subject garment region frame', {'neck': 'necklace choker necktie bowtie scarf', 'ear': 'earrings ear_piercing', 'wrist': 'bracelet wristwatch wristband', 'waist': 'belt sash waist_bow', 'carry': 'bag handbag backpack umbrella', 'face': 'mask mouth_mask veil'})

    for kind, label, unit in [('girls', 'Female character count', 'girl'), ('boys', 'Male character count', 'boy'), ('others', 'Other character count', 'other')]:
        facet('count.'+kind, label, 'scene frame', {str(n): f'{n}{unit}'+('s' if n != 1 else '') for n in range(1, 7)}, 'one', 'multiple_views multiple_timeframes', 'Exact counts compete within the same scene; counts of different categories are independent.')
    facet('count.composition', 'Subject count composition', 'scene frame', {'solo': 'solo', 'group': 'group crowd'}, rationale='Solo and group require subject interpretation; projected images and background people can qualify the count.')
    facet('count.more', 'Open-ended counts', 'scene frame', {'girls': 'multiple_girls 6+girls', 'boys': 'multiple_boys 6+boys', 'others': 'multiple_others 6+others'})
    facet('composition.crop', 'Framing', 'subject view frame', {'full': 'full_body', 'upper': 'upper_body', 'cowboy': 'cowboy_shot', 'close': 'close-up', 'feet': 'feet_focus'}, 'one', 'multiple_views comic collage picture-in-picture', 'Framing differs by subject and panel; detailed insets do not contradict a full-body view.')
    facet('composition.azimuth', 'Subject view', 'subject view frame', {'front': 'front_view', 'back': 'from_behind back_view', 'side': 'profile side_view'}, 'one', 'multiple_views mirror reflection turn head_turn', 'Only the same depicted surface in the same view competes; reflection and turned heads require context.')
    facet('composition.elevation', 'Camera elevation', 'subject view frame', {'above': 'from_above', 'below': 'from_below'}, 'one', 'multiple_views comic reflection', 'Above and below can describe different cameras, panels or subjects.')
    facet('composition.angle', 'Camera treatment', 'view frame', {'tilt': 'dutch_angle', 'wide': 'wide_shot', 'lens': 'fisheye wide-angle_lens', 'focus': 'depth_of_field blurry_background bokeh', 'ortho': 'isometric'}, rationale='Lens, angle, crop and focus are independent facets, not exclusive styles.')
    facet('composition.layout', 'Image layout', 'scene view frame', {'panels': 'comic 4koma multiple_views collage split_screen', 'sequence': 'multiple_timeframes motion_sequence', 'inset': 'picture-in-picture inset', 'single': 'single_panel', 'symmetry': 'symmetrical asymmetrical_composition'})
    facet('composition.focus', 'Subject focus', 'subject view frame', {'face': 'face_focus portrait', 'hands': 'hand_focus', 'feet': 'feet_focus', 'object': 'object_focus food_focus vehicle_focus', 'character': 'female_focus male_focus', 'none': 'no_humans'}, rationale='A focus is not a ban on all other subjects or regions.')
    facet('scene.location', 'Scene enclosure', 'scene region frame', {'inside': 'indoors', 'outside': 'outdoors'}, 'one', 'window doorway balcony open_door split_screen multiple_views', 'A scene can cross a threshold or show outdoors through a window. Do not impose image-wide exclusion.')
    facet('scene.place', 'Scene locations', 'scene region frame', {'urban': 'city street alley rooftop', 'home': 'bedroom bathroom kitchen living_room', 'public': 'classroom school office library restaurant shop', 'nature': 'forest mountain beach ocean river lake field desert', 'fantasy': 'space underwater dungeon castle'}, rationale='Locations nest and combine; a beach and ocean are compatible.')
    facet('scene.time', 'Time of day', 'scene frame', {'day': 'day daytime', 'night': 'night', 'twilight': 'sunset sunrise twilight dusk dawn'}, 'one', 'multiple_timeframes split_screen multiple_views', 'Time labels may span transitions, separate panels or hemispheres; warn only for one scene instant.')
    facet('scene.season', 'Season', 'scene region frame', {'spring': 'spring', 'summer': 'summer', 'autumn': 'autumn fall', 'winter': 'winter'}, 'one', 'multiple_timeframes split_screen multiple_views', 'Seasons are local to one place and time; mixed seasonal motifs are not necessarily a contradiction.')
    facet('scene.weather', 'Weather', 'scene region frame', {'rain': 'rain raining', 'snow': 'snow snowing snowfall', 'fog': 'fog mist', 'clear': 'clear_sky sunny', 'cloud': 'cloud cloudy_sky overcast', 'storm': 'storm thunderstorm lightning', 'wind': 'wind windy'}, rationale='Sun showers, mixed precipitation and local weather coexist; no pairwise weather prohibition.')
    facet('scene.background', 'Background treatment', 'scene region view frame', {'plain': 'simple_background solid_color_background', 'white': 'white_background', 'black': 'black_background', 'transparent': 'transparent_background', 'gradient': 'gradient_background', 'pattern': 'patterned_background'}, rationale='Background treatments can differ across panels and regions; white and transparent are not universally exclusive tags.')
    facet('light.source', 'Light sources', 'scene region frame', {'sun': 'sunlight sunbeam', 'moon': 'moonlight', 'fire': 'firelight candlelight', 'artificial': 'neon_lights artificial_light', 'self': 'glowing bioluminescence'}, rationale='Multiple light sources are normal and should not be mutually exclusive.')
    facet('light.direction', 'Light direction', 'subject region view frame', {'back': 'backlighting rim_lighting', 'front': 'frontlighting', 'side': 'sidelighting', 'below': 'underlighting'}, rationale='Fill lights, rim lights and key lights can coexist.')
    facet('light.quality', 'Light quality', 'scene region view frame', {'soft': 'soft_lighting', 'hard': 'hard_lighting harsh_lighting', 'dim': 'dim_lighting low_light', 'bright': 'bright', 'contrast': 'high_contrast chiaroscuro', 'volume': 'volumetric_lighting'}, rationale='Different sources and regions have different light qualities.')
    facet('art.medium', 'Art medium', 'image region', {'photo': 'photo photograph photorealistic realistic', 'digital': 'digital_media digital_art', 'paint': 'painting watercolor oil_painting acrylic_painting', 'drawing': 'sketch pencil_drawing ink drawing', 'pixel': 'pixel_art', 'render': '3d 3d_render', 'mixed': 'mixed_media'}, rationale='Mixed media, overpainting and stylised rendering are deliberate artistic choices.')
    facet('art.palette', 'Palette', 'image region', {'mono': 'monochrome greyscale', 'limited': 'limited_palette', 'colour': 'colorful multicolored', 'accent': 'spot_color partially_colored', 'pastel': 'pastel_colors', 'sepia': 'sepia'}, rationale='Spot colour and regional colouring invalidate a global monochrome-versus-colour exclusion.')
    facet('art.technique', 'Art technique', 'image region', {'line': 'lineart', 'cel': 'cel_shading', 'gradient': 'gradient', 'hatch': 'cross-hatching hatching', 'texture': 'halftone screentones', 'flat': 'flat_color', 'rough': 'unfinished rough_sketch'})
    facet('text.content', 'Text and symbols', 'image region', {'text': 'text speech_bubble thought_bubble caption subtitles', 'signature': 'signature watermark artist_name', 'none': 'no_text', 'language': 'english_text japanese_text chinese_text korean_text'}, rationale='Text may exist on one panel while another is text-free; languages and signatures can coexist.')
    facet('objects.presence', 'Objects', 'scene region frame', {'weapon': 'sword gun bow_(weapon) spear staff shield', 'furniture': 'chair table bed couch bench', 'vehicle': 'car bicycle motorcycle train airplane boat', 'plant': 'flower tree grass', 'animal': 'cat dog bird horse fish'}, rationale='Object types coexist; recognition is not a requirement to list every object.')


def build():
    FACETS.clear()
    define_facets()
    with gzip.open(ROOT / 'data/danbooru.csv.gz', 'rt', encoding='utf-8') as stream:
        rows = [row for row in csv.reader(stream) if row[1] == '0']
        vocabulary = {row[0] for row in rows}
    missing, facets, rules = set(), [], []
    for definition in FACETS:
        members = []
        for value, names in definition['values'].items():
            for name in names:
                if name in vocabulary:
                    members.append({'tag': name, 'value': value})
                else:
                    missing.add(name)
        exceptions = [name for name in definition['exceptions'] if name in vocabulary]
        missing.update(set(definition['exceptions']) - vocabulary)
        item = {key: definition[key] for key in ('id', 'label', 'scope', 'mode', 'rationale')}
        item['members'] = members
        facets.append(item)
        if definition['mode'] in ('one', 'mix') and len({member['value'] for member in members}) > 1:
            rules.append(dict(id=definition['id']+'.values', label=definition['label'],
                              kind='distinct_values' if definition['mode'] == 'one' else 'compatible_values',
                              facets=[definition['id']], scope=definition['scope'], exceptions=exceptions,
                              policy='warn' if definition['mode'] == 'one' else 'inform', status='candidate',
                              rationale=definition['rationale']))
    # Explicit cross-facet rules. These are not transitive exclusions.
    cross = [
        ('hair.absent-length', 'Scalp hair presence and length', 'hair.presence', ['absent'], 'hair.length', [],
         'subject region frame', 'wig hair_extensions', 'Bald scalp and scalp hair length need region or wig context.'),
        ('count.solo-girls', 'Solo and multiple female characters', 'count.composition', ['solo'], 'count.girls', ['2','3','4','5','6'],
         'scene frame', 'multiple_views multiple_timeframes', 'Solo can coexist with multiple views of one character; otherwise clarify scene count.'),
        ('count.solo-boys', 'Solo and multiple male characters', 'count.composition', ['solo'], 'count.boys', ['2','3','4','5','6'],
         'scene frame', 'multiple_views multiple_timeframes', 'Solo versus multiple characters needs scene identity.'),
        ('count.solo-others', 'Solo and multiple other characters', 'count.composition', ['solo'], 'count.others', ['2','3','4','5','6'],
         'scene frame', 'multiple_views multiple_timeframes', 'Solo versus multiple characters needs scene identity.'),
        ('count.solo-open', 'Solo and open-ended multiple counts', 'count.composition', ['solo'], 'count.more', [],
         'scene frame', 'multiple_views multiple_timeframes', 'An open-ended multiple count and solo need clarification for the same scene.'),
    ]
    for id, label, left, lv, right, rv, scope, exceptions, rationale in cross:
        valid = {facet['id']: {m['value'] for m in facet['members']} for facet in facets}
        lv = [value for value in lv if value in valid[left]]
        rv = [value for value in rv if value in valid[right]]
        rules.append(dict(id=id, label=label, kind='cross_values', facets=[left,right], values=[lv,rv],
                          scope=scope.split(), exceptions=[name for name in exceptions.split() if name in vocabulary],
                          policy='warn', status='candidate', rationale=rationale))
    rules.append(dict(id='count.solo-mixed', label='Solo and mixed-category counts', kind='solo_total',
                      facets=['count.composition','count.girls','count.boys','count.others'], scope=['scene','frame'],
                      exceptions=[name for name in ['multiple_views','multiple_timeframes'] if name in vocabulary],
                      policy='warn', status='candidate',
                      rationale='Solo plus positive counts in different categories implies more than one character in the same scene. This is a multi-tag rule, not pairwise exclusion.'))
    # Compatible cross-facet statements are dictionary knowledge, not unsolicited UI notices.
    for left,right,why in [
        ('hair.colour','hair.length','Colour and length are independent attributes.'),
        ('hair.colour','hair.details','Sidelocks and bangs coexist with hair colours.'),
        ('hair.length','hair.arrangement','Length and styling are distinct; a bun does not require short hair.'),
        ('expression.emotion','eyes.aperture','Emotion does not determine eye openness.'),
        ('clothes.lower','clothes.dress','Dresses and skirts may be worn over trousers or shorts.'),
        ('clothes.upper','clothes.outer','Shirts, sweaters and jackets can layer.'),
        ('clothes.legwear','clothes.footwear','Legwear and footwear coexist.'),
        ('clothes.ensemble','clothes.lower','Ensembles can be remixed with other garments.'),
        ('clothes.material','clothes.pattern','Material and pattern are independent.'),
        ('clothes.sleeve-length','clothes.upper-colour','Sleeve length does not constrain colour.'),
        ('pose.support','pose.arms','Body support and arm pose are independent.'),
        ('composition.crop','composition.elevation','Crop and camera elevation are independent.'),
        ('scene.time','scene.weather','Weather does not determine time of day.'),
        ('scene.location','light.source','Indoor scenes can receive sunlight and outdoor scenes artificial light.'),
        ('art.medium','art.palette','Palette is independent of medium.'),
    ]:
        rules.append(dict(id=left+'+'+right, label=why, kind='compatible_facets', facets=[left,right],
                          scope=[], exceptions=[], policy='inform', status='candidate', rationale=why))
    for rule in rules:
        if rule['id'] == 'pose.support.values':
            rule['exception_values'] = {tag: values for tag,values in {
                'seiza': ['sitting','kneeling'], 'on_one_knee': ['standing','kneeling']}.items() if tag in rule['exceptions']}
    source = json.loads((ROOT/'data/danbooru-source.json').read_text(encoding='utf-8'))
    mapped = {member['tag'] for facet in facets for member in facet['members']} | {tag for rule in rules for tag in rule['exceptions']}
    candidates = {}
    for row in rows:
        for alias in (row[3].split(',') if len(row) > 3 and row[3] else []):
            alias = alias.lower().replace(' ', '_')
            candidates.setdefault(alias,set()).add(row[0])
    aliases = {alias: next(iter(targets)) for alias,targets in sorted(candidates.items())
               if len(targets) == 1 and next(iter(targets)) in mapped and (alias not in vocabulary or alias in targets)}
    # Bare highlights also describes lighting in free prompts.
    aliases.pop('highlights', None)
    return dict(version=1, id='gallery-global-rules', revision='2026-10-18.2',
                provenance={'vocabulary': source, 'semantics': 'Gallery authored candidate heuristics; not Danbooru wiki assertions or corpus-derived probabilities.'},
                defaults={'missing_relation': 'unknown', 'enforcement': 'advisory', 'missing_scope': 'conditional', 'negative_prompt': 'separate', 'alternatives': 'branch_local'},
                facets=facets, rules=rules, aliases=aliases, unmapped_proposals=sorted(missing))


def documentation(pack):
    tags = {member['tag'] for facet in pack['facets'] for member in facet['members']}
    lines = ['# Global tag rules', '',
        'Generated from `tools/build_tag_rules.py`; edit that source, then rebuild the pack.', '',
        f"Revision **{pack['revision']}**: **{len(pack['facets'])} semantic facets**, **{len(pack['rules'])} candidate rules**, **{len(tags)} distinct mapped tags**.", '',
        'This is a broad first global pack, not an exhaustive or human-reviewed ontology. All rules are advisory. Unknown relationships remain unknown; tag-group membership never implies exclusion.', '',
        '## Where it runs', '',
        'Reload ComfyUI and expand **Global rules** beneath positive prefix terms or in the Gallery Prompt Encode preview. Negative prefix terms are separate. The clothing layering review remains alongside it. Existing Exclusive tags settings and saved custom exclusions are unchanged.', '',
        'Only tags reachable together in one alternative branch are compared. Weights and emphasis do not change compatibility. An optional group is checked when enabled; independent optional tags can occur together. No tags are disabled, no OR branches are removed, and sampling probabilities are unchanged.', '',
        'Rules bind to subject, garment, region, scene, frame or view. Known different bindings separate instances. Legacy text lacks these bindings, so its warnings are conditional. The evaluator accepts occurrence-path bindings for future structured recipes; there is not yet a UI for assigning them.', '',
        'Context exceptions must be guaranteed in the matching branch and scope. A context tag in a different alternative or an optional context tag cannot globally waive a rule. They qualify unresolved scope only; explicit identical bindings still receive the check. Seiza qualifies sitting/kneeling, not arbitrary standing/lying combinations. These context heuristics are not proofs of physical impossibility.', '',
        '## What the policies mean', '',
        '- `one`: competing values for the same bound attribute; warn conditionally. Hierarchical names can share one value (long and very long hair).',
        '- `mix`: multiple colours can coexist; distribution advice, not exclusion.',
        '- `many`: independent or coexisting attributes. Membership itself generates no warning or compatibility guarantee.',
        '- `layer`: garments can overlap intentionally. The separate clothing review handles explicit layer phrases.',
        '- `solo_total`: a multi-tag rule for solo plus positive counts in different character categories.',
        '- `compatible_facets`: explicit dictionary knowledge such as hair colour plus length; queryable without flooding the UI.', '',
        '## Semantic facets', '', '| Facet | Scope | Policy | Mapped names |', '| --- | --- | --- | --- |']
    for facet in pack['facets']:
        lines.append(f"| {facet['id']} — {facet['label']} | {', '.join(facet['scope'])} | {facet['mode']} | {len(facet['members'])} |")
    lines += ['', '## Rules and exceptions', '', '| Rule | Kind | Policy | Exceptions | Rationale |', '| --- | --- | --- | --- | --- |']
    for rule in pack['rules']:
        lines.append(f"| {rule['id']} | {rule['kind']} | {rule['policy']} | {', '.join(rule['exceptions']) or '—'} | {rule['rationale']} |")
    lines += ['', '## Database and provenance', '',
        '`data/global-tag-rules.json` is the authoritative runtime pack. `tag_rules.py` validates it and builds an offline SQLite projection at `data/global-tag-rules.sqlite3` with `data/tag-rules-schema.sql`. The generated database is ignored by Git; regenerate it with `python tag_rules.py` (`--replace` explicitly rebuilds an existing generated catalog). It is not a migration of the Hydrus memory database.', '',
        'The catalog includes all general names and aliases from the pinned vocabulary, facet memberships, rule dependencies, exception references, FTS5 search and the existing 91 topic groups. Topics support discovery only. The frontend consumes the same JSON pack without downloading rules or sending prompts anywhere. SQLite is not yet a server-side generation constraint engine.', '',
        'Semantic statements are Gallery-authored candidates. The vocabulary and topic provenance are recorded separately; these are not claims that Danbooru has endorsed the rules. Frequency is not a compatibility probability. There is no fabricated co-occurrence dataset.', '',
        'The earlier `tag-coincidence-schema.sql` is a larger design proposal. `data/tag-rules-schema.sql` is the implemented read-only candidate catalog; prefix overrides and observation tables from the proposal are not silently claimed as implemented.', '',
        '## Coverage gaps', '',
        'Unmapped vocabulary remains searchable in the SQLite catalog but is not semantically assessed. Free prose, escaped syntax, prompt schedules, model-specific syntax, explicit garment instances and subject bindings need structured recipe support. No semantic inference is made from gender, species, job, identity or cultural clothing categories being listed together.', '',
        f"{len(pack['unmapped_proposals'])} proposed names were absent from the pinned general vocabulary and were excluded rather than invented:", '',
        ', '.join('`'+name+'`' for name in pack['unmapped_proposals']), '',
        '## Validation', '',
        '`node --test tests/global_tag_rules.test.cjs tests/clothing_rules.test.cjs tests/prompt_boxes.test.cjs tests/batch_blacklist.test.cjs`', '',
        '`python -m unittest discover -s tests -p test_global_tag_rules.py`', '',
        '`npm run build` in `web`, plus isolated browser fixtures for global/clothing review and prefix saving.', '']
    return '\n'.join(lines)


if __name__ == '__main__':
    pack = build()
    target = ROOT/'data/global-tag-rules.json'
    target.write_text(json.dumps(pack, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (ROOT/'docs').mkdir(exist_ok=True)
    (ROOT/'docs/GLOBAL_TAG_RULES.md').write_text(documentation(pack),encoding='utf-8')
    tags = {m['tag'] for facet in pack['facets'] for m in facet['members']}
    print(f"Built {len(pack['facets'])} facets, {len(pack['rules'])} rules, {len(tags)} mapped tags; {len(pack['unmapped_proposals'])} unavailable proposals excluded.")
