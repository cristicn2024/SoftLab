import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaginaEditarEstudio from '../PaginaEditarEstudio'
import { guardarEstudio, obtenerEstudio, obtenerLaboratorios } from '../servicio'
import type { EstudioCatalogo } from '../tipos'

vi.mock('../servicio', () => ({ obtenerEstudio: vi.fn(), obtenerLaboratorios: vi.fn(), guardarEstudio: vi.fn() }))

const HBA: EstudioCatalogo = {
  id: 7,
  code: 'HBA001',
  name: 'Hemoglobina glucosilada (HbA1c)',
  price: '320.00',
  status: true,
  department: 'Química clínica',
  sampleType: 'Sangre',
  containerType: 'Tubo con EDTA',
  sampleVolume: '3.000',
  sampleVolumeUnit: 'ml',
  fastingHours: 0,
  preparationInstructions: 'Informar si hubo transfusión reciente',
  genderRestriction: 'BOTH',
  externalLabId: null,
  turnaroundDays: null,
  outsourcingCost: null,
}

function abrir() {
  render(
    <MemoryRouter initialEntries={['/catalogo/estudios/7/editar']}>
      <Routes>
        <Route path="/catalogo/estudios/:idEstudio/editar" element={<PaginaEditarEstudio />} />
        <Route path="/catalogo/estudios" element={<p>Lista de estudios</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HU 1.6 · Editar estudio', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(obtenerEstudio).mockResolvedValue(HBA)
    vi.mocked(obtenerLaboratorios).mockResolvedValue([{ id: 2, name: 'Laboratorio Referencia Nacional' }])
    vi.mocked(guardarEstudio).mockResolvedValue()
  })

  it('muestra las secciones del Figma con los datos del estudio', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Editar estudio' })).toBeInTheDocument()
    expect(screen.getByText('Catálogo clínico / Estudios / HBA001 / Editar')).toBeInTheDocument()
    expect(screen.getByLabelText('Volumen requerido')).toHaveValue('3 ml')
    expect(screen.getByText('No requiere ayuno')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Laboratorio externo' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Se procesa en laboratorio externo' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByLabelText('Laboratorio que lo procesa')).toBeDisabled()
  })

  it('marca el estudio como externo y guarda laboratorio, días y maquila', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('switch', { name: 'Se procesa en laboratorio externo' }))
    expect(screen.getByText('Activo', { selector: 'span' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Laboratorio que lo procesa'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Tiempo estimado de entrega en días'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Costo de maquila, opcional'), { target: { value: '$90.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Cambios guardados. Quedaron registrados en la bitácora.')
    expect(guardarEstudio).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ isExternal: true, externalLabId: 2, turnaroundDays: 3, outsourcingCost: '90.00', price: '320.00' }),
    )
  })

  it('no guarda si falta el laboratorio y lo avisa', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('switch', { name: 'Se procesa en laboratorio externo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona el laboratorio que procesa el estudio.')
    expect(guardarEstudio).not.toHaveBeenCalled()
  })

  it('guarda con Ctrl + S y regresa con Esc', async () => {
    abrir()
    await screen.findByRole('heading', { name: 'Editar estudio' })
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    await waitFor(() => expect(guardarEstudio).toHaveBeenCalled())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await screen.findByText('Lista de estudios')).toBeInTheDocument()
  })

  it('agrega y quita indicaciones de preparación', async () => {
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar indicación' }))
    fireEvent.change(screen.getByLabelText('Nueva indicación'), { target: { value: 'Acudir antes de las 9:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(screen.getByText('Acudir antes de las 9:00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar No requiere ayuno' }))
    expect(screen.queryByText('No requiere ayuno')).not.toBeInTheDocument()
  })

  it('muestra el error del servidor', async () => {
    vi.mocked(guardarEstudio).mockRejectedValue(new Error('x'))
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
