'use client';

import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [fileBase64, setFileBase64] = useState(null);
  const [filename, setFilename] = useState(null);
  const [docType, setDocType] = useState(null);
  const [fields, setFields] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [resultBlobUrl, setResultBlobUrl] = useState(null);
  const [resultName, setResultName] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function handleUpload() {
    if (!file) return;
    setStatus('Uploading and extracting...');
    setError('');
    setResultBlobUrl(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setDocType(data.type);
      setFields(data.fields);
      setFilename(data.filename);
      setFileBase64(data.fileBase64);
      setEditValues({});
      setStatus('Ready to edit.');
    } catch (e) {
      setError(e.message);
      setStatus('');
    }
  }

  function getEditableList() {
    if (!fields) return [];
    if (docType === 'pdf') return fields.pages.flatMap(p => p.textItems);
    return fields.paragraphs;
  }

  async function downloadResult(res) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="(.+)"/);
    const name = match ? match[1] : 'result';
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    setResultBlobUrl(blobUrl);
    setResultName(name);
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
          fileBase64, filename, type: docType, fields, edits,
          convertTo: convertTo || undefined,
        }),
      });
      await downloadResult(res);
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
          fileBase64, filename, type: docType, fields,
          edits: aiData.edits || [],
          watermark: aiData.watermark || null,
        }),
      });
      await downloadResult(res);
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

      {resultBlobUrl && (
        <section style={{ border: '1px solid #4a4', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <h3>Result ready</h3>
          <a href={resultBlobUrl} download={resultName} style={{ color: '#7fd' }}>Download {resultName}</a>
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
