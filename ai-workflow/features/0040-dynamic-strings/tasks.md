# Tasks: Dynamic strings

## Orden de ejecucion
Implementar en orden estricto: T01 -> T02 -> T03 -> T04 -> T05 -> T06. T01 fija la semantica central de interpolacion visible; T02 y T04 conectan consumidores concretos; T03 abre el contrato de proyecciones sin relajar superficies fuera de alcance; T05 cierra regresiones negativas; T06 queda para la pasada documental posterior.

Todas las tareas del alcance acordado están completadas.

## T01 - Crear resolucion central de strings interpolados visibles

### ID
T01

### Estado
Completada.

### Objetivo
Anadir en `runtime-references` una utilidad central para resolver strings visibles con placeholders `{{...}}`, reutilizando `resolveRuntimeReference` para cada referencia interna y activandola solo en la ruta visible comun que ya consumen `heading`, `paragraph`, `image` y `table`.

La semantica efectiva debe ser:
- Los strings sin placeholder conservan el comportamiento actual de literal, referencia completa o referencia escapada.
- Cada placeholder bien formado `{{ referencia }}` se sustituye por `string`, `number` o `boolean` convertido a texto.
- Referencias ausentes, invalidas, no soportadas, `null`, `undefined`, objetos y arrays producen string vacio solo para ese placeholder.
- `0` y `false` se conservan como `0` y `false`.
- `item.*` solo resuelve cuando existe `iterationContext`.
- Delimitadores no emparejados o texto que no forma un placeholder completo no rompen el render y se mantienen como salida estable.

### Fuera de alcance
- No conectar aun `button.props.label` ni labels de campos.
- No cambiar proyecciones de `list`, `select`, `radioGroup` ni `checkboxGroup`.
- No aplicar interpolacion a requests, `navigateTo.params`, `defaultValue`, `visibility`, `queryStateFeedback`, fuentes de coleccion ni keys de `repeater`.
- No anadir expresiones, filtros, formateadores, pipes, condicionales ni escape nuevo para `{{` o `}}`.

### Dependencias
Ninguna. Es la primera tarea y bloquea el resto.

### Impacto esperado en archivos
- Codigo a crear o modificar:
  - `src/runtime/runtime-references/runtime-reference-resolver.ts`
  - `src/runtime/runtime-references/runtime-reference-parser.ts` solo si hace falta exponer helpers de deteccion/parsing.
  - `src/runtime/runtime-references/runtime-reference-types.ts` solo si hace falta tipar un resultado nuevo.
  - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` solo si hace falta mantener diagnosticos por placeholder.
- Tests a crear o modificar:
  - `src/tests/runtime-reference-resolution.test.tsx`
  - `src/tests/layout-renderer.test.tsx` para una cobertura de integracion minima de `heading`, `image` y `table`.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Unit tests para un string con un placeholder, varios placeholders, placeholders consecutivos, placeholder al inicio y al final.
- Unit tests para placeholders con espacios alrededor de la referencia.
- Unit tests para `0`, `false`, string vacio, objeto, array, `null`, `undefined`, ruta ausente, referencia invalida, referencia no soportada y placeholder vacio.
- Unit tests para `params.userId` valido y `params.user.id` fuera de contrato.
- Unit tests para `item.id` con y sin `iterationContext`.
- Unit tests para contenido dentro de placeholder que fuera de `{{...}}` seria literal, por ejemplo `{{foo.bar}}` o `{{texto}}`, confirmando que dentro del placeholder produce string vacio y no el literal interno.
- Tests de regresion para strings sin `{{...}}`, referencias completas existentes y referencias completas escapadas con `\`.
- Integration tests minimos que confirmen interpolacion en `heading.props.text`, `image.props.src`, `image.props.alt`, celdas string manuales de `table` y `table.props.rows.cells` dinamicas con `item.*`.

### Documentacion afectada
Actualizada en T06. Esta tarea introduce el comportamiento central documentado como nueva capacidad visible y como eliminacion del limite "no hay interpolacion parcial dentro de strings".

### Criterios de finalizacion
- La logica de parsing y sustitucion vive en `runtime-references` y no en nodos visuales.
- `resolveRuntimeVisibleValue`, `resolveRuntimeTextReference`, `resolveRuntimeImageSource` y `resolveRuntimeImageAlt` conservan sus contratos externos y aplican interpolacion solo cuando el string contiene placeholders completos.
- El comportamiento historico de referencias completas no cambia para strings sin delimitadores.
- `heading`, `paragraph`, `image` y `table` quedan cubiertos por la ruta visible comun sin parsers locales.
- Los tests enfocados pasan y no hay cambios en requests, navegacion, defaults ni colecciones.

### Cierre de implementacion
La tarea queda cerrada cuando pasan:
```bash
pnpm exec vitest run src/tests/runtime-reference-resolution.test.tsx src/tests/layout-renderer.test.tsx
```
y no hay cambios fuera de `runtime-references` y los consumidores visibles ya cubiertos por esa ruta comun.

### Cierre documental
Cerrado en T06 mediante la pasada `update-app-documentation`.

## T02 - Conectar interpolacion en botones y labels de formulario

### ID
T02

### Estado
Completada.

### Objetivo
Aplicar la resolucion central de T01 a superficies visibles directas que no pasan hoy por `resolveRuntimeVisibleValue`: `button.props.label`, `input.props.label`, `textarea.props.label`, `select.props.label`, `radioGroup.props.label` y `checkboxGroup.props.label`.

Los labels resueltos deben usarse tambien en superficies accesibles derivadas del mismo texto, por ejemplo `aria-label` de `select`, para evitar divergencia entre texto visible y nombre accesible.

### Fuera de alcance
- No cambiar `defaultValue`, valores almacenados de formulario ni validaciones.
- No cambiar `submitAction`, acciones UI ni requests.
- No conectar todavia labels o values de opciones.
- No alterar la gramatica visual de campos, botones ni grupos.

### Dependencias
Depende de T01.

### Impacto esperado en archivos
- Codigo a crear o modificar:
  - `src/runtime/nodes/button-layout-node.tsx`
  - `src/runtime/nodes/input-layout-node.tsx`
  - `src/runtime/nodes/textarea-layout-node.tsx`
  - `src/runtime/nodes/select-layout-node.tsx`
  - `src/runtime/nodes/radio-group-layout-node.tsx`
  - `src/runtime/nodes/checkbox-group-layout-node.tsx`
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- `button.props.label` interpola `item.id` dentro de `repeater` y degrada a string vacio fuera de `repeater`.
- `input.props.label` interpola `forms.{formId}.{fieldId}` y se actualiza cuando cambia el campo observado.
- Al menos un label de campo bajo `repeater` interpola `item.*` usando el contexto de iteracion recibido por el nodo.
- `textarea`, `select`, `radioGroup` y `checkboxGroup` renderizan labels interpolados con la misma semantica de escalares y ausencias.
- El `aria-label` efectivo de `select` usa el label resuelto.
- Labels con referencias ausentes vacian solo el placeholder y no ocultan ni deshabilitan el control.
- Botones con action explicita y botones submit implicitos conservan su tipo, clase y handler.

### Documentacion afectada
Actualizada en T06 en la ficha de formularios y en el contrato de configuracion para enumerar las nuevas superficies visibles soportadas.

### Criterios de finalizacion
- Todos los nodos indicados consumen la misma utilidad central de T01.
- El texto visible y los atributos accesibles derivados usan el mismo resultado resuelto.
- La interaccion de campos y botones se mantiene igual salvo por el texto visible interpolado.
- No se introduce estado local nuevo ni duplicacion de resolucion de referencias en los nodos.

### Cierre de implementacion
La tarea queda cerrada cuando pasa:
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```
con cobertura de labels directos y sin modificar semantica de formularios o acciones.

### Cierre documental
Cerrado en T06 mediante la pasada `update-app-documentation`.

## T03 - Ajustar validacion de proyecciones con plantilla en colecciones

### ID
T03

### Estado
Completada.

### Objetivo
Actualizar la validacion previa al render para que las superficies de proyeccion de colecciones acepten strings con placeholders `{{...}}` en el catalogo cerrado de la spec:
- `list.props.items.itemText` en colecciones manuales o dinamicas de objetos.
- `select.props.items.label` y `select.props.items.value` en colecciones manuales o dinamicas de objetos.
- `radioGroup.props.items.label` y `radioGroup.props.items.value` en colecciones manuales o dinamicas de objetos.
- `checkboxGroup.props.items.label` y `checkboxGroup.props.items.value` en colecciones manuales o dinamicas de objetos.
- arrays historicos de opciones `{ label, value }` cuando `label` o `value` string incluyan delimitadores de plantilla, conservando la validacion vigente de homogeneidad de values.

Los strings de proyeccion sin delimitadores deben conservar la validacion historica de ruta relativa al item. La presencia de delimitadores de plantilla `{{` o `}}` en estas superficies cerradas no debe convertirse en validacion de existencia runtime ni rechazar placeholders no resolubles o mal emparejados: esos casos degradan en runtime segun T01.

### Fuera de alcance
- No relajar `repeater.props.items.key`.
- No relajar `list/select/radioGroup/checkboxGroup.props.items.source`.
- No admitir `params.*` como fuente dinamica de coleccion.
- No aplicar interpolacion ni validacion nueva en `api.query`, `api.body`, `api.headers`, `preloads`, `executeOperation`, `form.submitAction`, `navigateTo.params`, `visibility`, `queryStateFeedback` ni cabeceras de `table`.
- No cambiar shapes estructurales ni tipos publicos salvo que la implementacion necesite un helper tipado.

### Dependencias
Depende de T01 para reutilizar una deteccion central de strings con plantilla si se expone.

### Impacto esperado en archivos
- Codigo a crear o modificar:
  - `src/config/validate-runtime-config.ts`
  - `src/runtime/runtime-references/runtime-reference-parser.ts` solo si se decide exponer un helper de deteccion reusable.
  - `src/config/runtime-config-types.ts` solo si hace falta aclarar tipos de proyeccion, sin ampliar shapes.
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`

### Tests requeridos
- Config valida para `list.props.items.itemText: "{{item.code}} - {{item.title}}"` en colecciones manuales y dinamicas de objetos.
- Config valida para `select`, `radioGroup` y `checkboxGroup` con `label: "{{item.code}} - {{item.name}}"` y `value: "{{item.type}}:{{item.id}}"`.
- Config valida para arrays historicos de opciones con `label` interpolado y con `value` string interpolado, manteniendo invalida una mezcla de values literales `number` y `string` si la politica vigente ya la rechaza.
- Proyecciones del catalogo cerrado que contengan delimitadores no emparejados, como `"{{item.name"` o `"Nombre }}"`, no fallan en validacion y quedan para degradacion estable en runtime.
- Los mismos campos sin `{{...}}` siguen rechazando rutas invalidas como `profile..name` o `profile[id]`.
- `repeater.props.items.key` sigue rechazando strings globales o con plantilla.
- `props.items.source` sigue rechazando strings con plantilla y referencias fuera de `queries.*.data` o `item.*`.
- `visibility.reference`, `visibility.value`, `navigateTo.params` mal formados y request params conservan su validacion vigente.
- `table.props.headers` no se reinterpreta como superficie interpolable.

### Documentacion afectada
Actualizada en T06 en el contrato de configuracion para distinguir proyecciones interpolables de fuentes, keys y superficies no visibles.

### Criterios de finalizacion
- Solo las proyecciones enumeradas aceptan strings con plantilla.
- Las rutas de proyeccion heredadas sin plantilla mantienen la validacion estricta actual.
- La validacion no exige datos runtime ni evalua el contenido de queries, forms, params o item.
- Las superficies fuera de alcance siguen cerradas por tests de regresion.

### Cierre de implementacion
La tarea queda cerrada cuando pasa:
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```
y los diagnosticos existentes de rutas invalidas siguen apuntando a la propiedad concreta.

### Cierre documental
Cerrado en T06 mediante la pasada `update-app-documentation`.

## T04 - Resolver interpolacion en listas y opciones de seleccion

### ID
T04

### Estado
Completada.

### Objetivo
Aplicar la resolucion central de T01 a las superficies de render y proyeccion de colecciones:
- strings visibles de `list.props.items` cuando el shape declara texto directamente.
- `list.props.items.itemText` en colecciones manuales o dinamicas de objetos.
- labels y values efectivos de opciones en `select`, `radioGroup` y `checkboxGroup`, tanto en arrays historicos `{ label, value }` como en colecciones manuales o dinamicas de objetos.

En proyecciones por objeto, `item` e `item.*` deben apuntar al item local que se esta materializando. En labels, el resultado es texto visible. En values, el resultado es el string efectivo que entra en la normalizacion existente de seleccion simple o multiple.

### Fuera de alcance
- No cambiar fuentes de coleccion, busqueda remota, paginacion de opciones ni carga incremental.
- No cambiar validacion local de formularios.
- No crear estado paralelo para "valor de plantilla" y "valor normalizado".
- No deduplicar catalogos ni introducir una politica nueva de errores por opciones duplicadas.
- No cambiar `defaultValue`; si declara `{{...}}`, debe seguir siendo literal segun la frontera fuera de alcance.

### Dependencias
Depende de T01 y T03.

### Impacto esperado en archivos
- Codigo a crear o modificar:
  - `src/runtime/runtime-collection-sources.ts`
  - `src/runtime/nodes/list-layout-node.tsx` solo si hace falta pasar contexto o estado adicional de forma explicita.
  - `src/runtime/nodes/select-layout-node.tsx` solo si hace falta reutilizar labels resueltos en atributos.
  - `src/runtime/nodes/radio-group-layout-node.tsx` solo si hace falta ajustar props derivadas.
  - `src/runtime/nodes/checkbox-group-layout-node.tsx` solo si hace falta ajustar props derivadas.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si se extraen helpers compartidos nuevos.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- `list.props.items` como array de strings interpola referencias globales y `item.*` cuando vive bajo `repeater`.
- `list.props.items.itemText` renderiza `"{{item.code}} - {{item.title}}"` para cada objeto de una coleccion manual y dinamica.
- Un placeholder ausente en una lista vacia solo esa parte del texto y no elimina el item.
- `select` dinamico con `label: "{{item.code}} - {{item.name}}"` muestra labels compuestos.
- `select` dinamico con `value: "{{item.type}}:{{item.id}}"` almacena y envia el valor efectivo interpolado como string.
- Values interpolados desde `0` y `false` producen los strings efectivos `0` y `false`, no valor ausente.
- Arrays historicos de opciones conservan valores numericos literales y permiten labels o values string interpolados sin cambiar la normalizacion vigente.
- `radioGroup` y `checkboxGroup` comparten la misma semantica de labels y values interpolados que `select`.
- Una opcion con value interpolado a string vacio conserva la politica vigente de valor vacio sin romper el formulario.
- Dos opciones con el mismo value efectivo no rompen el render ni crean una politica nueva distinta a la normalizacion actual.
- Cambios en queries o formularios que afecten una opcion interpolada actualizan labels/values efectivos y limpian selecciones invalidas con la politica existente.

### Documentacion afectada
Actualizada en T06 en fichas de runtime, contrato, formularios y queries para explicar proyecciones por item y values efectivos de opciones.

### Criterios de finalizacion
- `runtime-collection-sources` centraliza la evaluacion de proyecciones interpoladas.
- Las proyecciones por objeto usan `iterationContext: { item }` local y no exponen `item.*` globalmente.
- Los shapes escalares de coleccion mantienen su comportamiento historico salvo strings visibles declarados directamente en `list`.
- La normalizacion de `select`, `radioGroup` y `checkboxGroup` opera sobre los values efectivos finales.
- La limpieza de selecciones invalidas reutiliza el flujo existente de formulario.

### Cierre de implementacion
La tarea queda cerrada cuando pasa:
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```
con cobertura de listas, selects, radio groups y checkbox groups, incluyendo actualizacion por cambios de estado.

### Cierre documental
Cerrado en T06 mediante la pasada `update-app-documentation`.

## T05 - Cerrar regresiones de superficies fuera de alcance

### ID
T05

### Estado
Completada.

### Objetivo
Anadir tests de frontera que demuestren que la interpolacion parcial no se aplica a superficies excluidas por la spec y que las referencias completas existentes conservan su semantica estricta en requests, navegacion, defaults, visibilidad y fuentes.

Esta tarea es principalmente de validacion. Si algun test falla, la correccion debe limitarse a devolver esas superficies a la ruta de resolucion de referencia completa o literal que ya usaban antes.

### Fuera de alcance
- No anadir nuevas superficies interpolables.
- No cambiar mensajes de error de requests salvo que sea imprescindible para conservar la semantica vigente.
- No crear una politica nueva de fallback para requests con datos ausentes.
- No actualizar documentacion funcional todavia.

### Dependencias
Depende de T01, T02, T03 y T04.

### Impacto esperado en archivos
- Codigo a crear o modificar:
  - Ninguno por defecto.
  - `src/queries/runtime-api-request.ts` solo si alguna regresion hizo que requests interpolaran indebidamente.
  - `src/runtime/runtime-state/runtime-state-provider.tsx` solo si alguna regresion hizo que `navigateTo.params` interpolara indebidamente.
  - `src/runtime/nodes/form-layout-node.tsx` solo si alguna regresion hizo que `defaultValue` interpolara indebidamente.
  - `src/runtime/runtime-layout-visibility.ts` solo si alguna regresion hizo que `visibility.value` o `visibility.reference` interpolaran indebidamente.
- Tests a crear o modificar:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-config-validation.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md` solo si se detecta que hace falta aclarar el no alcance de `navigateTo.params`.

### Tests requeridos
- `api.query`, hojas string de `api.body`, `api.headers`, `pages[].preloads.*.query/body/headers`, `button.props.action.query/body/headers` y `form.submitAction.query/body/headers` tratan `"prefix-{{forms.form.field}}"` como literal y no como plantilla.
- Una referencia completa ausente en requests sigue produciendo `request-build-failed`; una plantilla parcial en requests no produce fallback silencioso por placeholder.
- `navigateTo.params` conserva referencias completas soportadas, pero `"case-{{params.userId}}"` se persiste como literal y no como string interpolado.
- `defaultValue` de campos conserva referencias completas soportadas, pero `"Hola {{params.userId}}"` se usa como literal.
- `visibility.value` compara el literal declarado aunque contenga `{{...}}`.
- `visibility.reference`, `repeater.props.items.key`, `props.items.source`, `queryStateFeedback` y cabeceras de `table` siguen fuera del catalogo interpolable.

### Documentacion afectada
Actualizada en T06 para dejar claros los limites cerrados de la v1.

### Criterios de finalizacion
- Los tests negativos cubren requests, navegacion, defaults, visibilidad, fuentes y keys.
- Ninguna superficie fuera del catalogo cerrado reinterpreta `{{...}}`.
- Las referencias completas existentes siguen funcionando o fallando igual que antes en cada consumidor.
- La suite enfocada y la suite completa mantienen el umbral de cobertura global.

### Cierre de implementacion
La tarea queda cerrada cuando pasan:
```bash
pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-config-validation.test.ts
pnpm test
```
incluyendo el gate global de cobertura minimo del 80% en `functions`, `lines` y `statements` sobre `src/`.

### Cierre documental
Cerrado en T06 mediante la pasada `update-app-documentation`.

## T06 - Actualizar documentacion funcional y estado de feature

### ID
T06

### Estado
Completada.

### Objetivo
Actualizar la documentacion estable una vez implementadas y validadas T01-T05, reflejando la nueva interpolacion parcial `{{...}}`, su catalogo cerrado de superficies, la semantica defensiva de placeholders y las superficies explicitamente fuera de alcance.

### Fuera de alcance
- No modificar codigo de producto.
- No ampliar la feature hacia i18n, formateadores, expresiones, requests interpolados o nuevas superficies.
- No convertir `README.md` en changelog.
- No reabrir `architecture.md` salvo que durante la implementacion se haya cambiado una frontera arquitectonica real.

### Dependencias
Depende de T01, T02, T03, T04 y T05 implementadas con tests relevantes en verde y coverage final validado.

### Impacto esperado en archivos
- Codigo a crear o modificar:
  - Ninguno.
- Tests a crear o modificar:
  - Ninguno.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/forms-and-validation.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/app-features/pages-and-navigation.md` solo si hace falta aclarar `navigateTo.params`.
  - `ai-workflow/features/index.md`
  - `ai-workflow/features/0040-dynamic-strings/status.yaml`

### Tests requeridos
- No requiere tests nuevos. Antes de cerrar la documentacion debe existir evidencia de que T05 ejecuto `pnpm test` con coverage en verde.

### Documentacion afectada
- `current-state.md`: mover "no hay interpolacion parcial dentro de strings" desde limites a capacidades y mantener fuera de alcance requests, defaults y navegacion parcial.
- `config-driven-ui-runtime.md`: describir el comportamiento visible global y las superficies soportadas.
- `config-contract.md`: actualizar el contrato de strings visibles y proyecciones de colecciones.
- `forms-and-validation.md`: documentar labels de campos y values efectivos interpolados en opciones sin cambiar `defaultValue`.
- `queries-and-feedback.md`: documentar lectura de `queries.*` dentro de placeholders visibles y mantener requests fuera.
- `features/index.md`: mover o anotar `0040-dynamic-strings` como completada cuando la documentacion cierre la feature.

### Criterios de finalizacion
- La documentacion estable describe exactamente las superficies implementadas y excluidas.
- No queda ninguna referencia vigente a "no hay interpolacion parcial dentro de strings" como limite absoluto.
- `status.yaml` refleja fase documental o completa segun corresponda, sin marcar la feature como completada antes de cerrar la documentacion.
- No se introducen ejemplos que sugieran soporte en requests, `navigateTo.params`, `defaultValue`, `visibility`, fuentes o keys.

### Cierre de implementacion
No aplica; esta tarea no toca codigo.

### Cierre documental
Cerrado. La pasada documental actualizó las fichas indicadas, `features/index.md` y `status.yaml`, y la feature quedó marcada como completada.
