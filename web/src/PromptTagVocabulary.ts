/** Populated only from the user-scoped definition endpoint, never from image text. */
let aliases=new Map<string,string>();
export const promptTagIdentity=(text:string)=>text.trim().toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ').replace(/\\([()])/g,'$1');
export function installPromptTagVocabulary(value:Record<string,string>){aliases=new Map(Object.entries(value).map(([alias,canonical])=>[promptTagIdentity(alias),promptTagIdentity(canonical)]));}
export function canonicalPromptTag(text:string):string|undefined{return aliases.get(promptTagIdentity(text));}
