import { useState } from "react";
import "./Login.css";

const USERS_KEY = "razia_users";
const SESSION_KEY = "razia_session";

const leerUsuarios = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
};

const hash = async (texto) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const obtenerSesion = () => localStorage.getItem(SESSION_KEY);
export const cerrarSesion = () => localStorage.removeItem(SESSION_KEY);

export default function Login({ onLogin }) {
  const [modo, setModo] = useState("login");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [logoOk, setLogoOk] = useState(true);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    const nombre = usuario.trim().toLowerCase();
    if (nombre.length < 3) return setError("El usuario debe tener al menos 3 caracteres");
    if (clave.length < 4) return setError("La clave debe tener al menos 4 caracteres");

    const usuarios = leerUsuarios();
    const claveHash = await hash(clave);

    if (modo === "registro") {
      if (usuarios[nombre]) return setError("Ese usuario ya existe");
      usuarios[nombre] = claveHash;
      localStorage.setItem(USERS_KEY, JSON.stringify(usuarios));
    } else if (usuarios[nombre] !== claveHash) {
      return setError("Usuario o clave incorrectos");
    }

    localStorage.setItem(SESSION_KEY, nombre);
    onLogin(nombre);
  };

  return (
    <div className="login-screen">
      <div className="login-blob blob-a" />
      <div className="login-blob blob-b" />

      <div className="login-card">
        {/* Para usar tu logo, reemplaza frontend/public/logo.svg */}
        <div className="login-logo">
          {logoOk ? (
            <img src="/logo.svg" alt="Logo" onError={() => setLogoOk(false)} />
          ) : (
            <span>R</span>
          )}
        </div>

        <h1 className="login-title">
          <span className="part-blue">RAI</span>
          <span className="part-white">ZI</span>
          <span className="part-red">A</span>
        </h1>
        <p className="login-slogan">Rompiendo la barrera del idioma</p>

        <form onSubmit={enviar}>
          <input
            type="text"
            placeholder="Usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Clave"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete={modo === "login" ? "current-password" : "new-password"}
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn">
            {modo === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          className="login-switch"
          onClick={() => {
            setModo(modo === "login" ? "registro" : "login");
            setError("");
          }}
        >
          {modo === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>

        <p className="login-footer">Reto 06 - hack4edu - Funciona sin conexión</p>
      </div>
    </div>
  );
}