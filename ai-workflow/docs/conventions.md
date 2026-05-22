# Convenciones del proyecto

## Objetivo de este documento
Definir reglas de implementación para que el código y la documentación mantengan una estructura consistente y fácil de ampliar.

## Nomenclatura

### General
- Usar nombres descriptivos y específicos del dominio.
- Evitar abreviaturas salvo en casos ampliamente conocidos como `id`, `url`, etc.
- El lenguaje de código debe ser consistente con la terminología real del producto.

### Archivos y carpetas
- Usar `kebab-case` para nombres de archivos y carpetas.
- Agrupar por feature o por módulo de dominio, no por tipo técnico global cuando eso dificulte seguir un caso de uso.
- Las carpetas de feature dentro de `ai-workflow/features/` deben seguir el formato `NNNN-feature-name`.
- `NNNN` debe ser incremental y de cuatro dígitos, por ejemplo `0001-user-onboarding`.
- El sufijo debe usar `kebab-case` ASCII para evitar problemas de rutas y tooling.

### Código
- Usar `camelCase` para variables, funciones y propiedades.
- Usar `PascalCase` para componentes React, tipos, interfaces y clases.
- Usar `UPPER_SNAKE_CASE` solo para constantes globales reales.

### Nombres de funciones
- Las funciones deben expresar intención.

Ejemplos:
- `getUserProfile`
- `handleUserLogin`
- `saveFormDraft`
- `buildPreviewState`

## Estructura de carpetas

### Principio general
Separar presentación, estado de aplicación, dominio e integraciones para que cada cambio tenga una ubicación clara.

### Estructura orientativa
```txt
src/
  app/
  features/
  shared/
  tests/
```

### Criterios
- Agrupar por feature cuando mejore la trazabilidad de un caso de uso.
- Mantener en `shared/` solo utilidades o componentes realmente reutilizados.
- Evitar carpetas globales por tipo técnico si eso dispersa el flujo funcional.

## Validación

### Entrada de datos
- Validar en el borde de cada flujo: formularios, URL, almacenamiento local e integraciones externas.
- Normalizar formatos antes de que el dato entre en la lógica de negocio.
- Hacer explícitos los valores por defecto; no confiar en coerciones implícitas.

### Reglas de negocio
- Mantener las reglas de negocio fuera de los componentes visuales.
- Centralizar validaciones repetibles cuando formen parte del contrato del producto.
- Si una regla es parcial o manual, documentarlo en vez de sobreautomatizarla.

## Estilos

### Principios
- Usar `Tailwind CSS` como mecanismo por defecto para los estilos de la UI renderizada.
- Evitar estilos inline en componentes del runtime salvo casos excepcionales y explícitamente justificados.
- No introducir theming ni API visual configurable desde JSON sin una feature específica para ello.
- Los tokens visuales globales compartidos del runtime deben declararse en `src/app/index.css` mediante `@theme`, no dispersarse entre componentes.

### Convención
- Los componentes visuales del runtime deben expresar su presentación con `className` y utilidades de `Tailwind`.
- Cuando exista un token global estable, los nodos deben consumir antes una utilidad de tema como `bg-app-surface` o `text-app-text` que una clase arbitraria basada en `var(--...)`.
- Si `container.props.gap` recibe un valor arbitrario fuera de los alias soportados, la única excepción admitida es pasar una variable CSS local para alimentar una clase de `Tailwind`; no se debe reintroducir un objeto `style` completo para toda la presentación del nodo.
- Si un requisito visual no encaja todavía en una escala de diseño estable, se debe resolver con utilidades de `Tailwind` locales y revisables, no con una API visual paralela.
- Si una necesidad futura exige theming declarativo por JSON o variantes visuales configurables por nodo, debe abrirse como alcance nuevo en vez de mezclarse silenciosamente con la capa de tema global actual.

## Errores

### Principios
- Fallar de forma explícita y predecible.
- No ocultar errores relevantes con `catch` genéricos sin tratamiento.
- Mostrar al usuario mensajes comprensibles y no trazas técnicas.

### Tipos de error
- Error de validación: entrada inválida o incompleta.
- Error de negocio: operación no permitida según el estado actual.
- Error de integración: red, almacenamiento, importación o dependencias externas.

### Convención
- Usar errores o resultados con intención semántica clara.
- Traducir errores técnicos a mensajes comprensibles antes de llegar a la UI.
- Evitar mezclar errores recuperables con fallos fatales en el mismo flujo.

## Logs

### Principios
- Registrar lo suficiente para depurar, no para reconstruir toda la aplicación desde logs.
- Mantener formato y campos consistentes entre flujos similares.

### Qué registrar
- evento relevante
- contexto mínimo para depuración
- resultado o tipo de fallo

### Qué no registrar
- secretos
- datos personales innecesarios
- ruido repetitivo que no ayude a diagnosticar

## Convenciones de documentación
- `context.md` debe mantenerse breve como contexto global mínimo y no debe actuar como puerta de entrada documental.
- El detalle funcional por features de producto debe vivir en `ai-workflow/docs/app-features/`.
- Si una decisión reduce alcance o cambia comportamiento estable de una feature de producto, debe reflejarse en la ficha correspondiente de `ai-workflow/docs/app-features/` y, solo si afecta al marco general, también en `context.md`.
- Actualizar `architecture.md` solo si cambia una frontera arquitectónica, una responsabilidad de capa o un punto de extensión estable.
- Si una tarea cambia criterios de implementación repetibles, actualizar `conventions.md`.

## Convenciones para commands y skills del workflow

### Separación de responsabilidades
- Una `skill` define flujo, artefactos esperados y restricciones de trabajo.
- Un `$command` o su orquestador define política de ejecución: modelo, esfuerzo de razonamiento, límites de contexto y apertura de sesión.
- Un perfil de ejecución define una combinación reutilizable de modelo y esfuerzo de razonamiento.
- La selección de modelo no debe depender implícitamente del cuerpo de la `skill`.

### Reglas
- El `$command` debe tener prioridad sobre cualquier preferencia declarada en una `skill`.
- Una `skill` puede declarar un `preferred_profile` solo como sugerencia o fallback para el runner.
- Si el runner soporta overrides manuales, el usuario debe poder pedir otro perfil sin editar la `skill`.
- Cuando un mismo flujo tenga fases claramente distintas, conviene usar perfiles más baratos para documentación y perfiles más potentes para implementación o revisión.
- Si el runner no soporta perfiles todavía, la `skill` puede documentar la recomendación, pero no debe asumir que el modelo realmente cambiará.

### Perfiles recomendados
- `cheap`: para specs, planes, documentación y tareas mecánicas con poco riesgo.
- `standard`: para implementación habitual y cambios acotados de código con tests.
- `heavy`: para debugging difícil, refactors delicados, revisiones complejas o decisiones arquitectónicas tensas.

### Mapeo recomendado para los commands actuales
- `$generate-feature-spec`: `cheap`
- `$generate-implementation-plan`: `heavy`
- `$implement-task-test-first`: `standard`
- comandos de review o investigación profunda: `heavy`

### Metadatos sugeridos en `SKILL.md`
- `preferred_profile`: perfil recomendado por defecto para ese flujo
- `profile_rationale`: razón breve de coste y profundidad esperada

Estos metadatos no sustituyen la política del comando. Sirven para documentar la intención del flujo y dar un fallback legible al runner cuando no exista una configuración más específica.

## Convenciones de artefactos del workflow

### Artefactos base por feature
- `spec.md` es obligatorio antes de planificar.
- `tasks.md` y `test-plan.md` son obligatorios antes de implementar.
- `status.yaml` es obligatorio desde que la feature entra en discovery o planificación activa.
- `design.md` es opcional por defecto y obligatoria solo cuando la complejidad o el riesgo lo pidan.
- `discovery.md` se usa cuando todavía no conviene comprometer una `spec.md`.

### `status.yaml`
- Debe ser la fuente de verdad mínima del estado de la feature.
- Debe mantenerse breve y legible.
- No debe duplicar la prosa completa de `tasks.md`, `spec.md` o `test-plan.md`.
- Debe reflejar al menos:
  - fase actual
  - nivel de riesgo
  - si `design.md` es requerida
  - artefactos disponibles
  - bloqueos abiertos
  - tarea en curso si existe
  - estado de validación de tests y coverage
  - cierre documental

### Gates mínimos
- No implementar sin `spec.md`, `tasks.md`, `test-plan.md` y, si aplica, `design.md`.
- No pasar a documentación si la implementación de la tarea o del alcance solicitado no está validada.
- No cerrar una feature mientras `status.yaml` no refleje cierre documental explícito.
- No dar por cerrada una tarea de implementación si los tests relevantes no se han ejecutado y no están en verde.
- No dar por válida una pasada de implementación si rompe el umbral de cobertura exigido por el proyecto.

### Validación en `status.yaml`
- `status.yaml` debe poder reflejar si la pasada actual dejó los tests en verde.
- `status.yaml` debe poder reflejar si el gate de coverage quedó superado.
- No hace falta guardar el porcentaje exacto de coverage; basta con el estado del gate.

### `design.md`
- Debe usarse cuando reduzca ambigüedad o riesgo real.
- No debe convertirse en un paso burocrático para cambios simples.
- Cuando exista, debe capturar decisiones técnicas, trade-offs, riesgos y cambios estructurales relevantes, no repetir la `spec.md`.

### `discovery.md`
- Debe ayudar a explorar antes de comprometer la `spec.md`.
- Puede recoger preguntas abiertas, riesgos, tensiones de alcance y documentos a leer.
- No debe convertirse en una implementación encubierta ni en un pseudo-plan técnico.

### Estructura recomendada de `tasks.md`
Cada tarea debería escribirse con una plantilla estable y repetible.

Campos mínimos por tarea:
- `ID`
- `Estado`
- `Objetivo`
- `Fuera de alcance`
- `Dependencias`
- `Impacto esperado en archivos`
- `Tests requeridos`
- `Documentación afectada`
- `Criterios de finalización`
- `Cierre de implementación`
- `Cierre documental`

La redacción puede variar, pero esos bloques no deberían omitirse en features nuevas o replanificadas.
