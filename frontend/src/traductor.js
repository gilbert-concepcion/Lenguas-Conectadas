import diccionario from '../../diccionario/guna_dictionary.json'
import parrafos from '../../diccionario/parrafos.json'

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

export function traducirTexto(
    texto,
    direccion = 'es-guna'
) {

    if (!texto || !texto.trim()) {
        return []
    }

    // Primero buscar el párrafo completo

    const segmento = buscarSegmento(texto, direccion)

    if (segmento) {

        return [{
            id: 0,
            texto: segmento,
            traducido: true,
            esFrase: true
        }]
    }

    // Si no existe, traducir expresiones y palabras

    const resultado = palabraAPalabra(texto, direccion)

    return resultado.map((item, id) => ({
        ...item,
        id
    }))
}