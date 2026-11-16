import {useState} from 'react';
import {TreeSelect,theme} from 'antd';
export type VocabularyCategory={value:string;label:string;count:number;parent?:string};
/** Checked parents include their whole vocabulary; children can be chosen independently. */
export function VocabularyCategories({categories,value,onChange}:{categories:VocabularyCategory[];value:string[];onChange:(value:string[])=>void}){
    const [query,setQuery]=useState('');
    const {token}=theme.useToken();
    const tree=(parent?:string):any[]=>categories.filter(item=>item.parent===parent).map(item=>({key:item.value,value:item.value,title:item.label+' ('+item.count+')',searchLabel:item.label,disabled:!item.count,children:tree(item.value)}));
    return <TreeSelect aria-label="Tag categories and subcategories" placeholder="Wiki categories and subcategories" treeData={tree()} treeCheckable treeCheckStrictly showSearch searchValue={query} onSearch={setQuery} autoClearSearchValue={false} treeExpandedKeys={query?categories.filter(item=>!item.parent).map(item=>item.value):undefined} allowClear maxTagCount="responsive" treeNodeFilterProp="searchLabel" value={value.map(id=>({value:id,label:categories.find(item=>item.value===id)?.label||id}))} onChange={(items:any)=>onChange((items||[]).map((item:any)=>typeof item==='string'?item:item.value))} style={{width:350,maxWidth:'100%',minWidth:0}} styles={{popup:{root:{maxWidth:'calc(100vw - 24px)',background:token.colorBgElevated,color:token.colorText,border:'1px solid '+token.colorBorder,boxShadow:token.boxShadowSecondary}}}} listHeight={320}/>;
}
