import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, getSession, db, json } from '../auth/_utils.js';

function normalize(d: any) {
  return {
    id: String(d.id || ''),
    name: String(d.name || ''),
    number: String(d.number || d.id || ''),
    subject: String(d.subject || ''),
    sifat: String(d.sifat || 'Biasa'),
    tanggalSurat: String(d.tanggalSurat || ''),
    signerName: String(d.signerName || ''),
    signerTitle: String(d.signerTitle || ''),
    created: d.created || new Date().toISOString(),
    status: String(d.status || 'Preparing'),
    size: Number(d.size || 0),
    activity: String(d.activity || ''),
    elements: Array.isArray(d.elements) ? d.elements : [],
    fileName: String(d.fileName || d.file_name || ''),
  };
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET','POST'].includes(req.method || '')) return json(res,405,{error:'Method not allowed'});
  try {
    await init();
    const session=getSession(req);
    if(!session) return json(res,401,{error:'Sesi tidak valid.'});
    const pool=await db();
    await pool.query("ALTER TABLE gpm_documents ADD COLUMN IF NOT EXISTS sifat text NOT NULL DEFAULT 'Biasa'");
    await pool.query('ALTER TABLE gpm_documents ADD COLUMN IF NOT EXISTS tanggal_surat date');
    await pool.query('ALTER TABLE gpm_documents ADD COLUMN IF NOT EXISTS signer_name text');
    await pool.query('ALTER TABLE gpm_documents ADD COLUMN IF NOT EXISTS signer_title text');
    if(req.method==='GET') {
      const result=await pool.query(
        'SELECT id,name,number,subject,sifat,tanggal_surat AS "tanggalSurat",signer_name AS "signerName",signer_title AS "signerTitle",created,status,size,activity,elements,file_name AS "fileName", original_blob_path, final_blob_path, updated_at FROM gpm_documents WHERE owner_username=$1 ORDER BY updated_at DESC',
        [session.u]
      );
      return json(res,200,{documents:result.rows});
    }
    const incoming=Array.isArray(req.body?.documents)?req.body.documents:[req.body];
    if(!incoming.length) return json(res,400,{error:'Tidak ada dokumen.'});
    const saved=[];
    for(const raw of incoming) {
      const d=normalize(raw);
      if(!d.id || !d.name) continue;
      const result=await pool.query(
        `INSERT INTO gpm_documents (id,owner_username,name,number,subject,sifat,tanggal_surat,signer_name,signer_title,created,status,size,activity,elements,file_name,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,now())
         ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name,number=EXCLUDED.number,subject=EXCLUDED.subject,sifat=EXCLUDED.sifat,tanggal_surat=EXCLUDED.tanggal_surat,signer_name=EXCLUDED.signer_name,signer_title=EXCLUDED.signer_title,status=CASE WHEN gpm_documents.status='Completed' THEN gpm_documents.status ELSE EXCLUDED.status END,
          size=EXCLUDED.size,activity=EXCLUDED.activity,elements=EXCLUDED.elements,file_name=EXCLUDED.file_name,
          updated_at=now()
         WHERE gpm_documents.owner_username=EXCLUDED.owner_username
         RETURNING id,name,number,subject,sifat,tanggal_surat AS "tanggalSurat",signer_name AS "signerName",signer_title AS "signerTitle",created,status,size,activity,elements,file_name AS "fileName",original_blob_path,final_blob_path,updated_at`,
        [d.id,session.u,d.name,d.number,d.subject,d.sifat,d.tanggalSurat||null,d.signerName||null,d.signerTitle||null,d.created,d.status,d.size,d.activity,JSON.stringify(d.elements),d.fileName]
      );
      if(result.rowCount) {
        saved.push(result.rows[0]);
        await pool.query('INSERT INTO gpm_document_audit(document_id,owner_username,action,details) VALUES($1,$2,$3,$4::jsonb)',[d.id,session.u,'metadata_saved',JSON.stringify({status:d.status})]);
      }
    }
    return json(res,200,{documents:saved});
  } catch(e) { console.error('documents api error',e); return json(res,500,{error:'Gagal menyimpan data dokumen.'}); }
}
