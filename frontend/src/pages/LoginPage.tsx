import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { api, mensajeDeError } from '../compartido/api';
import { useSesion, type DatosSesion } from '../compartido/sesionContext';
import { panelInicial } from '../compartido/layout/menu';
import './login.css';

type Sucursal = { id: number; name: string };
type Respuesta = { sesion: DatosSesion } | { sucursales: Sucursal[] };

export function LoginPage() {
  const { sesion, cargando, establecer } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursal, setSucursal] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (cargando) return <main role="status">Verificando sesión…</main>;
  if (sesion) return <Navigate to={panelInicial(sesion.permisos)} replace />;
  const elegir = sucursales.length > 0;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (elegir ? !sucursal : !usuario.trim() || !clave) {
      setError(elegir ? 'Selecciona una sucursal.' : 'Ingresa tu usuario y contraseña.');
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const { data } = elegir
        ? await api.post<Respuesta>('/auth/sucursal', { sucursalId: Number(sucursal) })
        : await api.post<Respuesta>('/auth/login', { usuario: usuario.trim(), clave });
      setClave('');
      if ('sesion' in data) establecer(data.sesion);
      else setSucursales(data.sucursales);
    } catch (err) {
      if (elegir && isAxiosError(err) && err.response?.status === 401) {
        setSucursales([]);
        setSucursal('');
      }
      setError(mensajeDeError(err));
    } finally { setOcupado(false); }
  }

  return <main className="sl-acceso"><section aria-labelledby="titulo-login">
    <div className="sl-acceso-marca">SoftLab</div>
    <h1 id="titulo-login">{elegir ? 'Selecciona tu sucursal' : 'Iniciar sesión'}</h1>
    <form onSubmit={enviar} aria-busy={ocupado}>
      {elegir ? <label>Sucursal
        <select value={sucursal} onChange={e => setSucursal(e.target.value)} required disabled={ocupado}>
          <option value="">Elige dónde vas a trabajar</option>
          {sucursales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label> : <>
        <label>Usuario (correo electrónico)<input type="email" autoComplete="username" required maxLength={150}
          value={usuario} onChange={e => setUsuario(e.target.value)} disabled={ocupado}/></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required maxLength={256}
          value={clave} onChange={e => setClave(e.target.value)} disabled={ocupado}/></label>
      </>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={ocupado}>{ocupado ? 'Verificando…' : elegir ? 'Entrar al panel' : 'Iniciar sesión'}</button>
      {elegir && <button type="button" disabled={ocupado} onClick={() => {
        setSucursales([]); setSucursal(''); setError('');
      }}>Volver al inicio de sesión</button>}
    </form>
  </section></main>;
}
