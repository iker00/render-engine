# Spec: length-formatter — formatter `length` para arrays y strings

## Objetivo

Añadir un formatter `length` al catálogo cerrado de formatters de interpolación (`{{referencia | formatter}}`,
introducido en [[0101-interpolation-formatters]]) que devuelva el número de elementos de un array o el número de
caracteres de un string.

El caso canónico que motiva esta feature es mostrar un contador derivado directamente de un dato ya presente en el
runtime — por ejemplo `{{queries.searchResults.data.items | length}}` para mostrar "N resultados" — sin que el
backend tenga que añadir un campo adicional solo para transportar ese recuento.

## Alcance

- Nuevo formatter `length` en el catálogo v1 de `references/dynamic-strings.md`, sin argumento (misma forma que
  `uppercase`, `lowercase` o `capitalize`).
- Entrada compatible: `array` (cuenta elementos) y `string` (cuenta caracteres, mismo criterio de conteo que ya usa
  `truncate` para longitud de texto).
- Disponible en las mismas superficies donde ya aplican los formatters existentes: el catálogo de superficies
  visibles de `dynamic-strings.md`, las cuatro superficies de headers, y `api.endpoint`.
- Encadenable con el resto del catálogo, en cualquier posición de la cadena. El caso de uso principal es
  `{{referencia | length | number}}` para aplicar formato de miles a un contador grande.
- La salida de `length` es un número entero en texto plano, sin separador de miles ni formato de locale, de forma
  que quede como entrada válida para un `number` posterior en la cadena.

## Fuera de alcance

- Entrada de tipo objeto plano (contar claves). Solo `array` y `string` son entradas compatibles en esta feature;
  un objeto se trata como entrada incompatible, igual que hoy lo es para el resto del catálogo.
- Alias del formatter (`count`, `size`, etc.). El nombre es `length`.
- Cualquier cambio en cómo el backend calcula o expone contadores hoy. Esta feature no deprecia ni sustituye
  contadores que el backend ya devuelve precalculados; añade una alternativa para los casos en que el dato ya vive
  en el runtime como array o string y no merece un campo de backend dedicado solo para el recuento.
- Nuevas familias de referencia o nuevas superficies de interpolación. El catálogo de superficies no cambia.
- Locale o configuración de idioma para `length`. El resultado es un entero plano independiente de `data-lang` y del
  locale fijo que ya usan `number`/`currency`/`date`/`percent`.

## Requisitos funcionales

### Comportamiento del formatter

- `{{referencia | length}}` con `referencia` resuelta a un `array` produce el número de elementos del array, como
  texto plano (por ejemplo `"5"`).
- `{{referencia | length}}` con `referencia` resuelta a un `string` produce el número de caracteres del string, como
  texto plano, contando en unidades UTF-16 (mismo criterio que ya aplica `truncate` para longitud de texto).
- `length` no admite argumento. Un placeholder con argumento (`{{x | length:2}}`) hace la cadena no resoluble, con el
  mismo criterio que ya aplica el catálogo v1 a un argumento no esperado por el formatter.

### Compatibilidad de valor de entrada

- Entrada válida: `array` (de cualquier longitud, incluida vacía) y `string` (incluido vacío).
- Entrada incompatible: `object` plano, `number`, `boolean`, `null`, `undefined`, `NaN`, `Infinity`. Cualquiera de
  estos hace la cadena no resoluble.

### Resolución de la cadena y semántica de fallo

- `length` reutiliza exactamente la misma semántica de cadena no resoluble ya definida en
  [[0101-interpolation-formatters]]: en superficies visibles produce string vacío en ese placeholder; en las cuatro
  superficies de headers y en `api.endpoint` produce `request-build-failed` para la operación completa.
- No se introduce ningún criterio de fallo nuevo. `length` se comporta como cualquier otro formatter del catálogo
  frente a nombre desconocido, argumento inválido o entrada incompatible en un punto posterior de la cadena.

### Compatibilidad hacia atrás

- Ningún formatter existente ni ningún placeholder sin `length` cambia de comportamiento.

## Requisitos no funcionales

- `length` se resuelve en la misma capa central de formatters ya introducida por
  [[0101-interpolation-formatters]], sin registro paralelo ni implementación local por nodo o por superficie.
- No introduce dependencias nuevas: contar elementos de un array o caracteres de un string no requiere ninguna
  librería adicional.

## Criterios de aceptación

1. `{{queries.list.data.items | length}}` con `queries.list.data.items` = array de 5 elementos produce `5`.
2. `{{queries.list.data.items | length}}` con array vacío produce `0`.
3. `{{queries.name.data | length}}` con `queries.name.data` = `"hola"` produce `4`.
4. `{{queries.list.data.items | length | number}}` con un array de 1500 elementos produce `1.500`, demostrando que
   la salida de `length` encadena correctamente con `number`.
5. `{{queries.obj.data | length}}` con `queries.obj.data` = un objeto plano produce string vacío en una superficie
   visible.
6. `{{queries.total.data | length}}` con `queries.total.data` = un número produce string vacío en una superficie
   visible.
7. El mismo caso del punto 6 aplicado a un valor de `api.headers` produce `request-build-failed` y la petición no
   se emite.
8. `{{queries.list.data.items | length:2}}` (argumento no esperado) produce string vacío en una superficie visible.
9. Un placeholder existente sin `length` (por ejemplo `{{queries.total | number}}`) se comporta exactamente igual
   que antes de esta feature.

## Casos límite

- Array vacío (`[]`): `length` produce `0`, no string vacío ni no-resoluble.
- String vacío (`""`): `length` produce `0`, no string vacío ni no-resoluble.
- String con caracteres multibyte (por ejemplo emoji compuestos por varios code units): el conteo sigue unidades
  UTF-16, igual que ya asume `truncate` hoy para longitud de texto; no se introduce conteo por grafema.
- `{{referencia | length}}` donde `referencia` aún no tiene dato disponible (query en curso o sin ejecutar): la
  referencia se degrada según la política ya vigente para referencias sin valor, sin llegar a evaluarse `length`.
- `{{referencia | uppercase | length}}`: válido. `uppercase` produce un string y `length` sobre ese string produce
  su número de caracteres; se documenta explícitamente porque es el primer caso del catálogo donde una cadena
  mezcla un formatter de texto seguido de `length`.
- `{{referencia | length | uppercase}}`: válido pero sin efecto visible. `length` produce un string numérico
  (por ejemplo `"5"`) y `uppercase` sobre ese string no lo modifica; el resultado final es `"5"` sin cambios. No es
  un error, es un encadenamiento sin efecto práctico.

## Áreas de producto afectadas

- Sistema de referencias (`references/`): `dynamic-strings.md`, para añadir `length` al catálogo cerrado v1 de
  formatters junto con su tabla de compatibilidad de entrada.

## Documentación probablemente afectada

- `references/dynamic-strings.md`: añadir `length` a la tabla del catálogo v1 y a la sección de compatibilidad de
  valor de entrada por formatter.

## Riesgos o preguntas abiertas

Ninguna pregunta bloqueante pendiente. Las decisiones de producto relevantes (tipos de entrada aceptados —
array y string, sin objetos — y nombre del formatter, `length`) se cerraron durante la exploración previa
(`explore-feature-scope`) y quedan reflejadas en esta spec.
