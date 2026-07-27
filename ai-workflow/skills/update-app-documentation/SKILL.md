---
name: update-app-documentation
description: Actualiza la documentación funcional y operativa del proyecto después de una implementación ya realizada. Úsala cuando el código y los tests relevantes ya estén cerrados y quieras reflejar el comportamiento estable en `ai-workflow/docs/` y en el índice de features.
model: haiku
allowed-tools: Read, Edit, Bash
---

# Actualizar documentación de la app

Usa esta skill cuando una implementación ya está hecha y validada, y ahora toca reflejar sus efectos en la documentación
del proyecto.

Esta skill debe comportarse como una fase documental posterior al código: revisar qué cambió realmente, decidir qué
documentos quedan afectados y actualizarlos sin reabrir la implementación.

## Cuándo NO usar esta skill

- El código de la feature todavía está en curso o tiene tareas sin cerrar → terminar la implementación primero
- Los tests relevantes fallan o están incompletos → resolver antes de documentar
- `status.yaml` tiene bloqueos abiertos que invaliden el cierre documental → resolver el bloqueo primero
- La implementación contradice materialmente la `spec.md` → realinear spec e implementación antes de documentar

## Uso de Bash

Las únicas órdenes Bash aceptables en esta skill son las descritas en `ai-workflow/docs/vcs.md`. No ejecutar tests,
builds, ni operaciones destructivas más allá de las allí documentadas.

## Leer siempre

- `ai-workflow/docs/vcs.md`
- `ai-workflow/features/NNNN-feature-name/spec.md`
- `ai-workflow/features/NNNN-feature-name/status.yaml`
- `ai-workflow/docs/app-features/index.md`
- solo las fichas de `ai-workflow/docs/app-features/` que el índice marque como relevantes para la feature
  implementada (típicamente 1-3, rara vez más de 5)
- `ai-workflow/features/index.md` si existe

## Ejecutar siempre al arrancar

- Aplicar la sección **"Diff filtrado para actualización de documentación"** de `ai-workflow/docs/vcs.md` para
  obtener qué archivos relevantes cambiaron y su contenido.
- No leer archivos de código fuente adicionales para inferir el comportamiento; el diff filtrado basta.

## Leer si aplica

- `ai-workflow/docs/architecture.md` si la implementación consolidó una decisión arquitectónica estable.
- `ai-workflow/docs/conventions.md` si la implementación consolidó una convención repetible.
- `ai-workflow/docs/test-index.md` si la implementación añadió, movió o eliminó ficheros de test.
- `ai-workflow/docs/current-state.md` si hay que confirmar o actualizar capacidades vigentes o límites globales.
- `ai-workflow/docs/context.md` solo si el cambio requiere revisar el marco general del producto.
- `README.md` solo si hace falta ajustar información breve de entrada.

## Objetivo

Actualizar la documentación para que describa el comportamiento estable realmente implementado, usando el índice de
features como puerta de entrada y manteniendo el contexto corto.

Antes de empezar, comprobar que ninguna de las condiciones de "Cuándo NO usar esta skill" aplica.

## Qué documentos puede actualizar

- la ficha o fichas afectadas en `ai-workflow/docs/app-features/`
- `ai-workflow/docs/app-features/index.md` si cambia el mapa documental o hay que ajustar descripciones
- `ai-workflow/docs/current-state.md` si cambian capacidades vigentes
- `ai-workflow/docs/context.md` solo si cambia el marco general del producto
- `ai-workflow/docs/architecture.md` si la implementación consolidó una decisión arquitectónica estable
- `ai-workflow/docs/conventions.md` si la implementación consolidó una convención repetible
- `ai-workflow/docs/test-index.md` si la implementación añadió, movió o eliminó ficheros de test
- `ai-workflow/features/index.md` si conviene afinar el mapa de features entregadas
- `README.md` solo si hace falta ajustar información breve de entrada

## Flujo de trabajo

1. Identificar qué parte del comportamiento cambió realmente en el código ya implementado.
2. Cruzar ese cambio con la `spec.md` y el índice de features para detectar qué documentos son relevantes.
3. Actualizar primero la ficha o fichas funcionales afectadas en `ai-workflow/docs/app-features/`.
4. Ajustar `ai-workflow/docs/app-features/index.md` si cambió el inventario de features documentadas, el alcance de una
   ficha o su descripción corta.
5. Actualizar `current-state.md` si la capacidad ya forma parte del estado vigente del producto.
6. Actualizar `context.md`, `architecture.md` o `conventions.md` solo cuando el cambio sea suficientemente general o
   estable como para merecerlo.
7. Cerrar explícitamente el estado documental de la tarea actualizando `status.yaml` (campos `documentation.ready`/
   `documentation.done`) según las reglas de trabajo de esta skill.
8. Dejar la documentación alineada con el comportamiento real sin convertir los documentos en un changelog.
9. Leer `ai-workflow/docs/vcs.md` y aplicar su sección **"Fase update-app-documentation"** cuando corresponda,
   ejecutando directamente sin pedir confirmación.

## Reglas de trabajo

- No implementar código en esta skill.
- No reabrir decisiones de producto ya cerradas salvo que la implementación y la `spec` estén claramente en conflicto.
- No actualizar documentos "por si acaso"; tocar solo los realmente afectados.
- Mantener `context.md` breve y usar las fichas de `app-features/` para el detalle funcional.
- Mantener `app-features/index.md` como índice descriptivo y puerta de entrada para futuras skills.
- Si una feature nueva aparece como área funcional diferenciada, añadir su ficha al índice.
- Si una feature existente cambió de alcance, actualizar tanto su ficha como la descripción en el índice.
- Tratar el cierre documental como el segundo estado explícito de finalización de la tarea, posterior al cierre de
  implementación y tests.
- No convertir `README.md` en historial acumulado.
- Si el gate documental no se cumple, detenerse y explicar qué estado de `status.yaml` impide documentar.
- Al terminar, actualizar `status.yaml` como mínimo con:
    - `documentation.ready: true` cuando la implementación ya estaba lista para documentarse
    - `documentation.done: true` cuando la pasada documental queda cerrada
    - `phase: complete` cuando la feature quede cerrada en esta pasada documental
    - `feature_status: completed` cuando ya no quede trabajo pendiente dentro del alcance acordado

## Detente y señala un problema cuando

- el código implementado no deja claro cuál es el comportamiento final
- la implementación contradice de forma material a `spec.md`
- la documentación que debería cambiar es mucho mayor de lo esperado y parece indicar falta de replanificación
- falta contexto para decidir si una capacidad ya es estable o sigue siendo parcial

## Terminado cuando

1. la documentación afectada refleja el comportamiento estable real
2. el índice `ai-workflow/docs/app-features/index.md` sigue siendo una puerta de entrada fiable
3. `current-state.md` y `context.md` solo se tocan cuando realmente corresponde
4. `status.yaml` refleja el cierre documental real de la feature o del alcance tratado
5. queda cerrado el estado documental explícito de la tarea
6. la feature puede quedar marcada como `completed` directamente desde esta pasada si ya no queda trabajo pendiente
7. no se han introducido cambios de código en esta pasada