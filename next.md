## Workflow

- Evitar que los subagentes de implementación lean task.md. La tarea se la debe pasar el orquestador.
- Es necesario pasar a los subagentes de implemenatción la spec??
- Mejorar los nombres de las skills
- Eliminar la lectura de workflow.md de todas las skills
- Hacer que el orquestador de implementación pase el promtp de la skill del subagente, y lo pase a los subagentes para mejorar el uso de caché.
- Quitar el estado de las tareas en task.md ya que podemos verlo en status.md
- Hacer que el paso de documentación haga commit
- Definir una plantilla fija para cada tarea
- Mejora subagente implementación: Optimiza la skill implement-task-test-first para reducir el tiempo por subagente. El orquestador debe leer una sola vez los ficheros invariantes (todos los de ai-workflow/standards/, más architecture.md, conventions.md y test-index.md) y pasarlos inline en el prompt de cada subagente, en lugar de que cada subagente los redescubra y lea de cero. El contenido de subagent-prompt.md también debe ir inline. El subagente solo debería leer los ficheros propios de la tarea (spec, design si existe, el bloque de su task_id, y el código/tests del área afectada).

---

### Pendiente de decisión

- Añadir `.describe()` en los schemas Zod para el schema del prompt
- Subida de ficheros con componente de formulario attachment o file.
- Permitir personalizar todos los literales del componente fileManager
- Permitir variantes, types (alerts y badges) y colores condicionales.
- ¿Opción para poner los iconos a la derecha?

---

### Descartado / ignorar por ahora


