// gemini.js – REST call to Google Gemini
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}

function extractText(json) {
  try {
    const cand = json?.candidates?.[0];
    const parts = cand?.content?.parts || cand?.content?.[0]?.parts || [];
    const textParts = parts.map((p) => p?.text).filter(Boolean);
    return textParts.join("\n");
  } catch {
    return "";
  }
}

export async function geminiRequest(prompt, opts = {}, signal) {
  const { apiKey, model, temperature = 0.8, maxTokens = 2048 } = opts;
  if (!apiKey)
    throw new Error(
      "Missing API key. Open Settings and add your Gemini API key."
    );
  if (!model)
    throw new Error("Missing model. Choose a Gemini model in Settings.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: String(prompt || "") }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || "Unknown error";
    throw new Error(`Gemini error: ${msg}`);
  }
  return extractText(json) || "(no text)";
}

// Optional: simulate streaming by chunking text locally
export async function simulateStream(fullText, onChunk, delay = 16) {
  const words = fullText.split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    onChunk(words[i]);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, delay));
  }
}
