---
name: update-interactive-documentation
description: Revisa la documentación funcional en `ai-workflow/docs/app-features/` y sincroniza `src/dev/documentation.json` añadiendo secciones nuevas o actualizando las existentes para que la documentación interactiva del runtime refleje todas las capacidades documentadas.
model: sonnet
---

# Actualizar documentación interactiva

Usa esta skill cuando quieras que `src/dev/documentation.json` (la app de documentación interactiva del runtime) refleje fielmente las capacidades documentadas en `ai-workflow/docs/app-features/`.

Esta skill actúa como un puente entre la documentación funcional escrita (fichas `.md`) y la documentación interactiva renderizada por el propio runtime. Su trabajo es detectar brechas y cerrarlas.

## Cuándo usar esta skill

**Úsala cuando:**
- Se han implementado features nuevas y su documentación funcional ya está actualizada, pero `documentation.json` no las refleja
- Se quiere hacer una revisión general de cobertura entre la documentación funcional y la interactiva
- Se han actualizado fichas en `ai-workflow/docs/app-features/` y hay que reflejar los cambios en la app de documentación
- Frases típicas: "actualiza la documentación interactiva", "sincroniza documentation.json", "añade las features nuevas a la doc interactiva"

**No la uses cuando:**
- La documentación funcional en `ai-workflow/docs/app-features/` aún no está actualizada → usar `update-app-documentation` primero
- Solo se quiere actualizar la documentación funcional `.md` sin tocar la app interactiva → usar `update-app-documentation`
- Se quiere implementar código nuevo → usar `implement-task-test-first`

## Leer siempre
Turno 1, en un único turno (varias llamadas Read en el mismo mensaje), los ficheros fijos:
- [ ] `src/dev/documentation.json` (fichero completo, todas las páginas)
- [ ] `ai-workflow/docs/context.md`

Turno 2: lee `ai-workflow/docs/app-features/index.md`; con su contenido, identifica las áreas relevantes y lee sus `index.md` en un único turno para identificar sub-documentos relevantes.

## Leer según aplique
Con los sub-documentos ya identificados, léelos todos en un único turno:
- [ ] las fichas concretas de `ai-workflow/docs/app-features/nodes/` para los nodos que necesiten actualización o creación de sección
- [ ] las fichas de `ai-workflow/docs/app-features/forms/`, `queries/`, `references/`, `navigation/`, `config/`, `runtime/`, `auth/`, `development/` según las brechas detectadas
- [ ] `ai-workflow/docs/conventions.md` si hace falta respetar convenciones del proyecto

## Objetivo

Dejar `src/dev/documentation.json` sincronizado con `ai-workflow/docs/app-features/` de forma que:
- toda capacidad documentada en las fichas funcionales tenga representación en la app interactiva
- las secciones existentes reflejen el estado actual de la documentación funcional (props añadidas, comportamientos nuevos, etc.)
- la página `home` del documentation.json tenga enlaces a todas las secciones disponibles

## Flujo de trabajo

### Fase 1 — Análisis de cobertura

1. Leer `ai-workflow/docs/app-features/index.md` para obtener el mapa completo de áreas y fichas.
2. Leer `src/dev/documentation.json` completo para inventariar todas las páginas existentes y su contenido.
3. Construir un mapa de cobertura cruzando:
   - **Fichas funcionales documentadas** (cada `.md` en `app-features/`) → qué capacidades describen
   - **Páginas en documentation.json** → qué capacidades demuestran
4. Identificar tres tipos de brechas:
   - **Secciones ausentes**: capacidades documentadas en fichas que no tienen ninguna representación en documentation.json
   - **Secciones desactualizadas**: páginas que existen pero no reflejan props, variantes o comportamientos añadidos en la documentación funcional
   - **Cobertura incompleta**: páginas que cubren un nodo o área parcialmente (faltan ejemplos de props importantes)

### Fase 2 — Presentación del plan

5. Presentar al usuario un resumen del análisis con:
   - lista de secciones ausentes que se propone crear
   - lista de secciones desactualizadas que se propone actualizar
   - justificación breve de cada cambio propuesto
6. Esperar confirmación del usuario antes de proceder. El usuario puede pedir que se excluyan o prioricen elementos concretos.

### Fase 3 — Ejecución

7. Para cada brecha confirmada, leer la ficha funcional correspondiente en `ai-workflow/docs/app-features/`.
8. Generar o actualizar la página en `src/dev/documentation.json` siguiendo las reglas de generación de contenido (ver abajo).
9. Actualizar la página `home` si se añadieron páginas nuevas, añadiendo el botón de navegación correspondiente en la categoría adecuada.

## Reglas de generación de contenido para documentation.json

### Estructura de cada página

Cada página en documentation.json sigue esta estructura estándar:

```
[
  cabecera (heading + botón "Volver al inicio"),
  divider,
  sección 1 (heading h2 + paragraph descriptivo + ejemplos en cards),
  divider (entre secciones),
  sección 2 ...
]
```

La cabecera siempre es:
```json
{
  "type": "container",
  "props": { "direction": "row", "justify": "between", "align": "center" },
  "children": [
    { "type": "heading", "props": { "text": "<Título de la página>", "level": 1 } },
    { "type": "button", "props": { "label": "Volver al inicio", "variant": "ghost", "action": { "type": "navigateTo", "pageId": "home" } } }
  ]
}
```

### Ejemplos interactivos

Los ejemplos deben ser **interactivos y funcionales**, no solo descriptivos. Cada ejemplo se envuelve en un container con `variant: card`:

```json
{
  "type": "container",
  "props": { "variant": "card", "gap": "sm" },
  "children": [
    { "type": "paragraph", "props": { "text": "<JSON resumido del ejemplo>" } },
    { "type": "divider", "props": { "variant": "dashed" } },
    <nodo real renderizado con la configuración del ejemplo>
  ]
}
```

### Principios de contenido

- **Mostrar, no solo describir**: cada prop o variante importante debe tener un ejemplo renderizado real.
- **Usar datos plausibles**: nombres, ciudades, productos — no "lorem ipsum".
- **Cubrir las props del contrato**: al menos un ejemplo de cada prop relevante documentada en la ficha funcional.
- **Cubrir variantes y combinaciones**: si un nodo tiene variantes de estilo, mostrar cada una.
- **Usar los nodos existentes del runtime**: los ejemplos se construyen con los tipos de nodo disponibles (`heading`, `paragraph`, `container`, `button`, `table`, `alert`, `badge`, `stat`, `divider`, `image`, `form`, `input`, `select`, `textarea`, `toggle`, `hidden`, `list`, `repeater`, `tabs`, `accordion`, `modal`, `skeleton`, `link`, `file-input`, `file-manager`, `choice-groups`).
- **Respetar la API del runtime**: las props usadas en los ejemplos deben ser válidas según la documentación funcional. No inventar props que no estén documentadas.
- **Demostrar capacidades de runtime**: cuando sea relevante, incluir ejemplos que demuestren references dinámicas, visibility, interpolación, queryStateFeedback, etc.

### Página home

La página home organiza las secciones por categorías con contenedores grid de botones. Las categorías existentes son:
- **Catálogo de nodos** (color: primary)
- **Formularios** (color: success)
- **Nodos decorativos y estructurales** (color: warning)
- **Capacidades del runtime** (color: info)

Los nuevos botones deben respetar el color de su categoría y usar `variant: outline`, `fullWidth: true`.

### Idioma

El contenido de documentation.json está en **español sin tildes** (consistente con el contenido existente). Las descripciones, títulos y textos de ejemplo siguen esta convención.

## Reglas de trabajo

- No modificar código fuente del runtime. Esta skill solo toca `src/dev/documentation.json`.
- Leer las fichas funcionales relevantes antes de generar contenido; no inventar props o comportamientos.
- Mantener el JSON bien formado y la indentación a 2 espacios.
- No eliminar páginas ni secciones existentes que sigan siendo válidas.
- Al actualizar una sección existente, preservar los ejemplos que sigan siendo correctos y añadir los que falten.
- No duplicar ejemplos que ya cubran una capacidad.
- Si una ficha funcional documenta una capacidad que no es demostrable de forma interactiva (p.ej. comportamiento de error en runtime, validación pre-render), documentarla de forma descriptiva con paragraphs y tables, no con ejemplos rotos.
- Al añadir páginas nuevas, asignar un `id` en kebab-case consistente con los existentes.
- Validar que el JSON resultante sea parseable antes de dar por terminado. Usar un chequeo con `python3 -c "import json; json.load(open('src/dev/documentation.json'))"` o equivalente.

## Terminado cuando

1. Se ha completado el análisis de cobertura y se ha presentado al usuario
2. El usuario ha confirmado los cambios a realizar
3. `src/dev/documentation.json` refleja las capacidades documentadas en `ai-workflow/docs/app-features/`
4. Las secciones nuevas tienen ejemplos interactivos funcionales
5. Las secciones actualizadas incluyen las props o comportamientos nuevos
6. La página home tiene enlaces a todas las secciones
7. El JSON es válido y parseable
8. No se ha tocado código fuente del runtime
