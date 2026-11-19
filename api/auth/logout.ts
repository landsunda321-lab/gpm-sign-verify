import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSession, json } from './_utils.js';
export default function handler(req:VercelRequest,res:VercelResponse) { if(req.method!=='POST') return json(res,405,{error:'Method not allowed'}); clearSession(res); return json(res,200,{ok:true}); }
