import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tracker } from '@/lib/tracker';

function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 100) / 10;
  return `${seconds.toFixed(1)} seconds`;
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const data = await tracker();
    setSubmissions(data.submissions);
  };
  useEffect(() => { load().catch(e => { if (e.status !== 401) setError(e.message); }); }, []);

  const unlock = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await tracker('login', { password });
      setPassword('');
      await load();
    } catch (requestError) {
      setSubmissions(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  const logout = async () => {
    try { await tracker('logout', {}); navigate('/'); } catch (e) { setError(e.message); }
  };

  return <main className="fixed inset-0 z-50 overflow-auto bg-slate-950 px-4 py-12 text-slate-100">
    <section className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">Letter decisions</h1>
      {submissions ? <nav className="mt-8 flex gap-6" aria-label="Admin actions">
        <Link to="/?test=1">Test letters</Link>
        <button onClick={() => load().catch(e => { setSubmissions(null); setError(e.message); })}>Refresh records</button>
        <button onClick={logout}>Log out</button>
      </nav> : <form className="mt-8 flex max-w-xl gap-3" onSubmit={unlock}>
        <label className="sr-only" htmlFor="admin-password">Admin password</label>
        <input id="admin-password" className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-4 py-3" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Admin password" required />
        <button className="rounded-md bg-amber-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50" disabled={loading}>{loading ? 'Loading…' : 'Unlock'}</button>
      </form>}
      {error ? <p className="mt-4 text-red-300" role="alert">{error}</p> : null}
      {submissions ? <div className="mt-10 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-300"><tr><th className="p-4">Name</th><th className="p-4">Browser</th><th className="p-4">Choice #</th><th className="p-4">Letter</th><th className="p-4">Time picking</th><th className="p-4">Submitted</th></tr></thead>
          <tbody>{submissions.map(submission => <tr className="border-t border-slate-800" key={submission.id}><td className="p-4">{submission.participant_name}</td><td className="p-4 font-mono" title={submission.visitor_id}>{submission.visitor_id.replace(/^test:/,'').slice(0,8)}</td><td className="p-4">{submission.choice_order}</td><td className="p-4">{submission.letter_name}</td><td className="p-4">{formatDuration(submission.duration_ms)}</td><td className="p-4">{new Date(submission.submitted_at).toLocaleString()}</td></tr>)}</tbody>
        </table>
        {submissions.length === 0 ? <p className="p-6 text-slate-400">No decisions yet.</p> : null}
      </div> : null}
    </section>
  </main>;
}
