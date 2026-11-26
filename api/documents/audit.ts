import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, getSession, db, json } from '../auth/_utils.js';

export default async function handler(req:VercelRequest,res:VercelResponse){
 if(req.method!=='GET'&&req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 try{
  await init();
  const session=getSession(req);
  if(!session)return json(res,401,{error:'Sesi tidak valid.'});
  const pool=await db();
  if(req.method==='GET'){
   const result=await pool.query('SELECT id,document_id,action,details,created_at FROM gpm_document_audit WHERE owner_username=$1 ORDER BY created_at DESC LIMIT 100',[session.u]);
   return json(res,200,{audit:result.rows});
  }
  const documentId=String(req.body?.documentId||'');
  if(!documentId)return json(res,400,{error:'ID dokumen wajib diisi.'});
  const doc=await pool.query('SELECT id FROM gpm_documents WHERE id=$1 AND owner_username=$2',[documentId,session.u]);
  if(!doc.rowCount)return json(res,404,{error:'Dokumen tidak ditemukan.'});
  const stampApplied=req.body?.stampApplied===true;
  const details={
   stampApplied,
   stampAsset:stampApplied?'stamp-gpm.png':null,
   stampAssetSha256:stampApplied?String(req.body?.stampAssetSha256||''):null,
   stampElements:stampApplied&&Array.isArray(req.body?.stampElements)?req.body.stampElements.slice(0,10):[],
   finalPdfSha256:String(req.body?.finalPdfSha256||''),
   finalPdfBytes:Number(req.body?.finalPdfBytes||0)
  };
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('INSERT INTO gpm_document_audit(document_id,owner_username,action,details) VALUES($1,$2,$3,$4::jsonb)',[documentId,session.u,'document_finalized',JSON.stringify(details)]);
   if(stampApplied)await client.query('INSERT INTO gpm_document_audit(document_id,owner_username,action,details) VALUES($1,$2,$3,$4::jsonb)',[documentId,session.u,'stamp_applied',JSON.stringify({asset:details.stampAsset,assetSha256:details.stampAssetSha256,elements:details.stampElements})]);
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  return json(res,201,{recorded:true,stampApplied});
 }catch(e){console.error('document audit API error',e);return json(res,500,{error:'Gagal menyimpan atau membaca audit dokumen.'})}
}