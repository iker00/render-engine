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

## Componentes del runtime

### Resolución de variantes visuales
- Un nodo del runtime con variantes visuales (`variant`, o cualquier discriminador equivalente) debe resolver la selección de clases o estructura mediante un lookup map `Record<Variant, string>` o delegando en un único helper de `runtime-node-styling.ts`.
- No repetir el esqueleto JSX del nodo por rama `if/else` cuando la única diferencia entre variantes es qué helper de estilo se invoca: la estructura común debe declararse una sola vez y la resolución por variante debe quedar centralizada.
- Precedentes vigentes del patrón deseado en el propio código: `src/runtime/nodes/divider-layout-node.tsx` (lookup map `Record<Variant, string>`) y `src/runtime/nodes/button-layout-node.tsx` (delegación en un único helper de `runtime-node-styling.ts`).

### JSX frente a `createElement`
- JSX es la forma por defecto para renderizar el elemento raíz de un nodo y sus hijos.
- El uso explícito de `createElement` sólo se admite cuando exista una razón técnica real, por ejemplo un nombre de tag verdaderamente dinámico sin alternativa JSX limpia (caso actual de `src/runtime/nodes/icon-node.tsx`).
- Un tag dinámico entre elementos HTML conocidos (por ejemplo `h1`–`h6` según `props.level`) puede resolverse en JSX asignando el resultado del helper a una variable en `PascalCase` y usándola como componente; no justifica por sí solo recurrir a `createElement`.

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

