import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, db, verifyPassword, setSession, json } from './_utils';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  try {
    await init();
    const {username,password}=req.body||{};
    if(username!=='feri.setiadi'||typeof password!=='string'||password.length>256) return json(res,401,{error:'Username atau password salah.'});
    const pool=await db(); const result=await pool.query('SELECT password_hash,must_change_password FROM gpm_auth_users WHERE username=$1',[username]);
    if(!result.rowCount || !(await verifyPassword(password,result.rows[0].password_hash))) return json(res,401,{error:'Username atau password salah.'});
    setSession(res,username,result.rows[0].must_change_password);
    return json(res,200,{ok:true,mustChangePassword:result.rows[0].must_change_password});
  } catch(e) { console.error('auth login error',e); return json(res,500,{error:'Layanan autentikasi belum dikonfigurasi.'}); }
}