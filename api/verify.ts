import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, db, json } from './auth/_utils.js';
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 try{
  await init();
  const id=String(req.query.doc||'');
  if(!id)return json(res,400,{error:'Kode dokumen tidak ditemukan.'});
  const pool=await db();
  const result=await pool.query('SELECT id,name,number,created,status FROM gpm_documents WHERE id=$1 AND status=$2 LIMIT 1',[id,'Completed']);
  if(!result.rowCount)return json(res,404,{error:'Dokumen tidak ditemukan atau belum berstatus selesai.'});
  return json(res,200,{valid:true,...result.rows[0]});
 }catch(e){console.error('public verify error',e);return json(res,500,{error:'Verifikasi sedang tidak tersedia.'});}
}