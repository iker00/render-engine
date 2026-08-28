# Feature: icono decorativo en accordion y en items de tabs

## Objetivo
Añadir soporte de icono decorativo a la cabecera del nodo `accordion` y a cada item de `props.items` del nodo `tabs`, siguiendo el mismo mecanismo de nombre de icono Lucide React ya usado en el catálogo (`button`, `link`, `stat`, `heading`, `paragraph`), pero con posición fija a la izquierda del label — sin `iconPosition` configurable, ya que en accordion y tabs no tiene sentido un icono a la derecha (en accordion competiría con el chevron; en tabs no hay precedente que lo justifique).

## Alcance
- `accordion`: nueva prop `props.icon` (string opcional, nombre de icono Lucide React).
  - El icono se renderiza siempre a la izquierda de `props.label` en la cabecera. No existe prop de posición.
  - El chevron indicador de apertura/cierre se mantiene siempre fijo en el extremo derecho de la cabecera, sin relación con `icon`.
- `tabs`: cada item de `props.items` gana un campo opcional `icon` (nombre de icono Lucide React), renderizado siempre a la izquierda del `label` de ese tab, aplicado de forma independiente por item. No existe campo de posición.
- Si el nombre de icono declarado no resuelve a un icono Lucide conocido, se ignora silenciosamente (mismo comportamiento que en `button`/`link`/`stat`/`heading`/`paragraph`); el nodo sigue renderizando sin el icono y sin error.
- Actualización de la documentación funcional de ambos nodos (`ai-workflow/docs/app-features/nodes/accordion.md` y `tabs.md`) reflejando el nuevo contrato.

## Fuera de alcance
- Cualquier otro nodo del catálogo detectado como candidato adicional durante el análisis (`toggle`, `select`, `choice-groups`, `textarea`, `input` en su variante de tooltip, `alert`, `badge`, `map`) — quedan fuera de esta feature. Ver sección "Otros nodos candidatos" más abajo.
- Tamaño, color o intercambio del icono por JSON más allá del nombre Lucide (coherente con el límite ya vigente en `button`/`link`/`stat`).
- Iconos en el cuerpo/contenido del accordion o del panel de tabs; el alcance es solo la cabecera/etiqueta.
- Icono derivado o generado dinámicamente desde una colección (`queries.*`); el valor de `icon` es siempre un string estático por nodo/item.
- Cambios de comportamiento en la coordinación de grupos del accordion (`groupId`) o en el ciclo de vida del tab activo de `tabs`; el icono es puramente visual y decorativo.

## Requisitos funcionales
1. `accordion.props.icon`, cuando se declara y resuelve a un icono Lucide conocido, se renderiza en la cabecera siempre a la izquierda del texto de `props.label`, sin afectar nunca a la posición del chevron.
2. Cada item de `tabs.props.items` admite `icon` con la misma semántica que en `accordion` (siempre a la izquierda del label del tab), aplicada de forma independiente por tab (un item puede declarar icono y otro no).
3. Un `icon` que no resuelve a un icono Lucide conocido se ignora silenciosamente en ambos nodos: el label se renderiza igual, sin icono y sin error de validación en tiempo de render.

## Requisitos no funcionales
- Consistencia con el patrón visual y de accesibilidad ya usado en `button`/`link`: el icono es decorativo (`aria-hidden`), no debe interferir con el nombre accesible de la cabecera del accordion ni del botón de tab.
- No debe introducir un salto de layout perceptible en cabeceras/tabs que no declaren `icon` (comportamiento idéntico al actual cuando la prop está ausente).

## Criterios de aceptación
- Un accordion con `props.icon: "ChevronRight"` (o cualquier nombre válido) muestra el icono a la izquierda del label, con el chevron de apertura/cierre intacto a la derecha.
- Un accordion con `props.icon` con nombre inválido (no Lucide) renderiza la cabecera igual que si no se hubiera declarado `icon`, sin error.
- Un accordion sin `props.icon` renderiza la cabecera exactamente igual que antes de esta feature.
- Un `tabs` con dos items, uno con `icon` válido y otro sin `icon`, muestra el icono solo en el primer tab (a la izquierda de su label); el segundo se ve igual que antes.
- Un item de `tabs` con `icon` inválido renderiza el tab igual que si no hubiera declarado la prop.

## Casos límite
- `accordion` con `groupId` y `icon` declarado: el icono se comporta igual en todas las instancias del grupo; no afecta a la lógica de coordinación de apertura/cierre.
- `accordion` dentro de `repeater.props.template` con `icon`: cada iteración renderiza su propio icono de forma independiente, igual que ocurre hoy con `label`.
- `tabs` con `orientation: "vertical"`: el icono del item se renderiza junto al label igual que en `horizontal`, respetando el wrapping de etiquetas largas ya documentado.
- `tabs` item oculto por `visibility`: no aparece en la barra, por lo que su `icon` tampoco se renderiza (mismo comportamiento que el label del item).
- `accordion`/`tabs` con `icon` como referencia dinámica que resuelve a un valor no string o vacío: se trata igual que un nombre inválido, se ignora silenciosamente.
- `accordion`/`tabs` no exponen ninguna prop de posición de icono; declarar un campo `iconPosition` no reconocido en estos dos nodos no forma parte del contrato soportado.

## Otros nodos candidatos (fuera de alcance de esta feature)
Durante el análisis se identificaron nodos con cabecera/label visible que hoy no soportan `icon` y que podrían beneficiarse del mismo patrón en una feature futura:
- `toggle`, `select`, `choice-groups`, `textarea`: ya usan un icono fijo de ayuda (`HelpCircle`) ligado a `tooltip`, distinto del icono decorativo de label que tienen `button`/`link`/`stat`/`heading`/`paragraph`. Añadirles un `icon` de label propio requeriría decidir cómo convive con el icono de tooltip existente.
- `alert`: el icono ya existe pero está fijado por `props.type` (paleta semántica); permitir sobreescritura es una decisión de diseño explícitamente fuera de alcance en la ficha actual del nodo.
- `badge`: excluye explícitamente iconos por diseño actual del nodo.
- `map`: el icono de marcador ya existe pero es de color fijo por fuente, no decorativo de un label.

Estos casos no se tocan en esta feature; se documentan aquí como referencia para una posible feature futura de ampliación del catálogo de iconos.

## Riesgos o preguntas abiertas
Ninguna. El mecanismo de resolución de `icon` (Lucide React, fallo silencioso) ya está validado y en producción en cinco nodos del catálogo (`button`, `link`, `stat`, `heading`, `paragraph`); esta feature lo extiende a `accordion` y `tabs` con posición fija a la izquierda, sin introducir `iconPosition` ni otras decisiones técnicas nuevas.
