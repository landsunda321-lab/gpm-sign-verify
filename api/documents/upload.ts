import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { Readable } from 'node:stream';
import { init, getSession, db, json } from '../auth/_utils.js';
export const config={api:{bodyParser:false}};
const MAX_BYTES=4*1024*1024;
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  try {
    await init();
    const session=getSession(req);
    if(!session) return json(res,401,{error:'Sesi tidak valid.'});
    const docId=String(req.query.docId||'');
    const kind=String(req.query.kind||'original');
    if(!docId||!['original','final'].includes(kind)) return json(res,400,{error:'Parameter dokumen tidak valid.'});
    const pool=await db();
    const doc=await pool.query('SELECT id FROM gpm_documents WHERE id=$1 AND owner_username=$2',[docId,session.u]);
    if(!doc.rowCount) return json(res,404,{error:'Dokumen tidak ditemukan.'});
    const contentType=String(req.headers['content-type']||'application/pdf');
    if(contentType!=='application/pdf') return json(res,415,{error:'File harus PDF.'});
    const size=Number(req.headers['content-length']||0);
    if(size>MAX_BYTES) return json(res,413,{error:'Upload server dibatasi 4 MB. PDF yang lebih besar perlu metode upload cloud khusus.'});
    const path=`documents/${session.u}/${docId}/${kind}-${Date.now()}.pdf`;
    const body=Readable.toWeb(req) as ReadableStream<Uint8Array>;
    const blob=await put(path,body,{access:'private',contentType:'application/pdf',addRandomSuffix:false});
    const column=kind==='original'?'original_blob_path':'final_blob_path';
    const urlColumn=kind==='original'?'original_blob_url':'final_blob_url';
    const sizeColumn=kind==='original'?'original_blob_size':'final_blob_size';
    const typeColumn=kind==='original'?'original_blob_content_type':'final_blob_content_type';
    await pool.query(`UPDATE gpm_documents SET ${column}=$1,${urlColumn}=$2,${sizeColumn}=$3,${typeColumn}=$4,updated_at=now() WHERE id=$5 AND owner_username=$6`,[blob.pathname,blob.url,size,contentType,docId,session.u]);
    await pool.query('INSERT INTO gpm_document_audit(document_id,owner_username,action,details) VALUES($1,$2,$3,$4::jsonb)',[docId,session.u,'file_uploaded',JSON.stringify({kind,size})]);
    return json(res,200,{pathname:blob.pathname,size,kind});
  } catch(e) { console.error('document upload error',e); return json(res,500,{error:'Upload PDF gagal.'}); }
}
