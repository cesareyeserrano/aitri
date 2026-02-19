/**
 * Aitri AI client — thin provider-agnostic wrapper over native fetch.
 * Supports Claude (Anthropic), OpenAI, Gemini, and Ollama (local). No npm dependencies.
 */

export async function callAI({ prompt, systemPrompt, config }) {
  if (!config || !config.provider) {
    return { ok: false, error: "AI not configured. Add an `ai` section to .aitri.json." };
  }

  const { provider, model, apiKeyEnv, baseUrl } = config;

  // Ollama — local or cloud (cloud requires API key)
  if (provider === "ollama") {
    const ollamaKey = apiKeyEnv ? process.env[apiKeyEnv] : null;
    try {
      return await callOllama({
        prompt, systemPrompt,
        model: model || "gemma3:4b",
        baseUrl: baseUrl || "http://localhost:11434",
        apiKey: ollamaKey
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Ollama request failed: ${message}` };
    }
  }

  const envKey = apiKeyEnv || defaultApiKeyEnv(provider);
  const apiKey = process.env[envKey];

  if (!apiKey) {
    return {
      ok: false,
      error: `AI API key not found. Set the ${envKey} environment variable.`
    };
  }

  try {
    if (provider === "claude") {
      return await callClaude({ prompt, systemPrompt, model: model || "claude-opus-4-6", apiKey });
    }
    if (provider === "openai") {
      return await callOpenAI({ prompt, systemPrompt, model: model || "gpt-4o", apiKey, baseUrl });
    }
    if (provider === "gemini") {
      return await callGemini({ prompt, systemPrompt, model: model || "gemini-1.5-pro", apiKey });
    }
    return { ok: false, error: `Unknown AI provider: '${provider}'. Use claude, openai, gemini, or ollama.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `AI request failed: ${message}` };
  }
}

function defaultApiKeyEnv(provider) {
  if (provider === "claude") return "ANTHROPIC_API_KEY";
  if (provider === "openai") return "OPENAI_API_KEY";
  if (provider === "gemini") return "GEMINI_API_KEY";
  return "AI_API_KEY";
}

async function callOllama({ prompt, systemPrompt, model, baseUrl, apiKey }) {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, stream: false })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    return { ok: false, error: `Ollama error ${response.status}: ${text}` };
  }

  const data = await response.json();
  const content = data?.message?.content || "";
  return { ok: true, content };
}

async function callClaude({ prompt, systemPrompt, model, apiKey }) {
  const body = {
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }]
  };
  if (systemPrompt) body.system = systemPrompt;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    return { ok: false, error: `Claude API error ${response.status}: ${text}` };
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text || "";
  return { ok: true, content };
}

async function callOpenAI({ prompt, systemPrompt, model, apiKey }) {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096 })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    return { ok: false, error: `OpenAI API error ${response.status}: ${text}` };
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return { ok: true, content };
}

async function callGemini({ prompt, systemPrompt, model, apiKey }) {
  const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: combinedPrompt }] }]
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    return { ok: false, error: `Gemini API error ${response.status}: ${text}` };
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { ok: true, content };
}
