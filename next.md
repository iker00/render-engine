## Workflow

- Evitar que los subagentes de implementación lean task.md. La tarea se la debe pasar el orquestador.
- Es necesario pasar a los subagentes de implemenatción la spec??
- Mejorar los nombres de las skills
- Eliminar la lectura de workflow.md de todas las skills
- Hacer que el orquestador de implementación pase el promtp de la skill del subagente, y lo pase a los subagentes para mejorar el uso de caché.
- Quitar el estado de las tareas en task.md ya que podemos verlo en status.md
- Hacer que el paso de documentación haga commit
- Definir una plantilla fija para cada tarea

---

### Pendiente de decisión

- Añadir `.describe()` en los schemas Zod para el schema del prompt
- Subida de ficheros con componente de formulario attachment o file.
- Permitir personalizar todos los literales del componente fileManager
- Añadir mensajes personalizados todas las validaciones
- Controlar el title de la página
- Mejorar estilos del nodo tabs
- Permitir variantes, types (alerts y badges) y colores condicionales.
- Revisar los nodos interactivos para ver si tienen cursor: pointer.
  - Tabs
  - Buttons
  - Acordeón
  - Paginaciones
- Añadir lazy load de componentes
- ¿Opción para poner los iconos a la derecha?

---

### Descartado / ignorar por ahora

