import type { VercelRequest, VercelResponse } from '@vercel/node';
import { init, getSession, db, json } from './_utils.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed'});
  try {
    await init();
    const session=getSession(req);
    if(!session) return json(res,401,{authenticated:false});
    const pool=await db();
    const result=await pool.query('SELECT username,must_change_password FROM gpm_auth_users WHERE username=$1',[session.u]);
    if(!result.rowCount) return json(res,401,{authenticated:false});
    return json(res,200,{authenticated:true,username:result.rows[0].username,mustChangePassword:result.rows[0].must_change_password});
  } catch(e) { console.error('auth session check error',e); return json(res,500,{error:'Tidak dapat memeriksa sesi.'}); }
}
