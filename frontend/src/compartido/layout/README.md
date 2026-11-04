# Menú lateral compartido

Todas las pantallas se montan dentro de un mismo Layout (menú lateral, barra superior y pie de página). Así no hay que volver a armar el menú en cada historia de usuario.

Estos archivos tienen su propio CSS (`layout.css`, con clases que empiezan con `sl-`), así que funcionan sin depender del `App.css` ni del `index.css` de nadie.

## Cómo agregar tu historia de usuario

1. **Crea tu página** en tu propia carpeta, por ejemplo `frontend/src/features/pagos/PaginaPagos.tsx`. Devuelve tu contenido dentro de `<main className="sl-pagina">`; el menú, la barra superior y el pie ya los pone el Layout. Puedes copiar `frontend/src/features/ejemplo/PaginaEjemplo.tsx`.

2. **Registra tu ruta** en `frontend/src/App.tsx`, dentro del bloque `<Route element={<Layout />}>`:

```tsx
const PaginaPagos = lazy(() => import('./features/pagos/PaginaPagos'))

<Route path="ordenes/pagos" element={<PaginaPagos />} />
```

3. **Agrégala al menú** en `frontend/src/compartido/layout/menu.ts`, como subelemento del módulo que le corresponde:

```ts
{ etiqueta: 'Corte de caja', ruta: '/ordenes/pagos' }
```

Si el módulo todavía no tiene `ruta`, agrégasela también para que su botón del menú funcione.

El módulo del menú se marca como activo según su `prefijo` (por ejemplo `/ordenes` para Recepción), así que la ruta de tu página debe empezar con el prefijo de su módulo. Los subelementos sin `ruta` se muestran como texto sin enlace.

## Otros componentes

- `Cargando` y `MensajeError` (`frontend/src/compartido/`): mensajes de carga y de error.
- `Aviso`: mensaje flotante que se oculta solo a los 4 segundos.
- Clases útiles para tu página: `sl-pagina` (contenedor), `sl-migas` (ruta de navegación) y `sl-subtitulo`.

## Conflictos al juntar ramas

Cuando varias historias agreguen su ruta a `App.tsx` y `menu.ts`, Git puede marcar conflictos en esas líneas. Se resuelven conservando las líneas de todos.

El router (`BrowserRouter`) está en `App.tsx`. Si tu rama ya tenía uno, déjalo en un solo lugar: un router dentro de otro hace fallar la app.