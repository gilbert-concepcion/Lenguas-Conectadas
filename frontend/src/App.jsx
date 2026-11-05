import { useState } from 'react'
import diccionario from '../../diccionario/guna_dictionary.json'
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

function App() {
  const [direccion, setDireccion] = useState('es-guna')
  const [textoEntrada, setTextoEntrada] = useState('')
  const [elementosTraducidos, setElementosTraducidos] = useState([])

  const traducirLocal = (textoABuscar = textoEntrada) => {
    if (!textoABuscar.trim()) {
      setElementosTraducidos([{ texto: 'Por favor, escribe o sube un documento primero.', traducido: false }])
      return
    }

    const palabras = textoABuscar.split(/(\s+)/)
    let resultadoEstructurado = []

    palabras.forEach((palabra, index) => {
      const limpia = palabra.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿?¡!]/g,"").trim()
      
      if (!limpia) {
        resultadoEstructurado.push({ id: index, texto: palabra, traducido: false, esEspacio: true })
        return
      }

      const coincidencia = diccionario.find(item => {
        if (direccion === 'es-guna') {
          return item.espanol.toLowerCase() === limpia
        } else {
          return item.guna.toLowerCase() === limpia
        }
      })

      if (coincidencia) {
        const terminoTraducido = direccion === 'es-guna' ? coincidencia.guna : coincidencia.espanol
        resultadoEstructurado.push({ id: index, texto: terminoTraducido, traducido: true })
      } else {
        resultadoEstructurado.push({ id: index, texto: palabra, traducido: false })
      }
    })

    setElementosTraducidos(resultadoEstructurado)
  }

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('Por favor, sube un archivo PDF válido.')
      return
    }

    setTextoEntrada('Procesando texto del archivo PDF localmente...')
    setElementosTraducidos([{ texto: 'Leyendo documento offline de forma segura...', traducido: false }])

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
          const textoPagina = textContent.items.map(item => item.str).join(' ')
          textoExtraido += textoPagina + '\n'
        }

        if (textoExtraido.trim().length === 0) {
          setTextoEntrada('El PDF no contiene texto plano extraíble (podría ser una imagen escaneada).')
          setElementosTraducidos([{ texto: 'No se encontraron caracteres seleccionables.', traducido: false }])
          return
        }

        setTextoEntrada(textoExtraido)
        traducirLocal(textoExtraido)

      } catch (error) {
        console.error(error)
        setTextoEntrada('Error al decodificar el archivo PDF.')
        setElementosTraducidos([{ texto: 'Ocurrió un problema al procesar el archivo localmente.', traducido: false }])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="app-logo">(esperando a Stuffy)</div>
        {/* Título Estructurado en Bloques Tricolor */}
        <h1 className="tricolor-title">
          <span className="part-blue">RAI</span>
          <span className="part-white">ZI</span>
          <span className="part-red">A</span>
        </h1>
        <p className="app-subtitle">Reto 06 — hack4edu</p>
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
          <label><strong>Cargar Material Escolar (PDF):</strong></label>
          <input type="file" id="pdf-file" accept=".pdf" onChange={handlePdfUpload} />
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
                style={{ 
                  backgroundColor: item.traducido ? 'var(--warm-gold)' : 'transparent',
                  color: '#000000',
                  fontWeight: item.traducido ? '700' : '400',
                  padding: item.traducido ? '2px 4px' : '0',
                  borderRadius: item.traducido ? '4px' : '0',
                  transition: 'background-color 0.3s'
                }}
              >
                {item.texto}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App
