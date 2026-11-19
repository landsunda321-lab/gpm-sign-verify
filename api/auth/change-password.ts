import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, db, getSession, verifyPassword, hashPassword, setSession, json } from './_utils';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  try {
    await init(); const session=getSession(req); if(!session) return json(res,401,{error:'Sesi tidak valid. Silakan login kembali.'});
    const {currentPassword,newPassword}=req.body||{};
    if(typeof currentPassword!=='string'||typeof newPassword!=='string'||newPassword.length<12||newPassword.length>256) return json(res,400,{error:'Password baru minimal 12 karakter.'});
    const pool=await db(); const result=await pool.query('SELECT password_hash FROM gpm_auth_users WHERE username=$1',[session.u]);
    if(!result.rowCount||!(await verifyPassword(currentPassword,result.rows[0].password_hash))) return json(res,401,{error:'Password saat ini tidak sesuai.'});
    const hash=await hashPassword(newPassword);
    await pool.query('UPDATE gpm_auth_users SET password_hash=$1,must_change_password=false,updated_at=now() WHERE username=$2',[hash,session.u]);
    setSession(res,session.u,false);
    return json(res,200,{ok:true});
  } catch(e) { console.error('change password error',e); return json(res,500,{error:'Tidak dapat menyimpan password.'}); }
}