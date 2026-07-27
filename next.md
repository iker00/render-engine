## Workflow

- Evitar que los subagentes de implementación lean task.md. La tarea se la debe pasar el orquestador.
- Es necesario pasar a los subagentes de implemenatción la spec??
- Mejorar los nombres de las skills
- Eliminar la lectura de workflow.md de todas las skills
- Hacer que el orquestador de implementación pase el promtp de la skill, y lo cargue al inciio de la skill, a los
  subagentes para mejorar el uso de caché.
- Quitar el estado de las tareas en task.md ya que podemos verlo en status.md

---

### Pendiente de decisión

? (🚨 high - 🧠 medium) Añadir estado `onError` al formulario
- Añadir `.describe()` en los schemas Zod para el schema del prompt
- Subida de ficheros con componente de formulario attachment o file.
- Permitir personalizar todos los literales del componente fileManager
- Añadir mensajes personalizados todas las validaciones
- Permtir que el nodo Link pueda tener componentes hijos para que los enlaces no sean únicamente textos 
---

### Descartado / ignorar por ahora

- (🚨 medium - 🧠 high) Estilos condicionales para textos
