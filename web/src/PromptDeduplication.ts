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
export type Contribution={text:string;source?:boolean};
export {wrapper as promptWrapper};
export type SharedReference={from:number;to:number;text:string};
type Node={kind:'opaque';raw:string}|{kind:'tag';raw:string;key:string;entry:number}|{kind:'group';raw:string;part:string;inner:string;suffix:string;children:Node[]};
/** Match complete optional/alternative expressions before any random choice. */
export function mergePromptContributions<T extends Contribution>(rows:T[]):{rows:T[];references:SharedReference[]}{
    const owners=new Map<string,Extract<Node,{kind:'tag'}>>();let epoch=0;
    const parse=(value:string,entry:number,context:string[]=[],depth=0):Node[]=>{
        if(depth>64)return [{kind:'opaque',raw:value}];
        return parts(value).map(raw=>{
            const part=raw.trim(),wrapped=wrapper(part);
            if(wrapped){const [inner,suffix]=wrapped;return {kind:'group',raw,part,inner,suffix,children:parse(inner,entry,[...context,part[0],suffix],depth+1)};}
            if(/\bBREAK\b/.test(part)){epoch++;return {kind:'opaque',raw};}
            if(!part)return {kind:'opaque',raw};
            const key=JSON.stringify([epoch,context,part]);
            const node:Extract<Node,{kind:'tag'}>={kind:'tag',raw,key,entry};
            const previous=owners.get(key);
            if(!previous||rows[entry].source&&!rows[previous.entry].source)owners.set(key,node);
            return node;
        });
    };
    const trees=rows.map((row,index)=>parse(row.text,index)),references:SharedReference[]=[];
    const render=(tree:Node[]):string=>{
        const result:string[]=[];let changed=false;
        for(const node of tree){
            if(node.kind==='opaque')result.push(node.raw);
            else if(node.kind==='tag'){
                const owner=owners.get(node.key)!;
                if(owner===node)result.push(node.raw);
                else{changed=true;references.push({from:node.entry,to:owner.entry,text:node.raw.trim()});}
            }else{
                const kept=render(node.children);
                if(kept===node.inner)result.push(node.raw);
                else{changed=true;if(kept.trim())result.push(node.part[0]+kept.trim()+node.suffix+node.part[node.part.length-1]);}
            }
        }
        return changed?result.map(part=>part.trim()).filter(Boolean).join(', '):result.join(',');
    };
    const merged=rows.map((row,index)=>({...row,text:render(trees[index])}));
    return {rows:merged,references};
}
export function deduplicatePromptPreview(text:string):string{
    return mergePromptContributions([{text}]).rows[0].text;
}
