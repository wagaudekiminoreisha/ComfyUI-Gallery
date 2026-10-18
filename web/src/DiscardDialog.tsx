import {useState} from 'react';
import {Modal,Button,Space} from 'antd';
import {BASE_Z_INDEX} from './ComfyAppApi';
/** Keep destructive draft decisions inside the themed application. */
export function useDiscardDialog(){
 const [pending,setPending]=useState<{action:()=>void;message:string}>();
 const guard=(needed:boolean,action:()=>void,message='Discard unsaved rules changes?')=>{if(needed)setPending({action,message});else action();};
 const dialog=<Modal title="Unsaved changes" open={!!pending} zIndex={BASE_Z_INDEX+150} onCancel={()=>setPending(undefined)} footer={<Space><Button onClick={()=>setPending(undefined)}>Keep editing</Button><Button danger onClick={()=>{const action=pending?.action;setPending(undefined);action?.();}}>Discard changes</Button></Space>}>{pending?.message}</Modal>;
 return {guard,dialog};
}
