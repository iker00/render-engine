# Control de versiones

## Estrategia de ramas

El proyecto usa dos ramas permanentes:

- `master`: rama de producción estable.
- `dev`: rama de integración activa; base para el trabajo de features.

Todo el trabajo de features ocurre en ramas de vida corta creadas desde `dev`. Nunca se trabaja directamente sobre `master` ni sobre `dev`.

### Nomenclatura de ramas

```
feature/<descripción-en-kebab-case>
fix/<descripción-en-kebab-case>
```

Usar `feature/` para nuevas funcionalidades y `fix/` para correcciones de defecto. La descripción debe ser breve y legible.

## Inicio de una feature

Al comenzar la fase de especificación de una feature:

1. Hacer `git pull` sobre `dev` para asegurar que la base local está al día.
2. Crear la nueva rama desde `dev`:
   ```
   git checkout -b feature/<descripción>
   ```
   o `fix/<descripción>` según corresponda.

Todos los artefactos del flujo (spec, design, tasks, código, documentación) se generan sobre esta rama durante el ciclo de vida de la feature. No se hacen commits intermedios de trabajo parcial.

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

## Commit al cerrar el flujo

Un único commit por feature, realizado al finalizar la fase documental con `update-app-documentation`. Este commit incluye todo:

- código fuente y tests
- documentación funcional actualizada (`ai-workflow/docs/`)
- artefactos del flujo de la feature (`spec.md`, `design.md`, `tasks.md`, `status.yaml`)

Patrón de mensaje:

```
feat: implement feature NNNN — short description
```

Para correcciones:

```
fix: fix NNNN — short description
```

No se hacen commits intermedios por tarea, por fase ni por tipo de artefacto.

## Separador en mensajes de feature

Usar em dash (`—`) como separador entre el prefijo de feature y la descripción breve. No usar guion simple (`-`):

```
✓ feat: implement feature 0088 — form file input
✗ feat: implement feature 0088 - form file input
```

## Lo que no aplica

- No se hacen commits parciales durante la implementación.
- No se usan squash merges, rebase interactivos ni amends de commits ya empujados a remoto.
- No hay changelog generado automáticamente desde los commits.
