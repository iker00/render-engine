# Design: Feature 0026 - sede-electronica-visual-alignment

## Contexto
La feature `0005` migró el styling visible inicial del runtime a `Tailwind CSS`, pero la base vigente sigue siendo oscura, genérica y demasiado cercana a un shell técnico. La `spec.md` de `0026` y el documento canónico [`ai-workflow/design/sede-electronica-reference.md`](../../design/sede-electronica-reference.md) cambian ese objetivo: ahora el runtime debe adoptar una gramática visual institucional, clara y reutilizable para cualquier pantalla renderizada.

El riesgo no está en una sola clase CSS, sino en dejar cerradas varias decisiones que podrían divergir entre agentes:
- dónde viven los tokens visuales y cómo se consumen desde `Tailwind`
- hasta qué punto el shell de la app cambia junto al runtime
- cómo se consiguen secciones comprensibles de formulario sin abrir un nodo declarativo nuevo
- qué partes de la referencia visual se difieren explícitamente para no inventar capacidades no soportadas hoy

## Objetivos / No objetivos

### Objetivos
- Introducir una base estable de variables CSS para color, tipografía, radios, bordes y espaciado.
- Reutilizar esos tokens desde `Tailwind` y desde la convención central de `src/runtime/runtime-node-styling.ts`.
- Reconvertir `AppShell`, `RuntimePage` y los nodos visibles soportados a una experiencia clara, administrativa y responsive.
- Resolver la jerarquía principal de lectura como: bloque introductorio, contenido principal y cierre de acciones.
- Conseguir separación visual de secciones de formulario reutilizando el catálogo actual del runtime.

### No objetivos
- Añadir theming declarativo desde JSON o una API visual configurable por pantalla.
- Introducir nodos nuevos para `hero`, `section`, `card`, `accordion` o `fileUpload`.
- Simular subida de archivos, colapsables móviles o cualquier interacción ausente del contrato actual.
- Rediseñar contratos de datos, navegación, formularios o queries más allá de su presentación visible.

## Decisiones

### 1. Los tokens viven en `src/app/index.css` como variables CSS globales
La fuente de verdad de color, radios, espaciado y tipografía residirá en `:root` dentro de `src/app/index.css`.

Motivo:
- el shell de la app y el runtime necesitan compartir la misma base
- evita introducir una segunda capa de configuración fuera del proyecto
- permite que `Tailwind` consuma los tokens con clases utilitarias y valores arbitrarios acotados

La implementación no debe crear un sistema de temas runtime configurables por JSON. La tematización futura, si existe, partirá de estas variables pero queda fuera de esta feature.

### 2. La convención visual sigue centralizada en `src/runtime/runtime-node-styling.ts`
La feature no repartirá clases complejas en cada nodo. `runtime-node-styling.ts` pasa a ser la capa central para exponer slots visuales reutilizables del runtime:
- shell y frame principal
- ancho y espaciado de página
- jerarquía tipográfica
- superficies y divisores
- campos, labels, errores y estados focus
- botones primarios y secundarios

Motivo:
- reduce divergencia entre nodos
- mantiene el cambio revisable y testeable con unit tests
- deja un único punto de ajuste para futuras iteraciones visuales

### 3. El shell visible cambia junto con el runtime
`src/app/app-shell.tsx` y `src/runtime/runtime-page.tsx` forman parte del alcance de implementación.

La composición base acordada es:
- fondo de página claro y suave
- contenedor principal centrado con ancho de lectura controlado
- superficie principal blanca o muy clara para el contenido del runtime
- espaciado amplio en desktop y compacto pero respirable en móvil

No se intentará reproducir la cabecera ni la navegación lateral de la captura. El alineamiento empieza en el contenido principal del trámite.

### 4. No se crea un nodo declarativo nuevo para secciones
La separación de secciones del formulario se resolverá reutilizando nodos actuales:
- `form` actuará como tarjeta principal del trámite
- `container` dentro de `form` será el mecanismo preferente para agrupar bloques de campos y podrá recibir styling coherente de sección
- `heading`, `paragraph` y listas conservarán una jerarquía compatible con ese contexto

Motivo:
- evita reabrir el contrato JSON sin necesidad
- mantiene la feature dentro del alcance visual
- permite que la estructura existente del config materialice bloques comprensibles sin inventar semánticas nuevas

Consecuencia operativa:
- la implementación puede introducir heurísticas de styling basadas en contexto de render ya existente
- no puede exigir una propiedad nueva del JSON para activar secciones

### 5. Los controles actuales adoptan una sola gramática administrativa
`button`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` deben compartir:
- labels por encima del control
- bordes suaves sobre superficie blanca
- foco azul visible
- error rojo controlado
- radios medios
- altura cómoda y densidad no compacta

Los botones deben distinguir dos roles visibles:
- primario sólido azul para la acción principal
- secundario con fondo claro y borde visible para acciones auxiliares

Como el contrato actual no permite marcar explícitamente una variante por botón, la implementación debe fijar esta convención mínima y estable, sin abrir todavía una API declarativa nueva:
- dentro de un `form`, el botón implícito de submit (`action` ausente) es la CTA primaria
- dentro de un `form`, los botones con `action.type: resetForm` o `action.type: goBack` son secundarios
- dentro de un `form`, cualquier botón con `action` explícita distinta de submit se trata como acción auxiliar y, por tanto, secundaria en esta iteración
- fuera de `form`, los botones no se reinterpretan como CTA principal del trámite; conservan una apariencia coherente con el sistema pero sin forzar jerarquía primaria/secundaria de cierre

Motivo:
- evita heurísticas frágiles basadas en posición visual
- mantiene estable la semántica ya observable del runtime
- deja la puerta abierta a una futura feature si hiciera falta declarar variantes explícitas por JSON

### 6. `radioGroup` y `checkboxGroup` no se convierten en widgets especiales
Estos nodos seguirán usando controles nativos. El cambio es visual y de densidad:
- mejor alineación label-control
- mayor separación vertical
- textos auxiliares coherentes con el resto del formulario

No se introducirán tarjetas seleccionables, iconografía compleja ni un componente paralelo.

### 7. La referencia de subida de archivos se difiere sin placeholder nuevo
La captura incluye un bloque de adjuntos, pero el runtime no soporta todavía esa capacidad.

Decisión:
- esta feature no añade placeholder visual específico de subida
- tampoco inventa una lista falsa de adjuntos
- la diferencia se documenta explícitamente en la pasada documental

Motivo:
- evita simular una funcionalidad inexistente
- mantiene el contrato visible honesto respecto al catálogo actual

### 8. La variante móvil no introduce acordeones
La captura móvil sugiere secciones plegables, pero la feature inicial se limita a layout y styling responsive.

Decisión:
- móvil conserva el orden lineal de lectura
- las secciones se distinguen por espaciado, títulos, bordes y superficies
- no se implementan colapsables ni estados expandidos/contraídos

## Riesgos y trade-offs

### Riesgo: heurísticas visuales demasiado implícitas
Si el runtime intenta inferir demasiadas variantes según posición o tipo de hijo, el resultado será difícil de mantener.

Mitigación:
- centralizar la lógica en `runtime-node-styling.ts`
- limitar las heurísticas a contextos estables como shell, `form` y `container` dentro de formulario

### Riesgo: romper tests por acoplarlos a clases exactas
El cambio afecta presentación visible de muchos nodos.

Mitigación:
- usar unit tests para fijar la convención central
- en tests de integración, comprobar solo clases y atributos que representen contrato visual estable, no el detalle incidental completo del markup

### Riesgo: abrir sin querer una API nueva de theming
La feature exige variables CSS, pero no debe derivar en personalización declarativa.

Mitigación:
- tokens globales versionados en CSS
- consumo desde clases y helpers del runtime
- cero cambios en el shape del JSON para estilos

## Migración o despliegue
- No hay migración de datos ni backend.
- `src/dev/config.json` puede ajustarse para que la configuración local ejercite mejor la nueva gramática visual, pero sin añadir contratos nuevos.
- El cierre de implementación exige mantener `pnpm test` en verde y conservar el gate global de coverage del 80% sobre `src/`.

## Preguntas abiertas
- No quedan preguntas técnicas bloqueantes para implementación dentro del alcance de la feature.
- Cualquier futura necesidad de acordeones, upload o theming declarativo debe abrirse como feature separada.
