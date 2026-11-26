import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReferenciasPage from '../ReferenciasPage';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const data = { studies: [{ id: 1, name: 'Glucosa', parameters: [{ id: 7, name: 'Glucosa en suero' }] }], versions: [], audits: [] };
describe('HU 1.2 pantalla de referencias', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ data }); });
  it('carga los parámetros y permite agregar y quitar rangos', async () => {
    render(<ReferenciasPage />);
    await screen.findByRole('option', { name: 'Glucosa en suero' });
    expect(screen.getAllByRole('group', { name: /^Rango \d/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar rango' }));
    expect(screen.getAllByRole('group', { name: /^Rango \d/ })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[1]);
    expect(screen.getAllByRole('group', { name: /^Rango \d/ })).toHaveLength(1);
  });
  it('envía una referencia de texto abierto y conserva encabezados de sesión', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 1 } });
    render(<ReferenciasPage />);
    await screen.findByRole('option', { name: 'Glucosa en suero' });
    fireEvent.change(screen.getByLabelText('Estudio / parámetro'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'text' } });
    fireEvent.change(screen.getByLabelText('Reactivo / método'), { target: { value: 'Método QA' } });
    fireEvent.change(screen.getByLabelText('Referencia visible'), { target: { value: 'Descripción libre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva versión' }));
    await screen.findByText('Versión guardada en bitácora.');
    expect(api.post).toHaveBeenCalledWith('/referencias/7', expect.objectContaining({ rules: [expect.objectContaining({ type: 'text', method: 'Método QA', low: null })] }));
  });
  it('muestra el error del servidor al rechazar un rango', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: { mensaje: 'Hay huecos de edad' } } } });
    render(<ReferenciasPage />);
    await screen.findByRole('option', { name: 'Glucosa en suero' });
    fireEvent.change(screen.getByLabelText('Estudio / parámetro'), { target: { value: '7' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar nueva versión' }).closest('form')!);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Hay huecos de edad'));
  });
});
