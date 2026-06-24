# Design: Feature 0081 - design-tokens-normalization

## Contexto

El runtime declara hoy un puñado de tokens app-level (`app-background`, `app-surface`, `app-surface-subtle`, `app-text`,
`app-text-strong`, `app-text-muted`, `app-accent`, `app-accent-strong`, `app-danger`, `app-border-soft`,
`app-border-strong`) en `@theme` dentro de `src/app/index.css`. A su lado, conviven docenas de clases de color crudas de
Tailwind (`blue-*`, `red-*`, `green-*`, `yellow-*`, `gray-*`, `cyan-*`) repartidas por:

- `runtime-node-styling.ts` en los maps de variantes de botón (solid/outline/ghost/link).
- Nodos con clases inline en JSX: `accordion-layout-node.tsx`, `tabs-layout-node.tsx`, `link-layout-node.tsx`,
  `stat-layout-node.tsx`, `badge-layout-node.tsx`, `alert-layout-node.tsx`, `skeleton-layout-node.tsx`,
  `input-layout-node.tsx` (icono e iconHolder), y todo el subárbol `file-manager/`.

Tailwind v4 resuelve cualquier `--color-<name>-<step>` declarado en `@theme` como utilidad estándar
(`bg-<name>-<step>`, `text-<name>-<step>`, `border-<name>-<step>`), por lo que la sustitución de paleta puede hacerse
sin tooling adicional: solo declarar los tokens y renombrar usages. Lo mismo aplica al token `--radius-card`, hoy
referenciado por `rounded-card` pero no declarado en `@theme` (Tailwind v4 ignora silenciosamente la clase, dejando
border-radius por defecto = 0).

La referencia visual de sede.png está documentada en `ai-workflow/design/sede-electronica-reference.md`. Sus valores
orientativos (azul `#2563eb`, neutrales fríos, controles compactos pero respirables, radios medios) son la base
cromática del design. La spec añade dos matices propios respecto a esa referencia: escala tipográfica más compacta
("aplicación de gestión, no landing") y densidad de controles más contenida. Cuando hay conflicto, prevalecen los
criterios de la spec.

Los tokens app-level existentes son consumidos por el shell, formularios, paginación, tabla y bordes generales. No se
pueden borrar sin reescribir esos sitios. La estrategia del design es preservarlos como capa de aplicación pero anclar
sus valores a la paleta semántica.

El alcance excluye theming declarativo desde JSON y cualquier cambio de contrato funcional. El runtime no necesita
mecanismo nuevo de evaluación: todo se resuelve en CSS y `className` estáticos.

## Objetivos / No objetivos

### Objetivos

- Declarar en `@theme` seis paletas semánticas completas (`neutral`, `primary`, `success`, `warning`, `danger`, `info`)
  derivadas de la referencia sede.png, con rango 50–900.
- Reanclar los tokens app-level a la paleta semántica para que `app-accent` deje de ser un color independiente y pase
  a ser un alias de `primary-600`.
- Declarar `--radius-card` en `@theme` con valor coherente con el resto de radii.
- Definir y consumir desde `runtime-node-styling.ts` una escala tipográfica de headings reducida un escalón frente a
  la actual.
- Fijar criterio de pesos tipográficos por tipo de elemento: cuándo `font-semibold` y cuándo `font-medium`.
- Fijar criterio de padding uniforme entre móvil y desktop para inputs, botones, paginación y filtros.
- Eliminar todas las clases de color crudas de Tailwind bajo `src/runtime/` sustituyéndolas por utilidades de la paleta
  semántica.
- Migrar los estilos inline en JSX de los nodos listados en la spec hacia funciones centralizadas en
  `runtime-node-styling.ts`, sin cambiar comportamiento.
- Garantizar `transition-colors` en todos los elementos interactivos del runtime.

### No objetivos

- Theming declarativo desde JSON (sigue fuera de v1).
- Cambios en el contrato Zod ni en props de nodos.
- Cambios en lógica de runtime, navegación, estado o queries.
- Cambios en la fuente tipográfica.
- Cambios en `--radius-shell`, `--radius-section`, `--radius-form`, `--radius-control`, sombras o anchos de container
  más allá de lo necesario para anclar `radius-card`.
- Introducir nuevos nodos, variantes o props visuales.
- Reescribir los tests de comportamiento; solo actualizar aserciones de `className` cuando aplique.

## Decisiones

### D1. Paleta semántica completa con rango 50–900

Declarar en `@theme` los seis roles (`neutral`, `primary`, `success`, `warning`, `danger`, `info`) con todos los pasos
50, 100, 200, 300, 400, 500, 600, 700, 800, 900.

Motivo: la spec exige al menos 50–800, pero el código actual ya consume `text-gray-900` (stat value) y `border-gray-300`
(drop zone idle). Declarar el rango completo evita huecos posteriores y deja una superficie homogénea por rol.

Trade-off: más tokens declarados que los estrictamente usados hoy. Es coste despreciable porque Tailwind v4 solo emite
las utilidades realmente referenciadas en JSX.

Alternativa descartada: declarar solo los pasos en uso. Se descarta porque obligaría a ampliar `@theme` cada vez que un
nodo nuevo necesite un step adicional, dispersando la decisión cromática.

### D2. Valores concretos de la paleta

Los valores parten de la referencia sede.png. Se eligen hex sobre oklch porque la referencia visual los expresa así y
porque mantienen previsibilidad respecto a la documentación existente.

Tabla de valores (de claro a oscuro):

```txt
neutral
  50  #f8fafc
  100 #f1f5f9
  200 #e2e8f0
  300 #cbd5e1
  400 #94a3b8
  500 #64748b
  600 #475569
  700 #334155
  800 #1e293b
  900 #0f172a

primary (azul institucional sede)
  50  #eff6ff
  100 #dbeafe
  200 #bfdbfe
  300 #93c5fd
  400 #60a5fa
  500 #3b82f6
  600 #2563eb
  700 #1d4ed8
  800 #1e40af
  900 #1e3a8a

success
  50  #f0fdf4
  100 #dcfce7
  200 #bbf7d0
  300 #86efac
  400 #4ade80
  500 #22c55e
  600 #16a34a
  700 #15803d
  800 #166534
  900 #14532d

warning
  50  #fffbeb
  100 #fef3c7
  200 #fde68a
  300 #fcd34d
  400 #fbbf24
  500 #f59e0b
  600 #d97706
  700 #b45309
  800 #92400e
  900 #78350f

danger
  50  #fef2f2
  100 #fee2e2
  200 #fecaca
  300 #fca5a5
  400 #f87171
  500 #ef4444
  600 #dc2626
  700 #b91c1c
  800 #991b1b
  900 #7f1d1d

info
  50  #ecfeff
  100 #cffafe
  200 #a5f3fc
  300 #67e8f9
  400 #22d3ee
  500 #06b6d4
  600 #0891b2
  700 #0e7490
  800 #155e75
  900 #164e63
```

Motivo: la rampa `primary` se ancla en `#2563eb` (sede) como step 600 y se extiende a ambos lados con la rampa estándar
de Tailwind para esa tonalidad. Los neutrales adoptan la rampa de slate (también la usada por la referencia sede para
texto y bordes), más fría y armónica con el azul que la rampa de zinc o stone. Success, warning, danger e info usan las
rampas estándar de Tailwind (green, amber, red, cyan) que ya producen un conjunto cromático equilibrado y son las que
mejor se acercan a los colores crudos que se están sustituyendo (menor probabilidad de regresión visual percibida).

Trade-off: copiamos rampas conocidas de Tailwind v3/v4. Eso simplifica la migración (las equivalencias 1:1 son
evidentes) y reduce el riesgo de "color drift". El coste es que la paleta no es totalmente única; se asume porque la
spec no exige distinción visual frente a Tailwind, sino centralización y coherencia.

Alternativa descartada: derivar todas las rampas con oklch desde el primary. Se descarta para esta iteración porque
ralentiza la implementación, complica la verificación visual contra sede.png y no aporta valor antes de un theming
declarativo.

### D3. Anclaje de tokens app-level a la paleta semántica

Los tokens app-level se conservan pero pasan a apuntar a valores de la paleta semántica:

```css
--color-app-background: var(--color-neutral-50)
--color-app-surface: #ffffff
--color-app-surface-subtle: var(--color-neutral-100)
--color-app-border-soft: var(--color-neutral-200)
--color-app-border-strong: var(--color-neutral-300)
--color-app-text: var(--color-neutral-700)
--color-app-text-strong: var(--color-neutral-900)
--color-app-text-muted: var(--color-neutral-500)
--color-app-accent: var(--color-primary-600)
--color-app-accent-strong: var(--color-primary-700)
--color-app-danger: var(--color-danger-600)
```

Motivo: la spec dice que los tokens app-level deben ser coherentes con la paleta. Mantenerlos como capa con nombre
propio permite que el shell, formularios y paginación sigan consumiendo `bg-app-surface`, `text-app-text-muted` y
similares sin reescribirse. Quedan como alias semánticos de "rol de aplicación", no como capa duplicada.

Trade-off: hay dos formas de referirse al mismo color. Convivirán durante toda la v1. Se acepta porque permite migrar
gradualmente nodos sin abrir nueva ola de churn en el shell, y porque la app-level mantiene una semántica útil
("este azul es el accent del shell", no "este azul es primary").

Convención para mantener la doble capa coherente: dentro del shell de aplicación y de las funciones generales de
`runtime-node-styling.ts` que ya consumen app-level (paginación, table, form base, app-shell), se sigue consumiendo
`app-*`. En los maps por color/variant de nodos semánticos (`button`, `badge`, `alert`, `stat`, drop-zone phases) se
consume directamente la paleta semántica (`primary-600`, `success-100`, etc.). Así se preserva la separación entre
"chrome de aplicación" y "componente con color por contrato".

Alternativa descartada: borrar `app-accent` y `app-accent-strong` y reescribir todos sus consumidores a `primary-600`/
`primary-700`. Se descarta porque la migración masiva añade riesgo sin beneficio funcional y porque la capa app-level
es la única salida razonable si en el futuro se introduce theming declarativo o variantes por marca.

### D4. Token `--radius-card`

Declarar en `@theme`:

```css
--radius-card: 0.75rem
```

Motivo: 0.75rem (12px) encaja con la franja "inner cards/sections 14-18px" de sede.md a la baja y aporta diferenciación
clara frente a `--radius-control` (0.5rem, 8px) y `--radius-section` (0.75rem). Se elige el mismo valor que
`--radius-section` para mantener la cardinalidad visual sin proliferar tamaños nuevos.

Trade-off: `radius-section` y `radius-card` quedan iguales numéricamente. Se acepta porque su semántica es distinta y
en el futuro pueden divergir sin migración masiva.

Alternativa descartada: 1rem (16px). Se descarta porque introduce un radio que no encaja con la escala existente y
porque la captura de sede muestra esquinas medias-pequeñas para tablas, imágenes y modales.

### D5. Escala tipográfica de headings

Nueva escala en `runtime-node-styling.ts` (función `getHeadingNodeClassName`):

```txt
h1: text-lg sm:text-xl
h2: text-base sm:text-lg
h3: text-sm sm:text-base
h4: text-sm sm:text-base
h5: text-xs sm:text-sm
h6: text-xs sm:text-sm
```

Motivo: la spec pide "reducir al menos un escalón completo" y fija h1 ≈ `text-xl`/`text-2xl` como techo. La escala
elegida reduce más de un escalón en niveles altos (h1, h2) y comprime niveles bajos contra el body text (`text-sm` por
defecto, ver `getParagraphNodeClassName`). Esto refleja una jerarquía propia de aplicación de gestión: el título de
página no compite con la card principal y los subtítulos no se solapan con labels.

Trade-off: la diferencia entre niveles bajos se vuelve sutil (h3-h4 comparten tamaño base, h5-h6 también). Se acepta
porque en una aplicación de gestión raramente se anidan más de 3 niveles reales de heading; los pares h3/h4 y h5/h6
se diferenciarán por peso (decision D6), no solo por tamaño.

Alternativa descartada: la franja del reference doc (hero 40-48px, section 24-28px, card 18-20px). Se descarta porque
la spec lo contradice explícitamente y porque sede.png ilustra un trámite hero-céntrico que no representa el caso
general del runtime.

### D6. Criterio de pesos tipográficos

Matriz fija que la implementación debe respetar:

```txt
font-semibold (600):
  - getHeadingNodeClassName niveles 1 y 2
  - getPrimaryButtonNodeClassName, getSecondaryButtonNodeClassName y solid variant de button
  - app-shell error title y eyebrow
  - table header cell (mantiene el énfasis uppercase actual)
  - table sort button activo

font-medium (500):
  - getHeadingNodeClassName niveles 3 a 6
  - getFieldLabelClassName
  - getFieldErrorClassName (mantiene)
  - outline, ghost y link variant de button (no son CTA principal)
  - badge label
  - alert title
  - stat label y value cuando son tinted (queda font-medium en label y font-semibold en value)
  - pagination buttons (incluido current button)
  - table filter reset button
  - file-manager row text, file-manager action buttons
  - tab active label
  - link node label

font-normal (400):
  - paragraph, list items, body text genérico (sin cambio respecto al estado actual)
  - tab inactive label
  - drop zone helper texts
```

Motivo: reservar `semibold` para énfasis real (CTA, encabezados de página, tabla header) y mover labels y controles
secundarios a `medium`. Eso descongestiona visualmente la página, que hoy presenta `semibold` repartido en demasiados
sitios.

Trade-off: tab active y stat value tinted bajan de `font-bold`/`font-semibold` actuales a `font-semibold`/`font-medium`.
Asumido como parte del rebalanceo visual buscado.

### D7. Padding uniforme en controles

Eliminar la inversión actual (`px-4 py-3 sm:px-3.5 sm:py-2.5`) y unificar:

```txt
Inputs y campos de formulario (getFieldControlClassName, getTableFilterInputClassName):
  px-3 py-2

Botones principales y secundarios (getPrimaryButtonNodeClassName, getSecondaryButtonNodeClassName,
getTableFilterResetButtonClassName, getButtonVariantClassName base):
  px-3.5 py-2

Paginación (getRepeaterPaginationButtonClassName):
  px-3 py-1.5

Tab buttons (cuando se centralicen en runtime-node-styling):
  px-3 py-1.5
```

Motivo: la inversión actual viene de iteraciones previas y produce controles más altos en móvil que en desktop. La
referencia sede pide "altura cómoda sin densidad compacta extrema": un único par de valores que sea cómodo en touch y
preciso en desktop es suficiente. Se elige `py-2` para inputs y botones grandes (32–36 px de altura total con `text-sm`)
y `py-1.5` para botones secundarios de paginación/tab. La separación horizontal mantiene `px-3` para inputs y `px-3.5`
para botones, conservando el ligero respiro lateral en CTAs.

Trade-off: el área táctil en móvil disminuye respecto a la actual `py-3`. La métrica resultante (~34 px) sigue dentro de
guidelines razonables para web no nativa y la spec lo respalda explícitamente ("controles compactos y limpios").

Alternativa descartada: declarar tokens semánticos de espaciado (`--space-control-x`, `--space-control-y`). Se descarta
porque la spec excluye cambios de tokens de layout y porque las utilidades Tailwind ya cubren la necesidad sin abstraer
más.

### D8. Transiciones unificadas

Toda función de `runtime-node-styling.ts` que devuelve clases para un elemento interactivo debe incluir
`transition-colors`. Esto ya está garantizado en botones, table sort/reset y paginación. Se añadirá explícitamente al
migrar:

- tabs (tab button)
- link node
- file-manager row action buttons
- file-manager drop zone (ya tiene `transition-colors`; se preserva)

Motivo: criterio funcional explícito de la spec. Se centraliza en las funciones de styling para que la añadidura sea
automática y futura-prueba.

### D9. Migración de estilos inline a `runtime-node-styling.ts`

Las clases hoy inline en JSX se trasladan a nuevas funciones centralizadas en `runtime-node-styling.ts`. Esquema:

```txt
accordion-layout-node.tsx
  getAccordionHeaderClassName(): wrapper button del header
  getAccordionChevronClassName(isOpen: boolean): chevron transform + colour
  getAccordionBodyClassName(): contenedor del cuerpo
  getAccordionBodyAnimationClassName(isOpen: boolean): clase de animate-accordion-*

tabs-layout-node.tsx
  getTabsRootClassName(orientation): flex layout
  getTabsBarClassName(orientation): bar
  getTabsButtonClassName(isActive, orientation): activo vs inactivo
  getTabsPanelClassName(): panel container

link-layout-node.tsx
  getLinkNodeClassName(): el anchor con color primary y subrayado

stat-layout-node.tsx
  getStatAccentRootClassName(color): contenedor + border-l-4 + border-{role}
  getStatAccentIconClassName(color)
  getStatAccentLabelClassName()
  getStatAccentValueClassName()
  getStatTintedRootClassName(color): bg-{role}-100
  getStatTintedIconClassName(color)
  getStatTintedLabelClassName(color)
  getStatTintedValueClassName(color)

badge-layout-node.tsx
  getBadgePillClassName(color)
  getBadgeCircleDotClassName(color)
  getBadgeCircleLabelClassName()

alert-layout-node.tsx
  getAlertClassName(color)
  getAlertTitleClassName()

skeleton-layout-node.tsx
  getSkeletonBaseClassName(): bg-neutral-200 base
  getSkeletonAnimateClassName(animate: boolean)

input-layout-node.tsx (iconHolder y icono)
  getInputIconHolderClassName()
  getInputIconClassName()

file-manager (varias funciones, una por subcomponente):
  getFileManagerRowClassName()
  getFileManagerRowFileNameClassName()
  getFileManagerRowActionClassName(disabled, danger)
  getFileManagerListErrorClassName()
  getFileManagerListEmptyClassName()
  getFileManagerErrorItemClassName()
  getFileManagerDropZoneClassName(dndPhase)
  getFileManagerDropZoneTextClassName(dndPhase)
  getFileManagerDropZoneProgressTrackClassName()
  getFileManagerDropZoneProgressFillClassName()
```

Motivo: la spec exige migrar estos nodos. Mantener el patrón "una función por sub-elemento, parametrizada por estado"
sigue la convención ya establecida en `getPrimaryButtonNodeClassName` y `getFieldControlClassName(hasError)`.

Trade-off: la superficie pública de `runtime-node-styling.ts` crece de forma apreciable (≈ 30 funciones nuevas). Se
acepta porque consolida la decisión cromática y porque ese módulo ya está reconocido en `architecture.md` como punto
estable para gramática visual.

Alternativa descartada: extraer un sub-módulo por área (`runtime-node-styling/accordion.ts`, etc.). Se descarta para
esta iteración porque rompería referencias existentes desde tests y desde el resto del runtime, y porque el módulo
sigue siendo legible al ordenarse por área dentro del archivo.

### D10. Mapeo color crudo → token semántico

Tabla de migración aplicable durante la sustitución:

```txt
Botones (solid/outline/ghost/link en runtime-node-styling.ts):
  blue-*    -> primary-*
  red-*     -> danger-*
  green-*   -> success-*
  yellow-*  -> warning-*
  cyan-*    -> info-*
  gray-*    -> neutral-*

Stat:
  accent borders/icons gray-400 / blue-500 / green-500 / yellow-400 / red-500 / cyan-500
    -> neutral-400 / primary-500 / success-500 / warning-500 / danger-500 / info-500
  tinted bg-{color}-100 / text-{color}-600 / text-{color}-800
    -> bg-{role}-100 / text-{role}-700 / text-{role}-800
    (cambio menor: el text de label tinted pasa de step 600 a 700 para mejorar contraste sobre el bg 100)
  text-gray-500 (label accent default) -> text-app-text-muted
  text-gray-900 (value accent default) -> text-app-text-strong

Badge:
  pill bg-{color}-100 / text-{color}-700  -> bg-{role}-100 / text-{role}-700
  circle dot bg-{color}-{400|500}         -> bg-{role}-500 (uniformar a step 500 para todos los roles)

Alert:
  bg-{color}-100 / text-{color}-700 -> bg-{role}-100 / text-{role}-700

Skeleton:
  bg-gray-200 -> bg-neutral-200

Input icon holder:
  bg-gray-50    -> bg-neutral-50
  text-gray-400 -> text-app-text-muted

Tabs:
  active border-blue-600 -> border-primary-600
  active text (nuevo)    -> text-primary-700
  inactive text-gray-600 -> text-app-text-muted
  inactive hover text-gray-900 -> text-app-text-strong

Link node:
  text-blue-600 -> text-primary-600
  hover:text-blue-800 -> hover:text-primary-800

Accordion:
  bg-app-accent/10 -> bg-primary-50  (alias semántico explícito; se mantiene equivalencia tonal pero pasa por la rampa)
  hover:bg-app-accent/20 -> hover:bg-primary-100
  text-app-accent (chevron) -> text-primary-600
  focus-visible:ring-app-accent -> focus-visible:ring-primary-600

File-manager row:
  border-gray-200 -> border-app-border-soft
  text-gray-700   -> text-app-text
  text-gray-500   -> text-app-text-muted
  text-gray-400   -> text-app-text-muted
  text-gray-300   -> text-neutral-300
  text-blue-600   -> text-primary-600
  hover:text-blue-800 -> hover:text-primary-800
  text-red-500    -> text-danger-600
  hover:text-red-700 -> hover:text-danger-700

File-manager list/error:
  text-red-600  -> text-danger-600
  text-gray-500 -> text-app-text-muted

File-manager drop zone (phaseClassMap):
  idle border-gray-300 bg-gray-50 hover:bg-gray-100
    -> border-neutral-300 bg-neutral-50 hover:bg-neutral-100
  drag-over border-blue-500 bg-blue-50
    -> border-primary-500 bg-primary-50
  uploading border-blue-400 bg-blue-50
    -> border-info-400 bg-info-50
  success border-green-500 bg-green-50
    -> border-success-500 bg-success-50
  error border-red-400 bg-red-50
    -> border-danger-400 bg-danger-50

File-manager drop zone (textos e iconos):
  text-blue-700   -> text-info-700
  bg-blue-200     -> bg-info-200
  bg-blue-600     -> bg-info-600
  text-green-700  -> text-success-700
  text-gray-400   -> text-app-text-muted
  text-gray-500   -> text-app-text-muted
```

Motivo: se elige el step más cercano al crudo original para minimizar regresión percibida. Solo se desvían
intencionadamente:
- "uploading" de drop-zone pasa de primary a info, porque su semántica es "en progreso", consistente con badge/alert
  info; visualmente sigue siendo azul cian/claro y mantiene diferenciación con "drag-over" (primary).
- Stat tinted label sube de step 600 a 700 para garantizar contraste AA sobre fondos 100.

Trade-off: pequeñas variaciones tonales serán visibles en píxel-comparison automatizado si existiera. Se acepta porque
la spec admite explícitamente actualizaciones de snapshots de className.

### D11. Estrategia de sustitución y ámbito de cambio

La eliminación de colores crudos solo se exige bajo `src/runtime/`. Otras carpetas (`src/app/`, `src/config/`,
`src/queries/`, `src/dev/`, `src/tests/`) quedan fuera del criterio de aceptación de "no quedan clases crudas".

Motivo: `src/app/` (bootstrap, error screen) ya consume solo tokens app-level; `src/dev/` contiene config local sin
estilos; `src/tests/` puede comprobar tokens en string sin que eso sea "uso de color crudo en producción". El alcance
queda explícito para evitar reabrirlo en review.

Trade-off: si en el futuro alguien añade colores crudos en otra carpeta, este criterio no lo detecta. Se asume; un
linter es out-of-scope.

### D12. Validación visual

No se introducen snapshots visuales automatizados. La verificación de coherencia con sede.png será manual,
documentando en `notes.md` cualquier hallazgo relevante durante la implementación. Los tests existentes que comprueban
`className` por substring se actualizan a los nuevos nombres.

Motivo: la spec lo deja explícito en preguntas abiertas. Una infraestructura de visual regression queda fuera del
alcance.

## Riesgos y trade-offs

- **Cambio de identidad visual del accent**: `--color-app-accent` pasa de verde lima (`#A6D82F`) a azul institucional
  (`#2563eb`). Es un cambio deliberado y alineado con la spec y con la referencia sede, pero será el cambio visualmente
  más notable. Riesgo bajo si se comunica al revisar (capturas antes/después en `notes.md`).
- **Pérdida de contraste en stat tinted**: el ajuste de step 600 → 700 en labels tinted requiere comprobación rápida
  con cada color. Riesgo bajo: la rampa de Tailwind ya garantiza AA en 700/100 para todos los roles seleccionados.
- **Snapshots de className**: cualquier test que aserciona substring `blue-`, `gray-`, etc. romperá. Riesgo medio en
  cantidad de cambios, bajo en complejidad: son ajustes mecánicos. La planificación debe contemplar la actualización
  como parte de cada tarea, no como tarea final separada.
- **Cobertura de tests**: la migración de inline → centralizado puede dejar funciones nuevas en `runtime-node-styling`
  sin test directo si los tests existentes solo prueban el nodo de alto nivel. Para mantener el umbral del 80%, hay que
  cubrir las nuevas funciones de styling con tests unitarios cortos (entrada → className esperado), reutilizando el
  patrón existente para `getButtonVariantClassName`.
- **Doble capa app/semantic**: introduce dos formas legítimas de referirse al mismo color. Mitigación: convención
  explícita en D3 (shell y funciones generales → app-*; nodos semánticos → paleta). Documentar la convención en
  `conventions.md` durante la fase de documentación posterior.
- **rounded-card resuelve hoy a 0**: declarar `--radius-card: 0.75rem` hará visibles cambios sutiles en image, table
  container y modal. Verificable a ojo; aceptable como parte del scope ("token no declarado" es un bug latente).
- **Padding más compacto**: reducción de altura efectiva de controles en móvil. Riesgo bajo de accesibilidad táctil; la
  altura resultante se mantiene por encima de 32 px, dentro de límites razonables.

## Migración o despliegue

- No requiere migración de datos ni de contratos.
- No requiere feature flag: el cambio es CSS y `className`, observable en build.
- Compatibilidad con `data-config` en producción y `src/dev/config.json` en desarrollo: idéntica; los nodos siguen
  aceptando las mismas props.
- Orden recomendado para la fase de planificación posterior:
  1. Declarar paleta semántica completa y `--radius-card` en `@theme`, sin tocar consumidores aún.
  2. Anclar los tokens app-level a la paleta semántica.
  3. Migrar `runtime-node-styling.ts`: maps de variantes de botón a la paleta semántica, escala de headings, pesos y
     padding actualizados.
  4. Migrar estilos inline a funciones centralizadas, nodo a nodo (accordion, tabs, link, stat, badge, alert,
     skeleton, input icon, file-manager).
  5. Pase de transiciones y `transition-colors` donde falten.
  6. Verificación visual contra sede.png y actualización documental.
- Cada paso del orden anterior es una sublista de planificación, no un troceado final; eso pertenece a
  `generate-implementation-plan`.

## Preguntas abiertas

- **Validación visual sin snapshots**: queda como dependencia humana. No bloquea planificación pero condiciona el
  cierre de la feature. Documentar en `notes.md` los hallazgos comparativos.
- **Cambio de identidad app-accent verde → azul**: si más adelante se desea conservar el verde lima como variante de
  marca, debería abrirse una feature aparte (theming declarativo). Esta feature lo desplaza intencionadamente.
