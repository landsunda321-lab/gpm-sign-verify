import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, getSession, db, json } from './auth/_utils.js';
export default async function handler(req:VercelRequest,res:VercelResponse){
 if(!['GET','POST'].includes(req.method||''))return json(res,405,{error:'Method not allowed'});
 try{await init();const session=getSession(req);if(!session)return json(res,401,{error:'Sesi tidak valid.'});const pool=await db();
 await pool.query("ALTER TABLE gpm_auth_users ADD COLUMN IF NOT EXISTS profile_name text");
 await pool.query("ALTER TABLE gpm_auth_users ADD COLUMN IF NOT EXISTS profile_title text");
 if(req.method==='GET'){const r=await pool.query('SELECT username,profile_name,profile_title FROM gpm_auth_users WHERE username=$1',[session.u]);return json(res,200,{username:r.rows[0]?.username,name:r.rows[0]?.profile_name||'Feri Setiadi',title:r.rows[0]?.profile_title||''});}
 const name=String(req.body?.name||'').trim();const title=String(req.body?.title||'').trim();if(!name)return json(res,400,{error:'Nama penandatangan wajib diisi.'});
 await pool.query('UPDATE gpm_auth_users SET profile_name=$2,profile_title=$3,updated_at=now() WHERE username=$1',[session.u,name,title]);return json(res,200,{username:session.u,name,title});
 }catch(e){console.error('profile api error',e);return json(res,500,{error:'Gagal mengelola profil akun.'});}
}