# 0096 — Improved validation error messages

## Objetivo

Hacer que los mensajes de error de validación de configuración sean accionables sin necesidad de contar índices
manualmente en el JSON. Actualmente, un error como:

```
Page "form-fields" has an invalid layout at "layout[3].children[30].children[2].props.validations.required".
```

obliga al usuario a navegar el JSON contando posiciones. La mejora añade dos líneas de contexto adicionales bajo el
mensaje existente: un breadcrumb legible con tipos e identificadores de los nodos ancestros, y un extracto del nodo
problemático.

## Alcance

- Enriquecer los mensajes de error `invalid-layout` con dos líneas adicionales:
    1. **Breadcrumb legible**: cadena de nodos desde la raíz del layout hasta el nodo problemático, mostrando `type` +
       identificador cuando existe, o `type[índice]` cuando no.
    2. **Extracto del nodo**: objeto reducido del nodo que causa el error, mostrando `type` y las props más relevantes
       para su identificación (sin volcar el nodo completo).
- El mensaje de error original (path posicional) se mantiene intacto como primera línea.
- El enriquecimiento aplica a todos los errores generados por `invalidLayout()` en los módulos de validación del layout
  tree: `validate-layout-nodes`, `validate-form-nodes`, `validate-file-manager-nodes`, `validate-file-input-nodes`,
  `validate-actions-visibility` y `validate-preloads`.
- El enriquecimiento aplica también a los errores generados en `validate-runtime-config` que validan el layout tree.

## Fuera de alcance

- Cambios en la lógica de validación (qué se valida, qué se rechaza).
- Cambios en los errores que no son `invalid-layout` (como `unsupported-node-type`, `invalid-json`, `missing-config`,
  errores de `api`, `tokens`).
- Resaltado visual del nodo con error en el editor del dev-runtime.
- Navegación interactiva al nodo problemático desde el mensaje de error.
- Cambios en el comportamiento de producción (los errores `development-only` siguen sin mostrarse en producción).

## Requisitos funcionales

### Breadcrumb legible

- Construir una representación legible del camino desde la raíz del layout hasta el nodo que produce el error.
- Cada segmento del breadcrumb debe mostrar:
    - El `type` del nodo siempre.
    - El identificador más relevante según el tipo:
        - `id` para nodos que lo declaran (`form`, `modal`, y cualquier otro nodo con `id`).
        - `props.fieldId` para nodos de campo de formulario (`input`, `textarea`, `select`, `radioGroup`,
          `checkboxGroup`, `toggle`, `fileInput`).
        - `props.label` para nodos interactivos sin `fieldId` (`button`, `accordion`, `badge`, `link`).
        - `props.text` para nodos textuales (`heading`, `paragraph`).
        - `props.operationName` para `fileManager`.
        - Sin identificador adicional para nodos estructurales sin campo identificador (`container`, `divider`,
          `repeater`).
    - Cuando un nodo no tiene identificador, usar el índice posicional dentro de su padre: `container[3]`.
    - Cuando un nodo tiene identificador, mostrarlo entre paréntesis: `input(fieldId: "name")`, `form("user")`,
      `heading("Datos personales")`.
- Los segmentos se separan por ` > `.
- El breadcrumb se muestra como segunda línea del mensaje, prefijado por `  → ` (dos espacios + flecha + espacio).

### Extracto del nodo

- Mostrar un objeto JSON reducido del nodo que causa el error, incluyendo:
    - `type` siempre.
    - Las props de identificación del nodo según la heurística del breadcrumb (`id`, `fieldId`, `label`, `text`).
    - No incluir `children`, `visibility`, `queryStateFeedback`, `layout` ni el contenido completo de `props`.
- El extracto se muestra como tercera línea del mensaje, prefijado por `  Node: ` (dos espacios + "Node:" + espacio).
- El JSON del extracto se serializa en una sola línea.

### Formato resultante

```
Page "form-fields" has an invalid layout at "layout[3].children[30].children[2].props.validations.required".
  → container[3] > container[30] > input(fieldId: "name")
  Node: { "type": "input", "props": { "fieldId": "name", "label": "Nombre" } }
```

### Construcción del breadcrumb

- El breadcrumb se construye incrementalmente durante la validación recursiva del layout tree, junto con el path
  posicional ya existente.
- Cada nivel de recursión en la validación aporta un segmento al breadcrumb basándose en el nodo crudo disponible en ese
  punto.
- El breadcrumb se pasa como contexto adicional a las funciones que generan errores `invalidLayout()`.

## Requisitos no funcionales

- No debe cambiar la estructura del tipo `RuntimeConfigError` de forma incompatible; el campo `message` sigue siendo un
  string.
- El enriquecimiento no debe afectar al rendimiento de validación de forma perceptible (la validación se ejecuta una vez
  al arranque).
- Los tests existentes de validación que comprueban mensajes de error exactos deberán adaptarse para incluir las líneas
  adicionales.

## Criterios de aceptación

- Un error `invalid-layout` en un nodo hoja con `fieldId` muestra breadcrumb con `type(fieldId: "x")` y extracto con
  `type` + `fieldId` + `label`.
- Un error `invalid-layout` en un nodo con `id` (como `form` o `modal`) muestra breadcrumb con `type("id")` y extracto
  con `type` + `id`.
- Un error `invalid-layout` en un nodo sin identificador (como `container`) muestra breadcrumb con `type[índice]`.
- El breadcrumb refleja correctamente toda la cadena de ancestros desde la raíz del layout.
- El extracto muestra solo props de identificación, no el nodo completo.
- Los errores que no son `invalid-layout` no se modifican.
- El mensaje original con el path posicional se conserva como primera línea.
- Los tests de validación existentes pasan (adaptados al nuevo formato).

## Casos límite

- Nodo raíz del layout (sin ancestros): el breadcrumb tiene un solo segmento.
- Nodos dentro de `tabs.props.items[N].children`: el breadcrumb debe incluir el tab como ancestro con su `label` si está
  disponible.
- Nodos dentro de `repeater.props.template`: el breadcrumb debe incluir el repeater como ancestro.
- Nodos dentro de `modal.children`: el breadcrumb debe incluir el modal con su `id`.
- Props de identificación con caracteres especiales o strings largos: truncar el valor en el breadcrumb si excede una
  longitud razonable (por ejemplo, 30 caracteres) con `...`.
- Nodo con `props.text` muy largo (heading/paragraph): truncar en el breadcrumb.
- Nodo cuyo `type` no está en la heurística de identificación: mostrar solo `type[índice]`.

## Riesgos o preguntas abiertas

Ninguno. El cambio es de formato de mensaje sin impacto en lógica de validación ni en el contrato público.
