# Design: Declarative form validation rules

## Contexto
La feature `0015` dejó estable la validación `required` como una capacidad mínima de formulario apoyada en `forms.{formId}.{fieldId}.error`, y `0021` amplió el catálogo de campos manteniendo una semántica compartida entre controles simples y múltiples. La feature `0019` ya fijó además una única semántica de visibilidad efectiva reutilizada por renderer y formularios.

Lo que falta ahora es ampliar la validación local sin romper esa base:
- seguir validando en el borde del `form`
- seguir escribiendo un único error visible por campo
- mantener la exclusión de campos ocultos
- preparar el contrato para mensajes personalizados futuros sin rediseñar otra vez la superficie JSON

Sin diseño previo quedarían abiertas varias divergencias peligrosas:
- dónde vive la nueva superficie común de validaciones sin multiplicar props sueltas
- cómo se decide qué regla gana cuando un campo incumple varias a la vez
- cómo se evita convivir indefinidamente con dos formas distintas de declarar `required`
- cómo se prepara el contrato para mensajes personalizados futuros sin abrir todavía esa capacidad

## Objetivos / No objetivos

### Objetivos
- Introducir una superficie declarativa común de validaciones por campo.
- Sustituir `required` histórico por esa nueva superficie común.
- Añadir reglas locales y síncronas limitadas a:
  - `required`
  - `minLength`
  - `maxLength`
  - `min`
  - `max`
  - `minSelections`
  - `maxSelections`
- Mantener una única fuente de verdad de error por campo en `forms.*`.
- Reutilizar la misma semántica visible actual para excluir campos ocultos del circuito de validación.
- Dejar preparada cada regla para crecer más tarde con texto personalizado.

### No objetivos
- Añadir validaciones remotas o asíncronas.
- Añadir validaciones cruzadas entre campos.
- Abrir `pattern`, expresiones arbitrarias o un motor general de reglas.
- Introducir todavía mensajes personalizados efectivos en runtime.
- Cambiar la política actual de lifecycle de formularios o rehidratación de campos.
- Crear un dominio agregado nuevo de errores o validez fuera de `forms.*`.

## Decisiones

### 1. Las validaciones se agrupan en una única superficie `validations`
La nueva capacidad debe vivir bajo una propiedad común del campo, `validations`, en lugar de seguir ampliando props planas por regla.

Razonamiento:
- agrupa el dominio de validación en un único borde legible
- evita seguir ensanchando `props` con reglas heterogéneas
- deja una ubicación estable para futuras ampliaciones por regla

### 2. `required` histórico deja de ser el contrato preferente
La implementación puede retirar `props.required` como forma objetivo de declaración y mover la semántica de obligatoriedad a `validations.required`.

No hace falta diseñar una convivencia larga entre ambas formas porque la aplicación aún no está en producción.

Razonamiento:
- evita duplicar contratos para la misma intención
- simplifica bootstrap, runtime y documentación
- impide abrir ambigüedad sobre qué regla manda si aparecen las dos

### 3. Cada regla admite forma breve y forma extendida
La superficie por regla se cierra con dos modos equivalentes:
- forma breve para reglas simples y fácil serialización
- forma extendida para reservar sitio a metadatos futuros

Modelo conceptual:
- `validations` es un objeto ordenado; el runtime usa el orden de aparición de sus claves como prioridad efectiva entre reglas
- `required`: `true` o `{ value: true, message?: string }`
- reglas con umbral: número o `{ value: number, message?: string }`
- una regla omitida significa “desactivada”; no se admite una forma declarada pero inerte como `required: false`

Razonamiento:
- mantiene el contrato corto para los casos normales
- evita una futura ruptura cuando haya que añadir texto personalizado

### 4. La forma extendida se fija desde ya para crecer con `message`
Aunque esta iteración no active mensajes personalizados visibles, la forma extendida debe quedar preparada para incorporar más adelante una clave estable por regla, como `message`, sin mover la regla ni rediseñar el shape.

La implementación actual debe aceptar `message` en bootstrap como parte válida del contrato extendido, pero el runtime seguirá ignorándola funcionalmente en esta iteración y continuará mostrando mensajes por defecto. El diseño cierra así que la evolución ocurrirá dentro de la propia regla, no en una capa paralela.

Razonamiento:
- preserva compatibilidad futura del contrato
- evita reabrir el diseño del JSON al introducir textos personalizados

### 5. El orden de prioridad entre reglas sigue el orden declarado
Cuando un campo incumpla varias validaciones simultáneamente, el runtime debe resolver un único error visible por campo siguiendo el orden en el que las reglas están declaradas dentro de `validations`.

No se impondrá una prioridad rígida separada del contrato como “`required` siempre primero” si el JSON las ha declarado en otro orden.

Razonamiento:
- hace el comportamiento explícito y serializable
- evita mantener una tabla de prioridad oculta en el runtime
- respeta la intención declarativa del backend

### 6. La validación sigue devolviendo un único error visible por campo
El runtime no abre un array de errores ni un dominio paralelo con varias incidencias simultáneas. La primera regla fallida según el orden declarado produce el `error` visible del campo.

Razonamiento:
- alinea la ampliación con el shape actual de `forms.{formId}.{fieldId}.error`
- reduce ruido visual y complejidad de integración

### 7. Cada familia de regla queda acotada a un tipo de campo compatible
La semántica se cierra así:
- `required`: cualquier campo ya soportado
- `minLength` y `maxLength`: `input` textual y `textarea`
- `min` y `max`: `inputType: 'number'`
- `minSelections` y `maxSelections`: `checkboxGroup` y `select.multiple`

No se abren en esta iteración:
- `min` o `max` para fechas
- reglas de cardinalidad sobre `radioGroup` o `select` simple
- reglas textuales sobre campos no textuales

Razonamiento:
- mantiene el contrato pequeño y revisable
- evita coerciones o interpretaciones ambiguas

### 8. La validación local reutiliza los valores efectivos ya normalizados
La evaluación de reglas no debe trabajar contra el valor crudo del DOM ni contra el origen declarativo, sino contra el valor efectivo ya estable del campo:
- strings para campos textuales y selección simple
- `string[]` para selección múltiple
- semántica numérica efectiva para `inputType: 'number'`

Razonamiento:
- evita duplicar parsing o normalización dentro del motor de validación
- mantiene coherencia entre render, estado, submit y validación

### 9. Los campos ocultos salen del circuito de validación sin perder estado
La ampliación de reglas no cambia la política ya estable:
- un campo oculto por `queryStateFeedback` o `visibility` conserva su estado y su error
- mientras siga oculto, no bloquea submit por ninguna de sus reglas
- al volver a mostrarse, vuelve a validarse con su estado actual

Razonamiento:
- mantiene coherencia con la visibilidad efectiva ya fijada por `0019`
- evita divergencias entre lo visible y lo validable

### 10. La limpieza de errores al editar sigue siendo local al campo
El submit sigue validando todo el formulario visible. Durante la edición, el runtime no necesita revalidar el formulario completo, pero sí reevaluar localmente un campo con error para limpiarlo cuando la primera regla fallida deje de fallar.

Razonamiento:
- conserva el coste y la semántica actual del runtime
- mejora UX sin abrir un motor de validación reactivo global

### 11. La validación previa al render debe cerrar shape y compatibilidad
`Zod` y la validación semántica adicional deben rechazar antes del render:
- reglas desconocidas
- shapes inválidos en forma breve o extendida
- reglas aplicadas a tipos de campo incompatibles
- `required: false` o `{ value: false }`, porque la omisión de la regla ya representa el caso desactivado
- valores no finitos
- `minLength`, `maxLength`, `minSelections` y `maxSelections` no enteros
- `minLength`, `maxLength`, `minSelections` y `maxSelections` negativos
- rangos contradictorios en un mismo campo cuando `minLength > maxLength`, `min > max` o `minSelections > maxSelections`

Razonamiento:
- evita errores tardíos en runtime
- mantiene diagnósticos trazables sobre rutas del JSON

## Estructura objetivo

```txt
src/
  config/
    runtime-config-types.ts
    runtime-config-zod.ts
    validate-runtime-config.ts
  runtime/
    nodes/
      form-layout-node.tsx
      input-layout-node.tsx
      textarea-layout-node.tsx
      select-layout-node.tsx
      checkbox-group-layout-node.tsx
    runtime-state/
      runtime-state-types.ts
  tests/
    runtime-config-validation.test.ts
    runtime-state.test.tsx
    layout-renderer.test.tsx
```

Notas:
- no hace falta crear un subsistema nuevo de validación fuera del borde actual de formularios
- la mayor parte de la lógica debe seguir viviendo entre `config/` y `runtime/nodes/form-layout-node.tsx`

## Estrategia de implementación
Orden recomendado:

1. Extender la spec funcional del contrato a `validations` y retirar `required` histórico del contrato objetivo.
2. Ampliar tipos, `Zod` y validación semántica previa al render para reconocer reglas, formas breve/extendida y compatibilidad por tipo de campo.
3. Extraer o adaptar helpers runtime para evaluar reglas locales sobre valores efectivos ya normalizados.
4. Integrar el nuevo recorrido de validaciones en la validación de submit del `form`.
5. Integrar la reevaluación local de campo al editar para limpieza estable de errores.
6. Cerrar regresión conjunta de visibilidad, submit, selección múltiple y compatibilidad con formularios ya migrados a `validations`.

## Riesgos y mitigaciones
- Riesgo: esconder una prioridad de reglas distinta a la declarada y generar mensajes sorprendentes.
  Mitigación: usar siempre el orden declarado en `validations` como prioridad efectiva.

- Riesgo: mantener durante demasiado tiempo `props.required` y `validations.required`.
  Mitigación: cerrar diseño e implementación en torno a una única superficie objetivo y actualizar documentación en consecuencia.

- Riesgo: reintroducir parsing duplicado para números o selecciones múltiples dentro de la validación.
  Mitigación: evaluar reglas solo sobre valores efectivos ya normalizados por el runtime.

- Riesgo: abrir accidentalmente mensajes personalizados “a medias” en esta iteración.
  Mitigación: fijar solo la estructura preparada para `message`, pero mantener el comportamiento visible en mensajes por defecto del runtime.

- Riesgo: que campos ocultos con errores previos sigan bloqueando reglas avanzadas aunque ya no bloqueen `required`.
  Mitigación: reutilizar exactamente la misma decisión de visibilidad efectiva para todas las reglas locales.

## Migración o despliegue
No hay migración persistida.

La feature puede asumir un cambio intencional de contrato porque la aplicación aún no está en producción:
- `required` deja de ser la forma declarativa objetivo
- la documentación funcional pasa a describir `validations` como frontera principal
- los tests deben fijar la nueva superficie como contrato estable de v1 ampliada

## Preguntas abiertas
- No quedan preguntas abiertas funcionales relevantes para pasar a planificación técnica.
- La incorporación efectiva de `message` como comportamiento visible queda diferida a una feature posterior, pero su ubicación estructural ya queda cerrada por este diseño.
