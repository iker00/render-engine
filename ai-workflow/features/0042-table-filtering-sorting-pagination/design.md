# Design: Table filtering, sorting and pagination

## Contexto
El nodo `table` ya renderiza tablas de lectura con cabeceras ordenadas y filas manuales o dinamicas. Las filas dinamicas se resuelven desde colecciones compatibles con `queries.*` o `item.*`, y cada celda string reutiliza la semantica visible compartida de referencias completas e interpolacion parcial.

El runtime ya dispone de paginacion local en `repeater` con variantes `previousNext`, `numbered` y `scroll`. Esa paginacion opera sobre datos ya cargados, mantiene estado local del consumidor y no dispara red. Esta feature lleva ese modelo a `table` y anade filtros y ordenacion locales, dejando separada la evolucion futura a procesamiento remoto.

## Objetivos / No objetivos

### Objetivos
- Anadir filtros locales por columna sobre valores visibles de celda.
- Anadir ordenacion local por una unica columna activa.
- Reutilizar en `table` las variantes locales de paginacion ya establecidas para `repeater`.
- Mantener estado local independiente por instancia de tabla.
- Definir un orden de procesamiento local estable: filas, filtros, ordenacion, paginacion.
- Evitar que los campos locales puedan confundirse con un contrato remoto futuro.

### No objetivos
- Definir modo remoto de filtrado, ordenacion o paginacion.
- Definir metadatos de servidor, cursores, totales remotos o parametros de request.
- Anadir filtros avanzados por tipo o comparadores configurables.
- Anadir ordenacion multiple o comparadores personalizados.
- Cambiar el contrato de `repeater`.
- Convertir `table` en una superficie de acciones, seleccion o edicion por fila.

## Decisiones

### 0. Contrato JSON local de tabla
La superficie nueva de `table` debe quedar cerrada y separada de cualquier modalidad remota futura.

Shape planificado:

```json
{
  "type": "table",
  "props": {
    "headers": ["Nombre", "Rol"],
    "columns": [
      { "id": "Nombre", "filterable": true, "filterPlaceholder": "Buscar por nombre", "sortable": true }
    ],
    "rows": {
      "source": "queries.users.data.items",
      "cells": ["{{item.name}}", "{{item.role}}"]
    },
    "pagination": {
      "enabled": true,
      "pageSize": 10,
      "controls": {
        "variant": "numbered"
      }
    }
  }
}
```

Reglas:
- `props.columns` es opcional para compatibilidad; si se omite, la tabla no expone filtros ni ordenacion y conserva el comportamiento actual.
- Cuando existe, `props.columns` es una coleccion parcial de columnas configuradas. No debe tener la misma longitud que `props.headers` salvo que todas las columnas visibles tengan comportamiento opt-in.
- Cada columna declara un `id` no vacio y unico dentro de la tabla. El `id` debe coincidir exactamente con una entrada de `props.headers`.
- Si `props.columns` existe y un `columns[].id` coincide con mas de una cabecera visible, la configuracion debe rechazarse como ambigua. Las tablas sin `props.columns` conservan la compatibilidad actual aunque repitan texto de cabecera.
- Cada entrada de `props.columns` debe activar al menos una capacidad local con `filterable: true` o `sortable: true`; una entrada con solo `id` no representa comportamiento especial y debe rechazarse.
- Las cabeceras que no aparezcan en `props.columns` siguen renderizandose como columnas normales, sin filtro ni ordenacion.
- El runtime debe construir internamente un indice `header -> column config` para renderizar controles y para mapear filtros/ordenacion al indice de celda correcto. No debe asumir `columns[columnIndex]`.
- `filterable: true` activa un filtro local de texto libre para esa columna. La ausencia de `filterable` equivale a no filtrable.
- `filterPlaceholder` es opcional, debe ser un string no vacio y solo es valido cuando la misma columna declara `filterable: true`.
- Si `filterPlaceholder` se omite, el placeholder visible del control de filtro debe ser el texto de `headers` correspondiente.
- `sortable: true` activa ordenacion local interactiva para esa columna. La ausencia de `sortable` equivale a no ordenable.
- No se admiten otros valores para `filterable` o `sortable`; no existe `false` como contrato necesario porque la ausencia expresa la desactivacion.
- `props.pagination`, si existe, reutiliza exactamente el shape local ya validado para `repeater`: `{ enabled: true, pageSize, controls?: { variant?: 'previousNext' | 'numbered' | 'scroll' } }`.
- La ausencia de `props.pagination` es el unico modo de no paginar. `enabled: false` o paginacion sin `pageSize` son invalidos.
- `controls` o `controls.variant` omitidos equivalen a `previousNext`.
- Campos con apariencia remota como `mode`, `remote`, `query`, `params`, `request`, `sort`, `order`, `filters`, `total`, `cursor`, `limit`, `offset`, `page` o `hasNext` deben rechazarse dentro de `columns`, `pagination` o `pagination.controls`.

Motivo:
- mantiene `headers` como texto visible literal ya existente
- evita romper configuraciones actuales
- permite declarar solo las columnas que realmente tienen filtro u ordenacion
- usa el texto de `headers` como identificador declarativo de v1 para evitar duplicar metadata completa cuando no aporta comportamiento
- permite anadir en el futuro un modo remoto explicito sin reinterpretar campos locales

### 1. La primera version es local y opt-in
Filtros, ordenacion y paginacion de tabla se interpretan como transformaciones locales sobre las filas ya resueltas por la tabla.

Reglas:
- no se ejecuta red al cambiar un filtro, una ordenacion o una pagina
- no se modifica `queries.*`, `pageEntry`, formularios ni navegacion
- una tabla sin estas capacidades conserva su render actual
- cualquier campo que parezca describir cursores, totales o parametros remotos debe rechazarse dentro de esta superficie local

Motivo:
- encaja con el alcance actual del runtime
- permite tests deterministas
- evita fijar prematuramente un contrato de backend

### 2. Las columnas pasan a ser la unidad funcional de filtros y ordenacion
La configuracion debe poder asociar capacidades a columnas concretas mediante una lista parcial por `id`, preservando la correspondencia vigente entre cabeceras y celdas.

Reglas esperadas:
- `columns[].id` resuelve contra `headers` y determina el indice de celda afectado
- una columna filtrable expone un control de texto para esa columna
- los controles filtrables se renderizan en una barra superior a la tabla, alineada a la izquierda y fuera de `thead`
- el orden visible de la barra de filtros sigue el orden de las columnas en la tabla, no necesariamente el orden en que fueron declaradas dentro de `props.columns`
- cada filtro tiene label accesible `Filtrar {header}` y el placeholder se trata solo como ayuda visible
- cuando existe al menos un filtro activo, la barra muestra `Reiniciar filtros`; al activarlo se vacian todos los filtros de esa tabla y se reinicia la paginacion local
- una columna ordenable expone una interaccion de ordenacion para esa columna
- las columnas no marcadas como ordenables no ofrecen ordenacion
- las columnas no declaradas no necesitan entradas placeholder en `columns`
- los filtros activos se combinan con semantica `AND`

Motivo:
- evita un buscador global ambiguo
- mantiene la tabla como lectura tabular simple
- facilita validar que las capacidades declaradas existen para columnas reales sin obligar a describir columnas pasivas

### 3. Filtro local de texto libre
El filtro v1 es texto libre por columna, con coincidencia parcial no sensible a mayusculas, minusculas ni tildes.

Reglas:
- el filtro compara contra el valor visible final de la celda
- un filtro vacio no excluye filas
- si hay varios filtros activos, una fila debe cumplirlos todos
- una celda vacia solo coincide con filtro vacio
- la normalizacion de comparacion debe ser compartida por los helpers testeables, no una transformacion ad hoc dentro del componente React
- los filtros activos se detectan ignorando espacios en blanco para no mostrar `Reiniciar filtros` por valores vacios efectivos

Motivo:
- cubre el caso comun sin abrir operadores, rangos ni tipos avanzados
- reutiliza la normalizacion visible ya existente en `table`
- deja espacio para filtros remotos o tipados futuros como contratos separados

### 4. Ordenacion local simple
La ordenacion v1 usa una unica columna activa y cicla entre ascendente, descendente y sin ordenacion.

Reglas:
- solo una columna puede estar ordenada a la vez
- activar otra columna sustituye la ordenacion anterior
- activar por tercera vez la misma columna limpia la ordenacion activa y restaura el orden resuelto original
- la comparacion usa el valor visible final de la celda
- los valores vacios o no renderizables se tratan de forma estable y no rompen el render
- sin ordenacion activa, se conserva el orden resuelto original
- la cabecera activa expone `aria-sort="ascending"` o `aria-sort="descending"`; las cabeceras ordenables inactivas usan `aria-sort="none"` y las no ordenables no declaran `aria-sort`

Motivo:
- mantiene el comportamiento comprensible para usuarios finales y permite volver al orden original sin un control adicional
- evita definir prioridad de varias columnas
- conserva un contrato pequeno para backend

### 5. Orden de procesamiento local
La tabla debe procesar localmente siempre en este orden:

1. Resolver filas manuales o dinamicas.
2. Materializar valores visibles de celda.
3. Aplicar filtros activos.
4. Aplicar ordenacion activa.
5. Aplicar paginacion local.

Reglas:
- la paginacion cuenta las filas ya filtradas y ordenadas
- cambiar filtros u ordenacion reinicia la paginacion a una posicion inicial valida
- un refetch o cambio de fuente debe normalizar la pagina activa si queda fuera de rango

Motivo:
- coincide con la expectativa habitual de tablas
- evita que una fila filtrada aparezca en otra pagina inesperada
- hace que los criterios de aceptacion sean verificables

### 6. Paginacion de tabla reutiliza el modelo local de `repeater`
`table` debe usar el mismo vocabulario funcional que `repeater` para paginacion local.

Reglas:
- `pageSize` mantiene el significado de tamano de pagina o bloque visible
- `previousNext` es el default efectivo cuando no se declara variante
- `numbered` usa primera, anterior, ventana compacta de paginas, siguiente y ultima
- `scroll` muestra inicialmente hasta `pageSize` filas y aumenta la ventana visible por bloques locales
- si `IntersectionObserver` no esta disponible, `scroll` debe degradar a una accion local equivalente

Motivo:
- evita dos modelos de paginacion local incompatibles
- permite reutilizar reglas ya documentadas y testeadas
- cumple la expectativa de que la paginacion de tabla sea igual que en `repeater`

### 7. Estado local por instancia de tabla
Filtros activos, ordenacion activa y posicion de paginacion pertenecen a la instancia de tabla.

Reglas:
- dos tablas no comparten estado aunque usen la misma query
- desmontar y remontar una tabla puede reconstruir el estado local inicial
- cambios de datos o configuracion efectiva no deben dejar paginas fuera de rango

Motivo:
- respeta el aislamiento vigente de consumidores del runtime
- evita efectos laterales entre tablas de una misma pantalla

### 8. Frontera futura para modo remoto
La feature debe dejar claro que el procesamiento remoto sera una modalidad distinta.

Reglas:
- el modo local no acepta cursores, totales remotos ni parametros de request
- la futura modalidad remota debera declarar de forma explicita su fuente de verdad
- no se debe reutilizar silenciosamente `controls.variant`, filtros locales u ordenacion local para disparar red

Motivo:
- protege la compatibilidad de configuraciones locales
- evita una semantica mixta dificil de validar
- permite disenar mas adelante el contrato remoto con backend real

## Riesgos y trade-offs
- Filtrar y ordenar por valor visible simplifica la v1, pero puede no coincidir con necesidades futuras de tipos enriquecidos. La extension tipada queda fuera de esta feature.
- Los filtros por columna ocupan espacio visual. La decision cerrada es renderizarlos en una barra superior compacta, alineada a la izquierda, con wrap natural en pantallas estrechas y sin abrir personalizacion visual libre.
- `scroll` puede confundirse con carga remota. La documentacion y la validacion deben mantenerlo como incremento local sobre filas ya disponibles.
- El contrato remoto futuro necesitara decisiones de request y respuesta que no deben anticiparse con campos ambiguos en esta entrega.

## Migracion o despliegue
No requiere migracion de configuraciones existentes. Las tablas actuales que no declaren filtros, ordenacion ni paginacion deben conservar el mismo comportamiento.

## Preguntas abiertas
No quedan preguntas abiertas bloqueantes para pasar a planificacion. El contrato remoto futuro queda deliberadamente fuera de esta feature.
