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

  const response = await fetch('https://emea01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fapi.anthropic.com%2Fv1%2Fmessages&data=05%7C02%7C%7C298267b819b34e5dad4c08de97e2a02c%7C84df9e7fe9f640afb435aaaaaaaaaaaa%7C1%7C0%7C639115196749811013%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=MRmT5%2BmCa9LEdYiK9Re3WlHPfT4OFyyL%2BcACeUwcZew%3D&reserved=0', {
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