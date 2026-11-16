import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormularioContextoReferencia } from '../ContextoReferencia';
import { api } from '../../../services/api';
vi.mock('../../../services/api', () => ({ api: { post: vi.fn() } }));
const context = { processedAt: '2026-01-15T12:00:00Z', condition: '', weeks: null };
describe('Contexto de procesamiento', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('guarda fecha histórica, condición y semanas y recarga las referencias', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<FormularioContextoReferencia orderId={9} context={context} locked={false} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Condición especial'), { target: { value: 'embarazo' } });
    fireEvent.change(screen.getByLabelText('Semanas de embarazo'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar contexto y recalcular rangos' }));
    await screen.findByText('Contexto guardado. Referencias recalculadas para la fecha de procesamiento.');
    expect(api.post).toHaveBeenCalledWith('/referencias/ordenes/9/contexto', { processedAt: '2026-01-15T12:00:00.000Z', condition: 'embarazo', weeks: 20 }, expect.objectContaining({ headers: expect.any(Object) }));
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it('bloquea la edición cuando ya se capturaron resultados', () => {
    render(<FormularioContextoReferencia orderId={9} context={context} locked onSaved={vi.fn()} />);
    expect(screen.getByLabelText('Fecha de procesamiento')).toBeDisabled();
    expect(screen.getByLabelText('Condición especial')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aplicar contexto y recalcular rangos' })).toBeDisabled();
  });
  it('muestra el rechazo del servidor sin recargar la orden', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: { mensaje: 'El contexto está bloqueado' } } } });
    const onSaved = vi.fn();
    render(<FormularioContextoReferencia orderId={9} context={context} locked={false} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar contexto y recalcular rangos' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('El contexto está bloqueado'));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
