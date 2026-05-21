# Design: Feature 0035 - image-node-api-source

## Contexto
El runtime ya soporta `image` como nodo hoja con `src` y `alt` literales o resueltos desde referencias runtime completas. La ejecución remota declarativa vive en `src/queries/`, pero su proyección visible estable sigue keyed hoy por `queries.{operationName}`.

Ese modelo funciona para `preloads`, botones y submits porque cada trigger ya asume una query compartida por nombre de operación. Para esta feature no basta: la spec exige que varias imágenes visibles puedan reutilizar la misma operación base con parámetros distintos sin pisarse entre sí, y además que una imagen con carga propia pueda convivir con `queryStateFeedback` incluso cuando ese feedback observe la misma carga remota que la propia imagen dispara.

También hay una restricción de producto importante: la nueva gramática debe seguir siendo pequeña y familiar para backend, reutilizando `operationName`, `query`, `body` y `headers`, y evitando abrir un mini lenguaje nuevo de transformación.

## Objetivos / No objetivos

### Objetivos
- Añadir un modo remoto declarativo al nodo `image` sin romper su modo local actual.
- Separar la identidad de la query visible de la operación `api` base para evitar colisiones entre imágenes simultáneas.
- Mantener el resultado remoto dentro del dominio compartido `queries`, no en un subsistema paralelo exclusivo para imágenes.
- Permitir que la imagen extraiga `src` y `alt` desde rutas explícitas de la respuesta remota.
- Disparar la carga automática cuando la imagen entre en condición efectiva de activación dentro de la entrada actual.
- Evitar el deadlock entre auto-carga y `queryStateFeedback` cuando ambos usan la misma query declarada por la imagen.

### No objetivos
- Generalizar todavía esta capacidad a otros nodos distintos de `image`.
- Introducir polling, refetch configurable, caché histórica por firma, cancelación explícita o reintentos automáticos.
- Añadir deduplicación global de red entre queries distintas que coincidan en la misma request efectiva.
- Sustituir `pages[].preloads` como mecanismo preferente cuando varios nodos necesitan compartir la misma respuesta.

## Decisiones

### 1. El nodo `image` tendrá dos modos contractuales mutuamente excluyentes
- Modo local actual:
  - `props.src: string`
  - `props.alt: string`
- Modo remoto nuevo:
  - `props.loadFromApi`
  - `props.alt` podrá mantenerse como literal fijo opcional

El bloque remoto se fija así:

```ts
props: {
  alt?: string
  loadFromApi: {
    queryName: string
    operationName: string
    query?: RuntimeApiQuery
    body?: RuntimeApiBodyValue
    headers?: RuntimeApiHeaders
    response: {
      srcPath: string
      altPath?: string
    }
  }
}
```

Reglas cerradas por diseño:
- `props.src` y `props.loadFromApi` no pueden coexistir.
- `loadFromApi.queryName`, `loadFromApi.operationName` y `loadFromApi.response.srcPath` son obligatorios.
- `props.alt` literal y `loadFromApi.response.altPath` son mutuamente excluyentes para no abrir dos fuentes concurrentes de `alt`.
- En modo remoto, si no hay `props.alt` ni `altPath`, el render degrada a `alt=""`.
- `srcPath` y `altPath` son rutas relativas al `data` bruto de la query remota, no referencias runtime completas ni expresiones.

### 2. La identidad visible de query se separa de `operationName`
La capa de ejecución remota debe aceptar un `queryName` destino distinto de `operationName`.

Consecuencias:
- `operationName` sigue identificando la operación base declarada en `config.api`.
- `queryName` pasa a identificar la entrada visible dentro de `queries.{queryName}`.
- Botones, formularios y `preloads` conservan el comportamiento histórico usando `queryName = operationName` por defecto.
- Las imágenes remotas deben declarar `queryName` explícito para evitar colisiones entre instancias visibles que reutilicen la misma operación base.

Esta separación permite reutilizar el dominio compartido `queries` sin reescribir toda la arquitectura hacia un subsistema específico de imágenes.

### 3. La auto-carga de imágenes será entry-aware y no dependerá solo del estado global actual de la query
La semántica requerida es “primera activación visible dentro de la entrada actual”, no “primera vez histórica que existe la misma firma”.

Por eso, la implementación debe decidir la auto-carga con dos señales:
- la `requestSignature` efectiva de la imagen
- la `entryId` activa del runtime

El bloqueo de relanzamientos redundantes dentro de la misma entrada no debe apoyarse solo en `queries.{queryName}.requestSignature`, porque eso impediría relanzar la misma request al volver a entrar en otra `pageEntry` con la misma firma.

La política queda cerrada así:
- dentro de una misma `pageEntry`, una imagen remota no vuelve a disparar la misma request efectiva si ya la activó antes
- al cambiar de `pageEntry`, la imagen puede volver a activarse aunque la firma coincida con una entrada anterior
- esta memoria de activación es transitoria de runtime y no se documenta como caché histórica del producto

### 4. `queryStateFeedback` no puede bloquear la activación cuando observa la misma query remota propia
Hoy `layout-node-renderer.tsx` resuelve `queryStateFeedback` antes de montar el nodo. Con una imagen remota que observa su propia `queryName`, eso crea un deadlock: la query queda `idle`, el feedback oculta el nodo y la carga nunca se dispara.

La regla de diseño queda fijada así:
- la activación remota de `image` se decide con `visibility` y con `queryStateFeedback` solo cuando ese feedback observa otra query distinta
- si `queryStateFeedback.query === loadFromApi.queryName`, la imagen puede disparar su carga aunque el resultado visible del nodo en ese instante sea `hide` o `fallback`
- el feedback visible sigue controlando el output final renderizado, pero no bloquea el controlador de carga de la propia imagen

Esto preserva el caso de uso de `idle/loading/error/empty` sobre la misma carga remota sin obligar a usar un preload separado.

### 5. La respuesta remota se guarda bruta en `queries.{queryName}.data` y la imagen proyecta en render
La feature no introduce un dato transformado aparte para imágenes.

La ejecución remota sigue escribiendo:
- `status`
- `data`
- `error`
- `requestSignature`

La imagen resolverá `srcPath` y `altPath` contra `queries.{queryName}.data` en el momento de render, reutilizando una navegación segura compartida por objetos y arrays. Así:
- la misma respuesta queda disponible para `queryStateFeedback` y para cualquier consumidor futuro de `queries.{queryName}.data`
- no se abre una fase nueva de “mapping” persistido en store
- `src` no utilizable degrada a no render
- `alt` no utilizable degrada a `props.alt` literal o `''`

### 6. La validación cruzada debe cerrar la ambigüedad del modo remoto antes del render
Además del shape `Zod`, la validación semántica debe rechazar:
- `image` sin `src` ni `loadFromApi`
- `image` con `src` y `loadFromApi` a la vez
- `loadFromApi` sin `queryName`
- `loadFromApi` sin `operationName`
- `loadFromApi` sin `response.srcPath`
- `props.alt` junto con `loadFromApi.response.altPath`
- reutilización de un mismo `loadFromApi.queryName` entre dos imágenes remotas del mismo config

La unicidad de `queryName` entre imágenes remotas es una decisión deliberada para impedir colisiones silenciosas y mantener el comportamiento funcional estable entre agentes.

## Riesgos y trade-offs
- Añadir `queryName` hace el contrato algo más verboso, pero evita una arquitectura implícita e inestable basada en colisiones por `operationName`.
- La activación entry-aware introduce coordinación adicional fuera del store visible. Es preferible a contaminar `queries` con semántica histórica que hoy no existe para otros triggers.
- Mantener la respuesta bruta en `queries.{queryName}.data` evita duplicación de estado, pero obliga a fijar bien la navegación por rutas relativas y su degradación segura.
- La deduplicación de red entre dos imágenes distintas con igual request efectiva se deja fuera de alcance. Se prioriza corrección funcional sobre optimización prematura.

## Migración o despliegue
No aplica migración de datos. La compatibilidad hacia atrás depende de que el modo local actual de `image` permanezca intacto y siga validando/renderizando igual.

## Preguntas abiertas
- Queda una pregunta bloqueante antes de implementar: cómo se obtiene una identidad visible y estable de query por instancia renderizada cuando una misma `image` remota vive dentro de `repeater` o se monta, desmonta y remonta varias veces en la misma `pageEntry`.
- Con el diseño actual, `loadFromApi.queryName` identifica solo el nodo declarativo. Eso no basta para cumplir la spec cuando una única definición de `image` genera varias instancias simultáneas con `item.*` distintos, porque todas escribirían en el mismo `queries.{queryName}`.
- Tampoco está cerrada todavía la relación entre esa identidad por instancia y:
  - `queryStateFeedback` sobre la propia imagen cuando observa su misma carga remota
  - posibles referencias `queries.*` desde otros nodos del mismo subárbol iterado
  - la memoria de activación "una vez por `pageEntry` y request efectiva" cuando la imagen se desmonta y remonta
- La implementación no debería arrancar hasta fijar si el contrato necesita una identidad visible derivada por instancia, una restricción explícita de alcance sobre consumidores dentro de `repeater` o una semántica alternativa verificable que preserve los criterios de aceptación ya escritos en la spec.

## Estado
Feature archivada por ahora.

Motivo del archivado:
- el enfoque propuesto añade complejidad relevante al runtime para resolver un problema que encaja mejor como URL de imagen protegida o firmada desde backend
- la necesidad real es servir imágenes privadas con control de acceso, no convertir `image` en un cliente remoto específico con estado propio
