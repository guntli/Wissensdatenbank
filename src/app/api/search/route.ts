import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { question } = await request.json();
  const { data: entries, error } = await supabase
    .from('entries')
    .select('title, content, category, tags, source');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const context = entries?.map(e =>
    `Titel: ${e.title}\nKategorie: ${e.category}\nInhalt: ${e.content}`
  ).join('\n\n---\n\n');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Du bist ein persönlicher Wissensassistent. Beantworte die Frage basierend NUR auf den vorhandenen Einträgen. Antworte auf Deutsch.\n\nWissen:\n${context}\n\nFrage: ${question}`
      }]
    })
  });
  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Anthropic ${response.status}: ${err.slice(0, 500)}` }, { status: 500 });
  }
  const aiData = await response.json();
  const answer = aiData.content?.[0]?.text || 'Keine Antwort gefunden.';
  return NextResponse.json({ answer });
}