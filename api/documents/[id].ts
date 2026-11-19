import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, getSession, db, json } from '../auth/_utils.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(!['GET','DELETE'].includes(req.method||'')) return json(res,405,{error:'Method not allowed'});
  try {
    await init();
    const session=getSession(req);
    if(!session) return json(res,401,{error:'Sesi tidak valid.'});
    const id=String(req.query.id||'');
    if(!id) return json(res,400,{error:'ID dokumen wajib diisi.'});
    const pool=await db();
    if(req.method==='GET') {
      const r=await pool.query('SELECT * FROM gpm_documents WHERE id=$1 AND owner_username=$2',[id,session.u]);
      if(!r.rowCount) return json(res,404,{error:'Dokumen tidak ditemukan.'});
      return json(res,200,{document:r.rows[0]});
    }
    const r=await pool.query('DELETE FROM gpm_documents WHERE id=$1 AND owner_username=$2 RETURNING id',[id,session.u]);
    if(!r.rowCount) return json(res,404,{error:'Dokumen tidak ditemukan.'});
    await pool.query('INSERT INTO gpm_document_audit(document_id,owner_username,action) VALUES($1,$2,$3)',[id,session.u,'document_deleted']);
    return json(res,200,{deleted:true});
  } catch(e) { console.error('document api error',e); return json(res,500,{error:'Gagal memproses dokumen.'}); }
}
