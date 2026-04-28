# Design: Nested query data reference navigation

## Objetivo del diseño
Traducir la ampliación de `queries.{queryName}.data` a una partición técnica cerrada y predecible, manteniendo la resolución centralizada introducida en `0007` y evitando abrir `queries.*` como un acceso arbitrario al store del runtime.

## Estado de partida
La feature `0007` ya dejó estable la capa `src/runtime/runtime-references/` con esta semántica:
- `forms.{formId}.{fieldId}` se resuelve desde el store compartido.
- `queries.{queryName}` devuelve el objeto completo de la query.
- `queries.{queryName}.data`, `.status` y `.error` son las únicas subrutas oficiales de `queries`.
- `heading.props.text` y `paragraph.props.text` consumen la resolución central y degradan a vacío cuando la referencia no es resoluble.

El cambio de `0008` parte, por tanto, de un contrato ya en producción dentro del runtime. Si se ampliara sin diseño previo, aparecerían tres riesgos concretos:
- convertir `queries.*` en una navegación abierta sin catálogo claro de rutas soportadas
- introducir una heurística ambigua para segmentos numéricos que distintos agentes podrían resolver de forma distinta
- romper la diferencia semántica entre referencia inválida y referencia bien formada cuyo dato todavía no existe

## Decisiones de diseño

### 1. La ampliación solo abre navegación adicional bajo `queries.{queryName}.data`
La gramática soportada para `queries` pasa a ser:
- `queries.{queryName}`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data`
- `queries.{queryName}.data.{segmentoAdicional}+`

Reglas explícitas:
- la rama `data` sigue siendo el único punto desde el que se admite profundizar
- `status` y `error` conservan su significado actual y no aceptan subrutas adicionales
- `forms.*`, `navigation.*`, `routeParams.*` y `params.*` no cambian en esta feature

Razonamiento:
- la spec exige ampliar solo la navegación de datos remotos, no el catálogo general de referencias
- conservar el catálogo cerrado evita que la implementación derive hacia un lenguaje genérico de acceso al store

### 2. El parser debe distinguir entre base oficial y segmentos anidados de `data`
`parseRuntimeReference` seguirá clasificando la referencia completa, pero para `queries` pasará de validar solo longitud `1 | 2` a validar dos familias:
- `queries.{queryName}` y `queries.{queryName}.{status|data|error}`
- `queries.{queryName}.data.{segmentosAnidados}`

Los segmentos anidados:
- siguen usando la convención actual basada en strings separados por `.`
- pueden contener caracteres ya válidos hoy por `REFERENCE_SEGMENT_PATTERN`
- no introducen escapes por segmento, filtros ni interpolación parcial

Razonamiento:
- la semántica debe seguir entrando por el parser central, no por lógica ad hoc en el resolver
- dejar el shape bien fijado en parsing reduce ambigüedad en la clasificación `supported | invalid`

### 3. Los segmentos numéricos solo se interpretan como índice cuando el valor actual es un array
Convención cerrada:
- si el valor actual es un array y el siguiente segmento es un entero decimal no negativo, se interpreta como índice posicional
- si el valor actual es un objeto plano o cualquier otro objeto navegable, el segmento se interpreta como nombre de propiedad literal, aunque contenga solo dígitos
- no existe una sintaxis alternativa para “forzar índice” dentro de objetos ni para “forzar propiedad” dentro de arrays

Ejemplos:
- `queries.searchUsers.data.results.0.name` sobre `results: [{ name: 'Ada' }]` usa `0` como índice
- `queries.searchUsers.data.sections.2024.label` sobre `{ sections: { "2024": { label: 'Q1' } } }` usa `2024` como clave de objeto

Razonamiento:
- esta regla resuelve la principal ambigüedad de la spec sin añadir sintaxis nueva
- leer “según el valor actual” mantiene la navegación simple y compatible con datos legacy

### 4. Navegar más allá de un valor no navegable produce `missing`, no `invalid`
Una referencia como `queries.searchUsers.data.total.value` cuando `total` es `3` se tratará como:
- referencia sintácticamente válida
- resolución semántica `missing`

También serán `missing`:
- query inexistente
- `data` igual a `null` o `undefined` cuando se solicitan segmentos adicionales
- clave inexistente en objeto
- índice fuera de rango en array

Serán `invalid` únicamente los casos de contrato string mal formado, por ejemplo:
- `queries`
- `queries.searchUsers.data.`
- `queries.searchUsers.error.message`
- `queries.searchUsers.data..results`

Razonamiento:
- la spec exige diferenciar ruta mal formada de dato todavía no disponible
- considerar “seguir dentro de un primitivo” como `missing` mantiene una semántica uniforme de ruta válida pero no resoluble

### 5. La navegación anidada se implementa como lookup central iterativo y seguro
La ampliación debe vivir en `runtime-reference-resolver.ts`, apoyada en helpers pequeños y, si hace falta, un helper explícito en `runtime-state-selectors.ts`.

Partición prevista:
- `runtime-reference-parser.ts`: valida la nueva familia `queries.{queryName}.data.*`
- `runtime-reference-types.ts`: puede necesitar un tipo más preciso para la ruta de `queries`
- `runtime-reference-resolver.ts`: resuelve primero la base oficial de query y luego recorre los segmentos anidados de `data`
- `runtime-state-selectors.ts`: puede exponer una utilidad acotada para leer el valor raíz de una query o un helper de navegación segura reutilizable por tests y resolver

Reglas del lookup:
- el recorrido es estrictamente de izquierda a derecha
- cada paso decide según el valor actual si el siguiente segmento es propiedad o índice
- el primer fallo semántico corta el recorrido y devuelve `missing`
- no se muta el store ni se normalizan datos recibidos del backend

### 6. La proyección visible de `heading` y `paragraph` no cambia
`resolveRuntimeTextReference` mantiene la política existente:
- `literal` -> texto literal
- `resolved` -> normalización a string visible
- `missing | unsupported | invalid` -> string vacío

Consecuencias:
- si la ruta anidada resuelve a `string`, `number` o `boolean`, se renderiza
- si resuelve a `null`, `undefined`, objeto o array, la proyección textual sigue degradando a vacío
- los diagnósticos de desarrollo deben seguir apuntando a la referencia original completa

Razonamiento:
- la feature no introduce nuevas superficies visibles ni nuevas políticas de degradación
- mantener esa proyección intacta reduce el alcance del cambio a la semántica central de resolución

## Estructura objetivo

```txt
src/
  runtime/
    runtime-references/
      runtime-reference-types.ts
      runtime-reference-parser.ts
      runtime-reference-resolver.ts
      runtime-reference-diagnostics.ts
    runtime-state/
      runtime-state-selectors.ts
    nodes/
      heading-layout-node.tsx
      paragraph-layout-node.tsx
  tests/
    runtime-reference-resolution.test.tsx
    runtime-state.test.tsx
    layout-renderer.test.tsx
```

Notas:
- `heading` y `paragraph` no deberían incorporar parsing nuevo; solo absorber el resultado ampliado
- no hace falta tocar `src/config/validate-runtime-config.ts`, porque la semántica de referencias sigue siendo runtime y no validación estructural de arranque

## Estrategia de implementación
El orden recomendado es:

1. Endurecer parser y resolver con tests unitarios para rutas `queries.{queryName}.data.*`, incluyendo objetos, arrays, rutas ausentes y ramas inválidas.
2. Introducir el helper de navegación segura sobre datos de query y validar desde tests de store que no muta ni reinterpreta el estado.
3. Cerrar la integración visible en `heading` y `paragraph` con casos de render anidado, degradación y diagnóstico.
4. Ejecutar la regresión final del runtime y cerrar con `pnpm test`.

## Riesgos y mitigaciones
- Riesgo: interpretar siempre segmentos numéricos como índices y romper claves legítimas como `"2024"` en objetos.
  Mitigación: interpretar segmentos numéricos como índice solo cuando el valor actual sea array.

- Riesgo: clasificar como inválidas rutas válidas cuya query aún no existe o cuyo `data` aún no está cargado.
  Mitigación: devolver `missing` para cualquier fallo semántico sobre una ruta bien formada.

- Riesgo: abrir navegación adicional sobre `error` o `status` por conveniencia técnica.
  Mitigación: mantener el parser como catálogo cerrado y testear explícitamente que esas ramas adicionales siguen siendo inválidas.

- Riesgo: introducir serializaciones visibles de objetos o arrays al renderizar texto.
  Mitigación: conservar sin cambios la normalización textual ya establecida en `0007`.

## Impacto documental posterior
Cuando la implementación termine, la pasada documental debería revisar:
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/features/index.md`
