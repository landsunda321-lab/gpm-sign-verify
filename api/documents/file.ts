import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import { Readable } from 'node:stream';
import { init, getSession, db, json } from '../auth/_utils.js';
async function streamBuffer(stream:any):Promise<Buffer>{const chunks:Buffer[]=[];for await(const c of Readable.fromWeb(stream as any)){chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));}return Buffer.concat(chunks);}
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
  try{
    await init();const session=getSession(req);if(!session)return json(res,401,{error:'Sesi tidak valid.'});
    const id=String(req.query.id||'');const kind=String(req.query.kind||'original');
    if(!id||!['original','final'].includes(kind))return json(res,400,{error:'Parameter tidak valid.'});
    const pool=await db();const r=await pool.query(`SELECT ${kind==='original'?'original_blob_path':'final_blob_path'} AS pathname,file_name FROM gpm_documents WHERE id=$1 AND owner_username=$2`,[id,session.u]);
    if(!r.rowCount||!r.rows[0].pathname)return json(res,404,{error:'PDF belum diunggah atau tidak tersedia.'});
    const blob=await get(r.rows[0].pathname,{access:'private'});if(!blob||blob.statusCode!==200)return json(res,404,{error:'PDF tidak ditemukan di penyimpanan.'});
    const bytes=await streamBuffer(blob.stream);if(bytes.length<5||bytes.subarray(0,5).toString()!=='%PDF-')return json(res,422,{error:'File di penyimpanan bukan PDF valid.'});
    const filename=String(r.rows[0].file_name||'document.pdf').replace(/["\\r\\n]/g,'');
    res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`inline; filename="${filename}"`);res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','private, no-cache');res.setHeader('X-Content-Type-Options','nosniff');
    const range=String(req.headers.range||'');if(range){const m=/^bytes=(\\d*)-(\\d*)$/.exec(range);if(!m)return json(res,416,{error:'Range tidak valid.'});let start=m[1]?Number(m[1]):Math.max(0,bytes.length-Number(m[2]||0));let end=m[2]?Number(m[2]):bytes.length-1;if(!m[1]&&m[2])start=Math.max(0,bytes.length-end);if(start>=bytes.length||end<start){res.setHeader('Content-Range',`bytes */${bytes.length}`);return res.status(416).end();}end=Math.min(end,bytes.length-1);res.status(206);res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);res.setHeader('Content-Length',end-start+1);if(req.method==='HEAD')return res.end();return res.end(bytes.subarray(start,end+1));}
    res.setHeader('Content-Length',bytes.length);if(req.method==='HEAD')return res.end();return res.end(bytes);
  }catch(e){console.error('document file error',e);return json(res,500,{error:'Gagal mengambil PDF dari cloud.'});}
}
