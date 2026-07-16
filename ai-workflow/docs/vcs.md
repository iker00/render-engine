# Control de versiones
El proyecto utiliza Git como sistema de control de versiones.

## Estrategia de ramas

El proyecto usa dos ramas permanentes:
- `master`: rama de producción estable.
- `dev`: rama de integración activa; base para el trabajo de features.

Todo el trabajo de features ocurre en ramas de vida corta creadas desde `dev`. Nunca se trabaja directamente sobre `master` ni sobre `dev`.

**Política de commits**: Cada feature se consolida en **un único commit** al final de su ciclo de vida completo que incluye TODOS los cambios siguientes:
- Código fuente y tests.
- Documentación funcional actualizada (`ai-workflow/docs/app-features/`).
- Artefactos del flujo de la feature (`spec.md`, `design.md`, `tasks.md`, `status.yaml`).

**No se hacen commits intermedios** de trabajo parcial, ni commits separados por fase (implementación vs. documentación). Todos los cambios permanecen en working tree hasta que la feature esté completamente lista (código + tests + documentación + artefactos), momento en el que se consolida en un único commit.

### Nomenclatura de ramas
```
feature/<descripción-en-kebab-case>
fix/<descripción-en-kebab-case>
```
Usar `feature/` para nuevas funcionalidades y `fix/` para correcciones de defecto. La descripción debe ser breve y legible.

## Fase generate-feature-spec

Al comenzar la fase de especificación de una feature:
1. Hacer `git checkout dev`. Si el `checkout` falla por cambios sin commitear (working tree sucio), **detener el flujo y avisar** para decidir manualmente cómo proceder (no hacer stash ni descartar cambios automáticamente).
2. Hacer `git pull` para asegurar que la base local está al día.
3. Crear la nueva rama desde `dev`:
   ```
   git checkout -b feature/<descripción>
   ```
   o `fix/<descripción>` según corresponda.

Todos los artefactos del flujo (spec, design, tasks, código, documentación) se generan sobre esta rama durante el ciclo de vida de la feature. **No se hacen commits intermedios de trabajo parcial.** Todos los cambios permanecen en el working tree hasta que la feature esté completamente lista (implementación + documentación).

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

## Fase update-app-documentation

**IMPORTANTE: Esta es la última fase. Una vez aquí, se hace UN ÚNICO COMMIT con TODO.**

Cuando `status.yaml` marca `feature_status: completed` y `documentation.done: true`, la feature está lista para commit. Proceder inmediatamente sin pedir confirmación adicional.

Al finalizar implementación y documentación (cuando código, tests y documentación están completos, reflejado en `status.yaml`):

1. **Verificar que está todo en working tree** (nada commiteado aún, o todo revertido a antes del primer commit si los hubo):
   - ✅ Código fuente implementado
   - ✅ Tests completos y verdes
   - ✅ Documentación funcional actualizada en `ai-workflow/docs/app-features/`
   - ✅ Artefactos de feature completos (`spec.md`, `design.md`, `tasks.md`, `status.yaml`)

2. **Hacer el commit único** con todos los cambios:
   ```
   git add .
   git commit -m "feat: implement feature NNNN — short description"
   ```
   Para correcciones:
   ```
   git commit -m "fix: fix NNNN — short description"
   ```

3. **Pushear y crear el Merge Request**:
   ```
   git push -o merge_request.create -o merge_request.target=dev -o merge_request.title="<mismo patrón que el commit>" -o merge_request.description="<descripción en una sola línea>" origin <nombre-rama>
   ```
   - Título: mismo patrón que el mensaje de commit.
   - Descripción: **una sola línea sin saltos de línea**. Las opciones `-o` de `git push` rechazan cualquier carácter de nueva línea (`fatal: push options must not have new line characters`), por lo que la descripción no puede ser el volcado literal de `spec.md`. Escribir un resumen breve en una sola línea (por ejemplo, la sección "Objetivo" de la spec compactada) y, si hace falta la spec completa como cuerpo del MR, editarla desde la UI de GitLab tras la creación.
   - Sin asignación de reviewer ni assignee por defecto.

**Regla de oro**: Si encuentras un commit parcial (solo código sin docs, o docs sin código), eso es un error. El flujo debe terminar con UN ÚNICO COMMIT que incluya código, tests, documentación y artefactos.

## Lo que NO aplica (errores comunes a evitar)
- ❌ No se hacen commits parciales durante la implementación (ej: commit de código sin docs, o docs en commit separado).
- ❌ No se hacen commits intermedios por tarea, por fase (implementación vs. documentación) ni por tipo de artefacto.
- ❌ No se usan squash merges, rebase interactivos ni amends de commits ya empujados a remoto.
- ❌ No hay changelog generado automáticamente desde los commits.
- ❌ No se hacen "commits de documentación" separados después de un "commit de código". Ejemplo incorrecto: `git commit código/tests`, luego `git commit docs/`. Debe ser: un solo commit con todo.
