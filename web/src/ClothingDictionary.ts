/** Small, versioned clothing seed. Related garments are not exclusive sets. */
export const CLOTHING_PACK = 'clothing-1';
export type Garment = { id: string; label: string; kind: 'skirt' | 'lower' | 'dress' | 'ensemble' | 'upper' | 'outer' | 'legwear'; aliases: string[] };
export const GARMENTS: Garment[] = [
    { id: 'skirt', label: 'skirt', kind: 'skirt', aliases: ['skirt', 'miniskirt', 'long skirt', 'pleated skirt', 'pencil skirt'] },
    { id: 'pants', label: 'pants', kind: 'lower', aliases: ['pants', 'trousers', 'long pants'] },
    { id: 'track-pants', label: 'track pants', kind: 'lower', aliases: ['track pants', 'tracksuit pants', 'sweatpants'] },
    { id: 'jeans', label: 'jeans', kind: 'lower', aliases: ['jeans', 'denim pants'] },
    { id: 'shorts', label: 'shorts', kind: 'lower', aliases: ['shorts', 'short pants', 'bike shorts', 'cycling shorts'] },
    { id: 'leggings', label: 'leggings', kind: 'lower', aliases: ['leggings'] },
    { id: 'dress', label: 'dress', kind: 'dress', aliases: ['dress', 'sundress', 'evening gown'] },
    { id: 'tracksuit', label: 'tracksuit', kind: 'ensemble', aliases: ['tracksuit', 'track suit'] },
    { id: 'shirt', label: 'shirt', kind: 'upper', aliases: ['shirt', 't-shirt', 't shirt', 'blouse'] },
    { id: 'sweater', label: 'sweater', kind: 'upper', aliases: ['sweater', 'pullover'] },
    { id: 'jacket', label: 'jacket', kind: 'outer', aliases: ['jacket', 'track jacket', 'coat', 'cardigan'] },
    { id: 'tights', label: 'tights', kind: 'legwear', aliases: ['tights', 'pantyhose', 'stockings'] },
];
export const clothingKey = (text: string) => text.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const aliases = new Map(GARMENTS.flatMap(garment => garment.aliases.map(alias => [alias, garment] as const)));
export const garmentFor = (text: string) => aliases.get(clothingKey(text));

/** Only ambiguous lower-body combinations are flagged initially; ordinary shirt/jacket layering is quiet. */
export function needsLayeringContext(a: Garment, b: Garment): boolean {
    if (a.id === b.id) return false;
    const lower = new Set(['skirt', 'lower', 'dress', 'ensemble']);
    // Pants and a more specific kind of pants can describe one garment.
    if (a.id === 'pants' && ['track-pants', 'jeans'].includes(b.id) || b.id === 'pants' && ['track-pants', 'jeans'].includes(a.id)) return false;
    return lower.has(a.kind) && lower.has(b.kind);
}
