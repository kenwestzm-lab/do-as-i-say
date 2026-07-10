'use client';

import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(null); // {url, filename}
  const [docType, setDocType] = useState(null); // 'pdf' | 'docx'
  const [fields, setFields] = useState(null);
  const [editValues, setEditValues] = useState({}); // id -> newText
  const [aiPrompt, setAiPrompt] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [resultName, setResultName] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function handleUpload() {
    if (!file) return;
    setStatus('Uploading...');
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUploaded({ url: data.url, filename: data.filename });
      setStatus('Extracting fields...');

      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.url, filename: data.filename }),
      });
      const extractData = await extractRes.json();
      if (extractData.error) throw new Error(extractData.error);
      setDocType(extractData.type);
      setFields(extractData.fields);
      setStatus('Ready to edit.');
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  function getEditableList() {
    if (!fields) return [];
    if (docType === 'pdf') {
      return fields.pages.flatMap(p => p.textItems);
    }
    return fields.paragraphs;
  }

  async function handleManualRegenerate(convertTo) {
    setStatus('Applying edits...');
    setError('');
    try {
      const edits = Object.entries(editValues)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([id, newText]) => ({ id, newText }));

      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: uploaded.url,
          filename: uploaded.filename,
          type: docType,
          fields,
          edits,
          convertTo: convertTo || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResultUrl(data.url);
      setResultName(data.filename);
      setStatus('Done.');
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  async function handleAiEdit() {
    if (!aiPrompt.trim()) return;
    setStatus('Asking AI what to change...');
    setError('');
    try {
      const aiRes = await fetch('/api/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, type: docType, fields }),
      });
      const aiData = await aiRes.json();
      if (aiData.error) throw new Error(aiData.error);

      setStatus(`AI: ${aiData.notes || 'applying changes...'}`);

      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: uploaded.url,
          filename: uploaded.filename,
          type: docType,
          fields,
          edits: aiData.edits || [],
          watermark: aiData.watermark || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResultUrl(data.url);
      setResultName(data.filename);
      setStatus('Done.');
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>DO AS I SAY</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>Real PDF/Word editing, conversion, and AI-assisted edits.</p>

      <section style={{ border: '1px solid #333', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h3>1. Upload a document (.pdf or .docx)</h3>
        <input type="file" accept=".pdf,.docx" onChange={e => setFile(e.target.files[0])} />
        <button onClick={handleUpload} style={btnStyle} disabled={!file}>Upload & Extract</button>
      </section>

      {status && <p style={{ color: '#7fd' }}>{status}</p>}
      {error && <p style={{ color: '#f77' }}>Error: {error}</p>}

      {fields && (
        <section style={{ border: '1px solid #333', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <h3>2. Edit fields directly</h3>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {getEditableList().map(item => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.6 }}>{item.id}</label>
                <input
                  style={{ width: '100%', padding: 6 }}
                  defaultValue={item.text}
                  onChange={e => setEditValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <button onClick={() => handleManualRegenerate()} style={btnStyle}>Apply Edits</button>
          {docType === 'pdf' && (
            <button onClick={() => handleManualRegenerate('docx')} style={btnStyle}>Convert to Word</button>
          )}
        </section>
      )}

      {fields && (
        <section style={{ border: '1px solid #333', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <h3>3. Or just tell the AI what to change</h3>
          <textarea
            style={{ width: '100%', minHeight: 80, padding: 8 }}
            placeholder='e.g. "Change the invoice total to $450 and update the date to today"'
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
          />
          <button onClick={handleAiEdit} style={btnStyle}>Apply with AI</button>
        </section>
      )}

      {resultUrl && (
        <section style={{ border: '1px solid #4a4', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <h3>Result ready</h3>
          <a href={resultUrl} download={resultName} style={{ color: '#7fd' }}>Download {resultName}</a>
        </section>
      )}
    </main>
  );
}

const btnStyle = {
  marginLeft: 12,
  padding: '8px 14px',
  background: '#4a4',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};
