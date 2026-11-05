import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface VersionItem {
  id: number;
  version: number;
  name?: string;
  headerText?: string;
  disclaimer?: string;
  chemistName?: string;
  chemistCedula?: string;
  isDefault: boolean;
  createdAt: string;
}

interface NotificationState {
  show: boolean;
  version: number;
  previousVersion: number | null;
}

export const ReportTemplatePage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Estado para la notificación de publicación
  const [notification, setNotification] = useState<NotificationState>({
    show: false,
    version: 0,
    previousVersion: null,
  });

  // Estados de Configuración
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [header, setHeader] = useState('Logotipo · Laboratorio Santa Lucía · Clínica Central');
  const [disclaimer, setDisclaimer] = useState('Resultados válidos solo con firma del responsable sanitario');
  const [signature, setSignature] = useState('Laura Méndez · Cédula 10458392');
  
  // Estado para el Historial de Versiones
  const [versions, setVersions] = useState<VersionItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const historyRes = await api.get('/templates');
      const historyList: VersionItem[] = historyRes.data || [];
      setVersions(historyList);

      if (historyList.length > 0) {
        const active = historyList.find(v => v.isDefault) || historyList[0];
        applyTemplateToForm(active);
      }
    } catch (error) {
      console.error('Error al cargar historial de plantillas:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplateToForm = (item: VersionItem) => {
    setSelectedTemplateId(item.id);
    setHeader(item.headerText || 'Logotipo · Laboratorio Santa Lucía · Clínica Central');
    setDisclaimer(item.disclaimer || 'Resultados válidos solo con firma del responsable sanitario');
    setSignature(`${item.chemistName || 'Laura Méndez'} · Cédula ${item.chemistCedula || '10458392'}`);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    const selected = versions.find(v => v.id === id);
    if (selected) {
      applyTemplateToForm(selected);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const parts = signature.split('· Cédula');
      const chemistName = parts[0]?.trim() || signature;
      const chemistCedula = parts[1]?.trim() || '';

      const response = await api.post('/templates', {
        headerText: header,
        disclaimer,
        chemistName,
        chemistCedula,
      });

      const newVersion = response.data.version;
      const prevVersion = newVersion > 1 ? newVersion - 1 : null;

      // Mostrar banner de notificación de Figma
      setNotification({
        show: true,
        version: newVersion,
        previousVersion: prevVersion,
      });

      await loadData();
    } catch (error) {
      console.error('Error al guardar plantilla:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="sl-pagina">
        <div className="sl-migas">Resultados / Plantillas de informe</div>
        <div style={{ padding: '40px', textAlign: 'center' }}>Cargando plantilla...</div>
      </main>
    );
  }

  return (
    <main className="sl-pagina">
      <div className="sl-migas">Resultados / Plantillas / Biometría hemática</div>

          {/* BANNER DE NOTIFICACIÓN DE FIGMA */}
          {notification.show && (
            <div style={styles.notificationBanner}>
              <div style={styles.notificationIconBox}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1b3b2b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={styles.notificationTitle}>
                  Plantilla publicada · versión {notification.version}
                </div>
                <div style={styles.notificationDesc}>
                  Biometría hemática · Clínica Central. {notification.previousVersion ? `La versión ${notification.previousVersion} pasó a Reemplazada y los` : 'Los'} informes ya emitidos no cambian.
                </div>
              </div>
            </div>
          )}

          <h1 style={{ ...styles.pageTitle, textAlign: 'left' }}>Plantilla de informe</h1>
          <p style={{ ...styles.pageSubtitle, textAlign: 'left' }}>
            {versions.find(v => v.id === selectedTemplateId)
              ? `Plantilla: Biometría hemática · Clínica Central · Versión ${versions.find(v => v.id === selectedTemplateId)?.version}`
              : 'Plantilla de informe'}
          </p>

          {/* SECCIÓN CONFIGURACIÓN */}
          <section style={styles.sectionCard}>
            <h2 style={{ ...styles.sectionTitle, textAlign: 'left' }}>Configuración</h2>
            <p style={{ ...styles.sectionDesc, textAlign: 'left' }}>
              Los cambios de plantilla se versionan y no modifican informes ya emitidos.
            </p>

            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={{ ...styles.label, textAlign: 'left' }}>Plantilla</label>
                <select 
                  value={selectedTemplateId || ''} 
                  onChange={handleSelectChange}
                  style={styles.input}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Biometría hemática · Clínica Central · v{v.version} · {v.isDefault ? 'Publicada' : 'Reemplazada'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={{ ...styles.label, textAlign: 'left' }}>Encabezado</label>
                <input 
                  type="text" 
                  value={header} 
                  onChange={(e) => setHeader(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={{ ...styles.label, textAlign: 'left' }}>Aviso legal</label>
                <input 
                  type="text" 
                  value={disclaimer} 
                  onChange={(e) => setDisclaimer(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={{ ...styles.label, textAlign: 'left' }}>Firma y cédula</label>
                <input 
                  type="text" 
                  value={signature} 
                  onChange={(e) => setSignature(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
          </section>

          <hr style={styles.sectionDivider} />

          {/* SECCIÓN VISTA PREVIA DEL INFORME PDF */}
          <section style={styles.sectionCard}>
            <h2 style={{ ...styles.sectionTitle, textAlign: 'left' }}>Vista previa del informe PDF</h2>

            <div style={styles.paperPreview}>
              <div style={{ ...styles.paperHeader, textAlign: 'left' }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>{header}</strong>
                </div>
                <div style={styles.logoBox}>LOGO</div>
              </div>

              <div style={{ ...styles.patientGrid, textAlign: 'left' }}>
                <div>
                  <strong>Lucía Fernández Soto</strong><br />
                  <span>41 años · Mujer</span><br />
                  <span>ID P-000437</span><br />
                  <span>Folio SL-261010-0059</span>
                </div>
                <div>
                  <span>Médico solicitante: Dr. R. Salas</span><br />
                  <span>Toma: 10 oct 2026, 08:50</span><br />
                  <span>Emisión: 10 oct 2026, 12:05</span>
                </div>
              </div>

              <div style={{ ...styles.areaHeading, textAlign: 'left' }}>
                Hematología · Biometría hemática
              </div>

              <table style={styles.previewTable}>
                <thead>
                  <tr>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Prueba</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Resultado</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Unidades</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Rango de referencia</th>
                    <th style={{ ...styles.tableHeaderCell, textAlign: 'left' }}>Bandera</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.tableBodyCell}>Hemoglobina</td>
                    <td style={styles.tableBodyCell}><strong>9.8</strong></td>
                    <td style={styles.tableBodyCell}>g/dL</td>
                    <td style={styles.tableBodyCell}>12.0 a 16.0</td>
                    <td style={styles.tableBodyCell}>L</td>
                  </tr>
                  <tr>
                    <td style={styles.tableBodyCell}>Hematocrito</td>
                    <td style={styles.tableBodyCell}><strong>31</strong></td>
                    <td style={styles.tableBodyCell}>%</td>
                    <td style={styles.tableBodyCell}>36 a 46</td>
                    <td style={styles.tableBodyCell}>L</td>
                  </tr>
                  <tr>
                    <td style={styles.tableBodyCell}>Leucocitos</td>
                    <td style={styles.tableBodyCell}><strong>12.8</strong></td>
                    <td style={styles.tableBodyCell}>10³/µL</td>
                    <td style={styles.tableBodyCell}>4.5 a 11.0</td>
                    <td style={styles.tableBodyCell}>H</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ ...styles.previewNotes, textAlign: 'left' }}>
                <p style={{ margin: '4px 0', fontStyle: 'italic', color: '#666' }}>{disclaimer}</p>
              </div>

              <div style={{ ...styles.previewFooter, textAlign: 'left' }}>
                <div style={styles.signatureArea}>
                  <div style={styles.signatureLine}></div>
                  <span>{signature}</span>
                </div>

                <div style={styles.qrArea}>
                  <div style={styles.qrBox}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                      <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 17h3v3h-3z"></path>
                    </svg>
                  </div>
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    Página 1 de 2 · Verifica este informe con el código QR
                  </span>
                </div>
              </div>
            </div>
          </section>

          <hr style={styles.sectionDivider} />

          {/* SECCIÓN HISTORIAL DE VERSIONES */}
          <section style={styles.sectionCard}>
            <h2 style={{ ...styles.sectionTitle, textAlign: 'left' }}>Versiones</h2>
            <table style={styles.versionTable}>
              <thead>
                <tr>
                  <th style={{ ...styles.versionHeaderCell, textAlign: 'left' }}>Versión</th>
                  <th style={{ ...styles.versionHeaderCell, textAlign: 'left' }}>Estatus</th>
                  <th style={{ ...styles.versionHeaderCell, textAlign: 'left' }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {versions.length > 0 ? (
                  versions.map((v) => (
                    <tr key={v.id}>
                      <td style={styles.versionBodyCell}>v{v.version}</td>
                      <td style={styles.versionBodyCell}>{v.isDefault ? 'Publicada' : 'Reemplazada'}</td>
                      <td style={styles.versionBodyCell}>{new Date(v.createdAt).toLocaleDateString('es-MX')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ ...styles.versionBodyCell, textAlign: 'center' }}>
                      No hay versiones registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

      {/* BOTÓN DE ACCIÓN */}
      <div style={styles.actionRow}>
        <button style={styles.publishBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Publicar plantilla'}
          <span style={styles.shortcutBadge}>Ctrl + S</span>
        </button>
      </div>
    </main>
  );
};

// ESTILOS EN OBJETO JS
const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f3f2ee',
    minHeight: '100vh',
    color: '#1a1a1a',
  },
  topHeader: {
    display: 'flex',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e5e5',
    padding: '8px 24px',
    gap: '32px',
    fontSize: '12px',
  },
  infoGroup: { display: 'flex', flexDirection: 'column' },
  infoLabel: { color: '#737373', fontWeight: 'bold', fontSize: '10px', letterSpacing: '0.5px' },
  infoValue: { color: '#171717', fontWeight: 500 },
  mainLayout: { display: 'flex' },
  sidebar: { width: '220px', backgroundColor: '#ffffff', borderRight: '1px solid #e5e5e5', minHeight: 'calc(100vh - 45px)', padding: '16px 0' },
  brandTitle: { fontWeight: 'bold', fontSize: '15px', padding: '0 20px 16px 20px', color: '#171717' },
  navMenu: { display: 'flex', flexDirection: 'column' },
  navItem: { padding: '10px 20px', fontSize: '13px', color: '#404040', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  arrow: { color: '#a3a3a3', fontSize: '12px' },
  navGroup: { display: 'flex', flexDirection: 'column' },
  submenu: { display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' },
  subItem: { padding: '8px 20px 8px 32px', fontSize: '12px', color: '#525252', cursor: 'pointer' },
  activeSubItem: { backgroundColor: '#1b3b2b', color: '#ffffff', fontWeight: 500 },
  contentArea: { flex: 1, padding: '24px 40px', maxWidth: '1000px' },
  breadcrumb: { fontSize: '12px', color: '#737373', marginBottom: '16px' },

  // BANNER DE NOTIFICACIÓN
  notificationBanner: {
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    padding: '16px 20px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    border: '1px solid #e5e5e5',
  },
  notificationIconBox: {
    marginTop: '2px',
  },
  notificationTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#2e693e',
    marginBottom: '4px',
  },
  notificationDesc: {
    fontSize: '13px',
    color: '#2e693e',
    lineHeight: '1.4',
  },

  pageTitle: { fontSize: '28px', fontWeight: 600, margin: 0, color: '#171717' },
  pageSubtitle: { fontSize: '13px', color: '#525252', marginTop: '4px', marginBottom: '24px' },
  sectionCard: { borderRadius: '4px', padding: '20px 0' },
  sectionDivider: { border: 'none', borderTop: '1px solid #e5e5e5', margin: '20px 0' },
  sectionTitle: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', color: '#171717' },
  sectionDesc: { fontSize: '12px', color: '#737373', margin: '0 0 16px 0' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: 500, color: '#404040' },
  input: { padding: '8px 12px', fontSize: '13px', border: '1px solid #d4d4d4', borderRadius: '4px', backgroundColor: '#fafafa', color: '#171717', outline: 'none' },
  paperPreview: { backgroundColor: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '2px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  paperHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  logoBox: { border: '1px solid #d4d4d4', width: '50px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#a3a3a3' },
  patientGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '12px', marginBottom: '20px', color: '#262626', lineHeight: '1.5' },
  areaHeading: { fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' },
  previewTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px', fontFamily: 'monospace', border: '1px solid #171717' },
  tableHeaderCell: { border: '1px solid #171717', padding: '8px 10px', backgroundColor: '#f5f5f5', fontWeight: 'bold' },
  tableBodyCell: { border: '1px solid #171717', padding: '8px 10px' },
  previewNotes: { fontSize: '11px', color: '#404040', lineHeight: '1.4', marginBottom: '24px' },
  previewFooter: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' },
  signatureArea: { fontSize: '12px' },
  signatureLine: { width: '180px', borderTop: '1px solid #171717', marginBottom: '4px' },
  qrArea: { display: 'flex', alignItems: 'center', gap: '12px' },
  qrBox: { width: '44px', height: '44px' },
  versionTable: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'monospace', border: '1px solid #e5e5e5', borderRadius: '4px', backgroundColor: '#ffffff' },
  versionHeaderCell: { borderBottom: '1px solid #e5e5e5', backgroundColor: '#fafafa', padding: '10px 14px', fontWeight: 'bold', color: '#404040' },
  versionBodyCell: { borderBottom: '1px solid #f0f0f0', padding: '10px 14px', color: '#171717' },
  actionRow: { display: 'flex', justifyContent: 'flex-end', marginTop: '20px' },
  publishBtn: { backgroundColor: '#1b3b2b', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '4px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' },
  shortcutBadge: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
};