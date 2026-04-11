import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Du bist ein persönlicher Wissensassistent. Beantworte die Frage basierend NUR auf den vorhandenen Einträgen. Antworte auf Deutsch.\n\nWissen:\n${context}\n\nFrage: ${question}`
      }]
    })
  });

  const aiData = await response.json();
  const answer = aiData.content?.[0]?.text || 'Keine Antwort gefunden.';

  return NextResponse.json({ answer });
}
