# Design: Feature 0130 - dev-editor-translations-panel

## Contexto

- La feature vive por completo en el editor de desarrollo (`DevRuntime`, área `src/dev-runtime/`); no toca el runtime de
  producción ni el contrato de `translations` ya validado (`config/structure.md`).
- El patrón de sección de nivel superior a reutilizar sin cambios es el ya vigente para "Shell" (0122): al
  seleccionar la pestaña, el canvas se sustituye por un panel de formulario dedicado, y cada cambio confirmado
  parchea una única clave raíz sobre el último texto crudo válido de Monaco, validando con `validateRuntimeConfig`
  antes de aplicar (ver `dev-mode-editor.md` § Sección Shell, § Pipeline de commit). Esta feature aplica el mismo
  patrón parcheando `translations` en vez de `shell`.
- La spec dejó como riesgo explícito el contrato técnico exacto (URLs, payloads, host por entorno) de las dos
  operaciones de solo lectura del proveedor externo. Ese contrato ya está disponible: un fichero OpenAPI del
  proveedor ("API GESTIONES" / PlataGes, `openapi-facade 1.json`, codificado en UTF-16, aportado en la raíz del
  repo junto con esta feature) documenta las tres operaciones expuestas, dos de las cuales son las que esta feature
  necesita.
- `translations` ya se reconstruye en cada aplicar (`migrateRuntimeStateAcrossConfig`); solo carecía de una
  superficie de edición dedicada.

## Objetivos / No objetivos

### Objetivos
- Fijar la arquitectura de integración con el proveedor externo sin acoplarla al motor de ejecución de `src/queries/`.
- Fijar el contrato técnico exacto (URLs, payloads, mapeo de errores, selección de host) de las dos operaciones de
  solo lectura usadas por esta feature.
- Fijar el punto de extensión que aísla el proveedor concreto (PlataGes) del resto del panel.
- Resolver los puntos de ambigüedad de modelado de datos que la spec deja abiertos a nivel de diseño (idiomas como
  columnas, detección de claves numéricas).

### No objetivos
- No se diseña una capa de configuración genérica de "proveedores de traducción" (excluida explícitamente por la spec).
- No se especifica UI pixel a pixel; eso es implementación.
- No se toca `src/queries/` ni el contrato `api` del config editado.

## Decisiones

### D1. Cliente ad hoc fuera de `src/queries/`, sin reutilizar el motor de ejecución
**Elegido**: un módulo cliente HTTP dedicado, colocado junto al resto del editor visual en `src/dev-runtime/`, que
hace sus propias llamadas `fetch` a las dos operaciones de PlataGes.

**Por qué**: `src/queries/` compone y ejecuta únicamente operaciones declaradas en el bloque `api` del config que se
está editando, resuelve sus referencias contra ese mismo config, e inyecta tokens vía interpolación
`{{tokens.x.value}}` en headers de una operación declarada. PlataGes nunca puede ser una entrada de `api` (la spec
lo prohíbe explícitamente para no acoplar el editor a un proveedor concreto), así que no existe una `operationName`
real que declarar. Forzar esta llamada por `src/queries/` exigiría declarar una operación sintética invisible al
usuario (rompe la invariante de que el config en memoria es exactamente lo que se ve y se commitea) o ramificar el
motor de ejecución del runtime para aceptar llamadas ad hoc no declaradas (extiende una responsabilidad de
`runtime/` con una preocupación exclusiva del editor).

**Trade-off asumido**: el nuevo cliente no hereda la semántica de errores tipados de `src/queries/`; se define un
mapeo de errores propio y más pequeño, solo para estas dos operaciones (ver D3).

**Alternativa descartada**: extender `src/queries/` con un modo de ejecución "ad hoc" (URL/payload pasados
directamente, sin operación declarada). Se descarta por generalizar el motor de ejecución del runtime de producción
para servir a un caso de uso exclusivo del editor de desarrollo.

**Conflicto con `architecture.md` — señalado, no resuelto en silencio**: el límite documentado ("La red vive en
`src/queries/`. Los nodos visuales no deben construir `fetch`... directamente") se escribió pensando en nodos
visuales del runtime consumiendo el config editado, no en herramientas del propio editor llamando a un sistema
externo que nunca será parte de ese config. Esta decisión introduce una excepción deliberada y acotada a esa frase
literal: un cliente `fetch` fuera de `src/queries/`, pero dentro de `src/dev-runtime/`, exclusivo de esta feature y
sin superficie de uso desde el runtime de producción. Se deja constancia aquí para que una pasada documental
posterior valore si `architecture.md` necesita una frase explícita sobre integraciones exclusivas del editor.

### D2. Punto de extensión: interfaz de proveedor + módulo único de implementación PlataGes
**Elegido**: el panel y su lógica de UI dependen de una interfaz mínima de dos operaciones — equivalente a
"buscar textos por texto parcial" y "obtener traducciones por lote de identificadores", con los tipos de entrada/
salida ya alineados a lo que consumen "Buscar y añadir" y "Refrescar todo" — no del cliente PlataGes concreto. Toda
URL, payload, forma de request/response y mapeo de errores específico de PlataGes vive detrás de esa interfaz, en un
único módulo.

**Por qué**: cumple el requisito no funcional de la spec de que sustituir el proveedor no requiera tocar el resto
del panel. Mantiene la integración centralizada sin construir la capa de configuración de proveedores que la spec
excluye explícitamente: hoy hay una sola implementación concreta, importada directamente, sin registro ni selección
de proveedor en runtime.

**Alternativa descartada**: registro de proveedores seleccionable en runtime, aunque solo tenga una entrada. Se
descarta por ser exactamente la capa de configuración genérica que la spec excluye para esta entrega.

### D3. Contrato técnico exacto de las dos operaciones
Confirmado contra el fichero OpenAPI del proveedor:

- **Búsqueda** ("Buscar y añadir"): `POST {baseUrl}/platages/platages/v1/operations/6C1F94A2-3D57-4B08-9E62-1A70C58D34B1/buscartextos`
  - Body: `{ "BuscarTextosEntradaDTO": { "ParteTexto": <texto de búsqueda> } }`.
  - Respuesta 200: `{ "BuscarTextosSalidaDTO": { "Textos": [{ "IdTexto": number, "Texto": string }] } }`; `Textos`
    ausente o `null` se trata como lista vacía (estado "sin resultados" de la spec).
- **Obtención por lote** ("Refrescar todo"): `POST {baseUrl}/platages/platages/v1/operations/0B48D3E7-92AC-4F51-8D06-5E9B27A4C6F3/obtenertextos`
  - Body: `{ "ObtenerTextosEntradaDTO": { "IdTextos": [number, ...] } }` con todas las claves numéricas de
    `translations` como enteros.
  - Respuesta 200: `{ "ObtenerTextosSalidaDTO": { "Textos": [{ "IdTexto": number, "Traducciones": [{ "Idioma": number, "Texto": string }] }] } }`.
- **Excluida explícitamente** (spec, "Fuera de alcance"): `POST .../A5D20F63-7E14-48CB-B39A-C86F015D7E24/actualizarjsonconfiguracionenplatages`
  (escritura de configuración) — no se implementa ningún cliente para esta operación.
- **Autenticación**: header `Authorization: Bearer <valor de tokens.{tokenId}.value elegido en el desplegable>`,
  leído directamente del config en memoria — no vía interpolación `{{...}}`, porque esta llamada no es una operación
  `api` declarada. `Content-Type: application/json` en ambas llamadas.
- **Errores**: 400/401/403/404/500 devuelven `{ code, message }`. El cliente distingue 401/403 (mensaje de
  autenticación, según NFR de la spec) del resto de códigos (mensaje de integración usando `message` si viene, o un
  texto de fallback si no); fallos de red o de parseo de JSON reciben el mismo tratamiento genérico que un error de
  integración sin código HTTP.

### D4. Selección de host (`baseUrl`) centralizada, con valor por defecto seguro
El proveedor expone dos hosts (`https://frontapi.entidad.es` producción, `https://pre-frontapi.entidad.es`
pre-producción). Hoy no existe en el proyecto ningún mecanismo de selección de host por entorno: el runtime no hace
llamadas de red con host configurable propio (los `endpoint` de `api` los declara el config de cada instalación).

**Elegido**: `baseUrl` como una única constante centralizada en el módulo cliente de PlataGes (D2), resuelta desde
una variable de entorno de build de Vite (`VITE_PLATAGES_API_BASE_URL`), con valor por defecto el host de
pre-producción.

**Por qué**: evita construir un mecanismo de "entorno" nuevo solo para esta feature, y evita que ejecutar el editor
localmente golpee por defecto el sistema de producción del proveedor externo. Cada instalación que quiera apuntar a
producción lo fija explícitamente vía variable de entorno de build, sin tocar código.

**Trade-off asumido**: quien despliegue esta instalación en producción debe fijar esa variable si quiere que "Buscar
y añadir"/"Refrescar todo" trabajen contra datos reales; si no la fija, el editor sigue funcionando pero contra
pre-producción. Ver Preguntas abiertas.

### D5. Idiomas como derivado de los datos, no como lista persistida aparte
`translations` no tiene (ni la spec pide) un bloque separado de "idiomas declarados"; la columna de idioma es
siempre la unión de claves de idioma presentes en las entradas actuales. Un idioma recién añadido sin ninguna
entrada todavía ("Añadir idioma nuevo") no tiene forma de persistirse en `translations` hasta que exista al menos un
valor para él.

**Elegido**: ese idioma se mantiene como estado local de UI del panel (no se commitea a `translations` por sí solo)
hasta que la primera edición de una celda de esa columna lo escriba por primera vez.

**Por qué**: evita forzar una clave de metadatos nueva en el contrato de `translations` (fuera de alcance de la
spec) para resolver algo ya representable como estado efímero de la sesión del panel.

**Riesgo residual**: recargar la página, o cualquier evento que reinicie el panel, pierde una columna de idioma
añadida sin ningún valor todavía — mismo criterio de pérdida que el resto de cambios sin aplicar del editor (ver
`dev-mode-editor.md` § Persistencia y entorno), no es una regresión nueva de esta feature.

### D6. Detección de claves numéricas para "Refrescar todo"
**Elegido**: una clave de `translations` se considera "identificador válido" si coincide con `/^\d+$/` (uno o más
dígitos, sin signo ni separadores) — coherente con `IdTexto: integer` (siempre no negativo) del contrato del
proveedor. Cualquier otra clave (con espacios, signo negativo, o no numérica) se trata como manual y se excluye
siempre del envío.

### D7. Atomicidad de "Refrescar todo" por orden de operaciones, no por mecanismo nuevo
La spec exige que un fallo en la llamada de obtención por lote no aplique ningún cambio, ni parcial ni total. Esto
se resuelve con el orden ya implícito en el pipeline de commit existente: la llamada de red se espera por completo
y solo si resuelve con éxito se construye el objeto `translations` parcheado y se invoca el commit único (patch +
`validateRuntimeConfig` + aplicar). No hay commits incrementales por entrada ni un mecanismo de rollback nuevo que
diseñar: la atomicidad la da no empezar a construir el patch hasta tener la respuesta completa.

## Riesgos y trade-offs
- Excepción deliberada a la frase literal de `architecture.md` sobre dónde vive la red (ver D1); señalada para
  revisión y posible actualización documental futura.
- Dependencia de un fichero OpenAPI aportado fuera del flujo estándar de specs como fuente de contrato técnico; si
  el proveedor cambia su contrato, este design queda desactualizado hasta que se note en un fallo de integración
  real — no hay tipado generado automáticamente desde ese OpenAPI.
- Sin batching en "Refrescar todo" (asumido explícitamente por la spec): un `translations` con muchas claves
  numéricas envía una única petición potencialmente grande.
- El host por defecto (pre-producción, D4) puede no reflejar los datos reales que un mantenedor de producción
  espera ver si la instalación no fija la variable de entorno — mitigado solo por documentación.

## Migración o despliegue
No aplica: no hay datos persistidos que migrar; la feature es aditiva sobre el editor de desarrollo y no cambia el
contrato de `translations` ya validado por el runtime.

## Preguntas abiertas
- Ninguna pregunta técnica bloquea la planificación. Riesgo residual documentado: si esta instalación necesita que
  el editor apunte a producción de PlataGes por defecto (en vez de pre-producción, ver D4), debe fijar
  explícitamente `VITE_PLATAGES_API_BASE_URL` en su configuración de build — no es una decisión que deba reabrirse
  en planificación, pero conviene confirmarla antes de desplegar esta feature si el valor por defecto no encaja con
  esa instalación.
