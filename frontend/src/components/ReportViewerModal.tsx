import React from 'react';

interface Props {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportViewerModal: React.FC<Props> = ({ orderId, isOpen, onClose }) => {
  if (!isOpen) return null;

  const pdfUrl = `http://localhost:4000/api/reports/orders/${orderId}/pdf`;

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-frame') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{ background: '#fff', width: '80%', height: '90%', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Vista Previa del Informe Clínico</h3>
          <div>
            <button onClick={handlePrint} style={{ marginRight: '10px', padding: '8px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Imprimir Informe
            </button>
            <button onClick={onClose} style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </div>
        
        <iframe 
          id="pdf-frame"
          src={pdfUrl}
          title="PDF Report"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  );
};