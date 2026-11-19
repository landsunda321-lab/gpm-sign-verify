import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, db, json } from './auth/_utils.js';
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 try{
  await init();
  const pool=await db();
  await pool.query('ALTER TABLE gpm_documents ADD COLUMN IF NOT EXISTS signer_name text');
  await pool.query('ALTER TABLE gpm_documents ADD COLUMN IF NOT EXISTS signer_title text');
  const id=String(req.query.doc||'');
  if(!id)return json(res,400,{error:'Kode dokumen tidak ditemukan.'});
  const result=await pool.query('SELECT id,name,number,subject,sifat,tanggal_surat AS "tanggalSurat",signer_name AS "signerName",signer_title AS "signerTitle",created,status FROM gpm_documents WHERE id=$1 AND status=$2 LIMIT 1',[id,'Completed']);
  if(!result.rowCount)return json(res,404,{error:'Dokumen tidak ditemukan atau belum berstatus selesai.'});
  return json(res,200,{valid:true,...result.rows[0]});
 }catch(e){console.error('public verify error',e);return json(res,500,{error:'Verifikasi sedang tidak tersedia.'});}
}