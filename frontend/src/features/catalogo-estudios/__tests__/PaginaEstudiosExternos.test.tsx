import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaginaEstudiosExternos from '../PaginaEstudiosExternos'
import { obtenerExternos } from '../servicio'
import type { ListaExternos } from '../tipos'

vi.mock('../servicio', () => ({ obtenerExternos: vi.fn() }))

const LISTA: ListaExternos = {
  estudios: [
    { id: 7, code: 'HBA001', name: 'Hemoglobina glucosilada (HbA1c)', status: true, externalLabId: 2, laboratorio: 'Laboratorio Referencia Nacional', turnaroundDays: 3, outsourcingCost: 90 },
  ],
  resumen: { total: 1, activos: 1, porLaboratorio: [{ laboratorio: 'Laboratorio Referencia Nacional', cantidad: 1 }] },
  actualizada: '2026-10-10T16:18:00.000Z',
  ultimoEnvio: { folio: 'ENV-261010-0001', code: 'HBA001', laboratorio: 'Laboratorio Referencia Nacional', estimatedDays: 3, outsourcingCost: 90, createdAt: '2026-10-10T16:18:00.000Z' },
  laboratorios: [
    { id: 2, name: 'Laboratorio Referencia Nacional' },
    { id: 3, name: 'Laboratorio de Referencia del Norte' },
  ],
}

function abrir() {
  render(
    <MemoryRouter>
      <PaginaEstudiosExternos />
    </MemoryRouter>,
  )
}

describe('HU 1.6 · Estudios externos', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(obtenerExternos).mockResolvedValue(LISTA)
  })

  it('muestra el resumen, la tabla y la última orden de envío', async () => {
    abrir()
    expect(await screen.findByText('1 estudio externo · Laboratorio Referencia Nacional: 1')).toBeInTheDocument()
    expect(screen.getByText('1 activo')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'HBA001' })).toBeInTheDocument()
    expect(screen.getByText('3 días')).toBeInTheDocument()
    expect(screen.getByText('$90.00')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 1 estudios externos')).toBeInTheDocument()
    expect(screen.getByText('Última orden de envío · ENV-261010-0001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('filtra por laboratorio y estatus en el servidor', async () => {
    abrir()
    await screen.findByText('1 activo')
    fireEvent.change(screen.getByLabelText('Laboratorio'), { target: { value: '3' } })
    await waitFor(() => expect(obtenerExternos).toHaveBeenLastCalledWith('', '3', 'todos'))
    fireEvent.change(screen.getByLabelText('Estatus'), { target: { value: 'inactivos' } })
    await waitFor(() => expect(obtenerExternos).toHaveBeenLastCalledWith('', '3', 'inactivos'))
    fireEvent.change(screen.getByLabelText('Buscar por clave o nombre'), { target: { value: 'hba' } })
    await waitFor(() => expect(obtenerExternos).toHaveBeenLastCalledWith('hba', '3', 'inactivos'))
  })

  it('avisa cuando no hay estudios con esos filtros', async () => {
    vi.mocked(obtenerExternos).mockResolvedValue({ ...LISTA, estudios: [], resumen: { total: 0, activos: 0, porLaboratorio: [] }, ultimoEnvio: null })
    abrir()
    expect(await screen.findByText('No hay estudios externos con esos filtros.')).toBeInTheDocument()
    expect(screen.getByText('Aún no hay órdenes de envío')).toBeInTheDocument()
  })
})
