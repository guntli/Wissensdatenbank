'use client';
import { useState, useEffect } from 'react';

interface Entry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: string;
  summary: string;
  created_at: string;
}

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<'list' | 'new' | 'ask'>('list');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'Sonstiges', tags: '', source: '' });

  const categories = ['Banking & Regulatorik', 'Investment', 'Reise & Planung', 'Fitness & Sport', 'Persönlich', 'Sonstiges'];

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    const res = await fetch('/api/entries');
    const data = await res.json();
    setEntries(data);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setLoading(true);
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })
    });
    setForm({ title: '', content: '', category: 'Sonstiges', tags: '', source: '' });
    await loadEntries();
    setLoading(false);
    setView('list');
  };

  const handleAsk = async () => {
    if (!question) return;
    setLoading(true);
    setAnswer('');
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    setAnswer(data.answer);
    setLoading(false);
  };

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px', fontFamily: 'system-ui, sans-serif', background: '#020817', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>◈ Wissensdatenbank</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('ask')} style={{ background: view === 'ask' ? '#1d4ed8' : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>💬 Fragen</button>
          <button onClick={() => setView('new')} style={{ background: view === 'new' ? '#1d4ed8' : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>+ Neu</button>
          <button onClick={() => setView('list')} style={{ background: view === 'list' ? '#1d4ed8' : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>📋 Liste</button>
        </div>
      </div>

      {view === 'ask' && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>Wissen abfragen</h2>
          <textarea
            placeholder="Stelle eine Frage zu deinem gespeicherten Wissen..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 12, fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
          <button onClick={handleAsk} disabled={loading} style={{ marginTop: 10, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
            {loading ? '⟳ Suche...' : '✦ Antwort generieren'}
          </button>
          {answer && (
            <div style={{ marginTop: 16, background: '#020817', border: '1px solid #1e3a5f', borderRadius: 8, padding: 16, fontSize: 14, lineHeight: 1.7, color: '#94a3b8' }}>
              {answer}
            </div>
          )}
        </div>
      )}

      {view === 'new' && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>Neuer Eintrag</h2>
          {['title', 'content', 'source'].map(field => (
            <div key={field} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>{field === 'title' ? 'Titel' : field === 'content' ? 'Inhalt' : 'Quelle / Link'}</label>
              {field === 'content'
                ? <textarea value={form[field as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, minHeight: 100, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                : <input value={form[field as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
              }
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Kategorie</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, outline: 'none' }}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Tags (kommagetrennt)</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="z.B. basel4, regulatorik, schweiz" style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <button onClick={handleSave} disabled={loading} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
            {loading ? '⟳ Speichert...' : 'Eintrag speichern'}
          </button>
        </div>
      )}

      {view === 'list' && (
        <div>
          {entries.length === 0 && <p style={{ color: '#475569', textAlign: 'center', padding: 40 }}>Noch keine Einträge. Erstelle deinen ersten!</p>}
          {entries.map(entry => (
            <div key={entry.id} style={{ background: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 12, borderLeft: '3px solid #1d4ed8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ background: '#1e293b', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{entry.category}</span>
                <span style={{ color: '#475569', fontSize: 11 }}>{new Date(entry.created_at).toLocaleDateString('de-CH')}</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, color: '#f1f5f9' }}>{entry.title}</h3>
              {entry.summary && <p style={{ margin: '0 0 8px', fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>{entry.summary}</p>}
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{entry.content.slice(0, 200)}{entry.content.length > 200 ? '…' : ''}</p>
              {entry.tags?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {entry.tags.map(t => <span key={t} style={{ background: '#1e293b', color: '#64748b', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>#{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

