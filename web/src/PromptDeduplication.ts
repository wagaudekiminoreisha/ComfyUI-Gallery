/** Mirrors prompt_deduplication.py; unresolved choices must remain independent. */
const pairs:Record<string,string>={'(':')','[':']','{':'}','<':'>'};
function parts(text:string):string[]{
    const stack:string[]=[],cuts:number[]=[];let escaped=false;
    for(let at=0;at<text.length;at++){
        const char=text[at];
        if(escaped)escaped=false;
        else if(char==='\\')escaped=true;
        else if(pairs[char])stack.push(pairs[char]);
        else if(Object.values(pairs).includes(char)){if(!stack.length||stack.pop()!==char)return [text];}
        else if(char===','&&!stack.length)cuts.push(at);
    }
    if(stack.length)return [text];
    let start=0;const result:string[]=[];
    for(const at of cuts){result.push(text.slice(start,at));start=at+1;}
    return [...result,text.slice(start)];
}
function wrapper(text:string):[string,string]|undefined{
    if(!text||!['(','['].includes(text[0]))return;
    const stack:string[]=[];let escaped=false;
    for(let at=0;at<text.length;at++){
        const char=text[at];
        if(escaped){escaped=false;continue;}
        if(char==='\\')escaped=true;
        else if(pairs[char])stack.push(pairs[char]);
        else if(Object.values(pairs).includes(char)){
            if(!stack.length||stack.pop()!==char)return;
            if(!stack.length){
                if(at!==text.length-1)return;
                let inner=text.slice(1,-1),suffix='';
                const weight=text[0]==='('?inner.match(/(:[+-]?(?:\d+(?:\.\d*)?|\.\d+))$/):null;
                if(weight){inner=inner.slice(0,-weight[0].length);suffix=weight[0];}
                if(text[0]==='['&&inner.includes(':'))return;
                return [inner,suffix];
            }
        }
    }
}
export function hasUnresolvedChoices(text:string):boolean{
    let escaped=false;
    for(const char of text){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='{')return true;}
    return false;
}
export function deduplicatePromptPreview(text:string):string{
    // The backend cleans up after sampling. Removing an optional occurrence now
    // could change its probability or hide a tag supplied by another branch.
    if(hasUnresolvedChoices(text))return text;
    const seen=new Set<string>();
    const visit=(value:string,context:string[]=[],depth=0):string=>{
        if(depth>64)return value;
        const result:string[]=[];let changed=false;
        for(const raw of parts(value)){
            const part=raw.trim(),wrapped=wrapper(part);
            if(wrapped){
                const [inner,suffix]=wrapped,kept=visit(inner,[...context,part[0],suffix],depth+1);
                if(kept===inner){result.push(raw);continue;}
                changed=true;if(kept.trim())result.push(part[0]+kept.trim()+suffix+part[part.length-1]);
            }else if(/\bBREAK\b/.test(part)){seen.clear();result.push(raw);}
            else{
                const key=JSON.stringify([context,part]);
                if(part&&seen.has(key))changed=true;
                else{if(part)seen.add(key);result.push(raw);}
            }
        }
        return changed?result.map(part=>part.trim()).filter(Boolean).join(', '):value;
    };
    return visit(text);
}

