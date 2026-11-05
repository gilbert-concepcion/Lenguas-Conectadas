// Uso:  node cobertura.js ruta/al/texto.txt
// Muestra cuántas palabras del texto están en el diccionario y cuáles FALTAN,
// ordenadas de la más repetida a la menos repetida (esas son las que conviene agregar primero).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICT_PATH = process.env.DICT_PATH || path.join(__dirname, '..', 'diccionario', 'guna_dictionary.json');

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();

// índice del diccionario (cada significado por separado)
const index = new Map();
for (const { espanol, guna } of JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'))) {
  for (const parte of espanol.split(',')) {
    const clave = norm(parte.replace(/\(.*?\)/g, ''));
    if (!clave) continue;
    if (!index.has(clave)) index.set(clave, new Set());
    index.get(clave).add(guna);
  }
}

// Formas posibles de una palabra: plural, femenino y verbos conjugados -> infinitivo
const FINALES_VERBO = [
  ['aron', 'ar'], ['ieron', 'er'], ['aban', 'ar'], ['aba', 'ar'], ['ando', 'ar'], ['iendo', 'er'],
  ['ado', 'ar'], ['ido', 'er'], ['amos', 'ar'], ['emos', 'er'], ['imos', 'ir'], ['an', 'ar'], ['en', 'er'],
  ['as', 'ar'], ['es', 'er'], ['o', 'ar'], ['a', 'ar'], ['e', 'er'], ['io', 'er'],
];
function formas(w) {
  const f = new Set([w]);
  if (w.endsWith('es')) f.add(w.slice(0, -2));
  if (w.endsWith('s')) f.add(w.slice(0, -1));
  if (w.endsWith('as') || w.endsWith('os')) f.add(w.slice(0, -2) + 'o'), f.add(w.slice(0, -2) + 'a');
  if (w.endsWith('a')) f.add(w.slice(0, -1) + 'o');
  if (w.endsWith('o')) f.add(w.slice(0, -1) + 'a');
  for (const [fin, inf] of FINALES_VERBO) {
    if (w.endsWith(fin) && w.length > fin.length + 1) {
      const raiz = w.slice(0, -fin.length);
      f.add(raiz + inf); f.add(raiz + 'ir'); f.add(raiz + 'er');
    }
  }
  return [...f];
}
export function buscar(palabra) {
  for (const forma of formas(palabra)) if (index.has(forma)) return { forma, guna: [...index.get(forma)] };
  return null;
}

// ---- programa principal ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archivo = process.argv[2];
  if (!archivo) { console.log('Uso: node cobertura.js texto.txt'); process.exit(1); }
  const palabras = norm(fs.readFileSync(archivo, 'utf8')).split(' ').filter((w) => w.length > 2);
  const faltan = new Map();
  let encontradas = 0;
  const unicas = new Set();
  for (const w of palabras) {
    if (buscar(w)) { encontradas++; unicas.add(w); }
    else faltan.set(w, (faltan.get(w) || 0) + 1);
  }
  console.log(`Palabras en el texto: ${palabras.length}`);
  console.log(`Encontradas en el diccionario: ${encontradas} (${Math.round((encontradas / palabras.length) * 100)}%)`);
  console.log(`Palabras distintas que FALTAN: ${faltan.size}\n`);
  const orden = [...faltan].sort((a, b) => b[1] - a[1]);
  fs.writeFileSync('faltantes.txt', orden.map(([w, n]) => `${w}\t${n}`).join('\n'));
  console.log('Las 30 que más faltan (palabra, veces):');
  for (const [w, n] of orden.slice(0, 30)) console.log(`  ${w}  (${n})`);
  console.log('\nLista completa guardada en faltantes.txt');
}