> Cuándo leer: si la tarea toca formularios, ciclo de vida del estado, valores por defecto, reglas de validación o submit declarativo.
> Tamaño: corto.
> Relacionados: [[../nodes/form.md]], [[../nodes/input.md]], [[../nodes/select.md]], [[../nodes/choice-groups.md]], [[../queries/execution.md]].

# Formularios y validación

Modelo declarativo de formularios, ciclo de vida del estado por instancia, valores por defecto, reglas de validación local y submit.

Los detalles de cada nodo de formulario viven en [`../nodes/`](../nodes/index.md): [form](../nodes/form.md), [input](../nodes/input.md), [textarea](../nodes/textarea.md), [select](../nodes/select.md), [choice-groups](../nodes/choice-groups.md).

## Sub-documentos

| Documento | Cuándo leerlo |
|---|---|
| [lifecycle.md](./lifecycle.md) | Inicialización lazy, limpieza por desmontaje, `persistOnUnmount`, reentrada por `pageEntry`, campos ocultos. |
| [defaults.md](./defaults.md) | `defaultValue` literal o dinámico, integración con `params.*` e `item.*`, política de hidratación con `preloads`. |
| [validation-rules.md](./validation-rules.md) | `required`, `minLength`, `maxLength`, `min`, `max`, `minSelections`, `maxSelections`; cuándo valida, dónde vive el error. |
| [submit.md](./submit.md) | `submitAction.type: executeOperation`, payload efectivo, `resetOnSuccess`, semántica de `resetForm`. |
