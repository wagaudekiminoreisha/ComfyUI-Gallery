"""Read-only, shallow ComfyUI output-directory listing. No metadata scan or moves."""
import asyncio
import mimetypes
import os
from pathlib import Path, PurePosixPath
from urllib.parse import quote

from aiohttp import web

MEDIA_EXTENSIONS = {'.png','.jpg','.jpeg','.webp','.gif','.avif','.bmp','.mp4','.webm','.mov','.mkv','.mp3','.wav','.flac','.ogg'}


def output_path(root, relative):
    if not isinstance(relative,str) or len(relative)>4096 or '\\' in relative or '\x00' in relative:
        raise ValueError('Invalid output path.')
    parts = PurePosixPath(relative)
    if parts.is_absolute() or any(part in ('..','.') or ':' in part or part.startswith('.') for part in parts.parts):
        raise ValueError('Choose a folder inside the ComfyUI output directory.')
    base = Path(root).resolve()
    target = base
    for part in parts.parts:
        target = target/part
        if target.is_symlink() or getattr(target,'is_junction',lambda:False)():
            raise ValueError('Linked output paths are not browsable.')
    resolved = target.resolve()
    if not resolved.is_relative_to(base): raise ValueError('Output path is outside the output directory.')
    return resolved


def list_output(root, relative='', offset=0, limit=48, order='date'):
    directory=output_path(root,relative)
    if not directory.is_dir(): raise ValueError('Output folder does not exist.')
    offset=max(0,int(offset));limit=max(1,min(200,int(limit)))
    rows=[]
    with os.scandir(directory) as stream:
        for entry in stream:
            if entry.name.startswith('.') or entry.is_symlink(): continue
            try:
                target=output_path(root, '/'.join(filter(None,[relative,entry.name])))
                path='/'.join(filter(None,[relative,entry.name]))
                if entry.is_dir(follow_symlinks=False): rows.append({'kind':'folder','name':entry.name,'path':path,'timestamp':0})
                elif entry.is_file(follow_symlinks=False) and target.suffix.lower() in MEDIA_EXTENSIONS:
                    url='/Gallery/output-file?path='+quote(path,safe='')
                    rows.append({'kind':'file','name':entry.name,'path':path,'url':url,
                                 'thumbnailUrl':'/Gallery/output-thumbnail?url='+quote('/static_gallery/'+quote(path,safe='/'),safe=''),
                                 'mime':mimetypes.guess_type(entry.name)[0] or '', 'timestamp':entry.stat(follow_symlinks=False).st_mtime})
            except (OSError,ValueError): continue # Files may disappear while generation is running.
    rows.sort(key=lambda row:(row['kind']!='folder',row['name'].casefold() if order=='name' or row['kind']=='folder' else -row['timestamp'],row['name']))
    end=offset+limit
    return {'folder':relative,'items':rows[offset:end],'total':len(rows),'nextOffset':end if end<len(rows) else None}


def register_output_routes(routes,get_root):
    @routes.get('/Gallery/output-directory')
    async def directory(request):
        try:
            result=await asyncio.to_thread(list_output,get_root(),request.query.get('path',''),
                                           request.query.get('offset',0),request.query.get('limit',48),request.query.get('order','date'))
            return web.json_response(result,headers={'Cache-Control':'no-store'})
        except (OSError,ValueError): return web.json_response({'error':'Output folder is unavailable or outside the output directory.'},status=400)

    @routes.get('/Gallery/output-file')
    async def file(request):
        try:
            target=output_path(get_root(),request.query.get('path',''))
            if not target.is_file() or target.suffix.lower() not in MEDIA_EXTENSIONS: raise ValueError('Not output media.')
            return web.FileResponse(target,headers={'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=30'})
        except (OSError,ValueError): return web.json_response({'error':'Output file is unavailable.'},status=404)
