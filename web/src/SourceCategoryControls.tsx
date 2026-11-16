import {SOURCE_CATEGORIES,type SourceCategory} from './SourceTagPolicy';
export function SourceCategoryControls({excluded=[],onChange}:{excluded?:string[];onChange:(ids:string[])=>void}){
    const checkbox=(category:SourceCategory)=>{
        const blocked=!!category.parent&&excluded.includes(category.parent);
        return <label key={category.id} style={{display:'inline-flex',alignItems:'center',gap:4}}><input type="checkbox" aria-label={'Keep '+category.label} checked={!blocked&&!excluded.includes(category.id)} disabled={blocked} onChange={event=>onChange(event.target.checked?excluded.filter(id=>id!==category.id):[...new Set([...excluded,category.id])])}/>{category.label}</label>;
    };
    return <details><summary>Categories this source can contribute</summary><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{SOURCE_CATEGORIES.filter(category=>!category.parent).map(category=>{
        const children=SOURCE_CATEGORIES.filter(child=>child.parent===category.id);
        return children.length?<div key={category.id} style={{flex:'1 1 100%',minWidth:0}}>{checkbox(category)}<details style={{paddingLeft:18}}><summary>{category.refinementLabel||'Refine '+category.label.toLowerCase()}{children.some(child=>excluded.includes(child.id))?' · custom':''}</summary><div style={{display:'flex',flexWrap:'wrap',gap:8,padding:6}}>{children.map(checkbox)}</div><small>{category.note||'Categories can overlap. Enable the parent to edit its finer filters.'}</small></details></div>:checkbox(category);
    })}</div><small>Known tags only; unrecognized tags stay. These source filters run before encoder-wide rules and manually added tags.</small></details>;
}
