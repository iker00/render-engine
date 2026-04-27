# Runtime UI configurable

## Objetivo
Renderizar la primera página estática del runtime a partir de una configuración JSON validada, sin depender todavía de navegación interactiva, formularios ni datos remotos.

## Qué resuelve
- Permite que la configuración declare varias páginas aunque, por ahora, solo se resuelva la indicada por `initialPage`.
- Valida el contrato mínimo del runtime antes de renderizar.
- Interpreta un layout raíz basado en colección ordenada y un catálogo inicial y acotado de nodos.
- Sustituye el shell provisional por una página visible renderizada desde configuración.
- Mantiene una estructura interna separada entre validación de configuración, render de colecciones y piezas concretas por nodo soportado.
- Implementa la presentación visible del runtime con utilidades de `Tailwind CSS`, sin abrir todavía una capa de theming definida.

## Áreas funcionales principales
- Configuración y contrato JSON.
- Selección de página inicial.
- Render estático de layout.
- Gestión de errores de configuración entre desarrollo y producción.
- Modo desarrollo local sin backend.

## Estructura de alto nivel
La configuración soportada hoy se organiza alrededor de:
- `api`
- `pages`
- `initialPage`

Cada página soportada define al menos:
- `id`
- `layout`

En el estado actual, `layout` es una colección ordenada de bloques hermanos. La página puede empezar por varios elementos raíz sin requerir un `container` sintético.

## Catálogo inicial de nodos
El renderer estático soporta estos nodos:
- `container`
- `heading`
- `paragraph`
- `list`

Reglas funcionales vigentes:
- La raíz de página se renderiza como colección; el runtime no inventa un `container` de layout para envolver hermanos.
- `layout: []` es válido y resuelve una página vacía.
- Solo `container` admite `children`.
- `container.props` soporta `direction` y `gap`.
- Los alias de `container.props.gap` soportados hoy (`sm`, `md`, `lg`) se resuelven a clases estables de `Tailwind`.
- Un valor arbitrario de `container.props.gap` sigue siendo válido mediante una excepción acotada: clase `Tailwind` con variable CSS local, sin volver a estilos inline completos.
- `heading.props` soporta `text` y `level`.
- `paragraph.props` soporta `text`.
- `list.props` soporta `items` como array de strings.
- `heading`, `paragraph` y `list` usan clases base estables de `Tailwind` para mantener jerarquía y legibilidad mínimas.

## Organización estable del runtime
- `src/config/runtime-config.ts` actúa como fachada pública mínima del contrato del runtime.
- `src/config/runtime-config-types.ts` concentra los tipos del contrato y los shapes de resultado/error de validación.
- `src/config/validate-runtime-config.ts` contiene la validación estructural previa al render.
- `src/runtime/layout-renderer.tsx` renderiza colecciones ordenadas y conserva el soporte de varios hermanos raíz.
- `src/runtime/layout-node-renderer.tsx` centraliza la resolución `type -> pieza de render`.
- `src/runtime/runtime-node-styling.ts` centraliza la convención visual base y la compatibilidad acotada de `gap`.
- `src/runtime/nodes/` contiene una pieza concreta por nodo soportado hoy: `container`, `heading`, `paragraph` y `list`.

## Comportamiento de errores
- Si `initialPage` no coincide con ninguna página declarada, el runtime muestra un error visible.
- Si el `layout` es inválido, usa el shape raíz antiguo basado en objeto o aparece un nodo no soportado, en desarrollo se muestra un error diagnóstico.
- En producción, los errores marcados como `development-only` degradan a una superficie vacía en lugar de mostrar un mensaje genérico o inventar contenido.

## Límites actuales
- No existe navegación entre páginas.
- No se ejecutan `preloads`, queries ni endpoints declarados en `api`.
- No existe todavía estado compartido de formularios, queries o navegación.
- No se resuelven referencias dinámicas como `forms.*`, `queries.*` o `routeParams.*`.
- La presentación base del runtime sigue siendo intencionadamente mínima y no define todavía theming, tokens de diseño ni personalización visual declarativa.

## Referencias relacionadas
- [`./config-contract.md`](./config-contract.md)
- [`./pages-and-navigation.md`](./pages-and-navigation.md)
- [`./queries-and-feedback.md`](./queries-and-feedback.md)
- [`./forms-and-validation.md`](./forms-and-validation.md)
- [`./development-workflow.md`](./development-workflow.md)
