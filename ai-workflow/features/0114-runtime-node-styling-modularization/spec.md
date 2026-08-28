# Spec: Runtime node styling modularization

## Objetivo

Dividir físicamente `src/runtime/runtime-node-styling.ts` (1.245 líneas, 94 funciones exportadas) en varios módulos
agrupados por dominio visual, sin cambiar ningún comportamiento observable ni ninguna clase CSS generada, para reducir
el riesgo de conflictos de merge y facilitar la navegación cuando distintos cambios visuales de distintos nodos tocan
hoy siempre el mismo fichero.

Es una reorganización puramente mecánica del código fuente: mismas firmas de función, mismas clases Tailwind
devueltas, mismo comportamiento en todos los nodos que consumen estas utilidades.

## Alcance

- Partir la gramática visual actual en módulos por dominio (por ejemplo: shell de la app, grid/responsive, container,
  contenido simple —heading/paragraph/list/image/link—, tabla y sus subpartes, botones, paginación de repeater, campos
  de formulario, modal, accordion, tabs, stat, badge, alert, skeleton, icono de input, file manager). La agrupación
  exacta y el número final de ficheros se decide en `generate-implementation-plan`, siempre que cada función quede en
  un módulo cuya responsabilidad visual sea reconocible por su nombre.
- `src/runtime/runtime-node-styling.ts` se mantiene como punto de entrada único (barrel) que re-exporta el contenido
  de los nuevos módulos internos, de forma que **ningún import existente en el resto del código cambie**. Esta
  decisión está tomada y cerrada (ver justificación en Riesgos).
- Mismas firmas públicas, mismos nombres exportados, mismo comportamiento runtime.
- El test actual (`src/tests/runtime/runtime-node-styling.test.ts`, 1.798 líneas) sigue validando el mismo
  comportamiento; puede reorganizarse en paralelo a la estructura nueva de módulos, pero sin perder cobertura de
  ningún caso ya cubierto.

## Fuera de alcance

- Cualquier cambio de clases Tailwind, de firma de función o de comportamiento visual de cualquier nodo.
- Cambios en los imports de los 32 ficheros que hoy consumen `runtime-node-styling` (`src/app/app-shell.tsx`,
  `src/dev-runtime/dev-runtime.tsx`, `src/runtime/layout-node-renderer.tsx`, `src/runtime/runtime-page.tsx` y 28
  componentes bajo `src/runtime/nodes/`).
- Introducir un sistema de theming, tokens nuevos o una API visual configurable por JSON.
- Modularizar otras utilidades del runtime no relacionadas con estilos visuales (por ejemplo `runtime-form-validations`,
  `runtime-query-state-feedback`, `runtime-collection-sources`).
- Cambiar el umbral o la estrategia global de cobertura de tests.

## Requisitos funcionales

1. Toda función y tipo actualmente exportado por `src/runtime/runtime-node-styling.ts` sigue siendo importable desde
   esa misma ruta, con la misma firma y el mismo comportamiento.
2. Cada función queda ubicada en un módulo cuyo nombre refleja el dominio visual que cubre (nodo o familia de nodos
   concreta), no en un cajón de sastre.
3. Las utilidades verdaderamente compartidas entre dominios (por ejemplo el cálculo de spans de grid responsive, o la
   normalización de valores responsive) quedan en un módulo base del que pueden depender otros módulos de dominio, sin
   que ningún módulo de dominio dependa circularmente de otro.
4. La reutilización interna ya existente hoy (por ejemplo, la paginación de `table` delegando en los helpers de
   paginación de `repeater`) se preserva exactamente igual tras la división.

## Requisitos no funcionales

- Ningún fichero de `src/` fuera de `src/runtime/` (u otros módulos internos de node-styling) necesita modificar su
  import de `runtime-node-styling` como consecuencia de esta feature.
- No debe introducirse ningún ciclo de import entre los nuevos módulos internos.
- La cobertura global de tests se mantiene en el umbral mínimo del 80% sobre `src/`.
- Ningún módulo resultante debería quedar significativamente más grande que el resto salvo justificación por densidad
  real del dominio (por ejemplo, tabla o file manager, que ya concentran hoy más subpartes que el resto).

## Criterios de aceptación

1. `src/runtime/runtime-node-styling.ts` deja de tener ~1.245 líneas y pasa a ser un barrel corto, o el nuevo punto de
   entrada equivalente re-exporta el mismo API público completo.
2. Ninguno de los 32 ficheros que hoy importan de `runtime-node-styling` requiere cambios en su import tras la
   división (verificable con `grep` antes/después: mismo conjunto de rutas de import, mismos specifiers).
3. La suite de tests existente (`runtime-node-styling.test.ts` u su equivalente reorganizado) sigue en verde sin
   cambiar las aserciones sobre clases Tailwind generadas.
4. `pnpm build` y `pnpm test` completan sin errores tras la división.
5. Ningún módulo nuevo importa (directa o transitivamente) desde un módulo que a su vez dependa de él (sin ciclos).

## Casos límite

- **Funciones que delegan en otro dominio** (p. ej. `getTablePaginationButtonClassName` reutilizando
  `getRepeaterPaginationButtonClassName`, o `getButtonNodeClassName` reutilizando `getSecondaryButtonNodeClassName`):
  deben seguir delegando exactamente igual, ya sea dentro del mismo módulo o importando desde el módulo del que
  dependen.
- **Utilidades responsive compartidas** (mapas de clases por breakpoint, `normalizeResponsiveLayoutValue`,
  `getGridChildSpanClassName`): usadas tanto por `container` como por la paginación de `repeater`; deben quedar en un
  módulo base sin duplicarse.
- **Constantes y tipos internos no exportados** (mapas de clases, interfaces de opciones): pueden quedar privados de
  su módulo si solo los usa ese dominio, o promoverse al módulo base si los comparten dos o más dominios.

## Riesgos o preguntas abiertas

Ninguno bloqueante. Decisión ya tomada y justificada con datos:

- Se investigó cuántos ficheros importan hoy de `runtime-node-styling`: **32 ficheros de `src/`** (sin contar el test),
  la mayoría componentes de nodo bajo `src/runtime/nodes/`. Actualizar los 32 imports uno a uno no aporta beneficio
  funcional, amplía innecesariamente el diff de una feature que se declara sin cambio de comportamiento y aumenta el
  riesgo de romper algún import por error mecánico. Por eso se fija barrel re-exportador manteniendo
  `src/runtime/runtime-node-styling.ts` como ruta pública estable.
- No se detectaron ciclos de import obligatorios entre los dominios identificados: las utilidades responsive
  compartidas (grid/normalización) pueden vivir en un módulo base sin dependencias hacia el resto, y la única
  dependencia cruzada real hoy (tabla reutilizando paginación de repeater) es unidireccional.
- La agrupación de dominios se considera lo bastante clara tras leer el fichero completo como para no requerir
  `design.md`: no hay trade-offs arquitectónicos no triviales, solo una decisión de organización de ficheros que se
  cierra en `generate-implementation-plan`.

## Áreas de producto afectadas

- Runtime (organización interna de `src/runtime/`). No es una feature de producto visible; no cambia comportamiento
  para el usuario final de la aplicación construida con el runtime.

## Documentación probablemente afectada

- `ai-workflow/docs/architecture.md` (líneas que describen `runtime-node-styling` como "la gramática visual estable")
  si la nueva estructura de módulos cambia cómo se describe esa responsabilidad.
- `ai-workflow/docs/app-features/runtime/organization.md` (mapa de `src/runtime/`) si pasa a documentarse una
  subcarpeta en vez de un único fichero.
- `ai-workflow/docs/app-features/runtime/design-tokens.md` y `ai-workflow/docs/conventions.md`, que hoy referencian
  `runtime-node-styling.ts` como fichero único: si el punto de entrada público sigue teniendo esa misma ruta, no
  requieren cambio; solo revisar si la nota que dice "único helper" pierde precisión.
- `ai-workflow/docs/test-index.md`, si el fichero de test se reorganiza en varios ficheros por dominio.
