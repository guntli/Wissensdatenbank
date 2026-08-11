'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Gem, MessageCircle, Plus, ListChecks, LogOut, Sparkles, Loader2,
  Upload, CheckCircle2, Pencil, Trash2, Send
} from 'lucide-react';

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

const inputClass =
  'w-full bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 px-3 py-2.5 text-base sm:text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100';

const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600';

const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 rounded-lg px-5 py-2.5 text-sm font-medium transition hover:bg-slate-50';

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
  const [analyzeError, setAnalyzeError] = useState('');
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', content: '' });

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
    if (error) {
      if (error.message.includes('nicht erlaubt') || error.message.includes('Database error saving new user')) {
        setAuthError('Diese E-Mail-Adresse ist für die Registrierung nicht freigeschaltet.');
      } else {
        setAuthError(error.message);
      }
    } else {
      setAuthError('Bestätigungs-E-Mail gesendet! Bitte E-Mail prüfen.');
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setEntries([]); setView('list'); };

  const handleAnalyze = async () => {
    if (!uploadFile) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      // Bild verkleinern und zu JPEG konvertieren
      const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 1024;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
              if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
              else { w = Math.round(w * MAX / h); h = MAX; }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            URL.revokeObjectURL(url);
            resolve(base64);
          };
          img.onerror = reject;
          img.src = url;
        });
      };

      const isPdf = uploadFile.type === 'application/pdf';
      const isText = uploadFile.type.startsWith('text/');
      let body: any;

      if (isPdf) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(uploadFile);
        });
        body = { content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Erstelle auf Deutsch eine gute Zusammenfassung dieses Dokuments für ein persönliches Wissensarchiv: die wesentlichen Informationen und Inhalte, so dass man sie später wiederfinden und nutzen kann. Schreibe als Fließtext ohne Überschriften.' }
        ]};
      } else if (isText) {
        const text = await uploadFile.text();
        body = { content: [{ type: 'text', text: `Erstelle auf Deutsch eine gute Zusammenfassung des folgenden Texts für ein persönliches Wissensarchiv: die wesentlichen Informationen und Inhalte, so dass man sie später wiederfinden und nutzen kann. Schreibe als Fließtext ohne Überschriften.\n\n${text.slice(0, 8000)}` }] };
      } else {
        // Bild — verkleinern und konvertieren
        const base64 = await compressImage(uploadFile);
        body = { base64, mimeType: 'image/jpeg', content: [] };
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error(`API Fehler: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.result) {
        setForm(f => ({ ...f, content: f.content ? `${f.content}\n\n---\nDateiinhalt:\n${data.result}` : data.result }));
        if (!form.title) setForm(f => ({ ...f, title: uploadFile.name.replace(/\.[^.]+$/, '') }));
      } else {
        throw new Error('Kein Ergebnis von der KI');
      }
    } catch (e: any) {
      setAnalyzeError('Fehler: ' + (e?.message || 'Unbekannter Fehler'));
    }
    setAnalyzing(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setLoading(true);
    if (editingEntry) {
      await fetch('/api/entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id: editingEntry.id, title: form.title, content: form.content, category: editingEntry.category, tags: editingEntry.tags, source: editingEntry.source })
      });
    } else {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('content', form.content);
      formData.append('category', 'Sonstiges');
      formData.append('tags', JSON.stringify([]));
      formData.append('source', '');
      if (uploadFile) formData.append('file', uploadFile);
      await fetch('/api/entries', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData
      });
    }
    setForm({ title: '', content: '' });
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
    setForm({ title: entry.title, content: entry.content });
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
    setAnswer(data.error ? `Fehler: ${data.error}` : data.answer);
    setLoading(false);
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
      <Loader2 className="animate-spin mr-2" size={18} /> Lädt…
    </div>
  );

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center mb-3">
            <Gem className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Wissensdatenbank</h1>
        </div>
        <div className="mb-4">
          <label className={labelClass}>E-Mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div className="mb-5">
          <label className={labelClass}>Passwort</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} className={inputClass} />
        </div>
        {authError && (
          <p className={`text-sm mb-3 ${authError.includes('gesendet') ? 'text-emerald-600' : 'text-red-600'}`}>{authError}</p>
        )}
        <button onClick={handleLogin} className={`${primaryButtonClass} w-full mb-2`}>Anmelden</button>
        <button onClick={handleSignUp} className={`${secondaryButtonClass} w-full`}>Konto erstellen</button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Gem className="text-white" size={18} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 truncate">Wissensdatenbank</h1>
          </div>
          <button onClick={handleLogout}
            className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-400 hover:bg-white hover:text-slate-600 border border-transparent hover:border-slate-200 transition">
            <LogOut size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm mb-7">
          <button onClick={() => setView('ask')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 sm:py-1.5 text-xs font-semibold transition ${view === 'ask' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <MessageCircle size={14} /> Fragen
          </button>
          <button onClick={() => { setEditingEntry(null); setForm({ title: '', content: '' }); setUploadFile(null); setView('new'); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 sm:py-1.5 text-xs font-semibold transition ${view === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Plus size={14} /> Neu
          </button>
          <button onClick={() => setView('list')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 sm:py-1.5 text-xs font-semibold transition ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <ListChecks size={14} /> Liste
          </button>
        </div>

        {view === 'ask' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Wissen abfragen</h2>
            <textarea placeholder="Stelle eine Frage zu deinem Wissen…" value={question} onChange={e => setQuestion(e.target.value)}
              className={`${inputClass} min-h-24 resize-y`} />
            <button onClick={handleAsk} disabled={loading} className={`${primaryButtonClass} mt-3`}>
              {loading ? <><Loader2 className="animate-spin" size={16} /> Suche…</> : <><Send size={16} /> Antwort generieren</>}
            </button>
            {answer && (
              <div className="mt-4 bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{answer}</div>
            )}
          </div>
        )}

        {(view === 'new' || view === 'edit') && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">{view === 'new' ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}</h2>

            <div className="mb-5 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
              <label className={labelClass}>Datei / Bild hochladen</label>
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-indigo-600 transition w-fit">
                <Upload size={16} />
                <span>Datei auswählen</span>
                <input type="file" accept="image/*,.pdf,.txt,.md" onChange={e => { setUploadFile(e.target.files?.[0] || null); setAnalyzeError(''); }}
                  className="hidden" />
              </label>
              {uploadFile && (
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <CheckCircle2 className="text-emerald-500" size={15} />
                    <span className="text-xs text-emerald-700">{uploadFile.name} ({uploadFile.type || 'unbekannt'})</span>
                  </div>
                  <button onClick={handleAnalyze} disabled={analyzing}
                    className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {analyzing ? <><Loader2 className="animate-spin" size={15} /> KI analysiert…</> : <><Sparkles size={15} /> Mit KI analysieren</>}
                  </button>
                  {analyzeError && <p className="text-red-600 text-xs mt-1.5">{analyzeError}</p>}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className={labelClass}>Titel</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
            </div>

            <div className="mb-5">
              <label className={labelClass}>Inhalt / KI-Analyse</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Direkt eingeben oder Datei hochladen und analysieren lassen…"
                className={`${inputClass} min-h-32 resize-y`} />
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={loading} className={primaryButtonClass}>
                {loading ? <><Loader2 className="animate-spin" size={16} /> Speichert…</> : 'Speichern'}
              </button>
              <button onClick={() => setView('list')} className={secondaryButtonClass}>Abbrechen</button>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-3">
            {entries.length === 0 && (
              <div className="text-center py-16 text-slate-400 text-sm bg-white border border-dashed border-slate-200 rounded-2xl">
                Noch keine Einträge. Erstelle deinen ersten!
              </div>
            )}
            {entries.map(entry => (
              <div key={entry.id} className="group bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition hover:shadow-md hover:border-slate-300">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-semibold text-slate-900 text-sm min-w-0 break-words">{entry.title}</h3>
                  <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                    <button onClick={() => handleEdit(entry)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md p-1.5 transition">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(entry.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md p-1.5 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-500 leading-6 mt-1.5">{entry.content.slice(0, 200)}{entry.content.length > 200 ? '…' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
