import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { content, mimeType, base64 } = await request.json();

  let messages;

  if (base64 && mimeType) {
    const safeMimeType = mimeType.includes('heic') || mimeType.includes('heif')
      ? 'image/jpeg'
      : mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: safeMimeType, data: base64 } },
        { type: 'text', text: 'Beschreibe und extrahiere alle Informationen aus diesem Bild auf Deutsch. Was ist zu sehen? Welcher Text ist vorhanden? Fasse alles zusammen.' }
      ]
    }];
  } else {
    messages = [{ role: 'user', content }];
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

  const data = await response.json();
  const result = data.content?.[0]?.text || '';
  return NextResponse.json({ result });
}
