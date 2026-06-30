# Spec — 0089: posición de icono en input, button y link

## Objetivo

Añadir una opción a los nodos `input`, `button` y `link` para que el icono declarado con `props.icon` pueda renderizarse a la derecha del label en lugar de a la izquierda, que es el comportamiento actual por defecto.

## Alcance

- Nodos afectados: `input`, `button` y `link`.
- Nueva propiedad `props.iconPosition` de tipo enum cerrado `"left" | "right"`, opcional, en los tres nodos.
- Valor por defecto implícito: `"left"` (preserva el comportamiento actual; no rompe configs existentes).
- La propiedad solo tiene efecto cuando `props.icon` está declarado; si `props.icon` está ausente, `props.iconPosition` se ignora silenciosamente.

## Fuera de alcance

- Nodos `textarea`, `select`, `radioGroup`, `checkboxGroup` u otros nodos del catálogo no mencionados.
- Posiciones adicionales distintas de izquierda/derecha (p.ej. arriba, abajo, superpuesto).
- Variantes configurables de tamaño o color del icono.
- Iconos en `link` con modo `children` (ya restringido por el contrato actual: `props.icon` sin `props.label` se rechaza).
- Cambio del comportamiento visual de los iconos existentes declarados sin `iconPosition`.

## Requisitos funcionales

1. **`input`**: acepta `props.iconPosition: "left" | "right"`. Cuando es `"right"`, el icono se renderiza a la derecha del área de texto. Cuando es `"left"` o está ausente, el comportamiento es el actual (icono a la izquierda). El icono sigue siendo puramente decorativo: no afecta al valor, la validación ni el submit del formulario.
2. **`button`**: acepta `props.iconPosition: "left" | "right"`. Cuando es `"right"`, el icono se renderiza a la derecha del label. Cuando es `"left"` o está ausente, el comportamiento es el actual.
3. **`link` (modo `props.label`)**: acepta `props.iconPosition: "left" | "right"`. Cuando es `"right"`, el icono se renderiza a la derecha del label. Cuando es `"left"` o está ausente, el comportamiento es el actual. La restricción existente de que `props.icon` no aplica cuando el nodo usa `children` se mantiene sin cambios; `props.iconPosition` queda igualmente restringido.

## Requisitos no funcionales

- El posicionamiento se implementa exclusivamente con utilidades de Tailwind CSS, coherente con las convenciones del proyecto.
- `props.iconPosition` con un valor fuera del enum cerrado (`"left" | "right"`) rechaza el config antes del render con código `invalid-layout` y ruta exacta, coherente con el resto del catálogo.
- La adición de `props.iconPosition` no rompe ningún config existente que declare `props.icon` sin `props.iconPosition`.

## Criterios de aceptación

1. Un `button` con `props.icon: "ArrowRight"` y `props.iconPosition: "right"` renderiza el icono a la derecha del label.
2. Un `button` con `props.icon: "Search"` sin `props.iconPosition` (o con `"left"`) renderiza el icono a la izquierda del label sin cambio de comportamiento respecto al estado actual.
3. Un `input` con `props.icon: "Mail"` y `props.iconPosition: "right"` renderiza el icono a la derecha del área de texto.
4. Un `link` con `props.label`, `props.icon: "ExternalLink"` y `props.iconPosition: "right"` renderiza el icono a la derecha del label.
5. `props.iconPosition` con un valor fuera del enum (p.ej. `"center"`) rechaza el config antes del render con `invalid-layout` en los tres nodos.
6. `props.iconPosition` declarado sin `props.icon` no produce error ni cambio visual en ninguno de los tres nodos.
7. Un `link` con `children` y `props.iconPosition` declarado rechaza el config antes del render con el mismo diagnóstico que cuando `props.icon` se usa con `children` (restricción existente, sin cambio).
8. Todos los configs existentes sin `props.iconPosition` siguen funcionando con el mismo resultado visual.

## Casos límite

- **`iconPosition` sin `icon`**: se ignora silenciosamente; no genera error ni modifica el render.
- **`iconPosition: "left"` explícito**: comportamiento idéntico al actual; sin lógica adicional.
- **`icon` con nombre que no resuelve más `iconPosition: "right"`**: el icono sigue ignorándose silenciosamente; `iconPosition` no añade ningún efecto.
- **`link` con `children` y `iconPosition` declarado**: el config se rechaza por la restricción existente sobre `icon` + `children`; el diagnóstico de error no cambia.

## Áreas de producto afectadas

- Nodo `input`: contrato de props y render visual.
- Nodo `button`: contrato de props y render visual.
- Nodo `link` (modo label): contrato de props y render visual.
- Validación previa al render (Zod) para los tres nodos.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/input.md`
- `ai-workflow/docs/app-features/nodes/button.md`
- `ai-workflow/docs/app-features/nodes/link.md`

## Riesgos o preguntas abiertas

Ninguno.
