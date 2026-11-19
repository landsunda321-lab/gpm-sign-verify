import { Pool } from 'pg';
import { promisify } from 'node:util';
import { scrypt as scryptCallback, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const COOKIE = 'gpm_session';

export async function db() { return pool; }
export async function init() {
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) throw new Error('Server configuration is incomplete.');
  await pool.query(`CREATE TABLE IF NOT EXISTS gpm_auth_users (
    username text PRIMARY KEY, password_hash text NOT NULL, must_change_password boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  const admin = await pool.query('SELECT username FROM gpm_auth_users WHERE username=$1', ['feri.setiadi']);
  if (admin.rowCount === 0) {
    const bootstrap = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!bootstrap || bootstrap.length < 16) throw new Error('Initial administrator password is not configured.');
    const hash = await hashPassword(bootstrap);
    await pool.query('INSERT INTO gpm_auth_users(username,password_hash,must_change_password) VALUES($1,$2,true)', ['feri.setiadi', hash]);
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [scheme,salt,hex] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hex) return false;
  const key = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
function sign(value: string) { return createHmac('sha256', process.env.SESSION_SECRET!).update(value).digest('hex'); }
export function setSession(res: any, username: string, mustChange: boolean) {
  const payload = Buffer.from(JSON.stringify({u:username, m:mustChange, e:Date.now()+8*60*60*1000})).toString('base64url');
  const token = payload+'.'+sign(payload);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
}
export function clearSession(res: any) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`); }
export function getSession(req: any) {
  const raw = req.headers.cookie?.split(';').map((s:string)=>s.trim()).find((s:string)=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if (!raw) return null;
  const [payload,signature] = raw.split('.');
  if (!payload || !signature || signature !== sign(payload)) return null;
  try { const data=JSON.parse(Buffer.from(payload,'base64url').toString()); if(data.e<Date.now()) return null; return data; } catch { return null; }
}
export function json(res:any,status:number,data:any) { res.status(status).json(data); }
