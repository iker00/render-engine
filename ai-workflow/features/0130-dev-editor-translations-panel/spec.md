# Spec: panel de editor "Traducciones" con sincronización de un proveedor externo

## Objetivo

Añadir al editor visual una nueva sección de nivel superior **"Traducciones"**, junto a Layout/Api/Páginas/Tokens/Shell,
que permita gestionar el bloque raíz `translations` sin editar JSON a mano en Monaco. Cubre dos necesidades a la vez:

1. **Gestión manual** de las entradas de `translations` (añadir, editar valores por idioma, borrar), equivalente al
   punto 5 del roadmap de editor visual (`EDITOR-VISUAL-ROADMAP.md`).
2. **Sincronización con un proveedor externo de gestión de textos**: buscar textos ya existentes en ese proveedor y
   añadirlos como nuevas entradas, y refrescar en bloque las entradas ya sincronizadas para traer su valor más
   reciente por idioma.

Resuelve la necesidad de que quien mantiene la configuración de una app cuyos textos ya viven en un sistema externo
de gestión de textos no tenga que copiarlos a mano (texto e identificador) al JSON del runtime. El proveedor externo
concreto es un parámetro de la instalación, no una parte fija del diseño: esta primera entrega se integra con un
único proveedor ya identificado, pero el diseño no debe asumir que será el único que la aplicación use nunca — ver
"Fuera de alcance" y "Riesgos" para el tratamiento de esa integración como algo reemplazable, no como una dependencia
permanente.

## Alcance

- Nueva sección de nivel superior **"Traducciones"** en la barra flotante del editor visual, mismo tipo de componente
  que "Shell" (0122): al seleccionarla, el área donde normalmente se renderiza el canvas se sustituye por un panel de
  formulario dedicado.
- El panel opera sobre el bloque raíz `translations` de la configuración actualmente en memoria, con el mismo
  pipeline de commit/validación/aplicación que ya usan Layout y Shell (mutación en memoria + `validateRuntimeConfig`
  + patch de la clave raíz `translations`). El resultado es indistinguible de haber editado `translations` a mano en
  Monaco y pulsado "Aplicar".
- **Lista de entradas existentes**: el panel muestra todas las claves actuales de `translations`, con una columna por
  cada código de idioma ya presente en cualquier entrada del bloque (unión de idiomas usados), y el texto
  correspondiente en cada celda (vacío si esa entrada no tiene valor para ese idioma).
- **Alta manual de entrada**: formulario para crear una clave nueva (string, no vacía, no duplicada de una clave ya
  existente) con un campo de texto por cada idioma conocido en ese momento; cualquier campo de idioma puede quedar
  vacío.
- **Edición manual de entrada**: modificar el texto de cualquier idioma de una entrada ya existente. La clave de una
  entrada ya creada no es editable (ver Fuera de alcance).
- **Borrado de entrada**: elimina la clave completa de `translations`. No hay validación cruzada de referencias
  existentes antes de borrar (ver Riesgos).
- **Añadir idioma nuevo**: control a nivel de panel (no por entrada) para declarar un nuevo código de idioma; añade
  una columna nueva, vacía para todas las entradas existentes, disponible desde ese momento en alta/edición manual.
- **Acción "Buscar y añadir" (proveedor externo)**: campo de búsqueda que llama a la operación de búsqueda de textos
  del proveedor externo con el texto introducido, muestra los resultados (identificador de texto + texto en el
  idioma por defecto del proveedor) con selección manual (checkbox) por resultado, y un botón para añadir los
  resultados marcados. Cada resultado añadido crea una entrada nueva en `translations` con clave = identificador de
  texto (convertido a string) y el idioma por defecto poblado con el texto devuelto; el resto de idiomas quedan
  vacíos. Un resultado cuyo identificador ya existe como clave en `translations` se muestra marcado como "ya existe"
  y no puede seleccionarse para añadir (evita duplicados; para refrescar una entrada ya existente se usa "Refrescar
  todo").
- **Acción "Refrescar todo" (proveedor externo)**: recopila todas las claves de `translations` que son literalmente
  un identificador válido (cadena que representa un entero), envía esa lista a la operación de obtención por lote del
  proveedor externo, y por cada identificador que la respuesta incluye, sobrescribe en la entrada correspondiente el
  texto de cada idioma devuelto (mapeando el código de idioma numérico del proveedor al código de idioma de la app
  mediante una tabla fija de esta instalación: `1 → "es"`, `2 → "eu"`). Claves enviadas que no aparecen en la
  respuesta se dejan intactas — nunca se borran por esta acción. Claves de `translations` que no son un identificador
  numérico (creadas a mano) se ignoran por completo en esta acción.
- **Autenticación con el proveedor externo**: ambas acciones requieren un Bearer JWT. El panel incluye un
  desplegable con los `tokens.*` ya declarados en la configuración activa; el usuario elige cuál usar como
  Authorization Bearer para las llamadas al proveedor externo. Si no hay ningún `tokens.*` declarado en la
  configuración, las dos acciones quedan deshabilitadas con un mensaje explicando que hace falta declarar un token
  primero (en la sección Tokens del editor).
- El proveedor externo se integra mediante dos operaciones de solo lectura:
  - una operación de **búsqueda de textos por coincidencia parcial**: recibe un texto de búsqueda, devuelve una lista
    de pares identificador + texto en el idioma por defecto del proveedor;
  - una operación de **obtención de traducciones por lote de identificadores**: recibe una lista de identificadores,
    devuelve por cada uno sus traducciones, cada una con un código de idioma numérico y su texto.
  - El proveedor concreto integrado en esta entrega expone además una tercera operación no relacionada con
    textos/idiomas (gestión de configuración); queda explícitamente fuera de esta feature.
  - El contrato técnico exacto de estas dos operaciones para el proveedor actualmente integrado (URLs, formato de
    payload, host por entorno) se fija en `design.md`, no en esta spec — ver "Riesgos".
  - Estos endpoints quedan fijos para esta instalación (no configurables desde la UI todavía), pero la
    implementación debe mantenerlos centralizados y no dispersos inline, de forma que sustituir el proveedor externo
    por otro distinto en el futuro sea un cambio localizado, sin necesitar todavía una capa de configuración genérica
    de "proveedores de traducción".
- Esta feature es exclusiva del editor de desarrollo (`DevRuntime` / modo Editor); no introduce ningún cambio en el
  runtime de producción ni en el contrato de `translations` consumido por `{{translations.*}}`.

## Fuera de alcance

- Renombrar la clave de una entrada ya creada. Una vez creada (manualmente o vía "Buscar y añadir"), la clave es
  inmutable; para "cambiar" una clave hay que borrar la entrada y crear una nueva. Justificación: las claves creadas
  vía el proveedor externo son literalmente su identificador de origen y no tiene sentido editarlas; para claves
  manuales se acepta esta limitación para no introducir gestión de referencias cruzadas en esta primera entrega.
- Validación cruzada de referencias antes de borrar una entrada (comprobar si algún `{{translations.clave}}` la usa
  en otro punto del config). El runtime ya tiene definido un comportamiento de fallback ante una clave de
  `translations` no resoluble (texto literal de la clave en dev, string vacío en producción), por lo que borrar una
  clave todavía referenciada degrada de forma controlada en vez de romper el config.
- Hacer configurables desde la UI o desde un fichero externo los endpoints/URLs del proveedor externo usados por
  "Buscar y añadir" / "Refrescar todo", ni construir un mecanismo genérico para declarar o elegir entre varios
  proveedores. Quedan fijos a un único proveedor para esta instalación; la implementación debe evitar dispersarlos
  inline de forma que sustituir ese proveedor por otro en el futuro sea un cambio localizado, pero no se construye
  ninguna capa de configuración genérica de "proveedores de traducción" en esta feature.
- Editar o gestionar los tokens de autenticación (`tokens.*`) desde este panel; el panel solo consume tokens ya
  declarados en la sección Tokens existente (0078).
- Cualquier flujo de escritura hacia el proveedor externo (su operación de actualización de configuración, u otro
  mecanismo para subir traducciones editadas en el runtime de vuelta a él). La sincronización es de solo lectura
  desde el proveedor externo hacia `translations`, nunca al revés.
- Cambiar el idioma activo de renderizado (`data-lang`) o introducir un selector de idioma en tiempo de ejecución;
  esta feature solo gestiona el contenido de `translations`, no el mecanismo de selección de idioma activo ya
  existente.
- Ampliar o modificar la tabla fija de mapeo código de idioma del proveedor → código de idioma de la app más allá de
  los dos valores conocidos hoy (`1 → "es"`, `2 → "eu"`); añadir un tercer idioma a esa tabla es cambio de código,
  no una funcionalidad de esta feature.
- Paginación, límite de resultados o control de volumen sobre la respuesta de la operación de búsqueda más allá de lo
  que el propio proveedor externo ya aplique; esta feature no introduce paginación propia en el panel.
- Persistencia en disco de la configuración resultante; igual que el resto del editor visual hoy, el resultado vive
  en memoria de sesión y se conserva copiando el JSON (Monaco), no escribiendo a fichero.

## Requisitos funcionales

1. El editor visual añade una sección de nivel superior "Traducciones", junto a Layout/Api/Páginas/Tokens/Shell.
2. Seleccionar "Traducciones" sustituye el área de canvas por un panel de formulario dedicado, sin alterar el estado
   de las demás secciones.
3. El panel muestra una tabla con una fila por cada clave existente en `translations` y una columna por cada código
   de idioma presente en la unión de todas las entradas actuales.
4. El panel permite añadir una columna de idioma nueva (código introducido por el usuario), inicialmente vacía para
   todas las filas existentes.
5. El panel permite crear una entrada nueva a mano: clave (string no vacío, no duplicado) + un campo de texto por
   idioma conocido (todos opcionales).
6. El panel permite editar el texto de cualquier celda idioma de una entrada existente.
7. El panel permite borrar una entrada completa, eliminando su clave de `translations`.
8. La clave de una entrada existente no es editable una vez creada.
9. El panel incluye un campo de búsqueda y una acción "Buscar" que llama a la operación de búsqueda del proveedor
   externo con el texto introducido y muestra los resultados (identificador de texto, texto en el idioma por
   defecto del proveedor) con selección individual por checkbox.
10. Un resultado de búsqueda cuyo identificador ya es una clave existente en `translations` se muestra marcado como
    "ya existe" y no es seleccionable para añadir.
11. Confirmar los resultados seleccionados crea, para cada uno, una nueva entrada en `translations` con clave =
    identificador de texto (string) y el idioma por defecto del proveedor poblado con el texto devuelto; el resto de
    idiomas quedan vacíos.
12. El panel incluye una acción "Refrescar todo" que: (a) recopila las claves de `translations` que son literalmente
    un entero válido, (b) las envía a la operación de obtención por lote del proveedor externo, (c) para cada
    identificador devuelto, sobrescribe el texto de cada idioma de la entrada correspondiente usando la tabla fija
    código de idioma del proveedor → código de idioma de la app (`1 → "es"`, `2 → "eu"`), (d) deja intactas las
    claves enviadas que no aparecen en la respuesta.
13. "Refrescar todo" nunca borra ninguna entrada de `translations`, incluida ninguna cuyo identificador ya no exista
    en el proveedor externo.
14. Las claves de `translations` que no son un entero válido (creadas a mano) se excluyen siempre del envío de
    "Refrescar todo".
15. El panel incluye un desplegable con los `tokens.*` declarados en la configuración activa; el token elegido se usa
    como Authorization Bearer en las llamadas al proveedor externo.
16. Si la configuración activa no declara ningún `tokens.*`, las acciones "Buscar" y "Refrescar todo" quedan
    deshabilitadas con un mensaje explicando la causa.
17. Cualquier cambio confirmado desde el panel (alta manual, edición manual, borrado manual, resultados de "Buscar y
    añadir", resultado de "Refrescar todo") pasa por el mismo pipeline de commit/validación (`validateRuntimeConfig`)
    y patch de la clave raíz `translations` que ya usan Layout y Shell.
18. Un commit rechazado por validación muestra el mismo patrón de aviso (`role="alert"`) ya usado en el resto del
    editor (`CommitRejectionBanner`), sin aplicar el cambio.

## Requisitos no funcionales

- Retrocompatibilidad total: una configuración sin bloque `translations`, o con `translations` vacío, sigue
  comportándose igual que hoy en el runtime de producción; esta feature solo añade una superficie de edición nueva
  en el editor de desarrollo.
- Las llamadas a las dos operaciones del proveedor externo muestran estado de carga mientras están en curso y no
  bloquean el resto del panel ni del editor.
- Un fallo de red, de autenticación (401/403) o de validación del proveedor externo en cualquiera de las dos
  acciones se comunica con un mensaje de error explícito en el panel, sin dejar el panel en un estado inconsistente
  ni aplicar ningún cambio parcial a `translations`.
- "Refrescar todo" es atómico respecto al commit: si la llamada a la operación de obtención por lote falla, no se
  aplica ningún cambio a `translations` (ni parcial ni total).
- El panel debe ser operable por teclado (foco, tablas, checkboxes, botones) con el mismo nivel de accesibilidad ya
  exigido al resto del editor visual (Shell, Layout).
- La nueva sección "Traducciones" no debe alterar el comportamiento ni el estado de las secciones Layout/Api/
  Páginas/Tokens/Shell existentes.
- La integración con el proveedor externo se implementa de forma que sustituirlo por otro proveedor en el futuro no
  requiera tocar el resto del panel (UI, pipeline de commit, gestión manual de entradas) — solo la pieza que llama a
  sus dos operaciones.

## Criterios de aceptación

- Dado un config sin `translations`, al abrir la sección "Traducciones" el panel muestra una tabla vacía y permite
  crear la primera entrada manualmente.
- Dado `translations` con al menos una entrada, la tabla muestra todas las claves y todos los idiomas presentes en
  cualquiera de ellas, con celdas vacías donde una entrada no tenga texto para un idioma dado.
- Crear una entrada manual con una clave ya existente se rechaza con un mensaje claro, sin crear una entrada
  duplicada.
- Editar el texto de una celda y confirmar aplica el cambio a `translations` siguiendo el mismo pipeline de commit
  que Layout/Shell; el resultado es idéntico a editar esa clave a mano en Monaco.
- Borrar una entrada la elimina de `translations`; cualquier referencia `{{translations.clave}}` que existiera en
  otro punto del config sigue funcionando con el fallback ya definido por el runtime (texto literal en dev, vacío en
  producción), sin error de validación.
- Buscar un texto con "Buscar y añadir" y no marcar ningún resultado no modifica `translations`.
- Buscar un texto, marcar dos resultados y confirmar añade dos entradas nuevas a `translations`, cada una con clave =
  identificador de texto y solo el idioma por defecto del proveedor poblado.
- Un resultado de búsqueda cuyo identificador coincide con una clave ya existente se muestra como "ya existe" y no
  puede marcarse para añadir.
- Ejecutar "Refrescar todo" con `translations` conteniendo tanto claves numéricas como una clave manual no numérica
  actualiza solo las entradas numéricas devueltas por el proveedor externo y deja intacta la clave manual.
- Ejecutar "Refrescar todo" cuando alguno de los identificadores enviados no aparece en la respuesta del proveedor
  externo deja esa entrada exactamente igual que antes de la acción.
- Sin ningún `tokens.*` declarado en la configuración, las acciones "Buscar" y "Refrescar todo" aparecen
  deshabilitadas con explicación visible.
- Con varios `tokens.*` declarados, el desplegable del panel permite elegir cuál se usa como Bearer, y la llamada de
  red usa el valor del token elegido en la cabecera `Authorization`.
- Un fallo de red o un 401/403 del proveedor externo durante "Buscar" o "Refrescar todo" muestra un error visible en
  el panel y no modifica `translations`.

## Casos límite

- `translations: {}` (bloque declarado vacío): equivalente a no declarar `translations`; la tabla se muestra vacía.
- Búsqueda con texto vacío o que no devuelve resultados: el panel muestra un estado "sin resultados", sin error.
- "Refrescar todo" con `translations` sin ninguna clave numérica: la acción no envía ninguna petición y no cambia
  nada (no hay nada que refrescar).
- La respuesta de la operación de obtención por lote incluye un código de idioma numérico que no está en la tabla
  fija de mapeo (ni `1` ni `2`): ese valor de idioma se ignora para esa entrada (no se escribe ninguna clave de
  idioma desconocida), el resto de idiomas mapeados de la misma entrada sí se aplican con normalidad.
- Una entrada creada manualmente con una clave que por coincidencia es un número (por ejemplo, un usuario crea a mano
  la clave `"42"`): esa clave se trata igual que una clave sincronizada desde el proveedor externo a todos los
  efectos de "Refrescar todo" (se envía como identificador si "Refrescar todo" se ejecuta), incluido el riesgo de
  que el proveedor no reconozca ese identificador y la entrada quede simplemente intacta.
- Doble clic o doble confirmación rápida sobre "Refrescar todo" mientras la primera llamada sigue en curso: la acción
  queda deshabilitada mientras hay una llamada en curso, para no disparar dos refrescos simultáneos.
- Añadir una columna de idioma con un código ya existente (duplicado): se rechaza sin crear una columna repetida.
- Borrar la última entrada de `translations`: el bloque queda como objeto vacío `{}`, no se elimina la clave raíz
  `translations` del config.

## Riesgos o preguntas abiertas

- **Arquitectura de las llamadas al proveedor externo** (candidato claro a `design.md`): si las peticiones a sus dos
  operaciones deben reutilizar el motor de ejecución de `src/queries/` (que hoy solo conoce operaciones declaradas
  en el propio bloque `api` del config editado) o si necesitan una vía de ejecución ad hoc propia del editor, dado
  que el proveedor externo no es ni debe pasar a ser parte del catálogo `api` del config que se está editando. Esta
  feature dispara `requires_design: true` por este motivo.
- **Punto de extensión para sustituir el proveedor**: esta spec exige que integrar un proveedor distinto en el
  futuro sea un cambio localizado, sin construir todavía una capa de configuración genérica. El diseño concreto de
  ese punto de extensión (qué queda aislado, qué contrato interno expone) se resuelve en `design.md`, incluyendo el
  contrato técnico exacto (URLs, payloads, host por entorno) del proveedor integrado en esta primera entrega.
- **Envío único vs. batching en "Refrescar todo"**: si el número de claves numéricas en `translations` puede crecer
  lo bastante como para requerir dividir el envío en varios lotes, se decide en `design.md`; esta spec asume un
  único envío con todas las claves numéricas.
- **Mantenimiento de la tabla fija de mapeo de idiomas**: al estar fijada en código (`1 → "es"`, `2 → "eu"`) en vez
  de ser configurable, cualquier idioma nuevo que el proveedor externo incorpore en el futuro requiere un cambio de
  código explícito en una feature aparte; se deja anotado como deuda conocida y aceptada, no como bloqueo de esta
  spec.
- Sin dependencia externa pendiente de confirmación: la tabla de mapeo de idiomas y el criterio de exclusión de la
  operación de configuración del proveedor ya quedaron confirmados en la conversación de discovery previa a esta
  spec.
