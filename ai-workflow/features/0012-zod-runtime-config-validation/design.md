# Design: Zod runtime config validation

## Contexto
La validación del runtime config sigue concentrada hoy en `src/config/validate-runtime-config.ts`, con parsing manual de `api`, `pages`, `initialPage`, `preloads` y del catálogo completo de nodos soportados en el estado real del repositorio (`container`, `heading`, `paragraph`, `list` y `button`).

La feature `0012` no busca cambiar ese contrato funcional ni abrir nuevas capacidades del JSON. El objetivo es sustituir la base estructural del validador por esquemas `Zod` para:
- hacer el contrato más explícito y modular
- reducir duplicación de reglas manuales
- mejorar la trazabilidad diagnóstica cuando un error depende de una ruta concreta del JSON
- preservar la frontera pública estable consumida por bootstrap y tests

El riesgo sigue siendo alto porque la migración toca una frontera central del arranque del runtime y debe mantener compatibilidad con comportamientos ya fijados, incluida la semántica de normalización pragmática actual:
- rechazo previo al render de shapes inválidos
- error explícito para `initialPage` inexistente
- error explícito para nodos no soportados
- descarte de claves extra no soportadas sin convertirlas en error
- tratamiento de nodos hoja con `children` ignorados

## Objetivos / No objetivos

### Objetivos
- Basar la validación estructural del runtime config en esquemas `Zod`.
- Mantener `validateRuntimeConfig` como única entrada pública del borde de bootstrap.
- Preservar los códigos semánticos públicos ya existentes: `invalid-layout`, `unsupported-node-type` e `initial-page-not-found`.
- Mejorar los mensajes para que apunten con más precisión a la ruta del JSON afectada.
- Mantener el objeto validado listo para usar por el runtime sin transformaciones manuales adicionales del consumidor.

### No objetivos
- Rediseñar la API pública del bootstrap o exponer `Zod` a los consumidores.
- Abrir todavía validación `Zod` para formularios, acciones API remotas o cualquier otra frontera fuera del runtime config.
- Añadir nodos, props o reglas funcionales nuevas al contrato JSON.
- Forzar compatibilidad textual exacta carácter por carácter con todos los mensajes actuales si eso impide obtener diagnósticos más trazables.

## Decisiones

### 1. La migración será híbrida: `Zod` para estructura y una pasada pequeña para validaciones cruzadas
La validación se dividirá en dos capas:
- una capa principal con esquemas `Zod` para parsear y normalizar `api`, `pages`, `preloads` y cada nodo soportado
- una pasada posterior y pequeña para reglas que dependen del conjunto ya validado, en particular:
  - existencia de `initialPage` dentro de `pages`
  - existencia de destinos `button.props.action.pageId` dentro del catálogo de páginas

Secuencia acordada para evitar solapamiento entre tareas:
- en la capa estructural, `button.props.action.type` debe seguir aceptando solo `navigateTo | goBack`
- si la acción es `navigateTo`, el esquema estructural solo debe exigir que `button.props.action.pageId` sea un string no vacío
- la comprobación de que ese `pageId` existe realmente dentro de `pages` queda reservada a la pasada de validación cruzada

Razonamiento:
- `Zod` resuelve mejor el contrato estructural y la normalización de objetos.
- las reglas cruzadas siguen siendo más legibles y menos frágiles si se expresan sobre el objeto ya parseado en vez de forzarlas dentro de un único esquema recursivo con contexto global.
- evita duplicar el contrato principal en lógica manual paralela; la capa manual queda restringida a coherencias entre campos.

### 2. `validateRuntimeConfig` sigue siendo la fachada pública y no expone tipos de `Zod`
La implementación puede añadir módulos internos nuevos, pero el consumidor público seguirá entrando por:
- `src/config/runtime-config.ts`
- `validateRuntimeConfig(rawConfig)`
- `RuntimeConfigValidationResult`
- `RuntimeConfigError`

Razonamiento:
- bootstrap y tests ya dependen de esa frontera.
- la mejora diagnóstica no debe obligar al consumidor a conocer `ZodError`, `issues` ni detalles internos del parser.

### 3. El shape público de `RuntimeConfigError` se mantiene estable
La feature no necesita introducir una taxonomía nueva de errores ni obligar a reescribir consumidores. La estrategia preferida es:
- conservar `code`, `displayMode` y `message`
- mejorar la trazabilidad incorporando rutas concretas en `message`
- mantener `unsupported-node-type` como código diferenciado cuando el fallo sea el tipo de nodo

Razonamiento:
- la spec exige equivalencia semántica hacia bootstrap y tests, no una API pública nueva.
- mejorar el mensaje es suficiente para el objetivo diagnóstico sin abrir churn de tipos en el borde.

### 4. El parser `Zod` debe preservar la política actual de normalización pragmática
La migración debe seguir normalizando igual que hoy:
- los objetos válidos devueltos por `validateRuntimeConfig` incluyen solo campos soportados
- las claves extra en `api`, nodos, `props` y acciones no cambian la semántica y no sobreviven al objeto validado final
- `children` en nodos hoja no abren semántica nueva
- `body` y `query` siguen aceptando únicamente el shape ya documentado

Razonamiento:
- ya existen tests y comportamiento implícito del runtime que dependen de esa normalización.
- `Zod` encaja bien aquí usando objetos que descartan claves desconocidas por defecto y reconstruyendo solo el shape soportado cuando haga falta.

### 5. El catálogo real de nodos soportados se toma del estado actual del runtime, no de una lista histórica parcial
Aunque la spec enumera explícitamente `container`, `heading`, `paragraph` y `list`, el estado real del repositorio ya soporta además `button`. La migración debe cubrir el catálogo vigente completo para no introducir una regresión.

Razonamiento:
- la propia spec habla del “catálogo vigente de nodos declarativos”.
- excluir `button` convertiría la feature en regresiva frente al runtime actual.

### 6. La detección de nodo no soportado seguirá siendo explícita y no se diluirá en un error genérico de unión
La implementación no debe depender de un `discriminatedUnion` que degrade un `type` desconocido a un mensaje opaco. La capa de esquema debe conservar una distinción clara:
- shape inválido de un nodo soportado -> `invalid-layout`
- `type` no soportado -> `unsupported-node-type`

Razonamiento:
- esa distinción ya forma parte del contrato observable.
- `Zod` debe mejorar la base estructural sin perder semántica de diagnóstico.

### 7. La estructura interna se separará en módulos de esquema y adaptación de errores
La implementación debería mover la responsabilidad a piezas internas explícitas, por ejemplo:
- `src/config/runtime-config-zod.ts` para los esquemas y helpers de parseo
- `src/config/runtime-config-validation-errors.ts` para mapear errores estructurales a `RuntimeConfigError`
- `src/config/validate-runtime-config.ts` como orquestador de alto nivel

Los nombres exactos pueden ajustarse, pero la separación de responsabilidades debe mantenerse.

Razonamiento:
- reduce el tamaño y la heterogeneidad del validador actual.
- deja una base ampliable para futuras features sin mezclar todavía validaciones de otras fronteras.

## Riesgos y trade-offs
- Riesgo: endurecer accidentalmente el contrato y romper configuraciones válidas hoy.
  Mitigación: tests de paridad sobre configuraciones válidas/inválidas ya cubiertas y mantener la política actual de descarte de claves extra.

- Riesgo: perder el código `unsupported-node-type` si el esquema trata todos los fallos como unión inválida.
  Mitigación: mantener una detección explícita del discriminante `type` antes de delegar en el esquema concreto del nodo.

- Riesgo: dejar demasiada lógica manual fuera de `Zod` y no capturar la mejora de mantenibilidad buscada.
  Mitigación: limitar la pasada manual posterior solo a reglas cruzadas (`initialPage` y destinos `navigateTo`) y mover todo lo demás al esquema.

- Riesgo: acoplar la mejora diagnóstica a texto exacto de `Zod`.
  Mitigación: usar una capa propia de adaptación que traduzca rutas e issues a mensajes del dominio del runtime.

## Migración o despliegue
La implementación necesitará:
- añadir `zod` a `package.json`
- actualizar `pnpm-lock.yaml`

No hay migración persistida ni cambios de despliegue aparte del bundle resultante.

Compatibilidad esperada:
- una configuración válida hoy sigue siendo válida
- una configuración inválida sigue fallando antes del render
- bootstrap y tests siguen consumiendo `validateRuntimeConfig` sin cambio de API

## Preguntas abiertas
- No queda ninguna pregunta abierta que bloquee la implementación si se respeta la estrategia híbrida acordada.
