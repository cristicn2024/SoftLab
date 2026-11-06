import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { SesionProvider } from './compartido/SesionProvider'
import { Layout } from './compartido/layout/Layout'
import { CashCutPage } from './pages/CashCutPage'
import { OrderCapturePage } from './pages/OrderCapturePage'
import { ReportTemplatePage } from './pages/ReportTemplatePage'

const PaginaEjemplo = lazy(() => import('./features/ejemplo/PaginaEjemplo'))
const PaginaCobro = lazy(() => import('./features/cobro/PaginaCobro'))
const PaginaListaDeTrabajo = lazy(() => import('./features/lista-de-trabajo/PaginaListaDeTrabajo'))
const PaginaCapturaDeResultados = lazy(() => import('./features/lista-de-trabajo/PaginaCapturaDeResultados'))

const PaginaEntrega = lazy(() => import('./features/entrega/PaginaEntrega'))

export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Suspense fallback={<div>Cargando...</div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/recepcion/nueva-orden" replace />} />
              <Route path="recepcion/nueva-orden" element={<OrderCapturePage />} />
              <Route path="resultados/entrega" element={<PaginaEntrega />} />
              <Route path="ordenes/cobro" element={<PaginaCobro />} />
              <Route path="ordenes/corte-caja" element={<CashCutPage />} />
              <Route path="resultados/lista-de-trabajo" element={<PaginaListaDeTrabajo />} />
              <Route path="resultados/lista-de-trabajo/:idOrden" element={<PaginaCapturaDeResultados />} />
              <Route path="resultados/plantillas" element={<ReportTemplatePage />} />
              <Route path="resultados/ejemplo" element={<PaginaEjemplo />} />
            </Route>
            <Route path="corte-caja" element={<Navigate to="/ordenes/corte-caja" replace />} />
            <Route path="plantillas" element={<Navigate to="/resultados/plantillas" replace />} />
            <Route path="*" element={<Navigate to="/recepcion/nueva-orden" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SesionProvider>
  )
}