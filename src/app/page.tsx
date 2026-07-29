'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const CATEGORIES = ['Banking & Regulatorik', 'Investment', 'Reise & Planung', 'Fitness & Sport', 'Persönlich', 'Sonstiges'];

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<'list' | 'new' | 'ask' | 'edit'>('list');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'Sonstiges', tags: '', source: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) loadEntries(); }, [session]);

  const loadEntries = async () => {
    const res = await fetch('/api/entries', { headers: { Authorization: `Bearer ${session?.access_token}` } });
    const data = await res.json();
    if (Array.isArray(data)) setEntries(data);
  };

  const handleLogin = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setAuthError('Falsches Passwort oder E-Mail.');
      } else if (error.message.includes('Email not confirmed')) {
        setAuthError('E-Mail noch nicht bestätigt.');
      } else {
        setAuthError('Login fehlgeschlagen: ' + error.message);
      }
    }
  };

  const handleSignUp = async () => {
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else setAuthError('Bestätigungs-E-Mail gesendet! Bitte E-Mail prüfen.');
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setEntries([]); setView('list'); };

  const handleAnalyze = async () => {
    if (!uploadFile) return;
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      const isPdf = uploadFile.type === 'application/pdf';
      const isText = uploadFile.type.startsWith('text/');
      let body: any;

      if (isPdf) {
        body = { content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Fasse den Inhalt dieses Dokuments auf Deutsch zusammen.' }
        ]};
      } else if (isText) {
        const text = await uploadFile.text();
        body = { content: [{ type: 'text', text: `Fasse folgenden Text auf Deutsch zusammen:\n\n${text.slice(0, 8000)}` }] };
      } else {
        const mimeType = uploadFile.type && uploadFile.type.startsWith('image/') ? uploadFile.type : 'image/jpeg';
        body = { base64, mimeType, content: [] };
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.result) {
        setForm(f => ({ ...f, content: f.content ? `${f.content}\n\n---\nDateiinhalt:\n${data.result}` : data.result }));
        if (!form.title) setForm(f => ({ ...f, title: uploadFile.name.replace(/\.[^.]+$/, '') }));
      }
    } catch (e) { console.error('Analyze error:', e); }
    setAnalyzing(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setLoading(true);
    if (editingEntry) {
      await fetch('/api/entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id: editingEntry.id, ...form, tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) })
      });
    } else {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('content', form.content);
      formData.append('category', form.category);
      formData.append('tags', JSON.stringify(form.tags.split(',').map((t: string) => t.trim()).filter(Boolean)));
      formData.append('source', form.source);
      if (uploadFile) formData.append('file', uploadFile);
      await fetch('/api/entries', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData
      });
    }
    setForm({ title: '', content: '', category: 'Sonstiges', tags: '', source: '' });
    setUploadFile(null);
    setEditingEntry(null);
    await loadEntries();
    setLoading(false);
    setView('list');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eintrag wirklich löschen?')) return;
    await fetch('/api/entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id })
    });
    await loadEntries();
  };

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setForm({ title: entry.title, content: entry.content, category: entry.category, tags: entry.tags?.join(', ') || '', source: entry.source || '' });
    setView('edit');
  };

  const handleAsk = async () => {
    if (!question) return;
    setLoading(true);
    setAnswer('');
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    setAnswer(data.answer);
    setLoading(false);
  };

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>Lädt…</div>
  );

  if (!session) return (
    <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 32, width: 'min(380px, 90vw)' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, margin: '0 0 24px', textAlign: 'center' }}>◈ Wissensdatenbank</h1>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>E-Mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#64748b', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>Passwort</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
        </div>
        {authError && <p style={{ color: authError.includes('gesendet') ? '#4ade80' : '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{authError}</p>}
        <button onClick={handleLogin} style={{ width: '100%', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>Anmelden</button>
        <button onClick={handleSignUp} style={{ width: '100%', background: 'none', color: '#64748b', border: '1px solid #1e293b', borderRadius: 8, padding: '11px', fontSize: 14, cursor: 'pointer' }}>Konto erstellen</button>
      </div>
    </div>
  );

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px', fontFamily: 'system-ui, sans-serif', background: '#020817', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>◈ Wissensdatenbank</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setView('ask')} style={{ background: view === 'ask' ? '#1d4ed8' : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>💬 Fragen</button>
          <button onClick={() => { setEditingEntry(null); setForm({ title: '', content: '', category: 'Sonstiges', tags: '', source: '' }); setUploadFile(null); setView('new'); }} style={{ background: view === 'new' ? '#1d4ed8' : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>+ Neu</button>
          <button onClick={() => setView('list')} style={{ background: view === 'list' ? '#1d4ed8' : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>📋 Liste</button>
          <button onClick={handleLogout} style={{ background: 'none', color: '#64748b', border: '1px solid #1e293b', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>Logout</button>
        </div>
      </div>

      {view === 'ask' && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>Wissen abfragen</h2>
          <textarea placeholder="Stelle eine Frage zu deinem Wissen…" value={question} onChange={e => setQuestion(e.target.value)}
            style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 12, fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
          <button onClick={handleAsk} disabled={loading} style={{ marginTop: 10, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
            {loading ? '⟳ Suche…' : '✦ Antwort generieren'}
          </button>
          {answer && (
            <div style={{ marginTop: 16, background: '#020817', border: '1px solid #1e3a5f', borderRadius: 8, padding: 16, fontSize: 14, lineHeight: 1.7, color: '#94a3b8' }}>{answer}</div>
          )}
        </div>
      )}

      {(view === 'new' || view === 'edit') && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>{view === 'new' ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2>
          <div style={{ marginBottom: 16, background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Datei / Bild hochladen</label>
            <input type="file" accept="image/*,.pdf,.txt,.md" onChange={e => setUploadFile(e.target.files?.[0] || null)}
              style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10, display: 'block' }} />
            {uploadFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: '#4ade80', fontSize: 12 }}>✓ {uploadFile.name}</span>
                <button onClick={handleAnalyze} disabled={analyzing}
                  style={{ background: analyzing ? '#1e293b' : 'linear-gradient(135deg,#1e3a5f,#0f2942)', color: analyzing ? '#64748b' : '#60a5fa', border: '1px solid #1e40af44', borderRadius: 6, padding: '6px 14px', cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {analyzing ? '⟳ KI analysiert…' : '✦ Mit KI analysieren'}
                </button>
              </div>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Titel</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Kategorie</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, outline: 'none' }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Inhalt / KI-Analyse</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Direkt eingeben oder Datei hochladen und analysieren lassen…"
              style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, minHeight: 120, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Tags (kommagetrennt)</label>
            <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="z.B. basel4, regulatorik"
              style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Quelle / Link</label>
            <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="https://…"
              style={{ width: '100%', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', padding: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={loading} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>
              {loading ? '⟳ Speichert…' : 'Speichern'}
            </button>
            <button onClick={() => setView('list')} style={{ background: 'none', color: '#64748b', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14 }}>Abbrechen</button>
          </div>
        </div>
      )}

      {view === 'list' && (
        <div>
          {entries.length === 0 && <p style={{ color: '#475569', textAlign: 'center', padding: 40 }}>Noch keine Einträge. Erstelle deinen ersten!</p>}
          {entries.map(entry => (
            <div key={entry.id} style={{ background: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 12, borderLeft: '3px solid #1d4ed8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ background: '#1e293b', color: '#94a3b8', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>{entry.category}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleEdit(entry)} style={{ background: 'none', border: '1px solid #1e293b', color: '#64748b', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>✏️</button>
                  <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: '1px solid #450a0a44', color: '#ef4444', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                </div>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, color: '#f1f5f9' }}>{entry.title}</h3>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{entry.content.slice(0, 200)}{entry.content.length > 200 ? '…' : ''}</p>
              {entry.source && (
                <a href={entry.source} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontSize: 12 }}>
                  🔗 {entry.source.slice(0, 50)}{entry.source.length > 50 ? '…' : ''}
                </a>
              )}
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
