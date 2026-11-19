import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { init, getSession, db, json } from '../auth/_utils.js';
export const config={api:{bodyParser:false}};
const MAX_BYTES=4*1024*1024;
async function readBounded(req:VercelRequest):Promise<Buffer>{
  const chunks:Buffer[]=[];let total=0;
  for await (const chunk of req as any){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);total+=b.length;if(total>MAX_BYTES)throw Object.assign(new Error('PDF melebihi batas 4 MB.'),{status:413});chunks.push(b);}
  return Buffer.concat(chunks,total);
}
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  try {
    await init();const session=getSession(req);if(!session)return json(res,401,{error:'Sesi tidak valid.'});
    const docId=String(req.query.docId||'');const kind=String(req.query.kind||'original');
    if(!docId||!['original','final'].includes(kind))return json(res,400,{error:'Parameter dokumen tidak valid.'});
    const contentType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if(contentType!=='application/pdf')return json(res,415,{error:'File harus berformat PDF.'});
    const bytes=await readBounded(req);
    if(bytes.length<8||bytes.subarray(0,5).toString()!=='%PDF-')return json(res,415,{error:'Isi file bukan PDF valid.'});
    const pool=await db();const doc=await pool.query('SELECT id,status FROM gpm_documents WHERE id=$1 AND owner_username=$2',[docId,session.u]);
    if(!doc.rowCount)return json(res,404,{error:'Dokumen tidak ditemukan.'});
    if(kind==='original'&&doc.rows[0].status==='Completed')return json(res,409,{error:'Dokumen Completed tidak dapat mengganti PDF asli.'});
    const path=`documents/${session.u}/${docId}/${kind}-${Date.now()}.pdf`;
    const blob=await put(path,bytes,{access:'private',contentType:'application/pdf',addRandomSuffix:false});
    const col=kind==='original'?'original_blob_path':'final_blob_path';const urlCol=kind==='original'?'original_blob_url':'final_blob_url';const sizeCol=kind==='original'?'original_blob_size':'final_blob_size';const typeCol=kind==='original'?'original_blob_content_type':'final_blob_content_type';
    await pool.query(`UPDATE gpm_documents SET ${col}=$1,${urlCol}=$2,${sizeCol}=$3,${typeCol}=$4,updated_at=now() WHERE id=$5 AND owner_username=$6`,[blob.pathname,blob.url,bytes.length,'application/pdf',docId,session.u]);
    await pool.query('INSERT INTO gpm_document_audit(document_id,owner_username,action,details) VALUES($1,$2,$3,$4::jsonb)',[docId,session.u,'file_uploaded',JSON.stringify({kind,size:bytes.length,path:blob.pathname})]);
    return json(res,200,{pathname:blob.pathname,size:bytes.length,kind,verifiedPdf:true});
  }catch(e:any){console.error('document upload error',e);return json(res,e?.status||500,{error:e?.status===413?'PDF maksimal 4 MB.':'Upload PDF gagal.'});}
}
