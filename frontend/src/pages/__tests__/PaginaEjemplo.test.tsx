import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PaginaEjemplo from '../../features/ejemplo/PaginaEjemplo';

describe('Página de ejemplo (frontend)', () => {
  it('renderiza el encabezado, la miga y el subtítulo de la plantilla', () => {
    render(<PaginaEjemplo />);

    expect(
      screen.getByRole('heading', { name: 'Página de ejemplo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Resultados / Ejemplo')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Copia este archivo para armar la pantalla de tu historia de usuario.',
      ),
    ).toBeInTheDocument();
  });
});
