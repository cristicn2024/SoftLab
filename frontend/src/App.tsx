import './App.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SesionProvider } from './compartido/SesionProvider'
import { Layout } from './compartido/layout/Layout'
import { PaginaEjemplo } from './features/ejemplo/PaginaEjemplo'
import { CashCutPage } from './pages/CashCutPage'
import { ReportTemplatePage } from './pages/ReportTemplatePage'

function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="ordenes/corte-caja" element={<CashCutPage />} />
            <Route path="resultados/plantillas" element={<ReportTemplatePage />} />
            <Route path="resultados/ejemplo" element={<PaginaEjemplo />} />
          </Route>
          <Route path="corte-caja" element={<Navigate to="/ordenes/corte-caja" replace />} />
          <Route path="plantillas" element={<Navigate to="/resultados/plantillas" replace />} />
          <Route path="/" element={<Navigate to="/resultados/plantillas" replace />} />
          <Route path="*" element={<Navigate to="/resultados/plantillas" replace />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  )
}

export default App
