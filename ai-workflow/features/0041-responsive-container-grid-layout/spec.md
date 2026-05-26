# Spec: Responsive container grid layout

## Objetivo
Ampliar el layout declarativo de `container` para que la cantidad de columnas y la ocupación de cada hijo puedan variar por breakpoint, manteniendo compatible el contrato fijo actual de `columns` y `layout.span`.

La feature debe permitir que una pantalla configurada desde backend declare composiciones de escritorio, tablet y móvil sin duplicar nodos, sin introducir lógica condicional por viewport y sin abrir un sistema general de estilos responsive desde JSON.

## Alcance
- Permitir que `container.props.columns` acepte tanto el entero fijo vigente como un mapa responsive por breakpoint.
- Permitir que `node.layout.span` acepte tanto el entero fijo vigente como un mapa responsive por breakpoint en cualquier nodo soportado.
- Usar una familia cerrada de breakpoints alineada con el runtime actual basado en Tailwind: `base`, `sm`, `md`, `lg`, `xl` y `2xl`.
- Mantener `base` como valor sin prefijo responsive y como fallback recomendado para móvil.
- Resolver cada breakpoint declarado de forma independiente para que un contenedor pueda, por ejemplo, pasar de `1` columna en `base` a `2` en `md` y `4` en `lg`.
- Mantener la semántica actual de `layout.span`: solo aplica dentro de un `container` cuyo layout efectivo sea grid por `columns`.
- Mantener degradación segura cuando `span` aparece fuera de un grid efectivo o pide más columnas que las disponibles para un breakpoint.

## Fuera de alcance
- Añadir breakpoints configurables por aplicación, theming responsive o una API general de media queries desde JSON.
- Permitir valores arbitrarios de columnas, fracciones CSS, `auto-fit`, `minmax`, areas de grid o reglas de auto-placement configurables.
- Cambiar la semántica de `direction`, `wrap`, `align`, `justify`, `gap` o `variant`.
- Hacer responsive otras props de `container` como `gap`, `align`, `justify`, `wrap` o `variant`.
- Convertir `layout.span` en width responsive para layouts `flex`.
- Añadir soporte visible de `layout.span` sobre el propio nodo `repeater`; se conserva la regla vigente de aplicar span en los nodos visibles emitidos por su `template`.
- Cambiar la baseline visual institucional ni introducir nuevas variantes visuales.

## Áreas de producto afectadas
- Runtime UI configurable.
- Contrato de configuración.
- Layout declarativo de `container`.
- Composición responsive en grids efectivos.

## Requisitos funcionales
- `container.props.columns` debe seguir aceptando un entero entre `1` y `12`.
- `container.props.columns` debe aceptar también un mapa responsive cuyas claves pertenezcan a `base | sm | md | lg | xl | 2xl` y cuyos valores sean enteros entre `1` y `12`.
- Un mapa responsive de `columns` debe activar el modo grid del `container`, igual que el entero fijo vigente.
- Cuando `columns` sea fijo, el comportamiento observable actual debe conservarse.
- Cuando `columns` sea responsive, el contenedor debe aplicar la cantidad de columnas correspondiente a cada breakpoint declarado.
- Si un mapa responsive no declara `base`, el runtime debe seguir renderizando con un fallback móvil seguro de una columna.
- `node.layout.span` debe seguir aceptando un entero entre `1` y `12`.
- `node.layout.span` debe aceptar también un mapa responsive con las mismas claves cerradas y valores enteros entre `1` y `12`.
- Un `span` fijo debe comportarse como hasta ahora dentro de grids efectivos.
- Un `span` responsive debe aplicar la ocupación correspondiente a cada breakpoint declarado, siempre respecto a las columnas efectivas del grid padre en ese mismo breakpoint.
- Si un `span` responsive omite breakpoints, el runtime debe conservar una ocupación segura de una columna en los breakpoints no declarados.
- Si `span` supera las columnas efectivas del padre en un breakpoint concreto, debe limitarse a ocupar como máximo todas las columnas del padre en ese breakpoint.
- Si un nodo declara `layout.span` fuera de un grid efectivo, el valor no debe tener efecto visible y no debe romper el render.
- `columns` debe seguir prevaleciendo sobre `direction` cuando ambos existan.
- La combinación `container.props.columns` con `container.props.wrap` debe seguir siendo inválida también cuando `columns` use mapa responsive.
- La validación previa al render debe rechazar claves de breakpoint desconocidas y valores fuera de rango con diagnóstico trazable.
- Las configuraciones existentes que usen `columns` o `layout.span` como enteros no deben requerir migración.

## Requisitos no funcionales
- La superficie nueva debe ser declarativa, pequeña y consistente con la gramática actual: `columns`, `layout.span` y breakpoints cerrados.
- La implementación posterior debe poder resolverse con utilidades de Tailwind y la capa central de styling del runtime, sin estilos inline generales.
- La validación debe mantenerse previa al render y no delegar errores estructurales al navegador.
- La documentación debe distinguir claramente entre valor fijo y mapa responsive.
- El comportamiento responsive debe ser determinista y testeable sin depender de lógica de runtime en JavaScript durante resize.

## Criterios de aceptación
- Dado un `container` con `columns: 4`, el runtime conserva el grid fijo actual de cuatro columnas.
- Dado un `container` con `columns: { "base": 1, "md": 2, "lg": 4 }`, el layout usa una columna en móvil, dos desde `md` y cuatro desde `lg`.
- Dado un hijo con `layout.span: 2` dentro de un grid fijo compatible, el hijo conserva la ocupación vigente de dos columnas.
- Dado un hijo con `layout.span: { "base": 1, "md": 2 }`, el hijo ocupa una columna en móvil y dos desde `md` cuando el padre tiene columnas efectivas suficientes.
- Dado un hijo con `layout.span: { "base": 2, "lg": 4 }` dentro de un padre con `columns: { "base": 1, "lg": 3 }`, el hijo ocupa una columna en `base` y tres en `lg` por clamp seguro.
- Dado un mapa responsive con una clave no soportada, la configuración se rechaza antes del render con una ruta diagnóstica clara.
- Dado un mapa responsive con un valor menor que `1`, mayor que `12` o no entero, la configuración se rechaza antes del render.
- Dado un `container` con `columns` responsive y `wrap`, la configuración se rechaza igual que con `columns` fijo.
- Dado un nodo con `layout.span` responsive fuera de un `container` con `columns`, la pantalla renderiza sin error y el `span` no produce efecto visible.
- Dado un config existente que no usa mapas responsive, el comportamiento visible no cambia.

## Casos límite
- `columns: { "md": 2, "lg": 4 }` debe tener un comportamiento móvil seguro aunque no declare `base`.
- `layout.span: { "lg": 2 }` debe conservar una ocupación segura de una columna antes de `lg`.
- Un `container` puede declarar `columns` responsive y no tener hijos visibles; el grid no debe inventar contenido ni fallar.
- Un hijo puede declarar `span` responsive con breakpoints que el padre no declara explícitamente; la ocupación debe resolverse contra las columnas efectivas resultantes tras fallback del padre.
- Un padre puede reducir columnas en un breakpoint mayor si así se declara; el `span` debe evaluarse por breakpoint y clamped contra ese valor efectivo, no asumir crecimiento monotónico.
- Un `repeater` dentro de un grid responsive conserva su comportamiento estructural vigente: no aplica `layout.span` sobre el propio `repeater`; los nodos visibles de su `template` pueden declarar su propio `span` fijo o responsive.
- Un fallback de `queryStateFeedback` debe evaluar sus propios `layout.span` respecto al grid efectivo donde se materializa, igual que cualquier colección de nodos.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes para planificar la feature.
- Conviene vigilar que el mapa responsive no derive en una API general de estilos responsive; en esta feature solo cubre `columns` y `layout.span`.
- Conviene vigilar que la generación de clases responsive siga siendo compatible con el pipeline de Tailwind y no dependa de clases dinámicas que el build no pueda detectar.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/current-state.md`
