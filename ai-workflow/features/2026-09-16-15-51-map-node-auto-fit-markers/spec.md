# Ajuste automático de centro/zoom del nodo `map` según sus marcadores

## Objetivo

Permitir que el nodo `map` calcule automáticamente su centro y zoom iniciales a partir de las coordenadas de todos sus marcadores, como alternativa opcional al centro/zoom manual y al valor por defecto (Pamplona) que ya existen.

## Alcance

- Nuevo prop booleano `props.autoFitMarkers` en el nodo `map`. Por defecto `false`/ausente: sin cambios de comportamiento respecto al contrato actual.
- Con `props.autoFitMarkers: true`, el mapa ajusta su vista inicial (centro y zoom) para encuadrar todas las coordenadas resueltas en el primer render, tanto en modo estático (`props.markers`) como en modo dinámico (`props.markerSources`).
- El ajuste automático prevalece sobre `props.center`/`props.zoom` cuando ambos están declarados a la vez que `autoFitMarkers: true`: no se rechaza la config por declarar los tres, simplemente el centro/zoom manual queda sin efecto.
- El ajuste se calcula una sola vez, en el primer render del nodo, igual que hoy ocurre con `props.center`/`props.zoom` (el mapa no es reactivo a cambios posteriores del centro/zoom). Si `props.markerSources` resuelve datos después de ese primer render (por ejemplo, porque la query todavía estaba cargando), los marcadores nuevos se siguen mostrando con normalidad, pero la vista del mapa no se recalcula ni se mueve.
- Casos de fallback del ajuste automático cuando no hay bounds válidos que encuadrar:
  - Cero marcadores resueltos en el primer render: se usa `props.center`/`props.zoom` si están declarados, o si no el valor por defecto actual (Pamplona, zoom `13`).
  - Exactamente un marcador resuelto: se centra en ese punto, usando `props.zoom` si está declarado o si no el zoom por defecto actual (`13`).
  - Dos o más marcadores: se calcula el encuadre (bounds) que contiene a todos ellos.

## Fuera de alcance

- Recalcular o animar el centro/zoom tras el primer render (no hay seguimiento reactivo de cambios en los marcadores).
- Padding, margen o cualquier parámetro de ajuste fino del encuadre configurable desde `props`.
- Cambios en el contrato de `props.markers`, `props.markerSources`, `props.height` o en la resolución de `markerSources` (`resolveMapMarkerSourceItems`).
- Edición visual de esta opción desde `dev-editor` (el nodo `map` ya está fuera de alcance de `dev-editor` en general).
- Clustering de marcadores, cálculo de rutas o geolocalización del usuario (fuera de v1 del nodo `map`, sin cambios).

## Requisitos funcionales

1. `props.autoFitMarkers` es un prop opcional de tipo `boolean`. Ausente o `false` mantiene el comportamiento actual del nodo sin ningún cambio observable.
2. Con `autoFitMarkers: true` y dos o más marcadores con coordenadas válidas resueltos en el primer render (estáticos, dinámicos, o ambos combinados si `markerSources` está declarado y por tanto prevalece sobre `markers` según el contrato ya existente), el mapa encuadra su vista inicial para que todos esos marcadores queden visibles.
3. Con `autoFitMarkers: true` y exactamente un marcador resuelto, el mapa centra la vista inicial en ese marcador, usando `props.zoom` si está declarado o el zoom por defecto (`13`) en caso contrario.
4. Con `autoFitMarkers: true` y cero marcadores resueltos, el mapa usa `props.center`/`props.zoom` si están declarados, o si no el centro/zoom por defecto actuales (Pamplona, zoom `13`).
5. Con `autoFitMarkers: true`, cualquier `props.center`/`props.zoom` declarado deja de aplicarse salvo en los fallbacks de los requisitos 3 y 4.
6. El ajuste automático se calcula una única vez, en el primer render del nodo. Marcadores de `markerSources` que se resuelvan después de ese primer render (por ejemplo tras una carga de query en curso) siguen renderizándose, pero no provocan un recálculo del centro/zoom.
7. La ficha `ai-workflow/docs/app-features/nodes/map.md` refleja el nuevo prop, su contrato, su normalización, sus reglas de fallback y su interacción con `props.center`/`props.zoom`.

## Requisitos no funcionales

- Coherente con el patrón ya existente en el nodo (`markerSources` prevaleciendo sobre `markers` sin rechazar la config): declarar `autoFitMarkers` junto a `center`/`zoom` no debe producir un error de validación (`invalid-layout`).
- Sin overhead de render perceptible: el cálculo del encuadre es una operación local sobre los marcadores ya resueltos, sin llamadas adicionales a red ni recomputaciones en cada render.
- Mantener la cobertura de tests del área (`src/`) sobre el umbral mínimo global del proyecto.

## Criterios de aceptación

- Un `map` con `autoFitMarkers: true` y dos o más `props.markers` con coordenadas dispersas se renderiza con una vista inicial que encuadra a todos ellos.
- Un `map` con `autoFitMarkers: true`, sin `props.markers` ni `props.markerSources`, se renderiza igual que hoy sin la opción (Pamplona, zoom `13`, o el `center`/`zoom` declarado si lo hay).
- Un `map` con `autoFitMarkers: true` y un único marcador se centra en ese marcador con el zoom declarado o el zoom por defecto.
- Un `map` con `autoFitMarkers: true`, `props.markerSources` y varios ítems de colección con coordenadas válidas resueltos en el primer render se ajusta a esos marcadores, ignorando cualquier `props.center`/`props.zoom` declarado.
- Un `map` con `autoFitMarkers: true` y `props.center`/`props.zoom` declarados a la vez no produce ningún error de validación; el centro/zoom manual queda sin efecto salvo en los fallbacks documentados.
- La ficha del nodo `map` documenta el nuevo comportamiento.

## Casos límite

- Marcadores con coordenadas idénticas entre sí (bounds de área cero con dos o más puntos): se trata igual que el caso de un único marcador, centrando en ese punto con el zoom declarado o el zoom por defecto.
- `props.markerSources` cuya query resuelve una colección vacía en el primer render: se trata como cero marcadores (fallback al `center`/`zoom` declarado o al valor por defecto).
- Combinación de `props.markers` y `props.markerSources` declarados a la vez: sigue vigente la regla actual del nodo (`markerSources` prevalece y `markers` se ignora); el ajuste automático, si aplica, se calcula solo sobre los marcadores de `markerSources`.
- `autoFitMarkers: true` dentro de `repeater`/`tabs`/`accordion` con remount del nodo `map`: cada remount es un nuevo "primer render" y recalcula el ajuste igual que ya ocurre hoy con `center`/`zoom`; sigue sin `invalidateSize()` explícito (límite ya existente del nodo, sin cambios).

## Riesgos o preguntas abiertas

Ninguna pregunta bloqueante pendiente. Decisiones ya cerradas con el usuario:
- Nombre y tipo del prop: `props.autoFitMarkers: boolean`.
- Prioridad frente a `center`/`zoom` manual: el ajuste automático prevalece.
- Fallback sin marcadores o con un único marcador: cae al `center`/`zoom` declarado o al valor por defecto actual.
- Reactividad: el ajuste es solo inicial, no reactivo a cambios posteriores de los marcadores — mismo patrón que el `center`/`zoom` actual del nodo.
