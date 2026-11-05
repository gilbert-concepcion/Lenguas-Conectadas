// Memoria de traducción: usa los párrafos de la Biblia (español -> guna) para traducir documentos.
// Prueba primero el párrafo completo; si no está, prueba oración por oración.
// Lo que no encuentra queda con guna: null (ahí se usa el diccionario palabra por palabra).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA = process.env.PARRAFOS_PATH || path.join(__dirname, '..', 'diccionario', 'parrafos_biblia.json');

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

const oraciones = (t) => t.split(/(?<=[.;:?!])\s+/).map((x) => x.trim()).filter(Boolean);

const segmento = (espanol, guna, referencia) => {
  const clave = norm(espanol);
  return { espanol, guna, referencia, clave, palabras: new Set(clave.split(' ')) };
};

// Cada párrafo se guarda completo y, si español y guna tienen el mismo número de oraciones,
// también oración por oración.
const segmentos = [];
for (const p of JSON.parse(fs.readFileSync(RUTA, 'utf8'))) {
  if (!p.espanol || !p.guna || p.espanol.startsWith('PEGA AQUÍ')) continue;
  segmentos.push(segmento(p.espanol, p.guna, p.referencia));
  const es = oraciones(p.espanol), gu = oraciones(p.guna);
  if (es.length > 1 && es.length === gu.length) {
    es.forEach((e, i) => segmentos.push(segmento(e, gu[i], p.referencia)));
  }
}

function parecido(a, b) {
  const inter = [...a].filter((w) => b.has(w)).length;
  return inter / (a.size + b.size - inter || 1);
}

function buscar(texto, minimo) {
  const clave = norm(texto);
  if (!clave) return null;
  const palabras = new Set(clave.split(' '));
  let mejor = null, puntaje = 0;
  for (const s of segmentos) {
    const v = s.clave === clave ? 1 : parecido(palabras, s.palabras);
    if (v > puntaje) { puntaje = v; mejor = s; }
  }
  return puntaje >= minimo ? { ...mejor, parecido: Number(puntaje.toFixed(2)) } : null;
}

// Devuelve, por cada párrafo del documento, las partes traducidas y las que faltan
export function traducirParrafos(documento, minimo = 0.85) {
  return documento.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean).map((original) => {
    const completo = buscar(original, minimo);
    if (completo) return { original, partes: [{ espanol: original, guna: completo.guna, referencia: completo.referencia }] };
    return {
      original,
      partes: oraciones(original).map((o) => {
        const r = buscar(o, minimo);
        return r ? { espanol: o, guna: r.guna, referencia: r.referencia } : { espanol: o, guna: null };
      }),
    };
  });
}

export const totalSegmentos = segmentos.length;