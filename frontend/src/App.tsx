import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './compartido/layout/Layout'
import { OrderCapturePage } from './pages/OrderCapturePage'
import { ReportTemplatePage } from './pages/ReportTemplatePage'

const PaginaEjemplo = lazy(() => import('./features/ejemplo/PaginaEjemplo'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Cargando...</div>}>
        <Routes>
          {/* Rutas dentro del Layout principal con Barra Lateral */}
          <Route element={<Layout />}>
            {/* Redirección inicial */}
            <Route path="/" element={<Navigate to="/recepcion/nueva-orden" replace />} />
            
            {/* HU 5.1: Captura de Orden */}
            <Route path="recepcion/nueva-orden" element={<OrderCapturePage />} />
            
            {/* HU 3.2: Resultados de Plantillas e Informes */}
            <Route path="resultados/plantillas" element={<ReportTemplatePage />} />

            {/* Rutas adicionales */}
            <Route path="resultados/ejemplo" element={<PaginaEjemplo />} />
          </Route>

          {/* Fallback para rutas no encontradas */}
          <Route path="*" element={<Navigate to="/recepcion/nueva-orden" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}