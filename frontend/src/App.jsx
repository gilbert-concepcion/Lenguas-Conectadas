import { useState } from 'react'
import { traducirTexto } from './traductor'
import './App.css'
import logo from './assets/Raiza1.svg'


import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).toString()

const TUTOR_URL = 'http://localhost:3001/api/tutor'

const NOMBRE_FUENTE = {
  claude: 'Claude (con internet)',
  ollama: 'IA local Ollama (sin internet)',
  diccionario: 'Solo diccionario (la IA no respondió)',
}

function App() {
  const [direccion, setDireccion] = useState('es-guna')
  const [textoEntrada, setTextoEntrada] = useState('')
  const [elementosTraducidos, setElementosTraducidos] = useState([])
  const [respuestaTutor, setRespuestaTutor] = useState(null)
  const [cargandoTutor, setCargandoTutor] = useState(false)
  const [preguntaChat, setPreguntaChat] = useState('')

  const traducirLocal = async (textoABuscar = textoEntrada) => {
  if (!textoABuscar.trim()) {
    setElementosTraducidos([{ id: 0, texto: 'Por favor, escribe o sube un documento primero.', traducido: false }])
    return
  }
  setElementosTraducidos([{ id: 0, texto: 'Traduciendo...', traducido: false }])
  setElementosTraducidos(await traducirTexto(textoABuscar, direccion))
}

  const consultarTutor = async (modo, pregunta = '') => {
    if (!textoEntrada.trim()) {
      setRespuestaTutor({ respuesta: 'Primero escribe o sube un documento.', fuente: '', vocabulario: [] })
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
            .map(item => item.str + (item.hasEOL ? '\n' : ' '))
            .join('')
          textoExtraido += textoPagina + '\n'
        }

        if (textoExtraido.trim().length === 0) {
          setTextoEntrada('El PDF no contiene texto plano extraíble (podría ser una imagen escaneada).')
          setElementosTraducidos([{ id: 0, texto: 'No se encontraron caracteres seleccionables.', traducido: false }])
          return
        }

        setTextoEntrada(textoExtraido)
        traducirLocal(textoExtraido)

      } catch (error) {
        console.error(error)
      setTextoEntrada('Error al leer el PDF: ' + (error?.message || String(error)))
        setElementosTraducidos([{ id: 0, texto: 'Ocurrió un problema al procesar el archivo localmente.', traducido: false }])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="app-container">
     <div className="app-header">
      <img src={logo} alt="Logo RAIZIA" className="app-logo-img" />
  <h1 className="tricolor-title">
    <span className="part-blue">RAI</span>
    <span className="part-white">ZI</span>
    <span className="part-red">A</span>
  </h1>
  <p className="app-slogan">Tu lengua, tu raíz, tu identidad</p>
  <div className="app-pilares">
    <span>Conectando idiomas</span>
    <span>Preservando raíces</span>
    <span>Construyendo conocimientos</span>
  </div>
  <p className="app-subtitle"></p>
</div>

      <div className="dashboard-grid">
        <div className="selector-box">
          <label><strong> Dirección del Idioma:</strong></label>
          <select value={direccion} onChange={(e) => setDireccion(e.target.value)}>
            <option value="es-guna">Español a Dulegaya (Guna)</option>
            <option value="guna-es">Dulegaya (Guna) a Español</option>
          </select>
        </div>

        <div className="field-group">
          <label><strong>Cargar Material Escolar (PDF o TXT):</strong></label>
          <input type="file" id="pdf-file" accept=".pdf,.txt" onChange={handlePdfUpload} />
        </div>
      </div>

      <div className="field-group" style={{ marginBottom: '25px' }}>
        <label><strong>Texto extraído o digitado manualmente:</strong></label>
        <textarea
          value={textoEntrada}
          onChange={(e) => setTextoEntrada(e.target.value)}
          placeholder="El texto de tu PDF aparecerá aquí, o puedes escribir libremente para traducir..."
        />
      </div>

      <button className="btn-translate" onClick={() => traducirLocal()}>
        <span></span> Traducir Contenido Ahora
      </button>

      <div className="output-box">
        <div className="output-title">
          <span></span> <label><strong>Resultado de la Traducción Local:</strong></label>
        </div>
<div className="output-text" style={{ whiteSpace: 'pre-wrap' }}>
  {elementosTraducidos.length === 0 ? (
    <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>El resultado traducido aparecerá aquí automáticamente...</span>
  ) : (
    elementosTraducidos.map((item) => (
      <span
        key={item.id}
        title={item.alternativas}
        style={{ color: 'inherit', fontWeight: item.traducido ? 700 : 400 }}
      >
        {item.texto}
      </span>
    ))
  )}
      </div>
    </div>

      {/* ---------- Tutor con IA ---------- */}
      <div className="field-group" style={{ marginTop: '25px' }}>
        <label><strong>Tutor con IA:</strong></label>
        <button className="btn-translate" style={{ marginTop: '10px' }} disabled={cargandoTutor} onClick={() => consultarTutor('explicar')}>
          Explicar el documento
        </button>
        <button className="btn-translate" style={{ marginTop: '10px' }} disabled={cargandoTutor} onClick={() => consultarTutor('ensenar')}>
          Enseñar las palabras en guna
        </button>
        <button className="btn-translate" style={{ marginTop: '10px' }} disabled={cargandoTutor} onClick={() => consultarTutor('preguntas')}>
          Preguntas de práctica
        </button>
        <input
          type="text"
          value={preguntaChat}
          onChange={(e) => setPreguntaChat(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && preguntaChat.trim()) consultarTutor('chat', preguntaChat) }}
          placeholder="Pregúntale algo al tutor sobre el documento..."
          style={{ width: '100%', padding: '10px', marginTop: '10px', boxSizing: 'border-box' }}
        />
        <button className="btn-translate" style={{ marginTop: '10px' }} disabled={cargandoTutor || !preguntaChat.trim()} onClick={() => consultarTutor('chat', preguntaChat)}>
          Preguntar
        </button>
      </div>

      {(cargandoTutor || respuestaTutor) && (
        <div className="output-box">
          <div className="output-title">
            <label><strong>Respuesta del tutor:</strong></label>
          </div>
          <div className="output-text" style={{ whiteSpace: 'pre-wrap' }}>
            {cargandoTutor
              ? 'El tutor está pensando... (la primera respuesta puede tardar un poco)'
              : respuestaTutor.respuesta}
          </div>
          {!cargandoTutor && respuestaTutor?.fuente && (
            <p style={{ fontSize: '0.85em', marginTop: '8px' }}>
              Fuente: {NOMBRE_FUENTE[respuestaTutor.fuente] || respuestaTutor.fuente}
            </p>
          )}
                    {!cargandoTutor && respuestaTutor?.vocabulario?.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <strong>Vocabulario en guna encontrado en el documento:</strong>
              <ul>
                {respuestaTutor.vocabulario.map((v) => (
                  <li key={v.espanol}>
                    {v.espanol} → <strong>{v.guna.join(' / ')}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      )}
    </div>
  )
}

export default App