# Tasks: Tailwind runtime styling baseline

## T0005-01

### Estado
Completada

### Objetivo
Introducir una convención de styling reutilizable para los nodos visibles del runtime basada en `Tailwind CSS`, incluyendo una estrategia explícita y acotada para preservar la semántica actual de `container.props.gap` sin reabrir el alcance hacia theming.

### Fuera de alcance
- Añadir propiedades nuevas de estilo o apariencia al contrato JSON.
- Diseñar tokens, temas globales o variantes visuales configurables.
- Cambiar el catálogo de nodos soportados o su semántica funcional.
- Rediseñar el shell general de la aplicación fuera del runtime.

### Dependencias
- `spec.md`

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/` en una utilidad o módulo específico para componer clases base del runtime y resolver compatibilidad de `gap`
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/runtime/nodes/heading-layout-node.tsx`
  - `src/runtime/nodes/paragraph-layout-node.tsx`
  - `src/runtime/nodes/list-layout-node.tsx`
- Tests a crear o modificar:
  - `src/tests/` en un archivo nuevo o ampliado para validar la resolución de clases del runtime y el tratamiento de `gap`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/conventions.md`
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`

### Tests requeridos
- Confirmar que los valores alias soportados hoy para `gap` siguen resolviendo una separación equivalente mediante clases de `Tailwind`.
- Confirmar que un valor arbitrario de `gap` sigue siendo compatible mediante una excepción acotada y explícita basada en variable CSS, sin volver al patrón previo de estilos inline completos.
- Confirmar que la convención devuelve clases estables para `container`, `heading`, `paragraph` y `list` sin introducir una API visual nueva.

### Criterios de finalización
- Existe una única convención reutilizable para expresar el styling base de los nodos soportados con `Tailwind`.
- La compatibilidad de `gap` queda definida de forma explícita, revisable y acotada.
- La implementación ya no depende de objetos `style` completos para describir la presentación base de los nodos soportados.
- Los tests dirigidos a la nueva convención de styling quedan en verde.

### Cierre de implementación
Completado cuando la convención de clases y la compatibilidad de `gap` están fijadas en código, validadas con tests y listas para ser consumidas por el renderer sin decisiones abiertas de diseño.

### Cierre documental
Pendiente de una pasada posterior para reflejar la convención estable en la documentación global y funcional. No se cierra en esta tarea.

## T0005-02

### Estado
Completada

### Objetivo
Migrar el renderer visible de `container`, `heading`, `paragraph` y `list` para usar la convención de `Tailwind` definida en `T0005-01`, preservando el contenido, la jerarquía semántica y el comportamiento observable del runtime actual.

### Fuera de alcance
- Cambiar la resolución de `initialPage` o la validación de configuración.
- Añadir nodos nuevos, navegación, formularios o queries.
- Introducir theming, tokens compartidos o personalización declarativa desde JSON.
- Convertir esta tarea en un refactor amplio del shell de la app o de la arquitectura general del runtime.

### Dependencias
- `T0005-01` completada

### Impacto esperado en archivos
- Código a crear o modificar:
  - `src/runtime/nodes/container-layout-node.tsx`
  - `src/runtime/nodes/heading-layout-node.tsx`
  - `src/runtime/nodes/paragraph-layout-node.tsx`
  - `src/runtime/nodes/list-layout-node.tsx`
  - cualquier módulo de `src/runtime/` estrictamente necesario para consumir la convención creada en `T0005-01`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/app-bootstrap.test.tsx` solo si algún ajuste del render visible obliga a endurecer o adaptar aserciones
  - el archivo de tests introducido o ampliado en `T0005-01`
- Documentación a revisar o actualizar después:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/conventions.md`
  - `ai-workflow/features/index.md` si conviene dejar la feature preparada para seguimiento posterior

### Tests requeridos
- Confirmar que el runtime sigue renderizando el mismo contenido en el mismo orden para varios nodos raíz.
- Confirmar que `heading` sigue resolviendo el tag semántico correcto por `level`.
- Confirmar que `paragraph` y `list` mantienen legibilidad básica sin estilos inline como mecanismo principal.
- Confirmar que `container.props.direction` y `container.props.gap` siguen funcionando, incluyendo al menos un alias soportado y un valor arbitrario compatible.
- Ejecutar una regresión final del subconjunto relevante del runtime y cerrar con `pnpm test` para validar el gate global de cobertura.

### Criterios de finalización
- Los nodos visibles soportados renderizan su presentación base con `className` y utilidades de `Tailwind`.
- No queda una convención paralela equivalente que siga describiendo esos mismos nodos con estilos inline completos.
- El comportamiento observable del renderer permanece estable en contenido, semántica y estructura.
- Los tests relevantes del renderer y la regresión final quedan en verde, incluido el gate global de cobertura.

### Cierre de implementación
Completado cuando los nodos visibles ya usan la convención de `Tailwind`, los tests de runtime pasan y `pnpm test` confirma que el cambio no rompe el gate global del proyecto.

### Cierre documental
Pendiente de una pasada posterior para actualizar estado vigente, convención de styling y ficha funcional del runtime.

## Orden de ejecución
La siguiente tarea que debe escogerse en implementación es `T0005-01`.

No se debe empezar `T0005-02` hasta cerrar `T0005-01`.
