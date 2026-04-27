# Formularios y validación

## Objetivo
Soportar formularios declarativos con estado interno, campos reutilizables y validación básica.

## Encaje actual en el contrato de páginas
- El runtime actual todavía no implementa nodos `form`.
- La raíz de `pages[].layout` ya es una colección ordenada, así que una futura feature podrá introducir formularios como bloques hermanos de primer nivel sin rehacer otra vez la estructura raíz de página.
- La composición estructural existente sigue usando `children` en `container`; esta feature no adelanta todavía el shape interno de formularios dentro del árbol declarativo.
- El runtime ya dispone de un dominio `forms` en el store compartido, aunque todavía no tenga bloques visuales que lo consuman desde JSON.

## Modelo de formulario
- Cada formulario tiene `id`.
- Los campos escriben en un estado interno por `forms.{formId}.{fieldId}`.
- Cada campo mantiene como base `value`, `error`, `touched`, `dirty` y `defaultValue`.
- El funcionamiento básico del formulario no depende de eventos personalizados para mantener su estado.
- El cambio de página dentro de la misma instancia conserva por defecto el estado de formularios.

## Campos previstos en v1
- `input`
- `select`
- `radioGroup`
- `checkboxGroup`
- `textarea`

## Items dinámicos y estáticos
- `select`, `radioGroup` y `checkboxGroup` aceptan `items` estáticos o dinámicos.
- Los items usan una forma única: `{ label, value }`.

## Valores por defecto
- Los campos pueden declarar `defaultValue`.
- Ese valor puede ser literal o dinámico.
- Esto permite soportar páginas de edición donde el formulario se rellena desde backend o desde datos ya cargados.
- El reset por formulario restaura el estado inicial efectivo de cada campo usando ese `defaultValue` cuando exista.

## Validación básica de v1
- `required`
- `min/max` según tipo soportado
- mensaje de error simple por campo

En el estado implementado hoy solo existe la infraestructura de almacenamiento de `error` por campo. Las reglas declarativas y la UX visual de validación siguen pendientes.

## Submit y reseteo
- `onSubmit` puede ejecutar acciones API declaradas.
- El formulario puede decidir si se resetea tras submit exitoso.
- Esto permite diferenciar buscadores que conservan filtros de formularios que limpian su contenido tras guardar.

En el estado actual solo está implementado el reset por formulario dentro del store compartido. El submit declarativo y sus efectos siguen fuera de alcance.

## Casos funcionales previstos
- formulario de búsqueda con resultados
- formulario de edición con datos iniciales
- campos condicionales que dependen del valor actual de otros campos mediante reglas declarativas de visibilidad
