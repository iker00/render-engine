# Accesibilidad web

## Objetivo
Garantizar que los nodos del runtime producen HTML accesible por defecto. El nivel objetivo es **WCAG 2.1 AA**.

## Principios generales
- Preferir HTML semántico sobre ARIA cuando el elemento correcto ya existe.
- Cada nodo interactivo debe ser operable con teclado.
- Nunca usar `div` o `span` con `onClick` como sustituto de `<button>` o `<a>`.
- Los textos visibles de acción deben ser significativos fuera de contexto.
- El estado dinámico del runtime (carga, error, vacío) debe ser anunciable por lectores de pantalla.

## Semántica HTML por tipo de nodo

### Botones y acciones
- Nodo `button` → siempre `<button type="button">`.
- Si el botón solo contiene icono, añadir `aria-label` con texto descriptivo.
- Estado deshabilitado: usar `disabled` nativo, no solo apariencia visual.

### Textos y títulos
- Nodo `text` con nivel heading → `<h1>`–`<h6>` según el nivel configurado; no usar `<div>` con clases de tamaño.
- El orden de headings debe ser coherente: no saltar de `h1` a `h4`.
- Textos decorativos puros (separadores, iconos ornamentales) → `aria-hidden="true"`.

### Formularios
- Todo `<input>`, `<select>` y `<textarea>` debe tener un `<label>` asociado mediante `for`/`id` o `aria-labelledby`.
- No usar solo `placeholder` como etiqueta visible; siempre proporcionar `<label>`.
- Los errores de validación deben estar vinculados al campo con `aria-describedby` y anunciarse con `role="alert"` o `aria-live="polite"`.
- Agrupar campos relacionados con `<fieldset>` y `<legend>` cuando el contexto lo requiera.

### Listas y colecciones
- Nodo `list` con ítems enumerables → `<ul>` o `<ol>`; los ítems deben ser `<li>`.
- No usar `<div>` para colecciones que semánticamente son listas.

### Imágenes
- Nodo `image` → `<img>` con `alt` obligatorio.
  - Imagen informativa: `alt` con descripción breve.
  - Imagen decorativa: `alt=""`.

### Enlace
- Nodo `link` → `<a href>` con texto significativo. Evitar "haz clic aquí" o "más info" sin contexto adicional.
- Si abre en nueva pestaña, indicarlo con `aria-label` o texto visible.

### Modal
- El contenedor del modal debe tener `role="dialog"` y `aria-modal="true"`.
- El título del modal debe estar vinculado con `aria-labelledby`.
- Al abrir: mover el foco al primer elemento interactivo o al contenedor del modal.
- Al cerrar: devolver el foco al elemento que abrió el modal.
- Mientras el modal está abierto: atrapar el foco dentro del modal (focus trap).
- ESC cierra el modal.

### Estados de query (carga, error, vacío)
- Estado `loading` → incluir un indicador con `role="status"` y texto legible por lectores de pantalla (puede ser visualmente oculto con clase `sr-only`).
- Estado `error` → usar `role="alert"` para que sea anunciado automáticamente.
- Estado `empty` → texto descriptivo sin necesidad de rol especial.

## Teclado y foco

- El orden de foco debe seguir el orden visual de la página.
- No eliminar `outline` de foco sin proporcionar un indicador visible alternativo.
- Los componentes que gestionan foco programáticamente (`modal`, navegación entre páginas) deben hacerlo explícitamente con `.focus()`.
- Al navegar entre páginas del runtime, mover el foco a un punto de referencia estable (por ejemplo, el encabezado principal de la página o el contenedor de la página).

## ARIA

- Usar ARIA solo cuando el HTML semántico no es suficiente.
- No añadir `role` redundantes (`role="button"` en `<button>`, `role="link"` en `<a>`).
- Los atributos `aria-*` inválidos o incompatibles con el rol declarado deben evitarse.
- `aria-hidden="true"` en un elemento elimina ese elemento y todos sus hijos del árbol de accesibilidad; no usarlo en elementos que contienen foco activo.

## Contraste y color

- El ratio mínimo de contraste texto/fondo es 4.5:1 para texto normal y 3:1 para texto grande (≥18px regular o ≥14px negrita).
- No transmitir información únicamente con color; acompañar siempre con texto o icono.

## Tests de accesibilidad

- Cada nodo interactivo nuevo debe incluir tests de renderizado que verifiquen:
  - El elemento HTML correcto (`getByRole` en lugar de `getByTestId` cuando sea posible).
  - Presencia de `aria-label` o texto accesible cuando no hay texto visible.
  - Comportamiento de foco en componentes que lo gestionan programáticamente.
- Los tests de formulario deben verificar la asociación `label`↔`input` y los mensajes de error vinculados por `aria-describedby`.

## Fuera de alcance en v1
- Live regions complejas para actualizaciones parciales de contenido.
- Soporte completo de patrones ARIA Authoring Practices (grids, tree views, carousels).
- Verificación automática de ratio de contraste en CI.
