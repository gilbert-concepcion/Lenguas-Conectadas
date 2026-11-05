import { useEffect, useState } from 'react'
import { traducirTexto } from './traductor'
import Login, { obtenerSesion, cerrarSesion } from './Login'
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

const TUTOR_URL = 'http://localhost:3001/api/tutor'

const NOMBRE_FUENTE = {
  claude: 'Claude (con internet)',
  ollama: 'IA local Ollama (sin internet)',
  diccionario: 'Solo diccionario (la IA no respondió)',
}

const ICONO = {
  traducir: 'M4 5h8M8 3v2M6 5c0 4 2 7 5 8M10 5c0 3-2 6-5 8M13 19l4-10 4 10M14.5 16h5',
  tutor: 'M4 5h16v11H9l-5 4z',
  cuenta: 'M12 4a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM4 21c0-4 4-6 8-6s8 2 8 6',
  descargar: 'M12 4v12m0 0l-4-4m4 4l4-4M5 20h14',
  subir: 'M12 16V4m0 0l-4 4m4-4l4 4M5 20h14',
}

function Icono({ d }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

function App() {
  const [sesion, setSesion] = useState(obtenerSesion())
  const [pestana, setPestana] = useState('traducir')
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [direccion, setDireccion] = useState('es-guna')
  const [textoEntrada, setTextoEntrada] = useState('')
  const [elementosTraducidos, setElementosTraducidos] = useState([])
  const [listo, setListo] = useState(false)
  const [traduciendo, setTraduciendo] = useState(false)
  const [respuestaTutor, setRespuestaTutor] = useState(null)
  const [cargandoTutor, setCargandoTutor] = useState(false)
  const [preguntaChat, setPreguntaChat] = useState('')

  useEffect(() => {
    const alCambiar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', alCambiar)
    window.addEventListener('offline', alCambiar)
    return () => {
      window.removeEventListener('online', alCambiar)
      window.removeEventListener('offline', alCambiar)
    }
  }, [])

  const traducirLocal = async (textoABuscar = textoEntrada) => {
    if (!textoABuscar.trim()) {
      setElementosTraducidos([{ id: 0, texto: 'Por favor, escribe o sube un documento primero.', traducido: false }])
      setListo(false)
      return
    }
    setTraduciendo(true)
    setListo(false)
    try {
      const resultado = await traducirTexto(textoABuscar, direccion)
      setElementosTraducidos(resultado)
      setListo(resultado.length > 0)
    } catch (error) {
      console.error(error)
      setElementosTraducidos([{ id: 0, texto: 'Ocurrió un problema al traducir. Intenta de nuevo.', traducido: false }])
    } finally {
      setTraduciendo(false)
    }
  }

  const descargarTraduccion = () => {
    const contenido = elementosTraducidos.map((e) => e.texto).join('')
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = direccion === 'es-guna' ? 'traduccion-espanol-guna.txt' : 'traduccion-guna-espanol.txt'
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    URL.revokeObjectURL(url)
  }

  const consultarTutor = async (modo, pregunta = '') => {
    if (!textoEntrada.trim()) {
      setRespuestaTutor({ respuesta: 'Primero escribe o sube un documento en la pestaña Traducir.', fuente: '', vocabulario: [] })
      return
    }
    setCargandoTutor(true)
    setRespuestaTutor(null)
    try {
      const r = await fetch(TUTOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo, texto: textoEntrada, pregunta }),
      })
      if (!r.ok) throw new Error(`El tutor respondió ${r.status}`)
      setRespuestaTutor(await r.json())
    } catch (error) {
      console.error(error)
      setRespuestaTutor({
        respuesta: 'No pude conectar con el tutor. Revisa que el servidor siga encendido en la otra terminal (npm.cmd start).',
        fuente: '',
        vocabulario: [],
      })
    } finally {
      setCargandoTutor(false)
    }
  }

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain') {
      const texto = await file.text()
      setTextoEntrada(texto)
      traducirLocal(texto)
      return
    }

    if (file.type !== 'application/pdf') {
      alert('Por favor, sube un archivo PDF o TXT válido.')
      return
    }

    setTextoEntrada('Procesando texto del archivo PDF localmente...')
    setElementosTraducidos([{ id: 0, texto: 'Leyendo documento offline de forma segura...', traducido: false }])
    setListo(false)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const typedarray = new Uint8Array(event.target.result)
        const loadingTask = pdfjsLib.getDocument({ data: typedarray })
        const pdf = await loadingTask.promise
        let textoExtraido = ''

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const textoPagina = textContent.items
            .map((item) => item.str + (item.hasEOL ? '\n' : ' '))
            .join('')
          textoExtraido += textoPagina + '\n'
        }

        if (textoExtraido.trim().length === 0) {
          setTextoEntrada('El PDF no contiene texto plano extraíble (podría ser una imagen escaneada).')
          setElementosTraducidos([{ id: 0, texto: 'No se encontraron caracteres seleccionables.', traducido: false }])
          setListo(false)
          return
        }

        setTextoEntrada(textoExtraido)
        traducirLocal(textoExtraido)
      } catch (error) {
        console.error(error)
        setTextoEntrada('Error al decodificar el archivo PDF.')
        setElementosTraducidos([{ id: 0, texto: 'Ocurrió un problema al procesar el archivo localmente.', traducido: false }])
        setListo(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const salir = () => {
    cerrarSesion()
        setSesion(null)
  }

  // Los hooks siempre van antes de este return
  if (!sesion) return <Login onLogin={setSesion} />

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">
          <img src="/logo.svg" alt="Logo RAIZIA" />
        </div>
        <div className="header-text">
          <h1>RAIZIA</h1>
          <p>Rompiendo la barrera del idioma</p>
        </div>
        <span className={`estado-pill ${enLinea ? 'online' : 'offline'}`}>
          <span className="dot" />
          {enLinea ? 'En línea' : 'Sin conexión'}
        </span>
      </header>
      <div className="flag-bar" />

      <main className="app-content">
        {pestana === 'traducir' && (
          <section className="pestana">
            <div className="card">
              <h2 className="card-title">Dirección del idioma</h2>
              <div className="segmento">
                <button className={direccion === 'es-guna' ? 'activo' : ''} onClick={() => setDireccion('es-guna')}>
                  Español a Guna
                </button>
                <button className={direccion === 'guna-es' ? 'activo' : ''} onClick={() => setDireccion('guna-es')}>
                  Guna a Español
                </button>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Material escolar</h2>
              <label htmlFor="pdf-file" className="subir">
                <Icono d={ICONO.subir} />
                Cargar PDF o TXT
              </label>
              <input type="file" id="pdf-file" accept=".pdf,.txt" onChange={handlePdfUpload} hidden />
              <textarea
                value={textoEntrada}
                onChange={(e) => setTextoEntrada(e.target.value)}
                placeholder="El texto de tu PDF aparecerá aquí, o puedes escribir libremente para traducir..."
              />
              <button className="btn btn-primario" disabled={traduciendo} onClick={() => traducirLocal()}>
                {traduciendo ? 'Traduciendo...' : 'Traducir ahora'}
              </button>
            </div>

            <div className="card">
              <h2 className="card-title">Resultado de la traducción</h2>
              <div className="resultado">
                {traduciendo ? (
                  <span className="placeholder">Traduciendo, puede tardar unos segundos...</span>
                ) : elementosTraducidos.length === 0 ? (
                  <span className="placeholder">El resultado traducido aparecerá aquí automáticamente...</span>
                ) : (
                  elementosTraducidos.map((item) => (
                    <span key={item.id} title={item.alternativas}>
                      {item.texto}
                    </span>
                  ))
                )}
              </div>
              <button className="btn btn-exito" disabled={!listo || traduciendo} onClick={descargarTraduccion}>
                <Icono d={ICONO.descargar} />
                Descargar traducción
              </button>
            </div>
          </section>
        )}

        {pestana === 'tutor' && (
          <section className="pestana">
            <div className="card">
              <h2 className="card-title">Tutor con IA</h2>
              <p className="ayuda">El tutor trabaja con el texto que cargaste en la pestaña Traducir.</p>
              <div className="tutor-acciones">
                <button className="btn btn-claro" disabled={cargandoTutor} onClick={() => consultarTutor('explicar')}>
                  Explicar el documento
                </button>
                <button className="btn btn-claro" disabled={cargandoTutor} onClick={() => consultarTutor('ensenar')}>
                  Enseñar las palabras en guna
                </button>
                <button className="btn btn-claro" disabled={cargandoTutor} onClick={() => consultarTutor('preguntas')}>
                  Preguntas de práctica
                </button>
              </div>
              <div className="chat-fila">
                <input
                  type="text"
                  value={preguntaChat}
                  onChange={(e) => setPreguntaChat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && preguntaChat.trim()) consultarTutor('chat', preguntaChat)
                  }}
                  placeholder="Pregúntale algo al tutor..."
                />
                <button
                  className="btn btn-primario btn-enviar"
                  disabled={cargandoTutor || !preguntaChat.trim()}
                  onClick={() => consultarTutor('chat', preguntaChat)}
                >
                  Enviar
                </button>
              </div>
            </div>

            {(cargandoTutor || respuestaTutor) && (
              <div className="card">
                <h2 className="card-title">Respuesta del tutor</h2>
                <div className="resultado">
                  {cargandoTutor
                    ? 'El tutor está pensando... (la primera respuesta puede tardar un poco)'
                    : respuestaTutor.respuesta}
                </div>
                {!cargandoTutor && respuestaTutor?.fuente && (
                  <p className="ayuda">Fuente: {NOMBRE_FUENTE[respuestaTutor.fuente] || respuestaTutor.fuente}</p>
                )}
                {!cargandoTutor && respuestaTutor?.vocabulario?.length > 0 && (
                  <div className="vocabulario">
                    <strong>Vocabulario en guna encontrado en el documento:</strong>
                    <ul>
                      {respuestaTutor.vocabulario.map((v) => (
                        <li key={v.espanol}>
                          {v.espanol}: <strong>{v.guna.join(' / ')}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {pestana === 'cuenta' && (
          <section className="pestana">
            <div className="card centro">
              <div className="avatar">{sesion.charAt(0).toUpperCase()}</div>
              <p className="usuario">{sesion}</p>
              <p className="slogan-cuenta">Rompiendo la barrera del idioma</p>
            </div>

            <div className="card">
              <h2 className="card-title">Estado de la app</h2>
              <p className="ayuda">
                {enLinea ? 'Conectado a internet.' : 'Sin conexión a internet.'} El traductor y la lectura de PDF
                funcionan siempre sin conexión. El tutor con IA necesita que el servidor esté encendido.
              </p>
              <button className="btn btn-rojo" onClick={salir}>
                Cerrar sesión
              </button>
            </div>

            <p className="pie">Reto 06 - hack4edu</p>
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        {[
          ['traducir', 'Traducir'],
          ['tutor', 'Tutor'],
          ['cuenta', 'Cuenta'],
        ].map(([id, etiqueta]) => (
          <button
            key={id}
            className={`nav-item ${pestana === id ? 'activo' : ''}`}
            onClick={() => setPestana(id)}
          >
            <Icono d={ICONO[id]} />
            <span>{etiqueta}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App