import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './compartido/layout/Layout'
import { OrderCapturePage } from './pages/OrderCapturePage'
import { ReportTemplatePage } from './pages/ReportTemplatePage'

const PaginaEjemplo = lazy(() => import('./features/ejemplo/PaginaEjemplo'))
const PaginaCobro = lazy(() => import('./features/cobro/PaginaCobro'))

const PaginaEntrega = lazy(() => import('./features/entrega/PaginaEntrega'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Cargando...</div>}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/recepcion/nueva-orden" replace />} />
            <Route path="recepcion/nueva-orden" element={<OrderCapturePage />} />
            <Route path="ordenes/cobro" element={<PaginaCobro />} />
            <Route path="resultados/entrega" element={<PaginaEntrega />} />
            <Route path="resultados/plantillas" element={<ReportTemplatePage />} />
            <Route path="resultados/ejemplo" element={<PaginaEjemplo />} />
          </Route>
          <Route path="*" element={<Navigate to="/recepcion/nueva-orden" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}