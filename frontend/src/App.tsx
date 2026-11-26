import { LoginPage } from './pages/LoginPage'
import ReferenciasPage from './pages/ReferenciasPage'
import CatalogoPage from './pages/CatalogoPage'
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
const PaginaEditarEstudio = lazy(() => import('./features/catalogo-estudios/PaginaEditarEstudio'))
const PaginaEstudiosExternos = lazy(() => import('./features/catalogo-estudios/PaginaEstudiosExternos'))

export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Suspense fallback={<div>Cargando...</div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<Layout />}>
              <Route path="resultados/referencias" element={<ReferenciasPage />} />
              <Route path="catalogo/estudios" element={<CatalogoPage kind="studies" />} />
              <Route path="catalogo/estudios/externos" element={<PaginaEstudiosExternos />} />
              <Route path="catalogo/estudios/:idEstudio/editar" element={<PaginaEditarEstudio />} />
              <Route path="catalogo/perfiles" element={<CatalogoPage kind="profiles" />} />
              <Route path="/panel" element={<main className="sl-pagina"><h1>Panel de trabajo</h1><p>Consulta con tu administrador los módulos asignados a tu rol.</p></main>} />
              <Route path="recepcion/nueva-orden" element={<OrderCapturePage />} />
              <Route path="resultados/ejemplo" element={<PaginaEjemplo />} />
              <Route path="resultados/entrega" element={<PaginaEntrega />} />
              <Route path="ordenes/cobro" element={<PaginaCobro />} />
              <Route path="ordenes/corte-caja" element={<CashCutPage />} />
              <Route path="resultados/lista-de-trabajo" element={<PaginaListaDeTrabajo />} />
              <Route path="resultados/lista-de-trabajo/:idOrden" element={<PaginaCapturaDeResultados />} />
              <Route path="resultados/plantillas" element={<ReportTemplatePage />} />
            </Route>
            <Route path="corte-caja" element={<Navigate to="/ordenes/corte-caja" replace />} />
            <Route path="plantillas" element={<Navigate to="/resultados/plantillas" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SesionProvider>
  )
}
