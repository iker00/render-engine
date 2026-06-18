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

- (🚨 high - 🧠 medium) Añadir estado `onError` al formulario
- Añadir `.describe()` en los schemas Zod para el schema del prompt
- Añadir JWT + renovación automática. Crear nuevo namespace `tokens` en el que se almacenen todos los JWT.
    - En el JSON de configuración llegará el JWT inicial, el endpoint para actualizarlo y la frecuencia.
    - Dentro de las cabeceras de las peticiones http podremos obtener los tokens poniendo `tokens.tokenName`.
- Subida de ficheros con componente DND.
- Subida de ficheros con componente de formulario attachment o file.
- Permitir personalizar todos los literales del componente fileManager
- Añadir mensajes personalizados todas las validaciones

---

### Descartado / ignorar por ahora

- (🚨 medium - 🧠 high) Estilos condicionales para textos
