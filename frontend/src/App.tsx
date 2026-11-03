import './App.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CashCutPage } from './pages/CashCutPage'
import { ReportTemplatePage } from './pages/ReportTemplatePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReportTemplatePage />} />
        <Route path="/corte-caja" element={<CashCutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
