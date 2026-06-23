# Spec: 0079 — Interpolación `{{...}}` en valores de cabeceras

## Objetivo

Permitir combinar texto literal con referencias dinámicas dentro de los valores de cabecera de las cuatro superficies
que ya admiten headers declarativos, usando el mismo mecanismo `{{...}}` que funciona hoy en superficies visibles y en
`api.endpoint`.

El caso canónico que motiva esta feature es poder escribir `"Authorization": "Bearer {{tokens.sede.value}}"` sin
necesidad de que el valor del header sea exclusivamente una referencia completa.

## Alcance

- Interpolación parcial `{{...}}` habilitada en los valores (no las claves) de las cuatro superficies de headers:
    - `api.headers`
    - `button.props.action.headers`
    - `form.submitAction.headers`
    - `preloads[].headers`
- Las familias de referencias admitidas dentro de `{{...}}` en estas superficies son las mismas que ya son válidas en
  cada superficie como referencia completa: `queries.*`, `forms.*`, `params.*`, `item.*`, `tokens.*`.
- Cuando un placeholder no puede resolverse (referencia inválida, ausente o fuera de contrato), la construcción del
  request falla con `request-build-failed` y la petición no se emite. Este comportamiento es equivalente al de `api.endpoint`.
- Ningún cambio en el contrato de claves de header: las claves siguen siendo strings literales.
- Ningún cambio en la validación de configuración previa al render para las cuatro superficies.

## Fuera de alcance

- Interpolación `{{...}}` en claves de header (solo aplica a valores).
- Interpolación `{{...}}` en cualquier otra superficie de request (`api.query`, `api.body`, `button.props.action.query`,
  `button.props.action.body`, `form.submitAction.query`, `form.submitAction.body`, `navigateTo.params`).
- Nuevas familias de referencias no soportadas ya como referencia completa en headers.
- Uso de `translations.*` en headers (fuera de contrato en request surfaces, sin cambio en esta feature).
- Degradación silenciosa de placeholders no resolubles a string vacío en headers (la semántica es error, igual que en
  `api.endpoint`).
- Interpolación en superficies de texto visibles que no sean headers (ya cubiertas por `0040-dynamic-strings`).
- Cambios en `visibility.reference`, `queryStateFeedback` u otros consumidores no relacionados con headers.

## Requisitos funcionales

### Resolución de valores de header con interpolación

- Un valor de header puede contener cero, uno o varios placeholders `{{referencia}}`.
- Si el valor no contiene ningún placeholder `{{...}}`, se comporta exactamente igual que antes: referencia completa si
  el string coincide con una referencia soportada, literal en cualquier otro caso.
- Si el valor contiene uno o más placeholders, cada placeholder se resuelve individualmente contra el estado del runtime
  en el momento de construir la petición.
- El texto literal fuera de los placeholders se conserva sin modificación.
- Espacios alrededor de la referencia dentro de un placeholder (`{{ referencia }}`) se ignoran, igual que en las
  superficies visibles.

### Comportamiento ante placeholders no resolubles

- Si cualquier placeholder del valor de un header no puede resolverse (referencia ausente, inválida, token inexistente,
  dato no disponible, `null`, objeto, array u otro tipo no string-serializable), la construcción del request falla con
  `code: request-build-failed` y la petición no se emite.
- Este comportamiento es consistente con el de `api.endpoint` y con el de las referencias completas que no resuelven en
  headers.
- La diferencia con superficies visibles es explícita: en headers la semántica es error, no string vacío.

### Familias de referencias por superficie

Cada superficie mantiene exactamente la misma frontera de familias que tiene hoy para referencias completas:

| Superficie | Familias admitidas en `{{...}}` |
|---|---|
| `api.headers` | `queries.*`, `forms.*`, `params.*`, `item.*`, `tokens.*` |
| `button.props.action.headers` | `queries.*`, `forms.*`, `params.*`, `item.*`, `tokens.*` |
| `form.submitAction.headers` | `queries.*`, `forms.*`, `params.*`, `item.*`, `tokens.*` |
| `preloads[].headers` | `queries.*`, `tokens.*` (las familias ya admitidas como referencia completa en preloads) |

### Compatibilidad hacia atrás

- Los valores de header que hoy son referencias completas (`queries.user.data.token`) siguen funcionando exactamente
  igual que antes, sin ningún cambio de comportamiento.
- Los valores de header que hoy son strings literales también siguen siendo literales.
- No existe ninguna configuración actualmente válida que pase a ser inválida o a comportarse distinto.

## Requisitos no funcionales

- La resolución de placeholders en headers ocurre en el mismo momento que la resolución de referencias completas:
  durante la construcción del request, no en bootstrap.
- El mecanismo de interpolación reutiliza la misma capa central de resolución de referencias, sin reimplementaciones
  locales en cada superficie.
- La omisión de campos ocultos en submit (introducida por `0077`) sigue siendo aplicable: si un placeholder referencia
  un campo del propio formulario que está oculto, ese campo se omite en lugar de producir `request-build-failed`, igual
  que ocurre ya con las referencias completas en `form.submitAction`.

## Criterios de aceptación

1. `"Authorization": "Bearer {{tokens.sede.value}}"` construye el header con el valor resuelto del token concatenado
   correctamente al prefijo literal.
2. Un valor con múltiples placeholders (`"X-Header": "{{params.tenantId}}-{{queries.session.data.userId}}"`) combina
   todos los fragmentos en el header final.
3. Un valor con placeholder que no resuelve (referencia ausente o token inexistente) produce `request-build-failed` y la
   petición no se emite en ninguna de las cuatro superficies.
4. Los valores de header sin placeholders siguen comportándose exactamente igual que antes de esta feature.
5. `api.headers` con interpolación resuelve los placeholders en el momento de ejecutar la operación, no en bootstrap.
6. `button.props.action.headers` con interpolación resuelve desde el estado del runtime en el momento del clic.
7. `form.submitAction.headers` con interpolación resuelve desde el estado del runtime en el momento del submit.
8. `preloads[].headers` con interpolación resuelve en el momento de ejecutar la precarga.
9. Un header con valor `"Bearer {{tokens.sede.value}}"` donde el token existe produce exactamente `"Bearer <valor>"` sin
   espacios adicionales ni modificaciones del texto literal.
10. Un header cuyo valor es solo un placeholder `"{{tokens.sede.value}}"` se comporta igual que la referencia completa
    `tokens.sede.value`: produce el valor del token sin texto adicional.
11. Un placeholder que referencia un campo oculto del propio formulario (`forms.{formId}.{fieldId}`) en
    `form.submitAction.headers` aplica la política de omisión de campos ocultos (el header se omite, no produce error).
12. La configuración existente sin placeholders en headers no presenta ninguna regresión funcional.

## Casos límite

- Valor de header con llaves de apertura o cierre sin parear (`"Bearer {token}"`, `"valor}raro"`): no se interpreta
  como placeholder y se trata como string literal.
- Placeholder con referencia bien formada pero dato cuyo tipo no es serializable como string (objeto, array): produce
  `request-build-failed`, consistente con el comportamiento en `api.endpoint`.
- Placeholder con referencia `null` o `undefined`: produce `request-build-failed`.
- Valor de header que mezcla referencia completa válida y texto literal: `"prefix-queries.user.data.id"` no es
  interpolación (sin delimitadores `{{...}}`) y se trata como string literal completo, igual que hoy.
- Header de `preloads` con familia `forms.*` o `params.*` dentro de un placeholder: la familia `forms.*` no es válida
  en `preloads` (sin cambio respecto a referencias completas) y produce `request-build-failed`. La familia `params.*`
  está pendiente de confirmar su disponibilidad en preloads en el contrato actual.
- Dos placeholders donde uno resuelve y otro no: el fallo de cualquier placeholder del valor hace fallar toda la
  construcción del header, no se produce un valor parcial.

## Áreas de producto afectadas

- Sistema de referencias (`references/`): `dynamic-strings.md` y `reference-resolution.md` para documentar que las
  cuatro superficies de headers pasan a admitir interpolación parcial.
- Ejecución de endpoints (`queries/execution.md`): la semántica de construcción de headers en tiempo de ejecución
  cambia para soportar interpolación.

## Documentación probablemente afectada

- `references/dynamic-strings.md`: añadir las cuatro superficies de headers al catálogo de superficies con interpolación,
  con nota sobre semántica de error (no string vacío).
- `references/reference-resolution.md`: actualizar la sección de superficies que admiten referencias completas en
  requests para reflejar que los headers también admiten interpolación parcial.
- `queries/execution.md`: actualizar la sección de reglas de payload para reflejar que `{{...}}` ya aplica en headers.

## Riesgos o preguntas abiertas

- Confirmar si `params.*` es una familia admitida hoy en `preloads[].headers` como referencia completa, para saber si
  también debe admitirse como placeholder en esa superficie. La spec asume que hereda la misma frontera actual de esa
  superficie; la implementación debe verificarlo antes de ampliar el contrato.
