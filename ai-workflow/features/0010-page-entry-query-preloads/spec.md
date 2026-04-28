# Spec: Page entry query preloads

## Objetivo
Permitir que una página del runtime declare precargas de queries que se ejecutan automáticamente al entrar en ella, tanto en el arranque inicial como en la navegación interna posterior, reutilizando la frontera `api` y el estado compartido `queries` ya existentes y añadiendo un ciclo observable común de entrada de página para coordinar el feedback de carga.

## Alcance
- Añadir `preloads` como capacidad declarativa de página dentro del contrato JSON.
- Permitir que una página dispare automáticamente operaciones ya declaradas en `api` al convertirse en la página activa.
- Reutilizar el dominio compartido `queries` para almacenar el resultado individual de cada operación precargada.
- Definir un ciclo observable de entrada de página que represente el estado agregado de la tanda de precargas disparada al entrar en esa página.
- Aplicar la misma semántica tanto al `initialPage` del arranque como a cualquier navegación interna posterior a otra página.
- Mantener el alcance de esta feature en la orquestación declarativa de entrada de página y en el estado observable resultante, sin exigir todavía una biblioteca completa de consumidores visuales nuevos.

## Fuera de alcance
- Introducir una sintaxis rica de `preloads` con condiciones, dependencias, parámetros por entrada o políticas avanzadas de caché.
- Soportar ejecución secuencial, prioridades o grafos de dependencias entre precargas dentro de esta primera versión.
- Diseñar refetch automáticos tras acciones mutadoras o submits de formulario.
- Resolver la representación visual final y completa de `loading`, `error` y `empty` para cualquier bloque del layout.
- Cambiar el contrato estable de `queries.{queryName}.status`, `data` y `error`.
- Añadir navegación por URL, `routeParams`, `params` o nuevas familias de referencias fuera de las ya soportadas.

## Requisitos funcionales
- Cada página puede declarar `preloads` como una lista ordenada de nombres de operación existentes en `api`.
- Una página sin `preloads` sigue siendo válida y no dispara ninguna operación automática al entrar.
- Cuando una página se convierte en la página activa, el runtime debe disparar una nueva tanda de precargas para esa entrada concreta.
- Entrar en una página incluye:
  - el arranque inicial sobre `initialPage`
  - una navegación interna posterior hacia otra página
  - volver a una página previamente visitada si vuelve a convertirse en la página activa
- Las operaciones declaradas en `preloads` deben ejecutarse en paralelo dentro de la misma entrada de página.
- Cada precarga debe reutilizar la misma semántica de ejecución ya acordada para `executeQueryOperation(operationName)`, incluidos los estados `loading | success | error`, la conservación del último `data` válido durante recargas y los códigos de error normalizados.
- Si una operación declarada en `preloads` no existe en `api`, la entrada de página no debe bloquear el runtime completo; esa operación debe resolverse como error recuperable dentro de su query y contribuir a que la tanda agregada termine con error.
- Si una precarga no puede construirse por referencias sin resolver, debe comportarse como un error recuperable de esa query y contribuir al resultado agregado de la entrada.
- El runtime debe exponer, además del estado individual de cada `queries.{operationName}`, un ciclo agregado de entrada de página para la tanda de precargas activa.
- El ciclo agregado de entrada debe distinguir al menos estos resultados observables:
  - sin precargas para esa entrada
  - cargando mientras exista al menos una precarga pendiente
  - éxito cuando todas las precargas de la tanda terminan con éxito
  - error cuando al menos una precarga de la tanda termina con error
- Si una página tiene varias precargas y unas terminan con éxito mientras otras fallan, el resultado agregado final de esa entrada debe ser `error`, sin borrar por ello los datos exitosos ya almacenados en sus queries correspondientes.
- El ciclo agregado debe corresponder a la entrada de página más reciente y no debe quedar sobrescrito por completados tardíos de una tanda anterior después de otra navegación.
- El layout debe poder seguir consumiendo los datos finales mediante `queries.*`; esta feature no sustituye ese contrato, lo complementa con un estado compartido de entrada.
- Una configuración existente que no use `preloads` debe mantener el comportamiento estable actual sin cambios observables.

## Requisitos no funcionales
- El shape de `preloads` debe seguir siendo simple de generar desde backend legacy: una lista plana de strings.
- La orquestación de entrada debe reutilizar `api`, `queries` y la navegación interna ya existentes en lugar de abrir un subsistema remoto paralelo.
- La solución debe mantener la semántica de página de la v1: navegación interna al runtime, sin dependencia de la URL del navegador.
- El comportamiento agregado debe ser determinista y revisable aunque varias navegaciones ocurran en rápida sucesión.
- La feature debe preservar el alcance acotado de v1: cerrar el caso base de “cargar al entrar en pantalla” sin convertirse todavía en un motor general de orquestación remota.
- La terminología debe mantenerse alineada con el vocabulario ya asentado del proyecto: `pages`, `initialPage`, `preloads`, `api`, `queries`, `status`, `data` y `error`.

## Criterios de aceptación
- Dada una página con `preloads: ["searchUsers"]` y `initialPage` apuntando a esa página, el runtime dispara automáticamente `searchUsers` al arrancar.
- Dada una navegación interna hacia una página con `preloads`, el runtime vuelve a disparar automáticamente sus operaciones al entrar en ella, aunque esa página ya se hubiera visitado antes.
- Dada una página con varias precargas válidas, el runtime las lanza dentro de la misma entrada sin exigir orden secuencial entre ellas.
- Dada una precarga que termina con éxito, su resultado queda disponible en `queries.{operationName}` con la semántica estable ya documentada.
- Dada una precarga que falla por operación inexistente, construcción inválida del request, error de red, respuesta HTTP no `ok` o JSON inválido, su query correspondiente termina en `error` con el código estable ya documentado.
- Dada una página con dos precargas donde una termina en `success` y otra en `error`, el ciclo agregado de esa entrada termina en `error` y la query exitosa conserva su dato exitoso.
- Dada una página con precargas todavía en curso, el ciclo agregado de esa entrada permanece en estado de carga hasta que todas las operaciones de esa tanda hayan terminado.
- Dada una página sin `preloads`, el runtime no dispara operaciones automáticas y el ciclo agregado de entrada refleja que no había precargas que ejecutar.
- Dada una configuración previa sin `preloads`, el comportamiento observable actual del runtime no cambia.
- Dadas dos entradas consecutivas a páginas distintas, la finalización tardía de una precarga antigua no reescribe el resultado agregado de la entrada más reciente.

## Casos límite
- `preloads` puede ser una lista vacía.
- La misma operación puede aparecer en `preloads` de varias páginas distintas y debe poder reejecutarse cada vez que se entra en ellas.
- Una página puede declararse como destino de navegación repetida en poco tiempo; la agregación debe seguir representando la entrada más reciente.
- Una tanda puede mezclar respuestas rápidas, lentas, exitosas y fallidas.
- Una recarga de página puede comenzar cuando la query ya tenía `data` previo; durante esa nueva carga debe mantenerse la política actual de conservar el último dato válido.
- Una página puede depender funcionalmente de una sola query o de varias; el contrato agregado no debe impedir ninguno de los dos casos.

## Riesgos o preguntas abiertas
- La feature fija un ciclo agregado mínimo de entrada de página, pero futuras iteraciones deberán decidir cómo exponerlo al layout declarativo sin abrir una familia de referencias incoherente con el catálogo actual.
- Queda pendiente decidir si iteraciones futuras necesitarán políticas opcionales de reentrada distintas de “re-ejecutar siempre al entrar”.
- Si más adelante aparecen refetch automáticos o acciones mutadoras, convendrá revisar si comparten este mismo modelo agregado o si necesitan uno complementario.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Páginas y navegación
- Queries y feedback

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
