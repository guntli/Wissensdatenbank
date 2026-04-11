import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

async function analyzeFileWithClaude(file: Buffer, mimeType: string, fileName: string): Promise<string> {
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  if (!isImage && !isPdf) return '';

  const base64 = file.toString('base64');
  const content = isImage
    ? [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
       { type: 'text', text: 'Beschreibe und extrahiere alle Informationen aus diesem Bild auf Deutsch. Was ist zu sehen? Welcher Text ist vorhanden?' }]
    : [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
       { type: 'text', text: 'Fasse den Inhalt dieses Dokuments auf Deutsch zusammen. Extrahiere alle wichtigen Informationen.' }];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content }] })
  });

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const formData = await request.formData();
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const category = formData.get('category') as string;
  const tags = JSON.parse(formData.get('tags') as string || '[]');
  const source = formData.get('source') as string;
  const file = formData.get('file') as File | null;

  const { data: { user } } = await supabase.auth.getUser();

  let fileUrl = '';
  let aiContent = content;

  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    const { data: uploadData } = await supabase.storage.from('attachments').upload(fileName, buffer, { contentType: file.type });
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
      fileUrl = urlData.publicUrl;
    }
    const analysis = await analyzeFileWithClaude(buffer, file.type, file.name);
    if (analysis) aiContent = content ? `${content}\n\n---\nDateiinhalt:\n${analysis}` : analysis;
  }

  const { data, error } = await supabase
    .from('entries')
    .insert([{ title, content: aiContent, category, tags, source: fileUrl || source, summary: '', user_id: user?.id }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { id } = await request.json();
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const body = await request.json();
  const { data, error } = await supabase
    .from('entries')
    .update({ title: body.title, content: body.content, category: body.category, tags: body.tags, source: body.source })
    .eq('id', body.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}