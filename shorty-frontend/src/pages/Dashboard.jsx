import React, { useEffect, useState } from 'react';
import api from '../api';


const codeRegex = /^[A-Za-z0-9]{6,8}$/;

export default function Dashboard() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/api/links');
      setLinks(res.data.links || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setErrors({});
    if (!target) return setErrors({ target: 'Target required' });
    try { new URL(target); } catch (e) { return setErrors({ target: 'Invalid URL (include http/https)' }); }
    if (code && !codeRegex.test(code)) return setErrors({ code: 'Code must be 6-8 alphanumeric chars' });
    setBusy(true);
    try {
      const res = await api.post('/api/links', { target, code: code || undefined });
      if (res.status === 201) {
        setTarget(''); setCode('');
        load();
      }
    } catch (err) {
      if (err.response?.status === 409) setErrors({ code: 'Code already exists' });
      else setErrors({ target: err.response?.data?.error || 'Failed to create' });
    } finally { setBusy(false); }
  };

  const onDelete = async (c) => {
    if (!confirm(`Delete ${c}?`)) return;
    try {
      await api.delete(`/api/links/${c}`);
      load();
    } catch (e) { alert('Failed to delete'); }
  };

  const onCopy = async (c) => {
    const url = `${import.meta.env.VITE_BASE_URL || location.origin}/${c}`;
    await navigator.clipboard.writeText(url);
    alert('Copied: ' + url);
  };

  const filtered = links.filter(l => (l.code + l.target).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">Add link</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">Target URL</label>
            <input className="input" value={target} onChange={e=>setTarget(e.target.value)} placeholder="https://example.com/docs" />
            {errors.target && <div className="small-error">{errors.target}</div>}
          </div>
          <div>
            <label className="label">Custom code (optional)</label>
            <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="6-8 alphanumeric" />
            {errors.code && <div className="small-error">{errors.code}</div>}
          </div>
          <div className="flex items-center gap-3">
            <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{busy ? 'Creating...' : 'Create'}</button>
            <span className="text-sm text-green-600" hidden>Created!</span>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Links</h2>
          <input className="input w-1/3" placeholder="Search by code or URL" value={q} onChange={e=>setQ(e.target.value)} />
        </div>

        {loading ? <div>Loading...</div> : (
          <>
            {filtered.length === 0 ? <div className="muted">No links yet.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-sm text-gray-600">
                      <th className="py-2">Code</th>
                      <th className="py-2">Target</th>
                      <th className="py-2">Clicks</th>
                      <th className="py-2">Last clicked</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l.code} className="border-t">
                        <td className="py-2"><a className="text-blue-600" href={`/${l.code}`} target="_blank" rel="noreferrer">{l.code}</a></td>
                        <td className="py-2 truncate max-w-xs" title={l.target}>{l.target}</td>
                        <td className="py-2">{l.clicks}</td>
                        <td className="py-2">{l.last_clicked ? new Date(l.last_clicked).toLocaleString() : '-'}</td>
                        <td className="py-2 flex gap-2">
                          <button onClick={()=>onCopy(l.code)} className="copy-btn">Copy</button>
                          <a className="px-3 py-1 border rounded" href={`/code/${l.code}`}>Stats</a>
                          <button onClick={()=>onDelete(l.code)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
