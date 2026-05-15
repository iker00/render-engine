# Design: Feature 0027 - expanded-container-layout-controls

## Contexto
La feature amplía `container` en tres fronteras a la vez:
- contrato JSON y validación previa al render
- resolución visible del layout en runtime
- semántica reutilizada por `container` dentro de `form`

La `spec.md` fija el objetivo funcional, pero deja una decisión técnica que no conviene resolver durante la implementación: cómo conviven `columns`, `direction`, `align-items`, `justify-content` y `wrap` sin convertir `container` en una API informal de CSS.

El riesgo no es solo añadir props nuevas, sino fijar una semántica pequeña y estable para que distintos agentes implementen el mismo resultado funcional.

## Objetivos / No objetivos

### Objetivos
- Mantener `container` como único nodo de layout reutilizable del runtime.
- Ampliar el contrato visible con una escala cerrada de `gap`, columnas de `1` a `12`, alineación, distribución y `wrap`.
- Fijar defaults y precedencias explícitas para evitar degradaciones silenciosas.
- Mantener compatibilidad con `gap` arbitrario como excepción heredada.
- Preservar la semántica existente de secciones dentro de `form`.

### No objetivos
- Abrir una API genérica de estilos o clases desde JSON.
- Introducir responsive declarativo por breakpoint.
- Añadir spans por hijo, auto-placement complejo, orden visual por hijo o nodos nuevos de `grid`.
- Reabrir el catálogo actual de nodos fuera de `container`.

## Decisiones

### 1. `columns` cambia el modo de layout a `grid`
Cuando `container.props.columns` exista, el runtime renderizará el contenedor como una rejilla CSS con `grid-cols-{n}` para `n` entre `1` y `12`.

Motivo:
- resuelve la necesidad real de varias columnas con una semántica estable y legible
- evita reinterpretar columnas sobre `flex` con anchos heurísticos por hijo
- mantiene el orden lógico y visual según el orden declarado del JSON

Consecuencia:
- `columns` tiene precedencia efectiva sobre `direction`
- `direction` puede seguir presente por compatibilidad, pero deja de afectar al layout cuando `columns` existe

### 2. `wrap` solo aplica al modo lineal
`wrap` se interpreta únicamente cuando el `container` funciona en modo lineal (`flex`), es decir, cuando no hay `columns`.

Catálogo cerrado:
- `nowrap`
- `wrap`
- `wrap-reverse`

Default:
- si `wrap` no existe, el valor efectivo es `nowrap`

Regla de validación:
- `columns` + `wrap` debe rechazarse antes del render con diagnóstico explícito en la ruta afectada

Motivo:
- evita una semántica ambigua de doble layout entre `grid` y `flex-wrap`
- alinea la implementación con el caso límite ya marcado en la spec

### 3. `align` y `justify` usan un vocabulario cerrado y semántico
La feature debe exponer dos props nuevas estables:
- `props.align`
- `props.justify`

Catálogo cerrado propuesto:
- `align`: `start | center | end | stretch`
- `justify`: `start | center | end | between | around | evenly`

Estas opciones se mapearán a utilidades de `Tailwind` distintas según el modo activo, pero manteniendo la misma intención declarativa:
- `flex`: `items-*` y `justify-*`
- `grid`: `items-*` y `justify-*`

Motivo:
- evita filtrar vocabulario CSS completo al JSON
- deja una superficie corta, predecible y fácil de documentar
- mantiene suficiente utilidad tanto para columnas como para layout lineal

Se deja fuera `baseline` en esta iteración para no abrir una semántica difícil de estabilizar también en grid y formularios.

### 4. `gap` adopta `md` por defecto y amplía su escala cerrada
La escala recomendada pasa a ser:
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`

Default:
- ausencia de `props.gap` equivale a `md`

Compatibilidad:
- un valor arbitrario de `gap` sigue siendo válido mediante la misma variable CSS local ya existente

Motivo:
- fija una separación base útil sin exigir declarar `gap` en cada `container`
- conserva compatibilidad con JSON históricos
- mantiene la excepción arbitraria acotada a una única variable CSS ya admitida por la arquitectura

### 5. La resolución visual sigue centralizada en `runtime-node-styling.ts`
La implementación no repartirá la semántica de layout entre varios nodos o helpers ad hoc.

Se mantiene una única capa central para:
- detectar modo `flex` o `grid`
- aplicar el `gap` efectivo por defecto
- resolver clases de `columns`, `align`, `justify` y `wrap`
- conservar el tratamiento visual de `container` como sección dentro de `form`

Motivo:
- reduce varianza entre agentes
- mantiene el cambio revisable con tests unitarios
- evita duplicar precedencias entre el nodo React y el styling helper

### 6. `container` dentro de `form` conserva semántica de sección por defecto
La feature no introduce un nodo nuevo para secciones de formulario.

Regla de implementación:
- un `container` dentro de `form` sigue tratándose como sección visual cuando opera como bloque vertical de composición general
- un `container` dentro de `form` que declare `direction: row` o `columns` puede aprovechar las nuevas capacidades de layout sin perder el wrapper semántico `section`

Consecuencia práctica:
- la heurística actual basada solo en `direction !== 'row'` debe revisarse para que las secciones con `columns` no pierdan su superficie ni su separación visual por accidente

## Riesgos y mitigaciones

### Riesgo: ambigüedad entre `columns` y `wrap`
Mitigación:
- rechazar la combinación en validación
- documentar explícitamente que `wrap` solo existe para modo lineal

### Riesgo: divergencia entre contrato y styling efectivo
Mitigación:
- cerrar vocabularios en validación
- centralizar el mapeo de clases en `runtime-node-styling.ts`
- fijar precedencias y defaults con tests unitarios y de integración

### Riesgo: regresión visual en formularios
Mitigación:
- cubrir `container` dentro y fuera de `form`
- fijar por tests que `columns` y el `gap` por defecto no eliminan la semántica actual de sección

## Impacto estructural previsto
- `src/config/runtime-config-types.ts`
- `src/config/runtime-config-zod.ts`
- `src/config/validate-runtime-config.ts`
- `src/runtime/runtime-node-styling.ts`
- `src/runtime/nodes/container-layout-node.tsx`
- `src/tests/runtime-config-validation.test.ts`
- `src/tests/read-runtime-config.test.ts` si conviene fijar lectura pública del contrato ampliado
- `src/tests/runtime-node-styling.test.ts`
- `src/tests/layout-renderer.test.tsx`

## Preguntas abiertas
- No quedan preguntas técnicas bloqueantes para pasar a implementación.
- Si una iteración futura necesita `baseline`, spans por hijo o responsive declarativo, debe abrirse como feature separada.
