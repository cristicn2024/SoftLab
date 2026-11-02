import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

interface Concept {
  id: number;
  type: 'TEST' | 'PROFILE';
  code: string;
  name: string;
  price: number;
  genderRestriction: string;
  includedTestIds: number[];
}

interface Doctor {
  id: number;
  name: string;
  cedula?: string;
  specialty?: string;
}

export const OrderCapturePage: React.FC = () => {
  // Datos del Paciente (Ejemplo dinámico o prop)
  const [patient] = useState({
    id: 231,
    fullName: 'María López García',
    code: 'P-000231',
    ageYears: 38,
    gender: 'Mujer',
    genderKey: 'FEMALE',
    branchName: 'Clínica Central'
  });

  // Médicos y Selección
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('particular');
  const [showDoctorModal, setShowDoctorModal] = useState<boolean>(false);
  const [newDoctorName, setNewDoctorName] = useState<string>('');
  const [newDoctorCedula, setNewDoctorCedula] = useState<string>('');
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState<string>('');

  // Búsqueda Predictiva y Conceptos de la Orden
  const [query, setQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Concept[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [orderItems, setOrderItems] = useState<Concept[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [openOrderWarning, setOpenOrderWarning] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. Cargar médicos y validar si el paciente tiene orden abierta hoy
  useEffect(() => {
    loadDoctors();
    checkOpenOrder();
  }, [patient.id]);

  const loadDoctors = async () => {
    try {
      const res = await api.get('/doctors');
      setDoctors(res.data || []);
    } catch {
      // Si no existe el endpoint aún, dejamos la opción por defecto
    }
  };

  const checkOpenOrder = async () => {
    try {
      const res = await api.get(`/orders/check-open?patientId=${patient.id}`);
      setOpenOrderWarning(res.data.hasOpenOrder);
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Autocompletado predictivo
  useEffect(() => {
    if (query.trim().length > 1) {
      api.get(`/concepts/search?q=${query}`).then((res) => {
        setSuggestions(res.data);
        setSelectedIndex(0);
      }).catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  }, [query]);

  // 3. Atajos de Teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      addConcept(suggestions[selectedIndex]);
    } else if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (orderItems.length > 0) handleConfirmOrder();
    }
  };

  // 4. Agregar concepto a la orden con validación de sexo y duplicados
  const addConcept = (concept: Concept) => {
    const newWarnings: string[] = [];

    // Validar restricción por sexo
    if (concept.genderRestriction !== 'BOTH' && concept.genderRestriction !== patient.genderKey) {
      newWarnings.push(`El estudio "${concept.name}" no corresponde al sexo registrado (${patient.gender}).`);
    }

    // Validar duplicado exacto
    const isDuplicate = orderItems.some((i) => i.id === concept.id && i.type === concept.type);
    if (isDuplicate) {
      newWarnings.push(`El concepto "${concept.name}" ya fue agregado a la orden.`);
    }

    // Validar si el estudio ya está dentro de un perfil previamente agregado
    const alreadyInProfile = orderItems.some((i) =>
      i.type === 'PROFILE' && i.includedTestIds.some((tid) => concept.includedTestIds.includes(tid))
    );
    if (alreadyInProfile) {
      newWarnings.push(`El estudio "${concept.name}" ya está incluido en un perfil de esta orden.`);
    }

    setWarnings(newWarnings);
    setOrderItems([...orderItems, concept]);
    setQuery('');
    setSuggestions([]);
    searchInputRef.current?.focus();
  };

  const removeConcept = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // Registrar médico sin salir de la orden
  const handleCreateDoctor = async () => {
    if (!newDoctorName.trim()) return alert('Ingrese el nombre del médico');
    try {
      const res = await api.post('/doctors/express', {
        name: newDoctorName,
        cedula: newDoctorCedula,
        specialty: newDoctorSpecialty,
      });
      const created = res.data;
      setDoctors([...doctors, created]);
      setSelectedDoctorId(String(created.id));
      setShowDoctorModal(false);
      setNewDoctorName('');
      setNewDoctorCedula('');
      setNewDoctorSpecialty('');
    } catch {
      alert('Error al registrar médico');
    }
  };

  const totalAmount = orderItems.reduce((acc, curr) => acc + curr.price, 0);

  const handleConfirmOrder = async () => {
    if (orderItems.length === 0) return;
    try {
      const res = await api.post('/orders', {
        patientId: patient.id,
        branchId: 1,
        doctorId: selectedDoctorId !== 'particular' ? Number(selectedDoctorId) : null,
        items: orderItems,
        totalAmount,
      });
      alert(`¡Orden capturada exitosamente! Folio: ${res.data.folio}`);
      setOrderItems([]);
      setWarnings([]);
    } catch {
      alert('Error al registrar la orden');
    }
  };

  return (
    <div style={styles.appContainer}>
      {/* 1. HEADER SUPERIOR */}
      <header style={styles.topHeader}>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>LABORATORIO</span>
          <span style={styles.infoValue}>Laboratorio Santa Lucía</span>
        </div>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>SUCURSAL</span>
          <span style={styles.infoValue}>Clínica Central</span>
        </div>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>USUARIO</span>
          <span style={styles.infoValue}>Laura Méndez</span>
        </div>
        <div style={styles.infoGroup}>
          <span style={styles.infoLabel}>ROL</span>
          <span style={styles.infoValue}>Administradora</span>
        </div>
      </header>

      <div style={styles.mainLayout}>
        {/* 2. SIDEBAR NAVEGACIÓN */}
        <aside style={styles.sidebar}>
          <div style={styles.brandTitle}>SoftLab</div>
          <nav style={styles.navMenu}>
            <div style={styles.navGroup}>
              <div style={{ ...styles.navItem, fontWeight: 'bold' }}>
                Recepción <span style={styles.arrow}>˅</span>
              </div>
              <div style={styles.submenu}>
                <div style={styles.subItem}>Pacientes</div>
                <div style={{ ...styles.subItem, ...styles.activeSubItem }}>Nueva orden</div>
                <div style={styles.subItem}>Corte de caja</div>
              </div>
            </div>
            <div style={styles.navItem}>Catálogo <span style={styles.arrow}>›</span></div>
            <div style={styles.navItem}>Toma de muestras <span style={styles.arrow}>›</span></div>
            <div style={styles.navItem}>Resultados <span style={styles.arrow}>›</span></div>
            <div style={styles.navItem}>Administración <span style={styles.arrow}>›</span></div>
            <div style={styles.navItem}>Reportes <span style={styles.arrow}>›</span></div>
          </nav>
        </aside>

        {/* 3. CONTENIDO PRINCIPAL */}
        <main style={{ ...styles.contentArea, textAlign: 'left' }}>
          {/* Breadcrumb y Título */}
          <div style={{ ...styles.breadcrumb, textAlign: 'left' }}>Recepción / Nueva orden</div>
          <h1 style={{ ...styles.pageTitle, textAlign: 'left' }}>Nueva orden</h1>
          <p style={{ ...styles.patientMeta, textAlign: 'left' }}>
            {patient.fullName} · {patient.code} · {patient.ageYears} años · {patient.gender} · {patient.branchName}
          </p>

          {/* ALERTA: ORDEN ABIERTA HOY */}
          {openOrderWarning && (
            <div style={styles.alertBanner}>
              ⚠️ El paciente ya cuenta con una orden abierta el día de hoy.
            </div>
          )}

          {/* BLOQUE SUPERIOR DE CONFIGURACIÓN DE LA ORDEN */}
          <section style={{ ...styles.configCard, textAlign: 'left' }}>
            <div style={styles.configGrid}>
              {/* Columna Médico */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Médico solicitante</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="particular">Particular (sin médico)</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.name}
                    </option>
                  ))}
                </select>
                <span style={styles.fieldNote}>Opcional. Busca o registra al médico sin salir de la orden.</span>
              </div>

              {/* Columna Búsqueda Predictiva */}
              <div style={{ ...styles.formGroup, position: 'relative' }}>
                <label style={styles.label}>Agregar estudio o perfil</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Busca por clave o nombre"
                  style={styles.searchInput}
                />
                <span style={styles.fieldNote}>
                  Solo estudios disponibles en Clínica Central con precio vigente. Enter para agregar.
                </span>

                {/* Autocompletado Floating */}
                {suggestions.length > 0 && (
                  <ul style={styles.dropdownList}>
                    {suggestions.map((item, idx) => (
                      <li
                        key={`${item.type}-${item.id}`}
                        style={{
                          ...styles.dropdownItem,
                          backgroundColor: idx === selectedIndex ? '#e2e8f0' : '#ffffff',
                        }}
                        onClick={() => addConcept(item)}
                      >
                        <strong>[{item.code}]</strong> {item.name} — ${item.price.toFixed(2)} ({item.type})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Botón Registrar Médico Express */}
              <div style={styles.actionCol}>
                <button style={styles.outlineBtn} onClick={() => setShowDoctorModal(true)}>
                  Registrar médico
                </button>
              </div>
            </div>
          </section>

          {/* ADVERTENCIAS DE VALIDACIÓN */}
          {warnings.length > 0 && (
            <div style={styles.warningBox}>
              {warnings.map((w, i) => (
                <div key={i}>⚠️ {w}</div>
              ))}
            </div>
          )}

          {/* SECCIÓN PRINCIPAL: ESTADO VACÍO (EMPTY STATE) O TABLA DE ESTUDIOS */}
          <section style={styles.mainCard}>
            {orderItems.length === 0 ? (
              <div style={styles.emptyStateContainer}>
                <div style={styles.emptyStateBox}>
                  <h3 style={styles.emptyTitle}>Aún no hay estudios en esta orden</h3>
                  <p style={styles.emptyDesc}>
                    Busca un estudio o perfil por clave o nombre. Puedes mezclar estudios y perfiles.
                  </p>
                  <button
                    style={styles.greenBtn}
                    onClick={() => searchInputRef.current?.focus()}
                  >
                    Agregar estudio
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.orderTable}>
                  <thead>
                    <tr>
                      <th>Clave</th>
                      <th>Estudio / Perfil</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Precio</th>
                      <th style={{ textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.code}</strong></td>
                        <td>{item.name}</td>
                        <td>{item.type === 'PROFILE' ? 'Perfil' : 'Estudio'}</td>
                        <td style={{ textAlign: 'right' }}>${item.price.toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button style={styles.deleteLink} onClick={() => removeConcept(idx)}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={styles.totalRow}>
                  <strong>Total:</strong>
                  <span style={styles.totalAmount}>${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </section>

          {/* BARRA INFERIOR DE ACCIONES */}
          <div style={styles.footerBar}>
            <div style={styles.leftActions}>
              <button
                style={{
                  ...styles.confirmBtn,
                  backgroundColor: orderItems.length > 0 ? '#1b3b2b' : '#d4d4d4',
                  cursor: orderItems.length > 0 ? 'pointer' : 'not-allowed',
                }}
                disabled={orderItems.length === 0}
                onClick={handleConfirmOrder}
              >
                Continuar al cobro
              </button>
              <span style={{ ...styles.shortcutBadge, textAlign: 'left' }}>Ctrl + Enter</span>

              <button style={styles.cancelBtn} onClick={() => setOrderItems([])}>
                Cancelar
              </button>
            </div>

            <div style={{ ...styles.footerInstructions, textAlign: 'center' }}>
              Toda la orden se captura con teclado: Tab, Enter para agregar, F2 para confirmar indicaciones.
            </div>
          </div>

          {/* PIE DE PÁGINA DOCUMENTAL */}
          <div style={styles.pageFooter}>
            <span>SoftLab · Recepción</span>
            <span>El historial se conserva en cada cambio.</span>
          </div>
        </main>
      </div>

      {/* MODAL EXPRESS: REGISTRAR MÉDICO */}
      {showDoctorModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: '0 0 16px 0' }}>Registrar médico solicitante</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nombre completo *</label>
              <input
                type="text"
                value={newDoctorName}
                onChange={(e) => setNewDoctorName(e.target.value)}
                placeholder="Ej. Dr. Roberto Salas"
                style={styles.searchInput}
              />
            </div>
            <div style={{ ...styles.formGroup, marginTop: '10px' }}>
              <label style={styles.label}>Cédula profesional</label>
              <input
                type="text"
                value={newDoctorCedula}
                onChange={(e) => setNewDoctorCedula(e.target.value)}
                placeholder="Ej. 12345678"
                style={styles.searchInput}
              />
            </div>
            <div style={{ ...styles.formGroup, marginTop: '10px' }}>
              <label style={styles.label}>Especialidad</label>
              <input
                type="text"
                value={newDoctorSpecialty}
                onChange={(e) => setNewDoctorSpecialty(e.target.value)}
                placeholder="Ej. Medicina General"
                style={styles.searchInput}
              />
            </div>

            <div style={styles.modalActions}>
              <button style={styles.greenBtn} onClick={handleCreateDoctor}>
                Guardar médico
              </button>
              <button style={styles.cancelBtn} onClick={() => setShowDoctorModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// OBJETOS DE ESTILOS EXACTOS DE FIGMA
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
  sidebar: {
    width: '220px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e5e5',
    minHeight: 'calc(100vh - 45px)',
    padding: '16px 0',
  },
  brandTitle: { fontWeight: 'bold', fontSize: '15px', padding: '0 20px 16px 20px', color: '#171717' },
  navMenu: { display: 'flex', flexDirection: 'column' },
  navItem: {
    padding: '10px 20px',
    fontSize: '13px',
    color: '#404040',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrow: { color: '#a3a3a3', fontSize: '12px' },
  navGroup: { display: 'flex', flexDirection: 'column' },
  submenu: { display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa' },
  subItem: { padding: '8px 20px 8px 32px', fontSize: '12px', color: '#525252', cursor: 'pointer' },
  activeSubItem: { backgroundColor: '#1b3b2b', color: '#ffffff', fontWeight: 500 },
  contentArea: { flex: 1, padding: '24px 40px', maxWidth: '1080px' },
  breadcrumb: { fontSize: '12px', color: '#737373', marginBottom: '12px' },
  pageTitle: { fontSize: '28px', fontWeight: 600, margin: 0, color: '#171717' },
  patientMeta: { fontSize: '13px', color: '#525252', marginTop: '4px', marginBottom: '24px' },
  alertBanner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '12px 16px',
    borderRadius: '4px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  configCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e5e5',
    borderRadius: '4px',
    padding: '20px',
    marginBottom: '20px',
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr auto',
    gap: '20px',
    alignItems: 'flex-start',
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: 500, color: '#404040' },
  selectInput: {
    padding: '8px 12px',
    fontSize: '13px',
    color: '#5B625F',
    border: '1px solid #d4d4d4',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    outline: 'none',
  },
  searchInput: {
    padding: '8px 12px',
    color: '#5B625F',
    fontSize: '13px',
    border: '1px solid #1b3b2b',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    outline: 'none',
  },
  fieldNote: { fontSize: '9px', color: '#737373', marginTop: '4px' },
  actionCol: { paddingTop: '22px' },
  outlineBtn: {
    backgroundColor: '#ffffff',
    border: '1px solid #1b3b2b',
    color: '#1b3b2b',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  dropdownList: {
    position: 'absolute',
    top: '65px',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #d4d4d4',
    borderRadius: '4px',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    zIndex: 100,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  dropdownItem: {
    padding: '10px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
  },
  warningBox: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '12px 16px',
    borderRadius: '4px',
    fontSize: '12px',
    marginBottom: '16px',
  },
  mainCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e5e5',
    borderRadius: '4px',
    minHeight: '340px',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
  },
  emptyStateContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
  },
  emptyStateBox: {
    border: '1px solid #e5e5e5',
    borderRadius: '4px',
    padding: '40px 32px',
    textAlign: 'center',
    maxWidth: '380px',
  },
  emptyTitle: { fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 8px 0' },
  emptyDesc: { fontSize: '12px', color: '#737373', margin: '0 0 20px 0', lineHeight: '1.4' },
  greenBtn: {
    backgroundColor: '#1b3b2b',
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tableWrapper: { padding: '20px' },
  orderTable: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  deleteLink: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px' },
  totalRow: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', fontSize: '16px' },
  totalAmount: { fontWeight: 'bold', color: '#1b3b2b' },
  footerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  leftActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  confirmBtn: {
    color: '#5B625F',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
  },
  shortcutBadge: {
    backgroundColor: '#ffffff',
    border: '1px solid #d4d4d4',
    color: '#404040',
    padding: '4px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  cancelBtn: {
    backgroundColor: '#ffffff',
    border: '1px solid #d4d4d4',
    color: '#1F4D3A',
    padding: '10px 20px',
    borderRadius: '4px',
    borderColor: '#1F4D3A',
    fontSize: '13px',
    cursor: 'pointer',
  },
  footerInstructions: { fontSize: '10px', color: '#737373' },
  pageFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#737373',
    borderTop: '1px solid #e5e5e5',
    paddingTop: '16px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '6px',
    width: '400px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  modalActions: { display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' },
};