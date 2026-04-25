import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { content } = await request.json();

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
      messages: [{ role: 'user', content }]
    })
  });

  const data = await response.json();
  const result = data.content?.[0]?.text || '';
  return NextResponse.json({ result });
}
