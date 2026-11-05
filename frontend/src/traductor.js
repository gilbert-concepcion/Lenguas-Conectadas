// Traductor local español <-> guna (sin internet)
// 1) Busca frases y párrafos guardados en parrafos.json
// 2) Lo demás lo traduce palabra por palabra con guna_dictionary.json
import diccionario from '../../diccionario/guna_dictionary.json'
import parrafos from '../../diccionario/parrafos.json'

const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const limpiar = (s) => s.toLowerCase().replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
const suave = (s) => sinTildes(limpiar(s))

// ---------- Índices del diccionario ----------
const esGuna = new Map() // español (con tildes) -> [guna, ...]
const esGunaSuave = new Map() // español (sin tildes) -> [guna, ...]
const gunaEs = new Map() // guna -> [español, ...]

const agregar = (mapa, clave, valor) => {
  if (!clave) return
  if (!mapa.has(clave)) mapa.set(clave, [])
  const lista = mapa.get(clave)
  if (!lista.includes(valor)) lista.push(valor)
}

for (const { espanol, guna } of diccionario) {
  // "hermano, hermana" se guarda como dos palabras separadas
  for (const parte of espanol.split(',')) {
    if (/[¿¡]/.test(parte)) continue // "hola, ¿cómo están?" es una sola frase
    const clave = limpiar(parte.replace(/\(.*?\)/g, ''))
    agregar(esGuna, clave, guna)
    agregar(esGunaSuave, sinTildes(clave), guna)
  }
  // además, la entrada completa como una sola frase
  const completa = limpiar(espanol.replace(/\(.*?\)/g, ''))
  agregar(esGuna, completa, guna)
  agregar(esGunaSuave, sinTildes(completa), guna)
  agregar(gunaEs, limpiar(guna), espanol.split(',')[0].replace(/\(.*?\)/g, '').trim())
}

// ---------- Formas de palabras (plural, femenino, verbos conjugados) ----------
const FINALES = [
  ['aron', 'ar'], ['ieron', 'er'], ['aban', 'ar'], ['aba', 'ar'], ['ando', 'ar'], ['iendo', 'er'],
  ['ado', 'ar'], ['ido', 'er'], ['amos', 'ar'], ['emos', 'er'], ['imos', 'ir'], ['an', 'ar'],
  ['en', 'er'], ['as', 'ar'], ['es', 'er'], ['o', 'ar'], ['a', 'ar'], ['e', 'er'], ['io', 'er'],
]
const NO_FORMAS = new Set([
  'sobre', 'entre', 'hasta', 'desde', 'para', 'por', 'con', 'sin', 'pero', 'como', 'cuando',
  'donde', 'porque', 'esto', 'este', 'esta', 'estos', 'estas', 'eso', 'ese', 'esa', 'tras',
  'segun', 'hacia', 'tambien', 'muy', 'todos', 'todas', 'otro', 'otra',
])

const NO_TRADUCIR = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'u', 'e',
  'que', 'se', 'lo', 'en', 'a',
])

function formas(w) {
  const f = new Set([w])
  if (w.endsWith('es')) f.add(w.slice(0, -2))
  if (w.endsWith('s')) f.add(w.slice(0, -1))
  if (w.endsWith('as') || w.endsWith('os')) { f.add(w.slice(0, -2) + 'o'); f.add(w.slice(0, -2) + 'a') }
  if (w.endsWith('a')) f.add(w.slice(0, -1) + 'o')
  if (w.endsWith('o')) f.add(w.slice(0, -1) + 'a')
  for (const [fin, inf] of FINALES) {
    if (w.endsWith(fin) && w.length > fin.length + 1) {
      const raiz = w.slice(0, -fin.length)
      f.add(raiz + inf); f.add(raiz + 'ir'); f.add(raiz + 'er')
    }
  }
  return [...f]
}

function buscarPalabra(frase, direccion, esUnaPalabra) {
  if (direccion === 'guna-es') return gunaEs.get(frase) || null
  if (esUnaPalabra && NO_TRADUCIR.has(frase)) return null
  if (esGuna.has(frase)) return esGuna.get(frase)
  if (frase.length < 4) return null // "el" no debe confundirse con "él"
  const base = sinTildes(frase)
  if (esGunaSuave.has(base)) return esGunaSuave.get(base)
  if (esUnaPalabra && !NO_FORMAS.has(base)) {
    for (const f of formas(base)) if (esGunaSuave.has(f)) return esGunaSuave.get(f)
  }
  return null
}

const conMayuscula = (original, texto) =>
  /^\p{Lu}/u.test(original) ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto

// ---------- Memoria de frases y párrafos ----------
const oracionesDe = (t) => t.split(/(?<=[.;:?!])\s+/).map((x) => x.trim()).filter(Boolean)
const conjunto = (t) => new Set(suave(t).split(' ').filter(Boolean))

const segmentos = []
const nuevoSegmento = (espanol, guna) =>
  segmentos.push({ espanol, guna, setEs: conjunto(espanol), setGu: conjunto(guna) })

for (const p of parrafos) {
  if (!p.espanol || !p.guna) continue
  nuevoSegmento(p.espanol, p.guna)
  const es = oracionesDe(p.espanol)
  const gu = oracionesDe(p.guna)
  if (es.length > 1 && es.length === gu.length) es.forEach((e, i) => nuevoSegmento(e, gu[i]))
}

function parecido(a, b) {
  let comunes = 0
  for (const w of a) if (b.has(w)) comunes++
  return comunes / (a.size + b.size - comunes || 1)
}

function buscarSegmento(texto, direccion) {
  const set = conjunto(texto)
  if (!set.size) return null
  let mejor = null
  let puntaje = 0
  for (const s of segmentos) {
    const otro = direccion === 'es-guna' ? s.setEs : s.setGu
    const v = parecido(set, otro)
    if (v > puntaje) { puntaje = v; mejor = s }
  }
  // las frases cortas deben coincidir exactas; las largas aceptan pequeñas diferencias
  const minimo = set.size < 4 ? 1 : 0.85
  if (!mejor || puntaje < minimo) return null
  return direccion === 'es-guna' ? mejor.guna : mejor.espanol
}

// ---------- Traducción palabra por palabra de una oración ----------
function palabraAPalabra(texto, direccion) {
  const palabras = [...texto.matchAll(/\p{L}+(?:-\p{L}+)*/gu)]
  const salida = []
  let pos = 0
  let i = 0
  while (i < palabras.length) {
    let hallazgo = null
    for (const n of [3, 2, 1]) {
      const grupo = palabras.slice(i, i + n)
      if (grupo.length < n) continue
      let juntas = true
      for (let k = 1; k < n; k++) {
        const entre = texto.slice(grupo[k - 1].index + grupo[k - 1][0].length, grupo[k].index)
        if (!/^[ ,¿¡]+$/.test(entre)) juntas = false
      }
      if (!juntas) continue
      const frase = limpiar(grupo.map((g) => g[0]).join(' '))
      const opciones = buscarPalabra(frase, direccion, n === 1)
      if (opciones) { hallazgo = { n, grupo, opciones }; break }
    }
    const inicio = palabras[i].index
    if (inicio > pos) salida.push({ texto: texto.slice(pos, inicio), traducido: false })
    if (hallazgo) {
      const ultima = hallazgo.grupo[hallazgo.n - 1]
      const original = texto.slice(inicio, ultima.index + ultima[0].length)
      salida.push({
        texto: conMayuscula(original, hallazgo.opciones[0]),
        traducido: true,
        alternativas: hallazgo.opciones.join(' / '),
      })
      pos = ultima.index + ultima[0].length
      i += hallazgo.n
    } else {
      salida.push({ texto: palabras[i][0], traducido: false })
      pos = inicio + palabras[i][0].length
      i += 1
    }
  }
  if (pos < texto.length) salida.push({ texto: texto.slice(pos), traducido: false })
  return salida
}

// ---------- Función principal ----------
export function traducirTexto(texto, direccion = 'es-guna') {
  // [oración, espacios, oración, espacios, ...]
  const partes = texto.split(/(?<=[.;:?!])(\s+)/)
  const oraciones = partes.filter((_, i) => i % 2 === 0)
  const espacios = partes.filter((_, i) => i % 2 === 1)
  const salida = []
  let i = 0
  while (i < oraciones.length) {
    let usada = 0
    for (let k = Math.min(8, oraciones.length - i); k >= 1; k--) {
      const traduccion = buscarSegmento(oraciones.slice(i, i + k).join(' '), direccion)
      if (traduccion) {
        salida.push({ texto: traduccion, traducido: true, esFrase: true })
        usada = k
        break
      }
    }
    if (usada) {
      i += usada
      if (espacios[i - 1]) salida.push({ texto: espacios[i - 1], traducido: false })
    } else {
      salida.push(...palabraAPalabra(oraciones[i], direccion))
      if (espacios[i]) salida.push({ texto: espacios[i], traducido: false })
      i += 1
    }
  }
  return salida.map((e, id) => ({ ...e, id }))
}