# Spec: Image node local fetch

## Objetivo

Permitir que el nodo `image` pueda obtener su contenido directamente desde un endpoint que devuelve datos binarios, gestionando la petición y su resultado de forma completamente local al nodo, sin escribir nada en el estado compartido de `queries.*`.

Este modelo local es la única opción viable para imágenes cuya respuesta es binaria: almacenar el resultado en `queries.*` no encaja con el shape de datos que ese dominio espera, y generar una clave de query dinámica por instancia crearía colisiones o acumulación de estado no controlada. El nodo gestiona su propio ciclo de petición independientemente de si vive dentro de un `repeater` o de forma aislada en la página.

## Alcance

- Añadir al nodo `image` una propiedad opcional `fetch` que declara inline la petición remota.
- El campo `fetch.url` acepta literales y referencias dinámicas (`{{item.*}}`, `{{queries.*}}`, etc.) con la misma semántica de resolución que el resto del runtime.
- Los campos opcionales `fetch.method`, `fetch.headers` y `fetch.body` también aceptan referencias donde apliquen.
- La respuesta binaria se convierte en un object URL local al nodo.
- El object URL se revoca cuando el nodo se desmonta.
- Mientras la petición no termina o si falla: no render del nodo, consistente con el comportamiento actual de `src` no disponible.
- `alt` sigue siendo obligatorio como hoy y puede ser literal, referencia o interpolación.
- `fetch` y `src` son mutuamente excluyentes: si el nodo declara `fetch`, no se declara `src`.
- Funciona tanto dentro de un `repeater` (con contexto `item.*`) como fuera de él.
- Cada instancia del nodo gestiona su propio ciclo de vida de petición de forma independiente.

## Fuera de alcance

- Respuestas JSON: esta feature cubre únicamente respuestas binarias. Para obtener la URL de una imagen desde JSON, el caso sigue cubierto por `src` con referencias a `queries.*`.
- Placeholder visual o spinner durante la carga.
- Indicador de error cuando la petición falla.
- Props `width` o `height` en el nodo `image`.
- Caché de imágenes entre instancias o entre entradas de página.
- Reintentos automáticos, cancelación configurable o polling.
- Referenciar operaciones del catálogo `api`: la declaración es siempre inline en `fetch`.
- Escribir el resultado en `queries.*` o en ningún otro dominio compartido.
- Extender esta capacidad a otros nodos del catálogo en la misma feature.

## Requisitos funcionales

- El nodo `image` debe poder seguir funcionando en su modo actual con `src` y `alt`, sin cambio de comportamiento observable.
- El nodo `image` debe poder declarar opcionalmente `fetch` en lugar de `src`.
- Cuando `fetch` está declarado, `fetch.url` es obligatorio; `fetch.method`, `fetch.headers` y `fetch.body` son opcionales.
- `fetch.method` por defecto es `GET` si no se declara.
- Los valores de `fetch.url`, `fetch.headers` y `fetch.body` resuelven referencias del runtime con la misma semántica ya soportada en el resto de superficies declarativas del runtime.
- Dentro de un `repeater`, `fetch.url`, `fetch.headers` y `fetch.body` pueden resolver `item.*` igual que en otras superficies dentro del contexto de iteración.
- La petición se ejecuta automáticamente cuando el nodo se monta en el árbol de render visible.
- La respuesta binaria se convierte a un object URL que se usa como `src` efectivo del elemento `<img>`.
- El object URL se revoca cuando el componente se desmonta.
- Si la petición no ha completado todavía: el nodo no renderiza ningún `<img>`.
- Si la petición falla o la respuesta no es un binario utilizable: el nodo no renderiza ningún `<img>`.
- Varias instancias del nodo `image` con `fetch` declarado gestionan su petición y su resultado de forma completamente independiente entre sí.
- La validación previa al render rechaza:
  - un nodo `image` con `fetch` declarado que incluya también `src`.
  - un nodo `image` con `fetch` declarado pero sin `fetch.url`.
  - un nodo `image` sin `src` ni `fetch`.

## Requisitos no funcionales

- El resultado de la petición no se escribe en ningún dominio compartido del runtime.
- La ejecución de la petición HTTP debe pasar por la capa `src/queries/`, no construirse directamente en el componente visual.
- La resolución de referencias en `fetch.url`, `fetch.headers` y `fetch.body` debe usar `runtime-references/`, sin parsers locales ad hoc.
- La terminología del contrato JSON debe ser consistente con la del resto del runtime: `url`, `method`, `headers`, `body` para el bloque `fetch`.
- La feature debe mantenerse dentro del alcance acotado de la v1: una imagen simple con petición propia binaria, no un subsistema general de media.
- La validación debe seguir ocurriendo antes del render y producir diagnósticos trazables en caso de shape incoherente.

## Criterios de aceptación

- Dado un nodo `image` sin `fetch`, el comportamiento observable con `src` y `alt` no cambia.
- Dado un nodo `image` con `fetch.url` literal, el runtime lanza la petición al montar el nodo y renderiza la imagen con la respuesta binaria convertida a object URL.
- Dado un nodo `image` con `fetch.url` que contiene referencias, el runtime las resuelve antes de ejecutar la petición.
- Dado un nodo `image` con `fetch` dentro de un `repeater`, cada instancia lanza su propia petición con los parámetros `item.*` resueltos para su iteración, y el resultado de una instancia no interfiere con el de las demás.
- Dado un nodo `image` con `fetch` fuera de un `repeater`, la petición se lanza correctamente sin contexto `item.*`.
- Dado que la petición tiene éxito y devuelve datos binarios, el `<img>` se renderiza usando el object URL generado.
- Dado que el nodo se desmonta, el object URL es revocado.
- Dado que la petición falla, el nodo no renderiza ningún `<img>`.
- Dado que la petición aún está en curso, el nodo no renderiza ningún `<img>`.
- Dado un nodo `image` con `fetch` y `src` declarados a la vez, la validación rechaza el config antes del render con diagnóstico trazable.
- Dado un nodo `image` con `fetch` pero sin `fetch.url`, la validación rechaza el config antes del render con diagnóstico trazable.
- Dado un nodo `image` sin `src` ni `fetch`, la validación rechaza el config antes del render (comportamiento ya existente extendido al nuevo shape).

## Casos límite

- Un nodo `image` con `fetch` dentro de un `repeater` donde cada iteración resuelve el mismo `fetch.url` efectivo: cada instancia hace su propia petición de forma independiente.
- Un nodo `image` con `fetch` que se monta, inicia la petición y se desmonta antes de que la respuesta llegue: la petición se abandona y no se produce ninguna actualización de estado ni se crea object URL.
- Un nodo `image` con `fetch` donde `fetch.url` contiene una referencia que aún no está disponible en el momento del montaje: se resuelve al valor disponible en ese instante; si el resultado es vacío, la petición se lanza igualmente con el valor resuelto.
- Una pantalla mezcla nodos `image` con `fetch` y nodos `image` con `src` estático o referenciado: ambos coexisten sin interferencias.
- `alt` puede ser un literal fijo mientras `fetch` gestiona el binario: combinación válida y esperada.

## Riesgos o preguntas abiertas

- Ninguna duda funcional bloqueante permanece abierta.
- La planificación debe decidir explícitamente qué superficie de `src/queries/` expone la capacidad de petición binaria y cómo la consume el componente del nodo sin romper la frontera arquitectónica.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/image.md`
- `ai-workflow/docs/app-features/config/structure.md` (validación del nuevo shape)
- `ai-workflow/docs/current-state.md`
