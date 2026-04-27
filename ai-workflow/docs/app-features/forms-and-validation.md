# Formularios y validación

## Objetivo
Soportar formularios declarativos con estado interno, campos reutilizables y validación básica.

## Encaje actual en el contrato de páginas
- El runtime actual todavía no implementa nodos `form`.
- La raíz de `pages[].layout` ya es una colección ordenada, así que una futura feature podrá introducir formularios como bloques hermanos de primer nivel sin rehacer otra vez la estructura raíz de página.
- La composición estructural existente sigue usando `children` en `container`; esta feature no adelanta todavía el shape interno de formularios dentro del árbol declarativo.

## Modelo de formulario
- Cada formulario tiene `id`.
- Los campos escriben en un estado interno por `forms.{formId}.{fieldId}`.
- El funcionamiento básico del formulario no depende de eventos personalizados para mantener su estado.

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

## Validación básica de v1
- `required`
- `min/max` según tipo soportado
- mensaje de error simple por campo

## Submit y reseteo
- `onSubmit` puede ejecutar acciones API declaradas.
- El formulario puede decidir si se resetea tras submit exitoso.
- Esto permite diferenciar buscadores que conservan filtros de formularios que limpian su contenido tras guardar.

## Casos funcionales previstos
- formulario de búsqueda con resultados
- formulario de edición con datos iniciales
- campos condicionales que dependen del valor actual de otros campos mediante reglas declarativas de visibilidad
