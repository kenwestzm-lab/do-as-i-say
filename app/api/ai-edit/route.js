import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// The AI's ONLY job is to decide which existing text fields to change and
// what to change them to (plus optional watermark/QR requests). It never
// touches the actual file - lib/pdf.js and lib/docx.js do the real,
// precise editing based on the structured output below. This keeps edits
// accurate instead of relying on the model to "redraw" a document.
export async function POST(request) {
  try {
    const { prompt, type, fields } = await request.json();
    if (!prompt) return Response.json({ error: 'No prompt provided' }, { status: 400 });

    const fieldList = type === 'pdf'
      ? fields.pages.flatMap(p => p.textItems.map(t => ({ id: t.id, text: t.text })))
      : fields.paragraphs.map(p => ({ id: p.id, text: p.text }));

    const systemPrompt = `You are a document editing assistant. You are given a list of text fields from a document (each with an id and current text) and a user instruction.
Respond with ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "edits": [{"id": "field_id", "newText": "replacement text"}],
  "watermark": {"text": "string or null", "opacity": 0.3},
  "notes": "brief plain-English summary of what you changed"
}
Only include an edit for fields that should actually change based on the instruction. Do not invent field ids that were not given to you. If the instruction doesn't require a watermark, set watermark to null.`;

    const userPrompt = `Document fields:\n${JSON.stringify(fieldList, null, 2)}\n\nInstruction: ${prompt}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return Response.json({ error: 'AI returned invalid JSON', raw }, { status: 502 });
    }

    return Response.json(parsed);
  } catch (err) {
    console.error('AI edit error:', err);
    return Response.json({ error: err.message || 'AI edit failed' }, { status: 500 });
  }
}
