> Cuándo leer: si la tarea toca estilos visuales, colores semánticos, tokens CSS o apariencia general del runtime.
> Tamaño: corto.
> Relacionados: [[overview.md]], [[../nodes/button.md]], [[../nodes/badge.md]], [[../nodes/alert.md]], [[../nodes/stat.md]].

# Design Tokens

El runtime utiliza un sistema centralizado de design tokens CSS custom declarados en `@theme` de `src/app/index.css`. Todos los estilos visuales se construyen a partir de estos tokens, permitiendo que la paleta cromática sea coherente y mantenible.

## Paleta semántica

La aplicación declara seis roles semánticos con diez variantes de intensidad cada uno (pasos 50 a 900):

- **`neutral`**: Sin connotación semántica específica. Usado para bordes, fondos neutros y textos secundarios.
- **`primary`**: Acciones principales, elementos de énfasis. Refleja el azul institucional (#2563eb en el paso 600).
- **`success`**: Confirmaciones, estados positivos, aprobaciones.
- **`warning`**: Advertencias, acciones que requieren atención.
- **`danger`**: Acciones destructivas, errores, estados críticos.
- **`info`**: Información adicional, elementos informativos.

Cada rol es accesible como utilidad de Tailwind: `bg-{role}-{step}`, `text-{role}-{step}`, `border-{role}-{step}`, etc.

Ejemplo: `bg-primary-600`, `text-danger-700`, `border-neutral-200`.

## Tokens de aplicación (app-level)

El runtime mantiene un conjunto adicional de tokens app-level que actúan como alias semánticos de la paleta base:

- **`--color-app-background`** (`neutral-50`): Fondo general de la aplicación.
- **`--color-app-surface`** (`#ffffff`): Superficies principales (tarjetas, modales).
- **`--color-app-surface-subtle`** (`neutral-100`): Superficies de bajo contraste (bordes suaves, hover).
- **`--color-app-text`** (`neutral-700`): Texto base de cuerpo.
- **`--color-app-text-strong`** (`neutral-900`): Texto de énfasis, headings.
- **`--color-app-text-muted`** (`neutral-500`): Texto de apoyo, labels secundarios.
- **`--color-app-accent`** (`primary-600`): Color de acento de la UI (botones primarios, elementos activos).
- **`--color-app-accent-strong`** (`primary-700`): Variante más oscura del acento.
- **`--color-app-danger`** (`danger-600`): Color de error y acciones destructivas.
- **`--color-app-border-soft`** (`neutral-200`): Bordes de bajo contraste.
- **`--color-app-border-strong`** (`neutral-300`): Bordes de contraste normal.

## Radios y bordes redondeados

- **`--radius-shell`**: Radio de esquinas del shell de aplicación.
- **`--radius-section`**: Radio de secciones y containers.
- **`--radius-form`**: Radio de elementos de formulario.
- **`--radius-control`**: Radio de controles pequeños (botones, inputs).
- **`--radius-card`**: Radio de tarjetas de imagen, tablas y modales (0.75rem).

## Tipografía

- **Familia base**: Source Sans 3 (heredada de la baseline institucional).
- **Escala de headings**: Reducida respecto a versiones previas para reflejar la densidad de una aplicación de gestión:
  - h1: `text-lg sm:text-xl`
  - h2: `text-base sm:text-lg`
  - h3-h4: `text-sm sm:text-base`
  - h5-h6: `text-xs sm:text-sm`
- **Pesos**:
  - `font-semibold` (600) para headings principales (h1-h2) y elementos de énfasis.
  - `font-medium` (500) para labels de campo, botones secundarios, controles de paginación y cabeceras de tabla.
  - Texto base en peso normal (400).

## Espaciado de controles

- **Inputs**: `px-3 py-2` (uniforme, sin inversión móvil/desktop).
- **Botones**: `px-3.5 py-2` (uniforme).
- **Paginación**: `px-3 py-1.5` (uniforme).

Esta uniformidad reemplaza a un modelo anterior donde el padding era mayor en móvil que en desktop.

## Transiciones

Todos los elementos interactivos (botones, tabs, links, file-manager actions, accordion headers) incluyen `transition-colors` para que los cambios de estado (hover, focus, active) sean visualmente fluidos.

## Consumo en nodos

Los siguientes nodos utilizan la paleta semántica con sus props `color`:

- **`button`**: variantes `solid | outline | ghost | link` combinadas con seis colores semánticos.
- **`badge`**: variantes `pill | circle` con seis colores semánticos.
- **`alert`**: seis tipos semánticos (alias de `color` a nivel del contrato).
- **`stat`**: variantes `accent | tinted` con seis colores semánticos.

Ejemplo de JSON:
```json
{
  "type": "button",
  "props": {
    "label": "Enviar",
    "color": "primary",
    "variant": "solid",
    "action": { "type": "executeOperation", "operationName": "submit" }
  }
}
```

## Centralización de estilos

Todos los estilos visuales del runtime se declaran en funciones centralizadas de `src/runtime/runtime-node-styling.ts`, no directamente en el JSX de componentes. Esta centralización asegura que:

- Los tokens se resuelven uniformemente en build time.
- Los cambios de paleta o pesos no requieren tocar componentes individuales.
- El mantenimiento es más simple y menos propenso a inconsistencias.

## Limitaciones (v1)

- **Theming declarativo desde JSON**: No está soportado. Los tokens son fijos en build time.
- **Paleta extendida**: Los seis roles semánticos y sus diez pasos son el catálogo cerrado de v1; no es posible añadir colores adicionales desde configuración.
- **Customización de radios o sombras**: Los valores de `--radius-*` y `-shadow-*` son fijos.
