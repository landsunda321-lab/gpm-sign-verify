import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, getSession, db, json } from '../auth/_utils.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  try {
    await init();
    const session=getSession(req);
    if(!session) return json(res,401,{error:'Sesi tidak valid.'});
    const docs=Array.isArray(req.body?.documents)?req.body.documents:[];
    if(docs.length>500) return json(res,413,{error:'Maksimal 500 metadata dokumen per migrasi.'});
    const pool=await db();
    const saved=[];
    for(const d of docs) {
      if(!d?.id||!d?.name) continue;
      const r=await pool.query(`INSERT INTO gpm_documents(id,owner_username,name,number,subject,created,status,size,activity,elements,file_name,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,number=EXCLUDED.number,subject=EXCLUDED.subject,status=EXCLUDED.status,size=EXCLUDED.size,activity=EXCLUDED.activity,elements=EXCLUDED.elements,file_name=EXCLUDED.file_name,updated_at=now()
        WHERE gpm_documents.owner_username=EXCLUDED.owner_username
        RETURNING id`,
        [String(d.id),session.u,String(d.name),String(d.number||d.id),String(d.subject||''),d.created||new Date().toISOString(),String(d.status||'Preparing'),Number(d.size||0),String(d.activity||'Migrated from browser localStorage'),JSON.stringify(Array.isArray(d.elements)?d.elements:[]),String(d.fileName||'')]);
      if(r.rowCount) saved.push(String(d.id));
    }
    await pool.query('INSERT INTO gpm_document_audit(document_id,owner_username,action,details) SELECT id,$1,$2,$3::jsonb FROM gpm_documents WHERE owner_username=$1',[session.u,'metadata_migrated',JSON.stringify({count:saved.length})]);
    return json(res,200,{migrated:saved.length,ids:saved,note:'Metadata migrated. PDF files must be uploaded separately to cloud storage.'});
  } catch(e) { console.error('document migration error',e); return json(res,500,{error:'Migrasi metadata gagal.'}); }
}
