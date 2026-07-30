import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, base64, mimeType } = body;

    let messages: any[];

    if (base64 && mimeType) {
      // Immer als image/jpeg behandeln für iOS Kompatibilität
      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: 'Beschreibe und extrahiere alle Informationen aus diesem Bild auf Deutsch. Was ist zu sehen? Welcher Text ist vorhanden?' }
        ]
      }];
    } else if (content && Array.isArray(content) && content.length > 0) {
      messages = [{ role: 'user', content }];
    } else {
      return NextResponse.json({ error: 'Kein Inhalt übergeben' }, { status: 400 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        messages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Anthropic ${response.status}: ${err.slice(0, 500)}` }, { status: 500 });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text;

    if (!result) {
      return NextResponse.json({ error: `Leer: ${JSON.stringify(data)}` }, { status: 500 });
    }

    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
