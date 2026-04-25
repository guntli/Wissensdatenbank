const handleAnalyze = async () => {
    if (!uploadFile) return;
    setAnalyzing(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(uploadFile);
      });

      const isPdf = uploadFile.type === 'application/pdf';
      const isText = uploadFile.type.startsWith('text/');

      let body: any;

      if (isPdf) {
        body = {
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: 'Fasse den Inhalt dieses Dokuments auf Deutsch zusammen. Extrahiere alle wichtigen Informationen.' }
          ]
        };
      } else if (isText) {
        const text = await uploadFile.text();
        body = { content: [{ type: 'text', text: `Fasse folgenden Text auf Deutsch zusammen:\n\n${text.slice(0, 8000)}` }] };
      } else {
        // Bild — übergib base64 und mimeType separat
        body = {
          base64,
          mimeType: uploadFile.type || 'image/jpeg',
          content: []
        };
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
    } catch (e) { console.error(e); }
    setAnalyzing(false);
  };
