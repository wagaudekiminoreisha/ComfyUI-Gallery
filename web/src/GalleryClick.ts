/** Image selection needs a deliberate fast pair, independent of OS double-click settings. */
export const SELECTION_DOUBLE_CLICK_MS = 160;
export type ImageClick = {id:string;at:number};
export function quickSelectionClick(previous:ImageClick|undefined,current:ImageClick,detail:number):boolean{
 return detail===2&&previous?.id===current.id&&current.at>=previous.at&&current.at-previous.at<=SELECTION_DOUBLE_CLICK_MS;
}
