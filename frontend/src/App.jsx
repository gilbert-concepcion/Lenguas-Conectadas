import { useState } from 'react'

// Importamos el archivo JSON de tu companero
import diccionario from '../diccionario/guna_dictionary.json'

function App() {
  const [direccion, setDireccion] = useState('es-guna')
  const [textoEntrada, setTextoEntrada] = useState('')
  const [textoTraducido, setTextoTraducido] = useState('El resultado aparecera aqui...')

  // Algoritmo de busqueda local en el archivo JSON
  const traducirLocal = () => {
    if (!textoEntrada.trim()) {
      setTextoTraducido('Por favor, escribe algo primero.')
      return
    }

    const palabras = textoEntrada.toLowerCase().split(/\s+/)
    let resultado = []

    if (direccion === 'es-guna') {
      // Traducir de Espanol a Guna
      palabras.forEach(palabra => {
        const limpia = palabra.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")
        if (diccionario[limpia]) {
          resultado.push(diccionario[limpia])
        } else {
          resultado.push(`[${palabra}]`)
        }
      })
    } else {
      // Traducir de Guna a Espanol (Busqueda inversa)
      palabras.forEach(palabra => {
        const limpia = palabra.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")
        const encontrado = Object.keys(diccionario).find(key => diccionario[key].toLowerCase() === limpia)
        if (encontrado) {
          resultado.push(encontrado)
        } else {
          resultado.push(`[${palabra}]`)
        }
      })
    }

    setTextoTraducido(resultado.join(' '))
  }

  const handlePdfUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setTextoEntrada('Procesando texto del archivo PDF localmente...')
      setTextoTraducido('Leyendo documento offline...')
    }
  }

  return (
    <div className="app-container">
      <h1>Traductor Espanol - Guna</h1>
      <p style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '-15px' }}>Reto 06 - hack4edu</p>
      
      <div className="selector-box">
        <label><strong>Direccion:</strong></label>
        <select value={direccion} onChange={(e) => setDireccion(e.target.value)}>
          <option value="es-guna">Espanol a Guna</option>
          <option value="guna-es">Guna a Espanol</option>
        </select>
      </div>

      <div className="field-group">
        <label><strong>Sube un documento PDF:</strong></label>
        <input type="file" id="pdf-file" accept=".pdf" onChange={handlePdfUpload} />
      </div>

      <div className="field-group">
        <label><strong>O escribe el texto aqui:</strong></label>
        <textarea 
          value={textoEntrada} 
          onChange={(e) => setTextoEntrada(e.target.value)} 
          placeholder="Escribe palabras para traducir..."
        />
      </div>

      <button className="btn-translate" onClick={traducirLocal}>Traducir Ahora</button>

      <div className="output-box">
        <label><strong>Traduccion:</strong></label>
        <p className="output-text">{textoTraducido}</p>
      </div>
    </div>
  )
}

export default App