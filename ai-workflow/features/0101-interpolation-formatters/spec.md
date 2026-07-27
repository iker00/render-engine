# Spec: 0101 — Formatters en interpolación `{{...}}`

## Objetivo

Permitir transformar el valor ya resuelto de un placeholder `{{...}}` mediante un catálogo cerrado de formatters con
sintaxis pipe (`{{referencia | formatter}}`), sin abrir el sistema de interpolación a expresiones arbitrarias.

El caso canónico que motiva esta feature es mostrar datos formateados (`{{queries.total | number}}`,
`{{queries.date | date:"dd/MM/yyyy"}}`, `{{queries.price | currency}}`) sin que el backend tenga que devolver strings
pre-formateados para cada superficie visible.

## Alcance

- Sintaxis `{{referencia | formatter}}` dentro de placeholders `{{...}}`, en las mismas superficies donde ya existe
  interpolación parcial hoy: el catálogo de superficies visibles de `references/dynamic-strings.md` y las cuatro
  superficies de headers de `0079-header-interpolation` (`api.headers`, `button.props.action.headers`,
  `form.submitAction.headers`, `preloads[].headers`).
- Encadenamiento de varios formatters sobre el mismo placeholder: `{{referencia | formatter1 | formatter2 | ...}}`,
  ejecutados de izquierda a derecha, cada uno recibiendo la salida del anterior.
- Catálogo cerrado de formatters v1:

  | Formatter | Sintaxis | Comportamiento |
    |---|---|---|
  | `number` | `\| number` o `\| number:2` | Formato numérico `es-ES` con separador de miles; sin argumento no fuerza número de decimales, con argumento `N` fuerza exactamente `N` decimales |
  | `currency` | `\| currency` o `\| currency:"USD"` | Formato monetario `es-ES`; sin argumento usa `EUR` por defecto |
  | `date` | `\| date:"dd/MM/yyyy"` o `\| date:"dd/MM/yyyy HH:mm:ss"` | Formatea una fecha/hora ISO 8601 con los tokens `dd`, `MM`, `yyyy`, `HH`, `mm`, `ss` |
  | `percent` | `\| percent` o `\| percent:1` | Multiplica el valor (ratio 0–1) por 100 y añade `%`; el argumento `N` fija el número de decimales (default 0) |
  | `uppercase` | `\| uppercase` | Convierte el texto a mayúsculas |
  | `lowercase` | `\| lowercase` | Convierte el texto a minúsculas |
  | `capitalize` | `\| capitalize` | Convierte a mayúscula solo el primer carácter del texto |
  | `truncate` | `\| truncate:20` | Corta el texto a `N` caracteres y añade `…` si excede esa longitud |

- Gramática de argumento único opcional por formatter: `formatter:"texto"` (string entre comillas dobles, para
  `date` y `currency`) o `formatter:N` (número sin comillas, para `number`, `percent` y `truncate`). Ningún formatter
  del catálogo v1 admite más de un argumento.
- Espacios alrededor de `|` y alrededor de la referencia y los formatters dentro del placeholder se ignoran, igual que
  ya ocurre con las referencias simples.
- Locale fijo `es-ES` para `number`, `currency`, `date` y `percent`, independiente de `data-lang` (que hoy solo
  gobierna `translations.*`).
- Los formatters se aplican sobre el valor ya resuelto por la capa central de referencias (`runtime-references/`); no
  cambian qué referencias son válidas, ni las familias admitidas por superficie, ni el comportamiento de
  interpolación cuando no hay ningún formatter en el placeholder.

## Fuera de alcance

- Expresiones arbitrarias, operadores, condicionales o cualquier lógica de plantilla más allá de aplicar formatters
  con nombre del catálogo cerrado. Esto sigue respetando el límite de v1 que excluye "plantillas de texto interpolado
  complejas" (`context.md`): el pipe es un catálogo cerrado sobre una referencia ya resuelta, no una capa de
  expresiones.
- Formatters definidos, registrados o parametrizables desde la configuración JSON del backend. El catálogo es fijo en
  código para esta feature.
- Formatters no listados en el catálogo v1 (por ejemplo `boolean`/`yesno` para mapear valores booleanos a etiquetas).
  Quedan como candidatos para una ampliación futura del catálogo, no en esta feature.
- Locale dinámico según `data-lang` para `number`/`currency`/`date`/`percent`. El locale es fijo `es-ES` en esta
  feature.
- Nuevas superficies de interpolación no soportadas hoy. El catálogo de superficies con interpolación parcial no
  cambia.
- Formatters sobre referencias completas fuera de placeholders (`queries.total` sin `{{...}}`). Los formatters solo
  existen dentro de la sintaxis `{{...}}`.
- Límite explícito de número de formatters encadenados. No se introduce un máximo artificial en v1.
- Tokens de fecha adicionales a `dd`, `MM`, `yyyy`, `HH`, `mm`, `ss` (por ejemplo nombres de mes o formatos
  localizados largos tipo "16 de julio de 2026").

## Requisitos funcionales

### Sintaxis de la cadena de formatters

- Un placeholder `{{...}}` puede contener, opcionalmente, uno o más segmentos `| formatter` o `| formatter:argumento`
  tras la referencia.
- Sin ningún segmento `|`, el placeholder se comporta exactamente igual que hoy (sin cambios).
- Los formatters se ejecutan en el orden en que aparecen, de izquierda a derecha. Cada formatter recibe como entrada
  la salida del formatter anterior, o el valor ya resuelto de la referencia si es el primero de la cadena.
- El argumento de un formatter es opcional y, cuando existe, es único: texto entre comillas dobles (`"..."`) o un
  número sin comillas. Ningún formatter del catálogo v1 necesita más de un argumento.

### Resolución de la cadena y semántica de fallo

- Si el nombre de un formatter no pertenece al catálogo cerrado v1, si su argumento no cumple la gramática esperada,
  o si el valor de entrada en ese punto de la cadena no es compatible con lo que ese formatter espera, la cadena
  completa se considera no resoluble.
- Un placeholder cuya cadena de formatters no es resoluble aplica exactamente la misma semántica de fallo que ya
  tiene hoy la superficie donde vive ese placeholder:
    - en superficies visibles (el catálogo de `dynamic-strings.md`), el placeholder produce string vacío, conservando
      el texto literal que lo rodea.
    - en las cuatro superficies de headers (`0079-header-interpolation`), la construcción del request falla con
      `request-build-failed` y la petición no se emite.
- No existe un tercer criterio de fallo distinto para formatters: reutiliza el mismo contrato de degradación que ya
  tiene cada familia de superficie.

### Compatibilidad de valor de entrada por formatter

- `number`, `currency`, `percent`: entrada válida es un `number`, o un string que representa un número válido sin
  ambigüedad (por ejemplo `"42"` o `"42.5"`). Cualquier otro tipo o formato se considera incompatible.
- `date`: entrada válida es un string en formato fecha u hora ISO 8601. Cualquier otro tipo o formato se considera
  incompatible.
- `uppercase`, `lowercase`, `capitalize`, `truncate`: entrada válida es `string`, `number` o `boolean`, coercionada a
  texto con la misma regla que ya aplica hoy a superficies visibles sin formatter. `null`, `undefined`, objetos y
  arrays se consideran incompatibles.

### Compatibilidad hacia atrás

- Ningún placeholder `{{...}}` existente sin `|` cambia de comportamiento.
- Ninguna referencia completa fuera de `{{...}}` cambia de comportamiento.

## Requisitos no funcionales

- Los formatters se resuelven en la misma capa central de referencias (`runtime-references/`) y en el mismo momento
  en que hoy se resuelve cada placeholder (render para superficies visibles, construcción de request para headers).
  No se introduce un paso de resolución adicional ni una re-renderización extra.
- El registro de formatters vive como catálogo cerrado en código, sin reimplementaciones locales por nodo o por
  superficie.
- `number`, `currency`, `date` y `percent` usan `Intl` con locale fijo `es-ES` como mecanismo de formateo; no se
  introduce una librería de formateo de fechas adicional para cubrir la tokenización `dd/MM/yyyy`.

## Criterios de aceptación

1. `{{queries.total | number}}` con `queries.total.data` = `1234.5` produce `1.234,5`.
2. `{{queries.total | number:2}}` con el mismo valor produce `1.234,50`.
3. `{{queries.price | currency}}` con `queries.price.data` = `19.9` produce un valor monetario en euros formateado
   `es-ES` (por ejemplo `19,90 €`).
4. `{{queries.price | currency:"USD"}}` con el mismo valor produce el equivalente formateado en dólares.
5. `{{queries.date | date:"dd/MM/yyyy"}}` con `queries.date.data` = `"2026-07-16"` produce `16/07/2026`.
6. `{{queries.date | date:"dd/MM/yyyy HH:mm:ss"}}` con un datetime ISO con componente de hora produce fecha y hora
   formateadas con los tokens indicados.
7. `{{queries.name | uppercase}}` con `queries.name.data` = `"ana"` produce `ANA`.
8. `{{queries.name | uppercase | truncate:2}}` produce `AN…`, demostrando que la cadena aplica los formatters en
   orden y cada uno recibe la salida del anterior.
9. `{{queries.ratio | percent:1}}` con `queries.ratio.data` = `0.4256` produce `42,6%`.
10. Un formatter que no existe en el catálogo (`{{queries.total | doesNotExist}}`) produce string vacío en una
    superficie visible.
11. El mismo caso del punto 10 aplicado a un valor de `api.headers` produce `request-build-failed` y la petición no
    se emite.
12. `{{queries.name | date:"dd/MM/yyyy"}}` con `queries.name.data` = `"ana"` (valor no compatible con `date`) produce
    string vacío en una superficie visible, sin romper el render del resto del texto literal.
13. Un placeholder sin `|` se comporta exactamente igual que antes de esta feature.

## Casos límite

- Cadena con un único formatter sin argumento (`{{x | uppercase}}`): válida, comportamiento descrito en el catálogo.
- Cadena con varios formatters incompatibles entre sí en el orden dado (por ejemplo
  `{{x | uppercase | date:"dd/MM/yyyy"}}`,
  donde `date` recibe un string ya transformado por `uppercase` que ya no es una fecha ISO válida): la cadena
  completa se considera no resoluble y aplica la semántica de fallo de la superficie.
- Formatter con argumento mal formado (`{{x | number:"dos"}}`, argumento de texto donde se espera número): la cadena
  se considera no resoluble.
- Formatter con dos puntos pero sin argumento (`{{x | truncate:}}`): se considera no resoluble.
- Espacios variables alrededor de `|` y del argumento (`{{ x | number : 2 }}`): se ignoran igual que el resto de
  espacios dentro de un placeholder.
- `truncate` con `N` mayor que la longitud del texto de entrada: el texto se devuelve sin modificar, sin añadir `…`.
- `truncate:0`: produce string vacío seguido de `…` si el texto de entrada no está vacío.
- `date` sobre un string vacío o `null`: no compatible, aplica semántica de fallo.
- `percent` sobre un valor fuera del rango 0–1 (por ejemplo `2.5`): se formatea igual que cualquier número
  multiplicado por 100 (`250%`), sin validación de rango; el contrato solo define la operación, no un rango válido.
- Referencia con familia no soportada en la superficie (por ejemplo `forms.*` en `preloads[].headers`) combinada con
  un formatter: el fallo ocurre igual que hoy por referencia inválida, independientemente del formatter aplicado
  después.

## Áreas de producto afectadas

- Sistema de referencias (`references/`): `dynamic-strings.md` para documentar la sintaxis de formatters, el catálogo
  cerrado y la semántica de cadena.
- Ejecución de endpoints (`queries/execution.md`): para reflejar que los valores de header con formatters siguen la
  semántica `request-build-failed` ya documentada para headers.

## Documentación probablemente afectada

- `references/dynamic-strings.md`: añadir la sintaxis `| formatter`, el catálogo cerrado v1 con su gramática de
  argumentos, y la semántica de cadena no resoluble por superficie.
- `queries/execution.md`: nota de que los formatters en valores de header están sujetos a la misma semántica de error
  ya documentada para headers.

## Riesgos o preguntas abiertas

Ninguna pregunta bloqueante pendiente. Todas las decisiones de producto relevantes (catálogo v1, gramática de
argumentos, locale fijo, semántica de fallo por cadena y por superficie) se cerraron durante la exploración previa y
quedan reflejadas en esta spec.
