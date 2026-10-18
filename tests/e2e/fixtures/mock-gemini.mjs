// Solo para pruebas E2E: reemplaza las llamadas a Gemini por una respuesta fija (no sale nada a internet).
// Uso: node --import ./tests/e2e/fixtures/mock-gemini.mjs backend/server.mjs
const realFetch = globalThis.fetch;
globalThis.__geminiCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input?.url || input);
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    globalThis.__geminiCalls++;
    if (process.env.MOCK_GEMINI_FAIL === 'true') return new Response(JSON.stringify({ error: { message: 'mock' } }), { status: 503, headers: { 'content-type': 'application/json' } });
    const text = JSON.stringify({ reply: 'Respuesta de prueba del entrenador.', proposal: null, actions: [] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};
