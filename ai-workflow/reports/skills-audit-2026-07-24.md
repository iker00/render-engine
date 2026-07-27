# Auditoría de skills del workflow — informe de mejoras propuestas

Fecha: 2026-07-24
Alcance: skills en `ai-workflow/skills/` — análisis sin aplicar cambios.

---

# Skill: explore-feature-scope

## Ficha rápida

- Modelo actual: `haiku`
- Allowed-tools actual: sin restricción
- Fase del workflow: exploración previa a spec
- Tamaño estimado del SKILL.md: 56 líneas

## Problemas detectados

- **P1 — Lectura defensiva en "Leer siempre"**: `ai-workflow/docs/context.md` se pide siempre, pero la skill no produce
  artefactos y ya declara que "no toca `status.yaml`". Cita: *"## Leer siempre — `ai-workflow/docs/context.md`"*.
  Impacto: **medio** (context.md es un fichero grande y se paga en cada invocación conversacional).
- **P1 — Condición vaga en "Leer si aplica"**: *"`ai-workflow/docs/index.md` solo como mapa documental auxiliar si no
  está claro qué contexto adicional seleccionar"*. Es el patrón "por si acaso" clásico. Impacto: **bajo** (fichero corto
  pero se abre a menudo).
- **P1 — Selección amplia de fichas**: *"solo las fichas relevantes si la conversación afecta comportamiento de
  producto, contrato JSON, runtime visible, formularios, queries, navegación o modo de desarrollo local"*. La
  enumeración cubre casi todo el producto; en la práctica se traduce en "lee muchas fichas". Impacto: **medio**.
- **P8 — Falta `allowed-tools`**: el frontmatter no restringe herramientas; una skill conversacional pura no necesita
  Edit/Write/Bash. Impacto: **bajo** en tokens de ejecución, **medio** en riesgo de scope creep silencioso.
- **P9 — Sin cota numérica** en "solo las fichas relevantes"; a diferencia de `update-app-documentation`, no hay un "
  típicamente 1-3". Impacto: **bajo/medio**.

## Propuestas de mejora

1. [ ] **Restringir `allowed-tools` a `Read`** en el frontmatter (sección: frontmatter). Impacto: **medio**. **Seguro**.
2. [ ] **Mover `context.md` de "Leer siempre" a "Leer si aplica"** con condición concreta (p. ej. "si la conversación
   menciona un dominio del producto no evidente"). Impacto: **medio**. **Controvertido** (el usuario puede considerar
   context.md nuclear para exploración).
3. [ ] **Eliminar la línea `docs/index.md` "solo como mapa auxiliar"**; si el modelo no sabe qué leer, mejor que pregunte al
   usuario. Impacto: **bajo**. **Seguro**.
4. [ ] **Añadir cota numérica** a la selección de fichas: "típicamente 0-2 fichas; nunca más de 3 en una conversación de
   exploración". Impacto: **medio**. **Seguro**.
5. [ ] **Compactar el bloque `## Reglas de trabajo`**: las reglas 1-4 ("no crear/no modificar") ya están dichas al inicio ("
   Esta skill no produce artefactos..."). Deduplicar. Impacto: **bajo**. **Seguro**.

## Ganancia estimada agregada

**Media** — 30-45%. La skill es corta y no genera artefactos; el gasto real viene de las lecturas defensivas de
`context.md` y de fichas. Restringiendo lecturas y tools se reduce significativamente el bootstrap por invocación.

---

# Skill: generate-feature-spec

## Ficha rápida

- Modelo actual: `sonnet`
- Allowed-tools actual: sin restricción
- Fase del workflow: spec
- Tamaño estimado del SKILL.md: 132 líneas

## Problemas detectados

- **P1 — "Leer siempre" excesiva**: incluye `workflow.md`, `context.md`, `app-features/index.md`, `architecture.md`,
  `conventions.md`, `current-state.md`, más las fichas relevantes. Para una spec funcional, `architecture.md` y
  `conventions.md` son técnicas y raramente cambian la spec. Cita: *"## Leer
  siempre — `ai-workflow/docs/architecture.md`, `ai-workflow/docs/conventions.md`"*. Impacto: **alto** (ambos ficheros
  son gruesos y estables).
- **P1 — Condición ambigua**: *"solo las fichas de `ai-workflow/docs/app-features/` que el índice marque como
  relevantes para la petición"* sin cota numérica ni criterio de corte. Impacto: **medio**.
- **P1 — Fichero fantasma en "Leer siempre"**: *"`ai-workflow/features/NNNN-feature-name/spec.md` si ya existe"* —
  está bien, pero también aparece el `status.yaml` "si existe" en la misma lista. Los "si existe" mezclados con "Leer
  siempre" invitan a lecturas ciegas. Impacto: **bajo**.
- **P4 — Redundancia**: la restricción "no escribir design.md desde esta skill" aparece 3 veces (Objetivo, Reglas de
  trabajo, "Terminado cuando" vía redirección). Cita: *"No escribir `design.md` desde esta skill"* + *"No
  escribir `design.md` desde esta skill. Si la feature necesita decisiones técnicas..."*. Impacto: **bajo**.
- **P4 — Duplicación de reglas de status.yaml**: la lista de campos a actualizar en `status.yaml` está tanto en "
  Reglas de trabajo" (viñeta larga) como reforzada en "Terminado cuando". Impacto: **bajo**.
- **P5 — Incoherencia sutil**: *"Si no existe `status.yaml`, crearlo usando `ai-workflow/templates/status.yaml`"*.
  La skill no lista `templates/status.yaml` en "Leer siempre" ni "Leer si aplica"; el modelo lo abrirá igualmente cuando
  aplique, sin declararlo. Impacto: **bajo**.
- **P8 — Falta `allowed-tools`**. La skill necesita Read/Write/Edit y Bash (por VCS). Restringir a esas 4 tools
  mejora el bootstrap. Impacto: **medio**.
- **P9 — Sin cota numérica** en fichas relevantes. Impacto: **medio**.

## Propuestas de mejora

1. [ ] **Mover `architecture.md` y `conventions.md` a "Leer si aplica"** con condiciones concretas ("si la petición menciona
   límite arquitectónico o convención de naming"). Impacto: **alto**. **Controvertido** (usuario decide si quiere
   garantizar coherencia técnica siempre).
2. [ ] **Restringir `allowed-tools` a `Read, Write, Edit, Bash`** en frontmatter. Impacto: **medio**. **Seguro**.
3. [ ] **Añadir cota numérica** a "fichas relevantes": "típicamente 1-3, rara vez más de 5" (coherente con
   `update-app-documentation`). Impacto: **medio**. **Seguro**.
4. [ ] **Deduplicar "no escribir design.md"** dejándolo solo en "Restricciones" o en un único bloque. Impacto: **bajo**. *
   *Seguro**.
5. [ ] **Añadir `templates/status.yaml` a "Leer si aplica"** con condición "si `status.yaml` de la feature no existe".
   Impacto: **bajo**. **Seguro**.
6. [ ] **Fusionar la lista de campos de `status.yaml`** en un único bloque referenciado desde ambas secciones en lugar de
   repetirla. Impacto: **bajo**. **Seguro**.

## Ganancia estimada agregada

**Media/alta** — 35-50%. El grueso viene de mover `architecture.md`/`conventions.md` fuera de "Leer siempre" y de acotar
fichas.

---

# Skill: generate-feature-design

## Ficha rápida

- Modelo actual: `claude-opus-4-7`
- Allowed-tools actual: sin restricción
- Fase del workflow: design
- Tamaño estimado del SKILL.md: 117 líneas

## Problemas detectados

- **P7 — Modelo probablemente sobredimensionado**: `design.md` es un artefacto conversacional-analítico corto. Opus 4.7
  es lo más caro; para spec y design el usuario indicó que Sonnet suele bastar. La ejecución de 1.4M tokens en un design
  apunta a que cada input se procesa con Opus. Impacto: **alto**.
- **P1 — "Leer siempre" muy larga**: incluye `workflow.md`, `spec.md`, `status.yaml`, `design.md` previo, `context.md`,
  `architecture.md`, `conventions.md`, `app-features/index.md`, fichas relevantes, y `templates/design.md`. Impacto: *
  *alto** (Opus × muchos ficheros = coste desproporcionado).
- **P2 — Puerta abierta a leer código**: *"Código y tests actuales de las áreas afectadas cuando una decisión técnica
  dependa del estado real del runtime"*. Sin criterio para "dependa"; el modelo defenderá siempre que "depende".
  Impacto: **alto** (leer código es lo más caro del proyecto).
- **P1 — Condición vaga habitual**: *"`ai-workflow/docs/index.md` solo como mapa documental auxiliar si no está claro
  qué contexto adicional seleccionar"*. Impacto: **bajo**.
- **P4 — Redundancia**: "No escribir `tasks.md`" aparece en Objetivo y en Restricciones. "No implementar código"
  también. Impacto: **bajo**.
- **P4 — Formato de preguntas repetido**: el mismo patrón de "Fase de aclaración" que en `generate-feature-spec` (
  numeradas, sugerencia, confirmación) se copia literalmente. Podría vivir en un fragmento compartido o en workflow.md.
  Impacto: **medio** a nivel sistema.
- **P8 — Falta `allowed-tools`**. Debería ser Read + Write + Edit. Impacto: **medio**.
- **P9 — Sin cota** en fichas. Impacto: **medio**.

## Propuestas de mejora

1. [ ] **Cambiar modelo a `sonnet`** (o dejar Opus solo si el usuario declara feature de riesgo alto). Impacto: **alto**. *
   *Controvertido** (el usuario debe decidir si sacrifica profundidad analítica).
2. [ ] **Restringir `allowed-tools` a `Read, Write, Edit`** — el design no necesita Bash. Impacto: **medio/alto**. **Seguro
   **.
3. [ ] **Eliminar o endurecer la condición de "leer código"**: sustituir por *"Sólo si la spec/design previo referencian un
   símbolo o módulo específico cuyo comportamiento actual no está en `architecture.md` ni en `context.md`. Máximo 1
   fichero."* Impacto: **alto**. **Seguro** (formaliza P2).
4. [ ] **Mover `architecture.md` y `conventions.md` a "Leer si aplica"** con condición "si el design toca fronteras de
   capa/convención". Impacto: **medio**. **Controvertido**.
5. [ ] **Añadir cota numérica** a fichas relevantes. Impacto: **medio**. **Seguro**.
6. [ ] **Deduplicar restricciones** en un solo bloque. Impacto: **bajo**. **Seguro**.

## Ganancia estimada agregada

**Alta** — 50-70%. El cambio de modelo por sí solo puede recortar >50% si el número de tokens de input es similar;
endurecer la puerta al código evita picos de gasto.

---

# Skill: generate-implementation-plan

## Ficha rápida

- Modelo actual: `claude-opus-4-7`
- Allowed-tools actual: sin restricción
- Fase del workflow: planning
- Tamaño estimado del SKILL.md: 163 líneas

## Problemas detectados

- **P1 — "Leer siempre" extensa**: `workflow.md`, `spec.md`, `status.yaml`, `design.md` condicional, `tasks.md`,
  `context.md`, `app-features/index.md`, fichas relevantes, `standards/testing-rules.md`, `test-index.md`,
  `standards/coding-style.md`. Los dos ficheros de standards son estables y no cambian por feature. Impacto: **alto** (
  Opus × standards estables).
- **P2 — Puerta abierta a leer código**: *"Archivos relevantes de `ai-workflow/examples/` si existen ejemplos reales
  aplicables"* — con "si aplica" sin criterio de corte. Y no hay una prohibición explícita de leer `src/`; ausencia de
  mención invita al modelo a hacerlo cuando decide "impacto en archivos". Impacto: **alto**.
- **P5 — Incoherencia**: `tasks.md` aparece en "Leer siempre" con "si existe" pero el gate de entrada dice *"antes de
  planificar"* — en la primera ejecución no existe. Ese "si existe" mezclado con "Leer siempre" es exactamente el signo
  de P1. Impacto: **bajo**.
- **P4 — Redundancia larga**: las restricciones sobre `design.md` aparecen en "Objetivo", "Reglas de planificación" (dos
  veces) y "Restricciones". Cita: *"No crear ni refinar `design.md`. Si el plan requiere decisiones técnicas que aún no
  existen, devolver el control a `generate-feature-design`"* — duplicado. Impacto: **medio** (bloque grande).
- **P4 — Sub-bloque `tests` documentado tres veces**: en `Qué debe incluir` (viñeta corta), en
  `Sub-bloque tests de cada tarea` (largo) y otra vez en `Terminado cuando`. Impacto: **medio**.
- **P10 — Delegación en subagente para review sin justificación clara**: *"lanzar automáticamente una revisión del plan
  usando un sub-agente con contexto limpio"*. El razonamiento "contexto limpio" está implícito pero no explícito; y el
  sub-agente vuelve a bootstrapear el contexto de review-implementation-plan. Ver P10 sistémico. Impacto: **alto** (cada
  plan paga dos veces el bootstrap).
- **P8 — Falta `allowed-tools`**. Debería ser Read + Write + Edit + Agent. Impacto: **medio**.
- **P9 — Sin cota** en fichas. Impacto: **medio**.

## Propuestas de mejora

1. [ ] **Mover `standards/testing-rules.md` y `standards/coding-style.md` a "Leer si aplica"** con condición concreta ("si
   la feature introduce tests con harness nuevo" / "si toca un módulo con convención específica"). Impacto: **alto**. *
   *Controvertido** (el usuario puede querer garantía siempre).
2. [ ] **Añadir prohibición explícita de leer `src/`** en Restricciones, con excepción única y justificada (ej: "solo si una
   tarea concreta requiere confirmar un símbolo específico y no está en `test-index.md`"). Impacto: **alto**. **Seguro
   **.
3. [ ] **Restringir `allowed-tools` a `Read, Write, Edit, Agent`** — nunca Bash desde planning. Impacto: **medio**. **Seguro
   **.
4. [ ] **Reconsiderar el review automático como subagente**: alternativas: (a) hacer review inline en el mismo turno con la
   skill de plan (reusa contexto), (b) permitir invocación manual pero eliminar la automática. Impacto: **alto**. *
   *Controvertido** (afecta arquitectura de workflow — decisión del usuario).
5. [ ] **Deduplicar el bloque `design.md`**: dejarlo solo en "Restricciones" con una línea. Impacto: **medio**. **Seguro**.
6. [ ] **Deduplicar el sub-bloque `tests`**: la descripción larga vive en un único sitio y las otras la referencian.
   Impacto: **bajo**. **Seguro**.
7. [ ] **Añadir cota numérica** a fichas. Impacto: **medio**. **Seguro**.

## Ganancia estimada agregada

**Alta** — 40-60%. El gran ahorro viene de (a) eliminar la re-bootstrap del subagente de review y (b) sacar los
standards estables de "Leer siempre".

---

# Skill: review-implementation-plan

## Ficha rápida

- Modelo actual: `claude-opus-4-7`
- Allowed-tools actual: sin restricción
- Fase del workflow: review del plan
- Tamaño estimado del SKILL.md: ~91 líneas

## Problemas detectados

- **P7 — Modelo posiblemente sobredimensionado**: revisión estructural de un `tasks.md`; Sonnet debería bastar salvo que
  la feature sea de alto riesgo. Impacto: **medio/alto** (multiplicado si se lanza como subagente cada vez).
- **P1 — "Leer siempre" duplica lo que ya leyó el planner**: cuando se ejecuta como subagente lanzado por
  `generate-implementation-plan`, releerá todos los ficheros que el planner acaba de procesar (workflow.md, spec.md,
  tasks.md, status.yaml, context.md, app-features/index.md, testing-rules.md, coding-style.md, etc.). Este es el corazón
  del sobrecoste por delegación (P10). Impacto: **alto**.
- **P4 — Redundancia con generate-implementation-plan**: el sub-bloque "Verificaciones específicas del sub-bloque
  `tests`" repite casi textualmente lo que ya está en el contrato del planner. Cita: *"Cada fichero de test del
  sub-bloque está anotado con su rol explícito..."* — está copiado. Impacto: **bajo** en tokens; **medio** en
  mantenimiento.
- **P5 — Modos ambiguos**: la sección "Modos de invocación" declara dos modos con "el mismo contrato", pero luego "
  Salida esperada en modo sub-agente" es distinta. Falta un modo por defecto claro para la invocación manual. Impacto: *
  *bajo**.
- **P8 — Falta `allowed-tools`**. Debería ser Read + Edit. Impacto: **bajo/medio**.
- **P9 — Sin cota** en fichas. Impacto: **medio**.

## Propuestas de mejora

1. [ ] **Cambiar modelo a `sonnet`**. Impacto: **medio/alto**. **Controvertido**.
2. [ ] **Si se mantiene la delegación desde el planner, adoptar el patrón de `implement-task-test-first`** (prefijo
   cacheable) — o mejor, ejecutar review inline y eliminar la subagentización. Impacto: **alto**. **Controvertido**.
3. [ ] **Restringir `allowed-tools` a `Read, Edit`**. Impacto: **bajo**. **Seguro**.
4. [ ] **Referenciar el contrato del sub-bloque `tests`** desde `generate-implementation-plan` en lugar de duplicarlo.
   Impacto: **bajo**. **Seguro**.
5. [ ] **Añadir cota numérica** a fichas relevantes. Impacto: **medio**. **Seguro**.

## Ganancia estimada agregada

**Media** — 30-50%. La ganancia real depende de si se elimina la subagentización automática (que es la que multiplica el
gasto).

---

# Skill: implement-task-test-first

## Ficha rápida

- Modelo actual: `sonnet` (orquestador)
- Allowed-tools actual: sin restricción
- Fase del workflow: implementation
- Tamaño estimado del SKILL.md: 121 líneas + `subagent-prompt.md` 119 líneas + `build-context.sh`

## Problemas detectados

- **P10 — Delegación bien justificada**: esta skill es de hecho el ejemplo del uso legítimo — contrato quirúrgico por
  tarea con contexto compartido cacheable. **No es un problema**, es el patrón que las otras skills deberían emular.
- **P1 — Menor**: la "Leer siempre (orquestador)" es mínima y correcta (workflow, tasks, status). Buena calibración.
- **P2 — Aparente: el subagente lee código**, pero está justificado (implementa código). No es un problema.
- **P4 — Redundancia menor**: la "Salida obligatoria" del subagent-prompt.md se describe también en la SKILL.md ("
  Esperar como única salida un JSON con la forma documentada..."). Aceptable, es contrato entre orquestador y subagente.
  Impacto: **bajo**.
- **P5 — Detalle en subagent-prompt**: *"Si la tarea remite explícitamente a una feature funcional concreta, leer
  también su ficha en `ai-workflow/docs/app-features/` y la sección relevante de `ai-workflow/docs/context.md`"*. Ambas
  rutas ya vienen en el prefijo cacheable — no, `context.md` NO viene en el prefijo (ver `build-context.sh`: solo
  workflow, conventions, architecture, test-index). Es una lectura extra por tarea. Impacto: **medio** (multiplicado por
  N tareas).
- **P8 — Falta `allowed-tools`** en el orquestador. Debería incluir Read, Edit, Bash, Agent. Impacto: **bajo/medio**.
- **P7 — Bien calibrado**: sonnet en orquestador con delegación es correcto.

## Propuestas de mejora

1. [ ] **Añadir `context.md` al prefijo cacheable de `build-context.sh`** si la instrucción del subagente lo permite leer
   bajo condición. Alternativa: eliminar la instrucción de leer `context.md` desde el subagente y confiar en que la
   tarea ya cita lo necesario. Impacto: **medio**. **Seguro** (elegir una de las dos vías).
2. [ ] **Restringir `allowed-tools` del orquestador a `Read, Edit, Bash, Agent`** — no necesita Write directo. Impacto: *
   *bajo**. **Seguro**.
3. [ ] **Simplificar la sección "Salida obligatoria" duplicada**: en SKILL.md solo enumerar campos, dejar la estructura JSON
   en `subagent-prompt.md`. Impacto: **bajo**. **Seguro**.
4. [ ] **Explicitar en la doc de la skill que `build-context.sh` re-ejecutado dentro de la misma pasada es idempotente y no
   re-invalida caché**; ya está insinuado pero mejorable. Impacto: **bajo**. **Seguro**.

## Ganancia estimada agregada

**Baja** — 5-15%. Esta skill ya está bien optimizada (patrón prefijo cacheable). Sólo pequeños ajustes.

---

# Skill: update-app-documentation

## Ficha rápida

- Modelo actual: `haiku`
- Allowed-tools actual: `Read, Edit, Bash`
- Fase del workflow: docs
- Tamaño estimado del SKILL.md: 106 líneas

## Problemas detectados

- **P1 — Bloque "Ejecutar siempre al arrancar" con Bash implícito para VCS**: el `git diff dev` puede ser enorme según
  el tamaño de la feature. La consigna *"no leer archivos de código fuente para inferir el comportamiento; el diff
  basta"* es buena, pero el diff ya trae todo el código como texto — sigue siendo caro. Impacto: **alto** (posible
  origen del gasto de 5.1M).
- **P5 — Incoherencia entre "Leer siempre" y "Qué documentos puede actualizar"**: *"puede actualizar `README.md`"*
  aparece pero README solo está en "Leer si aplica". Está bien resuelto en este caso, pero la lista de "puede
  actualizar" incluye `architecture.md` y `conventions.md` que sí están en "Leer si aplica" — coherente. Impacto: **nulo
  **.
- **P4 — Redundancia con "Cuándo NO usar" + gate documental**: los cuatro bullets de "Cuándo NO usar" repiten lo que
  dice el gate en "Objetivo". Impacto: **bajo**.
- **P5 — Contradicción con `vcs.md`**: la skill dice *"Leer `ai-workflow/docs/vcs.md` y aplicar su sección Fase
  update-app-documentation"* como paso 9 del flujo, pero también dice al inicio *"Las únicas órdenes Bash aceptables en
  esta skill son las descritas en `ai-workflow/docs/vcs.md`"* — o sea, `vcs.md` es load-bearing pero **no está en "Leer
  siempre"**. Impacto: **medio** (se abre igualmente pero desordena el flujo).
- **P9 — Presente y correcta**: *"típicamente 1-3, rara vez más de 5"* — buen ejemplo a replicar.
- **P7 — Modelo bien**: `haiku` es correcto para escritura documental mecánica. Pero: para procesar un diff grande,
  Haiku puede requerir varias rondas y perder coherencia. Considerar `sonnet` como fallback si el diff supera cierto
  umbral. Impacto: **debate abierto**.

## Propuestas de mejora

1. [ ] **Añadir `ai-workflow/docs/vcs.md` a "Leer siempre"** — es load-bearing y hoy se está abriendo mid-flujo. Impacto: *
   *bajo**. **Seguro**.
2. [ ] **Cambiar la orden de VCS**: en lugar de `git diff dev` (código completo), obtener primero
   `git diff --name-only dev` + `git diff --stat dev`, y sólo pedir el contenido de los archivos de código que la ficha
   decida documentar. Impacto: **muy alto** (probable causa raíz del gasto de 5.1M). **Controvertido** (cambia el
   contrato del flujo VCS documentado).
3. [ ] **Deduplicar "Cuándo NO usar" con el gate**: dejar el gate como fuente única. Impacto: **bajo**. **Seguro**.
4. [ ] **Sustituir los checkbox `- [ ]`** por bullets normales — el modelo puede interpretar checkboxes como tareas
   obligatorias en vez de guía. Impacto: **bajo**. **Seguro**.
5. [ ] **Añadir bandera de escalado de modelo**: si el diff supera N líneas, sugerir invocar la skill con sonnet. Impacto: *
   *medio**. **Controvertido**.
[ ] 
## Ganancia estimada agregada

**Alta** — 60-80%. La propuesta 2 es el principal driver. Si el 5.1M viene mayoritariamente del diff completo, evitarlo
es la palanca dominante.

---

# Skill: update-interactive-documentation

## Ficha rápida

- Modelo actual: `sonnet`
- Allowed-tools actual: sin restricción
- Fase del workflow: docs (post `update-app-documentation`)
- Tamaño estimado del SKILL.md: 162 líneas

## Problemas detectados

- **P1 — "Leer siempre" pesada por diseño**: *"`src/dev/documentation.json` (fichero completo, todas las páginas)"* + *"
  los `index.md` de cada área en `ai-workflow/docs/app-features/`"*. `documentation.json` es probablemente grande y leer
  todos los `index.md` de áreas puede ser N archivos. Impacto: **alto** (por diseño la skill hace análisis de cobertura,
  requiere ambos; pero puede optimizarse por fases).
- **P1 — `context.md` innecesario**: no está claro que una skill de sincronización JSON necesite `context.md`. Cita:
  *"## Leer siempre — `ai-workflow/docs/context.md`"*. Impacto: **medio**.
- **P2 — Menor**: la skill sólo escribe `documentation.json`, no lee `src/` — bien acotada.
- **P4 — Redundancia**: los "Principios de contenido" y las "Reglas de trabajo" solapan (ambos dicen "no inventar
  props"). Impacto: **bajo**.
- **P5 — Coherencia buena** entre "Cuándo usar" y "Cuándo NO".
- **P8 — Falta `allowed-tools`**. Debería ser Read + Edit + Bash (para el `python3 -c` de validación). Impacto: *
  *bajo/medio**.
- **P9 — Cota implícita bien**: la skill trabaja sobre las brechas detectadas, no invita a leer todo.
- **P6 — Menor**: *"Al añadir páginas nuevas, asignar un `id`..."* — sobre-scope leve pero contenido dentro del contrato
  de la skill.

## Propuestas de mejora

1. [ ] **Sacar `context.md` de "Leer siempre"** (no aporta a sincronizar JSON). Impacto: **medio**. **Seguro**.
2. [ ] **Restringir `allowed-tools` a `Read, Edit, Bash`**. Impacto: **bajo**. **Seguro**.
3. [ ] **Convertir la fase 1 de "Análisis" en un pipeline explícito**: leer sólo el índice + estructura de
   `documentation.json` (páginas y sus títulos, no todo el contenido) para detectar brechas, y sólo cargar el contenido
   detallado de las páginas que se van a modificar. Impacto: **alto**. **Controvertido** (requiere disciplina del modelo
   para dos pasadas).
4. [ ] **Deduplicar "no inventar props"** en un único bloque. Impacto: **bajo**. **Seguro**.

## Ganancia estimada agregada

**Media** — 25-40%. Optimizando la lectura de `documentation.json` en dos fases y sacando `context.md` se recorta
bastante sin cambiar el contrato.

---

# Resumen ejecutivo

## Priorización global

1. `[update-app-documentation]` sustituir `git diff dev` completo por `--name-only` + `--stat` y sólo leer contenido de
   archivos que se vayan a documentar → **impacto muy alto** (probable driver de los 5.1M).
2. `[generate-feature-design]` cambiar modelo Opus → Sonnet → **impacto alto** (probable driver de los 1.4M).
3. `[generate-implementation-plan]` eliminar (o inlinear) el subagente automático de review y evitar re-bootstrap → *
   *impacto alto**.
4. `[generate-feature-design]` endurecer la puerta a "leer código" con criterio numérico ("máximo 1 fichero, sólo si
   referenciado explícitamente") → **impacto alto**.
5. `[generate-implementation-plan]` mover `standards/testing-rules.md`, `coding-style.md` fuera de "Leer siempre" → *
   *impacto alto**.
6. `[generate-feature-spec]` mover `architecture.md` y `conventions.md` a "Leer si aplica" → **impacto alto**.
7. `[review-implementation-plan]` cambiar modelo Opus → Sonnet → **impacto medio/alto**.
8. `[transversal]` añadir `allowed-tools` en todas las skills que no lo tienen → **impacto medio** por skill, agregado
   alto.
9. `[update-interactive-documentation]` dividir análisis de `documentation.json` en dos fases (estructura vs
   contenido) → **impacto medio/alto**.
10. `[transversal]` añadir cota numérica "típicamente 1-3, rara vez más de 5" a toda selección de fichas → **impacto
    medio**.

## Patrones sistémicos

- **P1 endémica**: `context.md`, `architecture.md`, `conventions.md` aparecen en "Leer siempre" de casi todas las
  skills. Estos ficheros son estables y probablemente cacheables si viven en un prefijo compartido. Considerar el mismo
  patrón que `implement-task-test-first` (prefijo cacheable + `build-context.sh`) para las fases donde varias skills
  leen el mismo conjunto. Alternativa más simple: mover a "Leer si aplica" con condición explícita.
- **P8 endémica**: sólo `update-app-documentation` tiene `allowed-tools`. Introducir la práctica en todas las skills es
  una regla de plantilla, no de skill.
- **P9 endémica**: la cota "típicamente 1-3, rara vez más de 5" sólo aparece en `update-app-documentation`. Elevarla a
  regla en `CLAUDE.md` o en plantilla común evita repetir en cada skill.
- **P4 endémica**: repetición de instrucciones de `status.yaml` en varias skills. Un fragmento compartido (por ejemplo
  `ai-workflow/docs/status-fields.md`) referenciado, no copiado, reduce mantenimiento y bootstrap.
- **P10 controlado en una skill, no en otras**: `implement-task-test-first` demuestra que un subagente sólo compensa
  si (a) hay contexto quirúrgico por tarea y (b) hay prefijo cacheable. `generate-implementation-plan` lanza un
  subagente sin ninguna de las dos cosas.
- **Ausencia de referencia a la regla de lecturas paralelas de `CLAUDE.md`**: `CLAUDE.md` ya cubre P3 globalmente; **no
  ** hace falta duplicarlo en cada skill. La verificación es que se cumpla en ejecución, no en la doc.

## Decisiones que debe tomar el usuario

1. **Modelo de `generate-feature-design`**: ¿Opus o Sonnet? Recomendación: Sonnet por defecto; Opus opcional cuando
   `risk_level: high`. **Decisión del usuario**.
2. **Modelo de `review-implementation-plan`**: ¿Opus o Sonnet? Recomendación: Sonnet. **Decisión del usuario**.
3. **Subagente automático de review**: mantener, inlinear o hacer opt-in manual. Recomendación: inlinear (mismo turno
   del planner) y dejar `review-implementation-plan` sólo como invocación manual. **Decisión del usuario**.
4. **Mover `architecture.md` / `conventions.md` fuera de "Leer siempre"** en spec/design/plan. Recomendación: sí, con
   condiciones concretas. **Decisión del usuario** (afecta garantía de coherencia).
5. **VCS en `update-app-documentation`**: cambiar `git diff dev` por `--name-only` + `--stat` + fetch selectivo.
   Recomendación: sí. **Decisión del usuario** (contradice la sección "Diff del cambio en curso" de `vcs.md` que da
   `git diff dev` como fuente única — habría que actualizar también `vcs.md`).
6. **Introducir prefijo cacheable transversal** para las docs estables leídas por spec/design/plan/review (análogo a
   `build-context.sh`). Recomendación: sí, es el patrón que más ahorra a medio plazo, pero es una intervención de
   arquitectura, no un ajuste de skill. **Decisión del usuario**.
7. **Elevar `allowed-tools` a estándar de plantilla** para todas las skills. Recomendación: sí. **Decisión del usuario
   ** (implica revisar cada frontmatter).

## Skills que parecen sanas

- **`implement-task-test-first`**: contexto compartido cacheable, orquestación con contrato JSON, delegación bien
  justificada. Sólo ajustes menores.
- **`explore-feature-scope`**: pequeña, sin producir artefactos; problemas menores. Puede refinarse pero no es
  prioridad.

---

# Anexo — pasada de aplicación 2026-07-24

## Aplicado en esta pasada
- `allowed-tools` añadido en las 7 skills que no lo tenían.
- Cota numérica ("típicamente 1-3, rara vez más de 5") en toda skill que selecciona fichas de `app-features/`.
- `generate-feature-design`: `model: sonnet` (indicativo) + condición endurecida para leer código (máximo 1 fichero, sólo si referenciado explícitamente).
- `review-implementation-plan`: `model: sonnet` (indicativo). Subagente automático se mantiene.
- `generate-feature-spec`: `architecture.md` y `conventions.md` movidos a "Leer si aplica" con condición; añadido `templates/status.yaml` en "Leer si aplica".
- `generate-implementation-plan`: `standards/testing-rules.md` y `standards/coding-style.md` eliminados por completo (viven ahora sólo en el bundle de implementación); prohibición explícita de leer `src/` con excepción única y justificada.
- `implement-task-test-first`: `workflow.md` eliminado del bundle cacheable de `build-context.sh` y del prompt del subagente.
- `explore-feature-scope`: `context.md` movido a "Leer si aplica".
- `update-app-documentation`: `vcs.md` añadido a "Leer siempre"; contrato VCS reescrito con filtro local de exclusión (lockfiles, generados, tooling configs, `src/dev/**`, `ai-workflow/features/**`).
- `ai-workflow/docs/vcs.md`: sección "Diff del cambio en curso" reescrita para reflejar el diff selectivo y documentar el filtro local por skill.

## Descartado por decisión del usuario
- Mover `architecture.md`/`conventions.md` fuera de "Leer siempre" en `generate-feature-design` y `generate-implementation-plan` — el usuario argumenta que design y plan sí necesitan conocer arquitectura y convenciones. Mantenido.
- Eliminar el subagente automático de review lanzado por `generate-implementation-plan` — el motivo original (contexto limpio, revisión adversarial) se mantiene válido, y con Sonnet el coste doble bootstrap es tolerable.
- Introducir prefijo cacheable transversal para spec/design/plan/review — las invocaciones ocurren en momentos separados; el cache TTL no lo aprovecha.
- Aplicar cambios a `update-interactive-documentation` — el usuario decide dejarla fuera del alcance de esta pasada.

## Deduplicaciones aparcadas (no aplicadas)
Cambios seguros de bajo impacto que se aparcan y pueden aplicarse en un pase mecánico separado. Documentados para no perder pista:

- **`explore-feature-scope`**: eliminar la línea `docs/index.md` "solo como mapa auxiliar"; compactar reglas de trabajo duplicadas con la introducción.
- **`generate-feature-spec`**: deduplicar "no escribir design.md" (aparece 3 veces); fusionar en un único bloque la lista larga de campos de `status.yaml` a actualizar.
- **`generate-feature-design`**: deduplicar restricciones repetidas ("No escribir `tasks.md`", "No implementar código").
- **`generate-implementation-plan`**: deduplicar el bloque `design.md` (aparece 4 veces); deduplicar el sub-bloque `tests` (aparece 3 veces).
- **`review-implementation-plan`**: referenciar el sub-bloque `tests` documentado en el planner en lugar de duplicarlo textualmente.
- **`implement-task-test-first`**: simplificar la sección "Salida obligatoria" duplicada entre `SKILL.md` y `subagent-prompt.md`; explicitar la idempotencia de `build-context.sh` en la propia skill.
- **`update-app-documentation`**: deduplicar "Cuándo NO usar esta skill" con el gate documental de "Objetivo"; sustituir los checkbox `- [ ]` por bullets normales en las listas de lectura.
- **`update-interactive-documentation`**: deduplicar "no inventar props" que aparece en "Principios de contenido" y en "Reglas de trabajo".

## Controvertidos no aplicados (revisar más adelante si el gasto sigue alto)
- `update-interactive-documentation`: dividir el análisis en dos fases (estructura vs contenido) para no leer `documentation.json` completo antes de saber qué modificar.
- `update-app-documentation`: bandera de escalado de modelo (Haiku → Sonnet) si el diff filtrado supera un umbral de líneas.
