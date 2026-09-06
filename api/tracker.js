import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { letters } from '../src/components/magical/letterData.js';

const letterNames = new Map(letters.map(({ id, name }) => [id, name]));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let client;

function database() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('Supabase is not configured');
  return client ||= createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function validateSubmission(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const letterId = typeof body?.letterId === 'string' ? body.letterId : '';
  const durationMs = typeof body?.durationMs === 'number' ? body.durationMs : NaN;
  const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
  if (!name || name.length > 32 || !letterNames.has(letterId) || !uuid.test(requestId) || !Number.isInteger(durationMs) || durationMs < 0 || durationMs > 86_400_000) return null;
  return { name, letterId, letterName: letterNames.get(letterId), durationMs, requestId };
}

function equalSecret(expected, supplied) {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function cookie(req, name) {
  return req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

function setCookie(res, name, value, age) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Strict${secure}`);
}

function signature(value) {
  return createHmac('sha256', process.env.ADMIN_PASSWORD).update(`admin:${value}`).digest('hex');
}

export function isAuthorized(req) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
  if (equalSecret(expected, supplied)) return true;
  const [expires, signed] = cookie(req, 'decision_admin').split('.');
  return Boolean(expected && /^\d+$/.test(expires || '') && Number(expires) > Date.now() && equalSecret(signature(expires), signed || ''));
}

function visitorId(req) {
  const value = cookie(req, 'decision_visitor');
  return uuid.test(value) ? value : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const action = new URL(req.url || '/', 'http://localhost').searchParams.get('action');
    if (req.method === 'GET') {
      if (action === 'status') {
        const id = visitorId(req) || randomUUID();
        setCookie(res, 'decision_visitor', id, 31536000);
        return res.status(200).json({ admin: isAuthorized(req) });
      }
      if (!isAuthorized(req)) return res.status(401).json({ error: 'Incorrect password.' });
      const { data: submissions, error } = await database()
        .from('letter_decision_history')
        .select('id,visitor_id,choice_order,participant_name,letter_id,letter_name,duration_ms,submitted_at')
        .order('id', { ascending: false })
        .limit(500);
      if (error) throw error;
      return res.status(200).json({ submissions });
    }

    if (req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'JSON required.' });
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'Invalid origin.' });
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch {
        return res.status(400).json({ error: 'Invalid submission.' });
      }
      if (action === 'login') {
        if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin access is not configured.' });
        if (typeof body?.password !== 'string' || !equalSecret(process.env.ADMIN_PASSWORD, body.password)) return res.status(401).json({ error: 'Incorrect password.' });
        const expires = String(Date.now() + 8 * 60 * 60 * 1000);
        setCookie(res, 'decision_admin', `${expires}.${signature(expires)}`, 8 * 60 * 60);
        return res.status(200).json({ ok: true });
      }
      if (action === 'logout') {
        setCookie(res, 'decision_admin', '', 0);
        return res.status(200).json({ ok: true });
      }
      const submission = validateSubmission(body);
      if (!submission) return res.status(400).json({ error: 'Invalid submission.' });

      if (body.adminTest && !isAuthorized(req)) return res.status(401).json({ error: 'Admin session expired. Enter the password again.' });
      const admin = body.adminTest === true && isAuthorized(req);
      const id = visitorId(req);
      if (!id) return res.status(428).json({ error: 'Please reload with cookies enabled before choosing.' });
      const { error } = await database().from('letter_decisions').upsert({
        visitor_id: admin ? `test:${id}` : id,
        request_id: submission.requestId,
        participant_name: admin ? `[Test] ${submission.name}`.slice(0, 32) : submission.name,
        letter_id: submission.letterId,
        letter_name: submission.letterName,
        duration_ms: submission.durationMs,
      }, { onConflict: 'visitor_id,request_id', ignoreDuplicates: true });
      if (error) throw error;
      return res.status(200).json({ ok: true, test: admin });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Tracker request failed', error);
    const status = error instanceof Error && error.message.includes('not configured') ? 503 : 500;
    return res.status(status).json({ error: status === 503 ? 'Tracker is not configured.' : 'Tracker request failed.' });
  }
}
