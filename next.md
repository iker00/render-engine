## Workflow

- Evitar que los subagentes de implementación lean task.md. La tarea se la debe pasar el orquestador.
- Es necesario pasar a los subagentes de implemenatción la spec??
- Poner mejores nombres a las skills
- Eliminar la lectura de workflow.md de todas las skills

---

### Pendiente de decisión

- (🚨 high - 🧠 medium) Añadir estados para el formSubmit de `onSuccess` y `onError` — ¿qué cubre esto que no resuelva ya `queryStateFeedback`?
- (🚨 low - 🧠 easy) Añadir iconos en títulos, inputs, botones y párrafos (https://lucide.dev/guide/react/)
- Bloquear la navegación o reinicio de página con mensaje de confirmación si hay cambios sin guardar en el editor Monaco
- Añadir `.describe()` en los schemas Zod para el schema del prompt

---

## Modo debug

- Cargar modo debug según la clase del elemento root

### Descartado / ignorar por ahora

- (🚨 medium - 🧠 high) Estilos condicionales para textos
