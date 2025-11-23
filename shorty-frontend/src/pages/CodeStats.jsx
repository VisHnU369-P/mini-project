import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';


export default function CodeStats(){
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(()=>{
    async function load(){
      try {
        const res = await api.get(`/api/links/${code}`);
        setData(res.data);
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true);
        else setData(null);
      }
    }
    load();
  }, [code]);

  if (notFound) return <div className="card"><p className="muted">Not found.</p><p><Link to="/">← Dashboard</Link></p></div>;

  if (!data) return <div>Loading…</div>;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-3">Stats for {data.code}</h2>
      <p><strong>Target:</strong> <a href={data.target} target="_blank" rel="noreferrer">{data.target}</a></p>
      <p><strong>Clicks:</strong> {data.clicks}</p>
      <p><strong>Last clicked:</strong> {data.last_clicked ? new Date(data.last_clicked).toLocaleString() : '-'}</p>
      <p><strong>Created:</strong> {new Date(data.created_at).toLocaleString()}</p>
      <p className="mt-3"><Link to="/">← Dashboard</Link></p>
    </div>
  );
}
