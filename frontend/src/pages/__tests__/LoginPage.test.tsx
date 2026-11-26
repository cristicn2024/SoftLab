import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { api } from '../../compartido/api';
import { usuarioQA } from '../../test/usuario';

vi.mock('../../compartido/api', async original => ({
  ...await original<typeof import('../../compartido/api')>(),
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../OrderCapturePage', () => ({ OrderCapturePage: () => <h1>Nueva orden</h1> }));
vi.mock('../../features/lista-de-trabajo/PaginaListaDeTrabajo', () => ({ default: () => <h1>Lista de trabajo</h1> }));

async function ingresar() {
  const usuario = await screen.findByLabelText(/Usuario \(correo/);
  fireEvent.change(usuario, { target: { value: 'gael@example.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave de prueba' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('HU 7.5 – acceso al panel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, '', '/');
    vi.mocked(api.get).mockRejectedValue({ response: { status: 401 } });
  });

  it('lleva al administrador a nueva orden y muestra su sucursal', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { sesion: usuarioQA } });
    render(<App />);
    await ingresar();
    expect(await screen.findByRole('heading', { name: 'Nueva orden' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/recepcion/nueva-orden');
    expect(screen.getByText('Clínica Central')).toBeInTheDocument();
  });

  it('elige sucursal y abre solo el panel concedido al rol personalizado', async () => {
    const sesion = { ...usuarioQA, rol: 'coordinacion', nombreRol: 'Coordinación', permisos: ['resultados'], sucursalId: 8, sucursal: 'Norte' };
    vi.mocked(api.post).mockResolvedValueOnce({ data: { sucursales: [{ id: 4, name: 'Central' }, { id: 8, name: 'Norte' }] } })
      .mockResolvedValueOnce({ data: { sesion } }).mockResolvedValueOnce({ data: null });
    render(<App />);
    await ingresar();
    expect(screen.queryByRole('navigation')).toBeNull();
    fireEvent.change(await screen.findByLabelText('Sucursal'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar al panel' }));
    expect(await screen.findByRole('heading', { name: 'Lista de trabajo' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/sucursal', { sucursalId: 8 });
    expect(screen.getByText('Norte')).toBeInTheDocument();
    expect(screen.queryByText('Recepción')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('restaura la sesión y corrige una URL privada sin permiso', async () => {
    window.history.replaceState({}, '', '/catalogo/perfiles');
    vi.mocked(api.get).mockResolvedValue({ data: { ...usuarioQA, permisos: ['resultados'] } });
    render(<App />);
    await screen.findByRole('heading', { name: 'Lista de trabajo' });
    expect(window.location.pathname).toBe('/resultados/lista-de-trabajo');
    expect(screen.queryByText('Catálogo')).toBeNull();
  });

  it('valida campos vacíos, muestra carga y presenta el error genérico', async () => {
    let rechazar!: (e: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(() => new Promise((_, reject) => { rechazar = reject; }));
    render(<App />);
    const boton = await screen.findByRole('button', { name: 'Iniciar sesión' });
    fireEvent.click(boton);
    expect(api.post).not.toHaveBeenCalled();
    await ingresar();
    expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled();
    rechazar({ isAxiosError: true, response: { data: { error: { mensaje: 'Usuario o contraseña incorrectos' } } } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos'));
  });
});
