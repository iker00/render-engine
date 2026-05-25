# Design: Collection pagination variants

## Contexto
El runtime ya soporta paginación local opt-in en `repeater` mediante `props.pagination.enabled: true`, `pageSize` y controles `previousNext`. Esa paginación opera sobre la colección completa ya resuelta desde `queries.*`, después de aplicar la política propia de `repeater` sobre keys válidas y únicas. El cambio de página es estado local del consumidor y no modifica queries, navegación, formularios ni `pageEntry`.

Esta feature amplía la interacción visible de esa paginación sin cambiar su fuente de datos: siguen siendo variantes locales sobre datos ya cargados. La paginación en servidor y la integración en `table` se reservan para features posteriores.

## Objetivos / No objetivos

### Objetivos
- Añadir una variante numerada con primera, anterior, páginas, siguiente y última.
- Añadir una variante de scroll incremental local que muestre más items por bloques.
- Mantener `pageSize` como tamaño de página o bloque visible.
- Conservar el aislamiento de estado por instancia de `repeater`.
- Mantener una frontera clara entre variantes locales y futura paginación remota.
- Dejar el vocabulario preparado para reutilizarse en `table` más adelante.

### No objetivos
- Definir metadatos remotos, cursores o contrato de servidor.
- Ejecutar red al navegar, seleccionar página o avanzar por scroll.
- Añadir virtualización.
- Añadir selector de tamaño de página o salto directo por input.
- Implementar estas variantes en `table`.

## Decisiones
- `controls.variant` seguirá siendo el selector de variante visible para la paginación local de `repeater`.
- `previousNext` conserva el comportamiento actual y sigue siendo el default efectivo cuando no se declara otra variante.
- `numbered` usa la misma página activa local que `previousNext`, pero añade controles para primera, anterior, páginas concretas, siguiente y última.
- La variante `numbered` debe mostrar todas las páginas cuando `totalPages <= 5`; si hay más páginas, debe mostrar una ventana estable de cinco páginas numéricas centrada en la página activa y ajustada a los extremos. Los controles `Primera` y `Última` siguen siendo controles separados, no forman parte de esa ventana.
- La página activa en `numbered` debe marcarse con `aria-current="page"`, mantener una clase visual diferenciada y no cambiar de estado al pulsarla. No se renderiza texto auxiliar `Página n de m`; la posición se comunica mediante el botón activo y su semántica.
- Los controles `Primera` y `Anterior` se deshabilitan en la primera página; `Siguiente` y `Última` se deshabilitan en la última. Las páginas concretas fuera de la ventana compacta no se renderizan, pero siguen siendo alcanzables mediante los controles extremos y los avances sucesivos.
- `scroll` no modela una página activa visible; modela una cantidad visible acumulada que empieza en `pageSize` y crece por bloques de `pageSize`.
- En `scroll`, el avance se interpreta como carga incremental local sobre la colección ya disponible. No se debe reutilizar esta variante para simular paginación remota.
- La variante `scroll` usa un sentinel local al final de los items visibles cuando quedan items por mostrar. Si `IntersectionObserver` existe, el runtime observa ese sentinel con un umbral amplio y aumenta la cantidad visible en `pageSize` cuando entra en zona observable.
- Si `IntersectionObserver` no existe, `scroll` debe renderizar una accion local equivalente `Mostrar mas` dentro de la superficie de controles. Esa accion solo aumenta la cantidad visible local y desaparece cuando no quedan items ocultos.
- La variante `scroll` no debe renderizar controles o indicadores de paginacion cuando `totalItems <= pageSize` ni cuando ya se han mostrado todos los items.
- En todas las variantes, los items omitidos por key inválida o duplicada quedan fuera del total paginable antes de derivar páginas, números o bloques.
- En todas las variantes, cambiar la colección resuelta, `pageSize` o `controls.variant` reinicia el estado local a su posición inicial.
- En contenedores con grid efectivo, los controles o sensores auxiliares de paginación deben comportarse como superficie propia de control y no mezclarse visualmente como otro item del template repetido.
- Si el entorno no permite observar el umbral de scroll, la variante debe degradar a una forma accionable local equivalente para no bloquear el acceso a resultados ya cargados.

## Riesgos y trade-offs
- La variante `scroll` puede confundirse con paginación remota si el contrato no separa claramente los modelos; por eso esta feature la define solo como incremento local sobre colección cargada.
- La variante numerada puede saturar el layout si se muestran demasiadas páginas; el plan técnico debe fijar una regla compacta sin convertirla en personalización visual libre.
- La futura integración de `table` puede necesitar ajustes de presentación, pero no debería cambiar el significado de `previousNext`, `numbered` o `scroll` como variantes locales.
- La futura paginación en servidor necesitará un contrato propio para request, respuesta y metadatos; mezclarlo ahora con `controls.variant` haría más difícil validar configuraciones ambiguas.

## Migración o despliegue
No requiere migración de configuraciones existentes. Las pantallas que ya usan `previousNext` o que omiten `controls` deben conservar su comportamiento vigente. Las nuevas variantes son opt-in.

## Preguntas abiertas
No quedan preguntas abiertas bloqueantes para planificar la implementación. La paginación en servidor y la integración en `table` quedan como futuras features explícitas.
