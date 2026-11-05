import diccionario from '../../diccionario/guna_dictionary.json'
import parrafos from '../../diccionario/parrafos.json'
import ollama from 'ollama/browser'

// ======================================
// 1. NORMALIZACIÓN
// ======================================

const sinTildes = (texto) =>
    texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const limpiar = (texto) =>
    texto
        .replace(/\*\*/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const normalizar = (texto) => sinTildes(limpiar(texto))

// ======================================
// 2. ÍNDICES DEL DICCIONARIO
// ======================================

const esGuna = new Map()
const gunaEs = new Map()

let longitudMaxima = 1

function agregar(mapa, clave, valor) {
    if (!clave || !valor) return

    if (!mapa.has(clave)) {
        mapa.set(clave, [])
    }

    const lista = mapa.get(clave)

    if (!lista.includes(valor)) {
        lista.push(valor)
    }
}

// Construcción de los índices

for (const entrada of diccionario) {

    const { espanol, guna } = entrada

    if (!espanol || !guna) continue

    const claveGuna = normalizar(guna)

    // Español -> Guna

    const significados = espanol
        .split(',')
        .map(x => normalizar(x))
        .filter(Boolean)

    for (const significado of significados) {

        agregar(esGuna, significado, guna)

        const cantidad = significado.split(' ').length

        if (cantidad > longitudMaxima) {
            longitudMaxima = cantidad
        }
    }

    // Guna -> Español

    for (const significado of significados) {
        agregar(gunaEs, claveGuna, significado)
    }

    const cantidadGuna = claveGuna.split(' ').length

    if (cantidadGuna > longitudMaxima) {
        longitudMaxima = cantidadGuna
    }
}

// ======================================
// 3. BÚSQUEDA DE PALABRAS
// ======================================

function buscarPalabra(frase, direccion) {

    const clave = normalizar(frase)

    if (!clave) return null

    if (direccion === 'guna-es') {
        return gunaEs.get(clave) || null
    }

    return esGuna.get(clave) || null
}

// ======================================
// 4. MEMORIA DE PÁRRAFOS
// ======================================

const segmentos = []

for (const p of parrafos) {

    if (!p.espanol || !p.guna) continue

    segmentos.push({
        espanol: normalizar(p.espanol),
        guna: normalizar(p.guna),
        originalEspanol: p.espanol,
        originalGuna: p.guna
    })
}

// Buscar únicamente coincidencias exactas

function buscarSegmento(texto, direccion) {

    const clave = normalizar(texto)

    const segmento = segmentos.find(s => {

        return direccion === 'es-guna'
            ? s.espanol === clave
            : s.guna === clave

    })

    if (!segmento) return null

    return direccion === 'es-guna'
        ? segmento.originalGuna
        : segmento.originalEspanol
}

// ======================================
// 5. TRADUCCIÓN DE EXPRESIONES
// ======================================

function palabraAPalabra(texto, direccion) {

    const palabras = [
        ...texto.matchAll(/[\p{L}]+(?:-[\p{L}]+)*/gu)
    ]

    const salida = []

    let posicion = 0
    let indice = 0

    while (indice < palabras.length) {

        const actual = palabras[indice]

        const inicio = actual.index

        // Conservar espacios y signos

        if (inicio > posicion) {
            salida.push({
                texto: texto.slice(posicion, inicio),
                traducido: false
            })
        }

        let mejorTraduccion = null
        let mejorCantidad = 0

        // Buscar primero las expresiones más largas

        for (
            let cantidad = Math.min(
                longitudMaxima,
                palabras.length - indice
            );
            cantidad >= 1;
            cantidad--
        ) {

            const grupo = palabras
                .slice(indice, indice + cantidad)

            const fin = grupo[grupo.length - 1].index +
                grupo[grupo.length - 1][0].length

            const frase = texto.slice(inicio, fin)

            const opciones = buscarPalabra(frase, direccion)

            if (opciones) {

                mejorTraduccion = opciones
                mejorCantidad = cantidad

                break
            }
        }

        if (mejorTraduccion) {

            const grupo = palabras.slice(
                indice,
                indice + mejorCantidad
            )

            const fin = grupo[grupo.length - 1].index +
                grupo[grupo.length - 1][0].length

            const original = texto.slice(inicio, fin)

            const traduccion = mejorTraduccion[0]

            const resultado = /^\p{Lu}/u.test(original)
                ? traduccion.charAt(0).toUpperCase() +
                  traduccion.slice(1)
                : traduccion

            salida.push({
                texto: resultado,
                traducido: true,
                alternativas: mejorTraduccion.join(' / ')
            })

            posicion = fin
            indice += mejorCantidad

        } else {

            salida.push({
                texto: actual[0],
                traducido: false
            })

            posicion = inicio + actual[0].length
            indice++
        }
    }

    // Conservar el contenido restante

    if (posicion < texto.length) {

        salida.push({
            texto: texto.slice(posicion),
            traducido: false
        })
    }

    return salida
}

// ======================================
// 6. FUNCIÓN PRINCIPAL
// ======================================

export async function traducirTexto(
    texto,
    direccion = 'es-guna'
) {
    if (!texto || !texto.trim()) {
        return []
    }

    // 1. Primero buscamos si el párrafo exacto ya está en parrafos.json
    const segmento = buscarSegmento(texto, direccion)
    if (segmento) {
        return [{
            id: 0,
            texto: segmento,
            traducido: true,
            esFrase: true
        }]
    }

    // 2. Si no es un párrafo exacto, extraemos el vocabulario usando tu función
    const analisisPalabras = palabraAPalabra(texto, direccion)
    // Español -> Guna: solo diccionario, sin IA, para no inventar palabras
if (direccion === 'es-guna') {
    return analisisPalabras.map((item, id) => ({ ...item, id }))
}
    
    // Filtramos e hilamos solo las palabras que tu diccionario SÍ logró traducir
    const vocabularioDetectado = analisisPalabras
        .filter(item => item.traducido)
        .map(item => `"${item.texto}" (${direccion === 'guna-es' ? 'español' : 'guna'})`)
        .join(', ')

    // 3. Configuramos las instrucciones sintácticas para Ollama según la dirección
    let instruccionesSistema = ""

    if (direccion === 'guna-es') {
        instruccionesSistema = `
        Eres un traductor experto del idioma Guna al español fluido.
        Tu tarea es recibir un párrafo en Guna y redactarlo en un español natural, correcto y perfectamente hilado.

        Vocabulario clave detectado por el sistema: [ ${vocabularioDetectado} ]

        REGLAS DE SINTAXIS FLUIDA:
        1. REORDENACIÓN DE VERBOS: El Guna coloca el verbo al final. Debes mover obligatoriamente los verbos a su posición intermedia natural en español (Sujeto + Verbo + Objeto).
        2. SUFIJOS LOCATIVOS: En Guna el sufijo "gi" equivale a la preposición "en". Por ejemplo, "diwala gi" se traduce como "en el río".
        3. ARTÍCULOS: Añade los artículos necesarios (el, la, los, las, un, una) que hagan falta para que la lectura sea natural.

        Devuelve exclusivamente el párrafo final en español. No añadas notas, comentarios ni saludos.
        `
    } else {
        instruccionesSistema = `
        Eres un traductor experto del español al idioma Guna (Dulegaya).
        Tu tarea es recibir un párrafo en español y traducirlo respetando la gramática nativa Guna.

        Vocabulario clave detectado por el sistema: [ ${vocabularioDetectado} ]

        REGLAS DE SINTAXIS GUNA:
        1. VERBO AL FINAL: Asegúrate de colocar el verbo o la acción al final de cada oración gramatical.
        2. SUFIJOS: Integra las preposiciones como "en" convirtiéndolas en el sufijo "gi" acoplado al final del sustantivo.

        Devuelve exclusivamente el párrafo final en Guna. No añadas introducciones ni explicaciones.
        `
    }

    // 4. Ejecutamos la llamada a Ollama para que aplique la fluidez
    try {
        const respuesta = await ollama.chat({
            model: 'llama3.2', // Modifica este nombre si usas otro modelo en Ollama
            messages: [
                { role: 'system', content: instruccionesSistema },
                { role: 'user', content: texto }
            ],
            options: {
                temperature: 0.15
            }
        })

        const parrafoFluido = respuesta.message.content.trim()

        return [{
            id: 0,
            texto: parrafoFluido,
            traducido: true,
            esFrase: true
        }]

    } catch (error) {
        console.error("Error en Ollama, usando fallback literal:", error)
        
        // Si Ollama está apagado o falla, devuelve tu mapeo original palabra por palabra
        return analisisPalabras.map((item, id) => ({
            ...item,
            id
        }))
    }
}