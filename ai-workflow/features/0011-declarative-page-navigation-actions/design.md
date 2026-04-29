# Design: Declarative page navigation actions

## Contexto
La feature `0010` ya dejó operativo el estado compartido del runtime para navegación interna, historial funcional y relanzado automático de `preloads` al entrar en una página. También existe ya un dispatcher central de nodos (`layout-node-renderer.tsx`) y piezas visuales concretas para cada nodo soportado.

Lo que todavía no existe es una superficie interactiva declarativa dentro del `layout` para reutilizar esa navegación desde el propio JSON. Implementar esta feature sin diseño previo abre cuatro riesgos:
- fijar un shape de acción demasiado pegado al primer trigger y difícil de reutilizar cuando aparezcan `link` o submit de formularios
- repartir la semántica de `goBack` entre componente, provider y reducer sin una regla única sobre el historial
- dejar ambigua la validación del destino `pageId` entre bootstrap e interacción en tiempo de ejecución
- mezclar la reentrada de página y el relanzado de `preloads` con lógica especial en el nuevo nodo visual en vez de reutilizar la navegación ya estable

## Objetivos / No objetivos

### Objetivos
- Añadir un nodo `button` al contrato del runtime como primer trigger interactivo declarativo.
- Fijar un shape único y acotado para acciones de navegación `navigateTo` y `goBack`.
- Reutilizar el estado de navegación y el historial interno ya existentes, incluyendo la política de reentrada que vuelve a disparar `preloads`.
- Mantener el componente visual del botón separado de la lógica de ejecución de la acción para que la misma familia de acciones pueda reutilizarse más adelante desde otros triggers.
- Rechazar en bootstrap las configuraciones con shape de `button` o de acción incompatible con el contrato soportado.

### No objetivos
- Diseñar un sistema general de eventos con varios handlers por nodo, condiciones, composición de acciones o secuencias.
- Añadir triggers distintos de `button`.
- Abrir referencias declarativas sobre `navigation.*` para condicionar visibilidad, deshabilitado o contenido.
- Cambiar la política de `preloads`, latest-only o caché ya fijada en `0010`.
- Sincronizar la navegación con la URL del navegador o con `window.history`.

## Decisiones

### 1. El contrato del nuevo nodo será `button.props.label + button.props.action`
El runtime añadirá un nodo `button` con este shape funcional:

```ts
interface ButtonLayoutNode {
  type: 'button'
  id?: string
  props: {
    label: string
    action:
      | { type: 'navigateTo'; pageId: string }
      | { type: 'goBack' }
  }
}
```

Reglas de contrato:
- `label` es obligatorio y visible.
- `action` es obligatoria.
- `navigateTo` exige `pageId` no vacío.
- `goBack` no admite parámetros adicionales necesarios para v1.
- el nodo sigue el patrón actual de nodos hoja: `children` no forma parte de su semántica soportada.
- para mantener consistencia con el contrato actual del runtime, claves extra no soportadas dentro de `button.props` o de `action` no bloquean el bootstrap, pero la validación debe descartarlas del objeto normalizado y los tests deben fijar ese comportamiento
- si un `button` recibe `children`, el contrato no los usa y el valor debe conservar el mismo tratamiento pragmático que el resto de nodos hoja actuales: no afecta al render ni abre semántica adicional

Razonamiento:
- mantiene la generación simple desde backend legacy
- evita abrir ya un modelo general `events.onClick`
- deja la acción como dato reutilizable aunque el primer trigger sea un botón

### 2. La validación del config debe cerrar el shape de la acción y la existencia del destino antes del render
La validación en `src/config/validate-runtime-config.ts` debe:
- aceptar `button` como tipo soportado
- validar `props.label`
- validar `props.action`
- rechazar acciones con `type` distinto de `navigateTo | goBack`
- rechazar `navigateTo` sin `pageId` válido
- rechazar `navigateTo` cuyo `pageId` no exista dentro del catálogo declarado de `pages`

La comprobación de existencia del destino debe hacerse con conocimiento del catálogo completo de páginas ya parseado, no desde el componente ni desde el provider.

Razonamiento:
- la spec exige que los shapes inválidos y los destinos mal declarados se rechacen de forma explícita en bootstrap
- mantener esta validación fuera del tiempo de interacción evita que una mala configuración llegue al runtime visible como caso recuperable

### 3. `goBack` se implementa como transición explícita del reducer, no como derivación ad hoc en el botón
La navegación interna debe conservar dos operaciones distintas en la capa de estado:
- `navigateToPage(pageId)` para cambiar a una página concreta
- `goBackPage()` para volver a la entrada válida anterior del historial

Semántica del historial:
- `navigateToPage(pageId)` hacia la misma página visible sigue siendo `no-op`, no añade historial y limpia `lastError`
- `navigateToPage(pageId)` hacia una página distinta sigue añadiendo el destino al final de `history`
- `goBackPage()` con al menos dos entradas elimina la entrada actual, mueve `currentPageId` a la nueva cola del historial y limpia `lastError`
- `goBackPage()` con menos de dos entradas es `no-op`, no crea error y no inventa destino
- un recorrido `A -> B -> A` conserva `history: [A, B, A]`; al hacer `goBack` desde ese estado se obtiene `B`

Razonamiento:
- la regla correcta vive en el dominio de navegación, no en el trigger visual
- usar pop de la entrada actual conserva la semántica pedida para duplicados funcionales

### 4. La ejecución declarativa del botón se centraliza en un pequeño módulo de acciones del runtime
La feature debería introducir una pieza explícita, por ejemplo en `src/runtime/runtime-actions/`, responsable de traducir la acción declarativa a llamadas del provider:
- `navigateTo` -> `navigateToPage(pageId)`
- `goBack` -> `goBackPage()`

El nuevo `ButtonNode` queda limitado a:
- renderizar un `<button type="button">`
- aplicar la convención visual base del runtime
- invocar el ejecutor de acción al hacer click

Razonamiento:
- evita meter la semántica de navegación dentro del nodo visual
- deja una superficie lista para que futuras features reutilicen las mismas acciones desde triggers distintos
- mantiene la arquitectura separada entre presentación, estado e interpretación del contrato
- deja claro que `0011` no está modelando todavía `click` como evento general; solo encapsula el disparo mínimo actual para que esa futura migración sea posible

### 4.b. Esta feature es un puente hacia eventos futuros, no su implementación
La dirección esperable a futuro es que el runtime pueda declarar interacciones de forma más general, por ejemplo bajo un modelo de eventos como `onClick` reutilizable por `button`, `link` u otros nodos.

Esta feature no resuelve eso. Solo fija:
- un trigger inicial `button`
- una única acción soportada por trigger
- una familia de acciones limitada a navegación interna

Razonamiento:
- permite entregar valor funcional ahora sin abrir una feature transversal prematura
- evita que la implementación actual se interprete como contrato definitivo del futuro sistema de eventos

### 5. Las navegaciones disparadas por botón no introducen una vía alternativa para `preloads`
Ni `ButtonNode` ni el ejecutor de acciones deben lanzar `preloads` manualmente. Toda navegación efectiva, venga de `navigateTo` o de `goBack`, debe seguir entrando por el mismo cambio de `navigation.currentPageId` que ya observa `RuntimeStateProvider`.

Consecuencias:
- llegar a una página por botón reutiliza la misma semántica de entrada que `initialPage`
- volver atrás a una página ya visitada vuelve a disparar sus `preloads`
- navegar a la misma página visible no relanza `preloads` porque no cambia `currentPageId`

Razonamiento:
- evita duplicar orquestación de entrada entre la feature `0010` y esta feature
- mantiene una única fuente de verdad para la reentrada de página

### 6. El error recuperable `page-not-found` se conserva solo para navegaciones imperativas o estados imposibles, no para configs inválidos
Después de esta feature coexistirán dos niveles distintos:
- config inválido: un `button.navigateTo` a una página inexistente se rechaza en bootstrap
- interacción imperativa/defensiva: `navigateToPage(pageId)` sigue manteniendo el error recuperable `page-not-found` por compatibilidad con la API pública del provider y con tests existentes

Razonamiento:
- evita romper la semántica ya fijada del provider
- separa claramente error de contrato y error recuperable de ejecución

## Riesgos y trade-offs
- Riesgo: acoplar la forma de la acción al botón y cerrar mal la evolución futura.
  Mitigación: mantener `action` como dato explícito y ejecutar desde un módulo reutilizable fuera del componente.

- Riesgo: validar la existencia de `pageId` demasiado tarde y convertir config inválido en bug interactivo.
  Mitigación: resolver destinos contra el catálogo completo de `pages` durante la validación.

- Riesgo: implementar `goBack` como simple navegación al penúltimo valor sin podar historial y romper `A -> B -> A -> goBack`.
  Mitigación: fijar contractualmente que `goBack` elimina la entrada actual del stack.

- Riesgo: disparar `preloads` desde el botón y desde el provider a la vez.
  Mitigación: mantener toda la reentrada en el efecto ya existente que observa `navigation.currentPageId`.

- Riesgo: crecer demasiado la feature añadiendo deshabilitado, visibilidad condicional o referencias `navigation.*`.
  Mitigación: dejar esas capacidades fuera de alcance y no exponer todavía selectors declarativos nuevos en el contrato JSON.

## Migración o despliegue
No hay migración persistida ni despliegue especial.

Compatibilidad:
- una configuración existente sin nodos `button` mantiene el comportamiento actual
- `navigateToPage()` y el historial interno siguen existiendo como base compartida del runtime
- el nuevo nodo solo añade capacidad; no cambia el contrato observable de `container`, `heading`, `paragraph`, `list`, `api` o `preloads`

## Preguntas abiertas
- No quedan preguntas abiertas que bloqueen la implementación dentro del alcance actual.
- La evolución a un sistema más general de acciones y triggers queda intencionadamente pospuesta a una feature posterior.
