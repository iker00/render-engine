# Spec: Link `navigateTo` — añadir `href` canónico

## Objetivo

Cuando un nodo `link` usa `props.action.type === 'navigateTo'`, el elemento `<a>` resultante debe llevar un atributo `href` con la ruta hash canónica de la página de destino. Esto permite que el navegador muestre el cursor de enlace correctamente y que la URL de destino aparezca en la barra de estado al pasar el puntero.

## Alcance

- Nodo `link` con `props.action.type === 'navigateTo'`: el `href` generado sigue el formato canónico del runtime: `#/pageId`.
- Nodo `link` con `props.action.type === 'goBack'`: el `href` se deriva del historial de navegación del runtime (`state.navigation.history[currentEntryIndex - 1]`). Si existe una entrada previa, se usa su hash canónico (`#/pageId` o `#/` para la página inicial). Si no hay entrada previa, el `href` es `"#"` como fallback.
- El comportamiento de navegación no cambia en ningún caso: el anchor sigue ejecutando `preventDefault` y delegando en `executeRuntimeUiAction`.

## Fuera de alcance

- Incluir query params en el `href` de `navigateTo`: los params pueden ser referencias dinámicas no resolubles en render; el `href` refleja solo la ruta de página.
- `button` con `navigateTo`: fuera de esta feature; el `button` no es un `<a>` y el cambio de cursor no aplica.
- Cambios en la validación del nodo, en el schema Zod o en el contrato de configuración: el contrato no varía.

## Requisitos funcionales

1. Si `props.action.type === 'navigateTo'`, el `<a>` renderizado incluye `href="#/{pageId}"`.
2. El valor de `pageId` es el literal declarado en `props.action.pageId` (siempre string estático en la configuración validada).
3. Si `props.action.type === 'goBack'`, el `href` se resuelve en tiempo de render desde `state.navigation.history[state.navigation.currentEntryIndex - 1]` usando la misma función de hash canónico del runtime (`createBrowserHashNavigationHash`). Si no hay entrada previa, el `href` es `"#"`.
4. El handler de clic sigue llamando a `preventDefault` antes de delegar en `executeRuntimeUiAction` en ambos casos; el `href` es solo decorativo para el navegador.
5. Si `props.href` está presente (modo URL externa), el comportamiento existente no cambia.

## Requisitos no funcionales

- El cambio no debe introducir re-renders adicionales ni dependencias nuevas en el nodo.
- El `href` generado debe ser estable (mismo valor entre renders sucesivos si la config no cambia).

## Criterios de aceptación

1. Un nodo `link` con `navigateTo` a `pageId: "dashboard"` renderiza `<a href="#/dashboard">` en el DOM.
2. Un nodo `link` con `goBack` renderiza `<a href="#/previousPageId">` cuando hay historial previo, o `<a href="#">` cuando no lo hay.
3. El cursor cambia a puntero de enlace al pasar sobre cualquier `link` con `props.action`.
4. Al hacer clic, la navegación se ejecuta vía el runtime (no por seguimiento nativo del `href`).
5. Un nodo `link` con `props.href` externo mantiene su comportamiento actual sin regresión.
6. Los tests existentes del nodo `link` siguen en verde.

## Casos límite

- **`navigateTo` + params dinámicos**: el `href` solo refleja `#/pageId`; los params se ignoran en el `href`.
- **`navigateTo` a `initialPage`**: el `href` es `#/initialPageId`; la normalización a `#/` la hace el runtime al navegar, no el `href` estático.
- **Link dentro de `repeater`**: `pageId` es siempre un literal estático; no hay referencias dinámicas posibles en `props.action.pageId`, así que el `href` es fijo.
- **`goBack` sin historial previo**: el `href` es `"#"` como fallback; el `preventDefault` garantiza que no desplace el scroll ni añada entrada al historial del navegador.
- **`goBack` con historial previo**: el `href` refleja el hash canónico de la entrada anterior (`history[currentEntryIndex - 1]`), incluyendo params si los tuviera esa entrada.

## Riesgos o preguntas abiertas

Ninguno. El cambio está acotado al renderer del nodo `link` y no toca validación, schema ni estado compartido.
