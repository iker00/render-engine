# Control de versiones
El proyecto utiliza Git como sistema de control de versiones.

## Estrategia de ramas

El proyecto usa dos ramas permanentes:
- `master`: rama de producción estable.
- `dev`: rama de integración activa; base para el trabajo de features.

Todo el trabajo de features ocurre en ramas de vida corta creadas desde `dev`. Nunca se trabaja directamente sobre `master` ni sobre `dev`.

**Política de commits**: una feature se consolida en tres tipos de commit, nunca en trabajo suelto sin commitear entre medio:
- **Un commit de planificación**, hecho por `implement-task-test-first` justo antes de lanzar la primera tarea, con `spec.md`, `design.md` (si existe), `tasks.md` y `status.yaml` tal como quedaron al cerrar la planificación. Deja esos artefactos fuera del alcance de los commits de tareas.
- **Un commit por tarea de implementación**, hecho por el orquestador (`implement-task-test-first`) justo después de que el subagente de implementación la cierre con éxito (contrato en `ai-workflow/agents/implement-task.md`) y de que el orquestador actualice `status.yaml`. El subagente nunca ejecuta git: solo propone el `commit_message`; el orquestador hace `git add -A` + commit con el código, los tests y la actualización de `status.yaml` de esa tarea juntos.
- **Un commit final de documentación**, hecho por `update-app-documentation` al cerrar la feature, con la documentación funcional y los artefactos del flujo actualizados en esta última fase (`spec.md`, `design.md`, `tasks.md`, `status.yaml`). No reabre ni reescribe los commits anteriores.

No se generan commits especulativos ni de trabajo en curso fuera de estos tres puntos de cierre.

### Nomenclatura de ramas
```
feature/<descripción-en-kebab-case>
fix/<descripción-en-kebab-case>
```
Usar `feature/` para nuevas funcionalidades y `fix/` para correcciones de defecto. La descripción debe ser breve y legible.

## Formato de commit

Seguir el estilo Conventional Commits con mensaje en inglés:
```
<type>[(<scope>)]: <descripción en inglés>
```

### Tipos
| Tipo       | Cuándo usarlo                                                    |
|------------|------------------------------------------------------------------|
| `feat`     | Nueva funcionalidad o cambio de comportamiento observable        |
| `fix`      | Corrección de defecto                                            |
| `docs`     | Cambios exclusivamente de documentación o artefactos de workflow |
| `refactor` | Restructuración interna sin cambio de comportamiento             |
| `test`     | Añadir o modificar tests sin cambio de comportamiento            |
| `chore`    | Mantenimiento de tooling, dependencias o configuración           |

### Scope
Opcional. Usarlo cuando delimite claramente un subsistema:
```
feat(accordion): ...
fix(forms): ...
fix(tests): ...
```

### Longitud y cuerpo
- Línea de asunto: máximo ~72 caracteres.
- Cuerpo opcional; solo cuando el "por qué" del cambio no sea obvio desde el diff.
- No incluir IDs de tarea ni tickets si el nombre de feature ya da el contexto suficiente.
- No añadir a Claude como coautor.

## Lo que NO aplica (errores comunes a evitar)
- ❌ No se hacen commits parciales dentro de una misma tarea (código sin sus tests, o tests sin el código que validan): cada commit de tarea incluye ambos juntos.
- ❌ No se usan squash merges, rebase interactivos ni amends de commits ya empujados a remoto.
- ❌ No hay changelog generado automáticamente desde los commits.
- ❌ El commit final de documentación no reabre, reescribe ni aplasta los commits de tareas ya hechos.
