# Design: Centralized runtime reference resolution

## Objetivo del diseño
Traducir la spec de resolución centralizada de referencias a una partición técnica concreta, pequeña y extensible, de forma que el runtime pueda interpretar rutas como `forms.*` y `queries.*` desde una sola capa común sin convertir esta feature en un lenguaje genérico de expresiones.

## Estado de partida
Hoy el runtime ya dispone de estado compartido para `navigation`, `forms` y `queries`, pero el árbol de layout sigue consumiendo solo strings literales:
- `heading.props.text` y `paragraph.props.text` renderizan directamente el valor recibido.
- `runtime-state-selectors.ts` expone lectura de dominios concretos, pero no existe una capa común para resolver rutas string.
- `config/` valida estructura de nodos, no semántica de referencias.
- No existe todavía una política uniforme para distinguir texto literal de una referencia dinámica.

Eso deja cuatro riesgos si la implementación se hace sin diseño previo:
- dispersar la interpretación de `forms.*` y `queries.*` en nodos visuales concretos
- resolver rutas con heurísticas distintas según la superficie consumidora
- perder la distinción entre referencia inválida, namespace reservado y valor todavía ausente
- romper textos literales que coincidan con una ruta soportada

## Decisiones de diseño

### 1. Convención explícita de referencia con escape austero para literales
La convención base de esta feature será:
- un string que empiece por un namespace oficial del runtime y cumpla el shape completo soportado se interpreta como referencia dinámica
- en esta iteración, los namespaces oficialmente resolubles son `forms` y `queries`
- los namespaces `navigation`, `routeParams` y `params` quedan reservados y reconocibles, pero no resolubles todavía
- para forzar contenido literal cuando el string coincida exactamente con una ruta oficial o reservada, el backend podrá anteponer `\`

Ejemplos:
- `forms.userSearch.name` -> referencia dinámica resoluble
- `queries.searchUsers.data` -> referencia dinámica resoluble
- `navigation.currentPageId` -> referencia reconocida pero no soportada en esta iteración
- `\\forms.userSearch.name` en JSON -> texto literal visible `forms.userSearch.name`
- `User: forms.userSearch.name` -> texto literal, porque la iteración no soporta interpolación parcial

Razonamiento:
- la spec exige mantener referencias como strings simples para un backend legacy
- el escape con `\` evita introducir objetos JSON nuevos solo para distinguir literal y referencia
- la convención sigue siendo legible y ampliable a nuevos namespaces sin cambiar el estilo del contrato

### 2. Resolver central con resultado tipado y semántico
La resolución no devolverá solo `string | undefined`. La capa común debe distinguir al menos:
- `literal`: el valor no debe tratarse como referencia y se renderiza tal cual
- `resolved`: la referencia es válida y produjo un valor
- `missing`: la referencia apunta a un namespace y ruta soportados, pero el valor todavía no existe
- `unsupported`: la referencia usa un namespace reservado no habilitado en esta iteración
- `invalid`: la referencia intenta usar un namespace soportado o reservado con un shape no válido

Razonamiento:
- la spec exige diferenciar una ruta vacía o pendiente de una ruta inválida
- futuras features no textuales necesitarán esa semántica antes de decidir su propia política de degradación
- los textos visibles solo consumirán una proyección de este resultado, no la semántica completa

### 3. Nueva capa `runtime-references/` separada de `runtime-state/` y de los nodos
La implementación creará un módulo específico dentro de `src/runtime/`:

```txt
src/runtime/
  runtime-references/
    runtime-reference-types.ts
    runtime-reference-parser.ts
    runtime-reference-resolver.ts
    runtime-reference-diagnostics.ts
```

Responsabilidades:
- `runtime-reference-types.ts`: tipos del contrato interno de parsing y resolución
- `runtime-reference-parser.ts`: detección de literal, escape, namespace y shape esperado
- `runtime-reference-resolver.ts`: lectura contra `RuntimeState` y normalización de resultados
- `runtime-reference-diagnostics.ts`: diagnóstico de desarrollo por superficie consumidora

Razonamiento:
- la spec exige una capa común del runtime, no helpers sueltos dentro de `heading` o `paragraph`
- esta partición deja un sitio obvio para ampliar más adelante `navigation.*`, `routeParams.*`, `params.*` u otras rutas oficiales
- `runtime-state/` mantiene responsabilidad sobre almacenamiento y selectors del store, no sobre parsing del contrato string

### 4. Lookup seguro y explícito sobre `forms` y `queries`
La resolución apoyada en estado seguirá reglas cerradas:
- `forms.{formId}.{fieldId}` devuelve `RuntimeFormFieldState.value`
- `queries.{queryName}` devuelve el objeto `RuntimeQueryState` completo
- `queries.{queryName}.data`, `.status` y `.error` devuelven subrutas oficiales
- cualquier otra subruta de `queries` queda invalidada en esta iteración para evitar semántica abierta
- `forms` no soporta en esta fase subrutas como `.error`, `.dirty` o `.touched`; si se quisieran exponer después, deberán abrirse como ampliación explícita del catálogo

Razonamiento:
- la spec fija `forms.{formId}.{fieldId}` como lectura oficial de formulario para esta iteración
- limitar subrutas evita que una primera implementación abra lectura arbitraria del shape interno del store
- permitir `queries.{queryName}` completo deja preparada la futura reutilización en superficies no textuales

### 5. Política de proyección para textos visibles
`heading.props.text` y `paragraph.props.text` no resolverán rutas por su cuenta. Consumirán una utilidad común del runtime con esta política:
- `literal` -> renderizar el texto literal
- `resolved` -> normalizar a string visible
- `missing` -> degradar a string vacío
- `unsupported` -> degradar a string vacío
- `invalid` -> degradar a string vacío

Normalización visible:
- `string` se muestra tal cual
- `number` y `boolean` se convierten con `String(value)`
- `null` y `undefined` degradan a vacío
- arrays, objetos y otros valores no stringificables como texto simple degradan a vacío en esta iteración

Razonamiento:
- la spec acuerda degradación a vacío para textos visibles no resolubles
- limitar la normalización evita que `heading` o `paragraph` inventen serializaciones de objetos complejos
- la semántica completa queda disponible para futuras superficies con políticas distintas

### 6. Diagnóstico centralizado solo en desarrollo
La feature añadirá un diagnóstico común por superficie visible, por ejemplo `heading.props.text` o `paragraph.props.text`.

Reglas:
- solo se emite en desarrollo
- incluye la ruta original y la superficie consumidora
- se activa para resultados `missing`, `unsupported` e `invalid`
- no se emite para `literal` ni para `resolved`

Razonamiento:
- la spec pide avisos suficientemente claros para depurar referencias no resolubles
- centralizar el diagnóstico evita mensajes divergentes entre nodos
- en producción la degradación no debe mostrar detalles técnicos al usuario

## Estructura objetivo

```txt
src/
  runtime/
    nodes/
      heading-layout-node.tsx
      paragraph-layout-node.tsx
    runtime-references/
      runtime-reference-types.ts
      runtime-reference-parser.ts
      runtime-reference-resolver.ts
      runtime-reference-diagnostics.ts
    runtime-state/
      runtime-state-selectors.ts
  tests/
    runtime-reference-resolution.test.tsx
    layout-renderer.test.tsx
    runtime-state.test.tsx
```

Notas de partición:
- `heading` y `paragraph` solo consumen la utilidad común; no alojan lógica de parsing
- `runtime-state-selectors.ts` puede incorporar helpers de lectura segura que el resolver reutilice, pero la decisión de qué rutas son válidas vive en `runtime-references/`
- `config/` no añadirá validación semántica exhaustiva de referencias en esta fase

## Estrategia de implementación
La implementación debería avanzar en este orden:

1. Fijar el contrato de parsing y resolución con tests unitarios, incluyendo escape literal, namespaces soportados y namespaces reservados.
2. Conectar el resolver a `RuntimeState` para `forms` y `queries`, fijando en tests la diferencia entre `resolved`, `missing`, `unsupported` e `invalid`.
3. Integrar la proyección visible en `heading` y `paragraph`, junto con los diagnósticos solo de desarrollo.
4. Ejecutar la regresión final del runtime y cerrar con `pnpm test`.

Esta secuencia minimiza riesgo porque:
- cierra primero la convención funcional antes de tocar el render visible
- evita que los nodos visuales decidan por sí mismos qué rutas son válidas
- deja los diagnósticos y la degradación como una capa final sobre una semántica ya probada

## Riesgos y mitigaciones
- Riesgo: que la convención de escape genere dudas entre literal y referencia.
  Mitigación: fijar el comportamiento en tests y reflejarlo después en la documentación funcional del contrato.

- Riesgo: acoplar el resolver al shape interno completo de `queries` o `forms`.
  Mitigación: limitar las subrutas oficiales de esta fase a `forms.{formId}.{fieldId}` y `queries.{queryName}[.data|.status|.error]`.

- Riesgo: convertir objetos o arrays a textos poco controlados.
  Mitigación: degradar a vacío cualquier resultado no apto para texto visible simple en esta iteración.

- Riesgo: abrir validación semántica excesiva en `config/`.
  Mitigación: mantener esta feature en resolución runtime y tests, sin rehacer la frontera de validación estructural.

## Impacto documental posterior
Cuando el código esté implementado, la pasada documental debería revisar:
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/features/index.md`
