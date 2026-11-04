import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './compartido/layout/Layout'
import { ReportTemplatePage } from './pages/ReportTemplatePage'

const PaginaEjemplo = lazy(() => import('./features/ejemplo/PaginaEjemplo'))
const PaginaCobro = lazy(() => import('./features/cobro/PaginaCobro'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="resultados/ejemplo" element={<PaginaEjemplo />} />
          <Route path="ordenes/cobro" element={<PaginaCobro />} />
        </Route>
        <Route path="*" element={<ReportTemplatePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App