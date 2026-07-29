import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, base64, mimeType } = body;

    let messages: any[];

    if (base64 && mimeType) {
      // Bild
      const safeMime = mimeType.includes('heic') || mimeType.includes('heif') || !mimeType.startsWith('image/')
        ? 'image/jpeg'
        : mimeType;

      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64 } },
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Anthropic Fehler: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const result = data.content?.[0]?.text;

    if (!result) {
      return NextResponse.json({ error: `Anthropic Antwort leer: ${JSON.stringify(data)}` }, { status: 500 });
    }

    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
