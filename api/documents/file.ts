import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import { Readable } from 'node:stream';
import { init, getSession, db, json } from '../auth/_utils.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed'});
  try {
    await init();
    const session=getSession(req);
    if(!session) return json(res,401,{error:'Sesi tidak valid.'});
    const id=String(req.query.id||'');
    const kind=String(req.query.kind||'original');
    if(!id||!['original','final'].includes(kind)) return json(res,400,{error:'Parameter tidak valid.'});
    const pool=await db();
    const r=await pool.query(`SELECT ${kind==='original'?'original_blob_path':'final_blob_path'} AS pathname,file_name FROM gpm_documents WHERE id=$1 AND owner_username=$2`,[id,session.u]);
    if(!r.rowCount||!r.rows[0].pathname) return json(res,404,{error:'File belum tersedia di cloud.'});
    const blob=await get(r.rows[0].pathname,{access:'private'});
    if(!blob||blob.statusCode!==200) return json(res,404,{error:'File tidak ditemukan.'});
    res.setHeader('Content-Type',blob.blob.contentType||'application/pdf');
    res.setHeader('Content-Disposition',`inline; filename="${String(r.rows[0].file_name||'document.pdf').replace(/["\\r\\n]/g,'') }"`);
    res.setHeader('Cache-Control','private, no-cache');
    res.setHeader('X-Content-Type-Options','nosniff');
    Readable.fromWeb(blob.stream as any).pipe(res);
  } catch(e) { console.error('document file error',e); return json(res,500,{error:'Gagal mengambil file.'}); }
}
