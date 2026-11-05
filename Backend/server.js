// Servidor del tutor de Lenguas-Conectadas
// Orden de intento: 1) Claude (con wifi)  2) Ollama (sin wifi)  3) solo diccionario
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICT_PATH = path.join(__dirname, '..', 'diccionario', 'guna_dictionary.json');
const PORT = process.env.PORT || 3001;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// ---------- Diccionario ----------
const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();

// índice: palabra en español (cada significado por separado) -> varias palabras guna
const index = new Map();
for (const { espanol, guna } of JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'))) {
  for (const parte of espanol.split(',')) {
    const clave = norm(parte.replace(/\(.*?\)/g, ''));
    if (!clave) continue;
    if (!index.has(clave)) index.set(clave, new Set());
    index.get(clave).add(guna);
  }
}
console.log(`Diccionario cargado: ${index.size} palabras en español`);

// busca en el texto las palabras (y frases de hasta 3 palabras) que están en el diccionario
function buscarVocabulario(texto, limite = 40) {
  const palabras = norm(texto).split(' ').filter(Boolean);
  const encontradas = new Map();
  for (let i = 0; i < palabras.length && encontradas.size < limite; i++) {
    for (const n of [3, 2, 1]) {
      const frase = palabras.slice(i, i + n).join(' ');
      if (n === 1 && frase.length < 3) continue;
      if (index.has(frase)) {
        if (!encontradas.has(frase)) encontradas.set(frase, [...index.get(frase)]);
        i += n - 1;
        break;
      }
    }
  }
  return [...encontradas].map(([espanol, guna]) => ({ espanol, guna }));
}

// ---------- Prompt ----------
const SYSTEM = `Eres un tutor amable para estudiantes que aprenden el idioma guna (Guna Yala, Panamá).
Reglas estrictas:
- Responde en español, con frases cortas y claras.
- Usa SOLO las palabras guna de la lista "VOCABULARIO" que recibes. Nunca inventes palabras, frases ni gramática del guna.
- Si algo no está en la lista, dilo: "esa palabra no está en el diccionario".
- Puedes explicar el contenido del documento en español, resumirlo, enseñar el vocabulario y hacer preguntas de práctica.`;

function armarMensaje({ modo, texto, pregunta }, vocab) {
  const lista = vocab.length
    ? vocab.map((v) => `- ${v.espanol}: ${v.guna.join(' / ')}`).join('\n')
    : '(ninguna palabra del texto está en el diccionario)';
  const tarea = {
    explicar: 'Explica de forma sencilla de qué trata el documento.',
    ensenar: 'Enseña al estudiante las palabras guna del vocabulario, con una frase de ayuda para recordarlas.',
    preguntas: 'Hazle 5 preguntas de práctica sobre el documento y el vocabulario, sin dar las respuestas todavía.',
    chat: pregunta || 'Ayuda al estudiante.',
  }[modo] || pregunta || 'Explica el documento.';
  return `DOCUMENTO:\n${texto}\n\nVOCABULARIO:\n${lista}\n\nTAREA: ${tarea}${
    modo !== 'chat' && pregunta ? `\nPregunta del estudiante: ${pregunta}` : ''
  }`;
}

// ---------- Fuentes ----------
async function conClaude(user) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('No hay ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(10000), // sin wifi falla rápido
  });
  if (!r.ok) throw new Error(`Claude respondió ${r.status}`);
  const data = await r.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function conOllama(user) {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(120000), // el modelo local puede tardar
  });
  if (!r.ok) throw new Error(`Ollama respondió ${r.status}`);
  const data = await r.json();
  return data.message.content;
}

// último recurso: sin IA, solo con el diccionario
function soloDiccionario(vocab) {
  if (!vocab.length) return 'No encontré palabras del documento en el diccionario.';
  const lista = vocab.map((v) => `• ${v.espanol} → ${v.guna.join(' / ')}`).join('\n');
  const practica = vocab.slice(0, 5)
    .map((v, i) => `${i + 1}. ¿Cómo se dice "${v.espanol}" en guna?`).join('\n');
  return `Palabras del documento en guna:\n${lista}\n\nPractica:\n${practica}`;
}

// ---------- Servidor ----------
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.post('/api/tutor', async (req, res) => {
  const texto = String(req.body.texto || '').slice(0, 6000);
  const vocab = buscarVocabulario(texto);
  const mensaje = armarMensaje({ ...req.body, texto }, vocab);

  for (const [fuente, fn] of [['claude', conClaude], ['ollama', conOllama]]) {
    try {
      const respuesta = await fn(mensaje);
      return res.json({ fuente, respuesta, vocabulario: vocab });
    } catch (e) {
      console.log(`${fuente} no disponible: ${e.message}`);
    }
  }
  res.json({ fuente: 'diccionario', respuesta: soloDiccionario(vocab), vocabulario: vocab });
});

app.listen(PORT, () => console.log(`Tutor en http://localhost:${PORT}`));