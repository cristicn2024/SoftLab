import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { Layout } from './compartido/layout/Layout'
import FeatureWorkflowPage from './pages/FeatureWorkflowPage'

const PaginaListaDeTrabajo = lazy(() => import('./features/lista-de-trabajo/PaginaListaDeTrabajo'))
const PaginaCapturaDeResultados = lazy(() => import('./features/lista-de-trabajo/PaginaCapturaDeResultados'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="resultados/lista-de-trabajo" element={<PaginaListaDeTrabajo />} />
          <Route path="resultados/lista-de-trabajo/:idOrden" element={<PaginaCapturaDeResultados />} />
        </Route>
        <Route path="*" element={<FeatureWorkflowPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App