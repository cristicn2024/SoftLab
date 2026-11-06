import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { SESION } from '../compartido/sesion';
import { mensajeDeError } from '../features/cobro/cobroApi';
import { ROLES_CON_PERMISO_ESPECIAL } from '../features/cobro/datosCobro';

interface Props { orderId: number; isOpen: boolean; onClose: () => void }

export function ReportViewerModal({ orderId, isOpen, onClose }: Props) {
  const [pdf, setPdf] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [channel, setChannel] = useState('counter');
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setPdf(''); setError(''); setBlocked(false); setReason('');
  }, [orderId, isOpen]);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf); }, [pdf]);
  if (!isOpen) return null;

  async function obtener(excepcion = false) {
    setBusy(true); setError(''); setPdf(''); setBlocked(false);
    try {
      const response = await api.post(`/reports/orders/${orderId}/pdf`, {
        channel, ...(excepcion ? { reason } : {}),
      }, { responseType: 'blob', headers: {
        'x-user-name': encodeURIComponent(SESION.usuario),
        'x-user-role': encodeURIComponent(SESION.rol),
      } });
      setPdf(URL.createObjectURL(response.data));
    } catch (err) {
      const response = (err as { response?: { data?: Blob } }).response;
      if (response?.data instanceof Blob) {
        try {
          const data = JSON.parse(await response.data.text());
          const detalle = data.error;
          const mensaje = typeof detalle === 'string' ? detalle : detalle?.mensaje;
          setError(mensaje || 'No se pudo obtener el informe.'); setBlocked(data.code === 'PAYMENT_REQUIRED');
        } catch { setError('No se pudo obtener el informe.'); }
      } else setError(mensajeDeError(err));
    } finally { setBusy(false); }
  }

  return <div role="dialog" aria-modal="true" aria-label="Entrega de resultados" style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  }}><section style={{ background: 'white', padding: 24, width: '85%', height: '90%', overflow: 'auto' }}>
    <h2>Entrega de resultados · Orden {orderId}</h2>
    <label>Canal <select value={channel} disabled={busy} onChange={e => { setChannel(e.target.value); setPdf(''); }}>
      <option value="counter">Mostrador</option><option value="print">Impresión</option>
      <option value="email">Correo (descargar para adjuntar)</option><option value="portal">Portal</option>
    </select></label>{' '}
    <button disabled={busy} onClick={() => obtener()}>{busy ? 'Verificando…' : 'Obtener resultados'}</button>{' '}
    <button disabled={busy} onClick={onClose}>Cerrar</button>
    {error && <p role="alert">{error}</p>}
    {blocked && <div>
      <Link to={`/ordenes/cobro?orden=${orderId}`} onClick={onClose}>Registrar pago</Link>
      <p>Al liquidar, vuelve a obtener los resultados. Puedes seguir capturando y validando mientras exista saldo.</p>
      {ROLES_CON_PERMISO_ESPECIAL.includes(SESION.rol) && <div>
        <label>Motivo de excepción <textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
        <button disabled={busy || !reason.trim()} onClick={() => obtener(true)}>Autorizar excepción y obtener resultados</button>
      </div>}
    </div>}
    {pdf && <><p>Documento liberado. <a href={pdf} download={`Informe_Orden_${orderId}.pdf`}>Descargar informe</a></p>
      <iframe src={pdf} title="Informe de resultados" style={{ width: '100%', height: '70%', border: 0 }} /></>}
  </section></div>;
}
