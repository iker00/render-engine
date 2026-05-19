# Spec: Form page-entry invalidation

## Objetivo
Hacer que un formulario con `persistOnUnmount: false` invalide su estado local cuando cambia la `pageEntry` activa, aunque la `pageId` siga siendo la misma y el nodo `form` no llegue a desmontarse físicamente, para que los `defaultValue` y demás datos iniciales se reconstruyan contra el nuevo contexto de entrada.

## Alcance
- Ajustar el lifecycle funcional de los formularios para que la unidad observable de persistencia por defecto deje de ser solo el desmontaje real y pase a respetar también el cambio de `pageEntry`.
- Aplicar esta invalidación a formularios que permanecen montados al reentrar en la misma página con `params` distintos o con una nueva tanda de `preloads`.
- Hacer que, tras esa invalidación, el formulario vuelva a inicializar sus campos con la semántica vigente de `defaultValue`, incluidos `params.*`, `queries.*` e `item.*` donde ya apliquen.
- Mantener `persistOnUnmount: true` como excepción explícita para conservar estado entre entradas distintas dentro de la misma instancia del runtime.
- Cubrir especialmente el caso de una misma página con query params distintos donde el fetch asociado sí se relanza pero el formulario conserva valores anteriores.

## Fuera de alcance
- Convertir `defaultValue` en una referencia reactiva general ante cualquier cambio posterior de `params.*`, `queries.*` u otros datos externos mientras la misma `pageEntry` siga activa.
- Introducir una limpieza global de todos los formularios al navegar de página, al hacer `goBack` o al cambiar cualquier parte del store compartido.
- Redefinir la semántica de recarga manual de queries fuera de `pages[].preloads`.
- Añadir nuevas políticas declarativas de persistencia por campo, por query o por tipo de navegación.
- Cambiar el comportamiento de formularios que ya declaran `persistOnUnmount: true`, salvo para dejar explícito que esa persistencia también cubre cambios de `pageEntry`.

## Requisitos funcionales
- La semántica por defecto de un formulario sin `persistOnUnmount: true` debe quedar ligada a la `pageEntry` activa y no solo al desmontaje real del nodo.
- Cuando cambie la `pageEntry` de la página visible, cualquier formulario afectado con persistencia por defecto debe invalidar su estado local existente en `forms.{formId}`, aunque el árbol React mantenga montado ese mismo nodo `form`.
- Esa invalidación debe aplicarse también cuando la nueva `pageEntry` conserve la misma `pageId` pero cambien sus `params` efectivos y se relancen `preloads`.
- Tras la invalidación, los campos del formulario deben comportarse como una nueva inicialización efectiva dentro de la nueva entrada:
  - si tienen `defaultValue`, deben reconstruirse con la semántica ya vigente
  - si no tienen `defaultValue`, deben arrancar vacíos según el tipo de campo
- Si un `defaultValue` depende de `params.*`, al reentrar en la misma página con params distintos el formulario debe reflejar los params de la nueva entrada y no los valores escritos o hidratados en la entrada anterior.
- Si un `defaultValue` depende de una query incluida en `preloads`, el formulario debe reconstruirse contra el estado limpio y la futura respuesta fresca de la nueva `pageEntry`, sin conservar valores de la entrada anterior.
- La excepción ya vigente para absorción del primer dato fresco de una query precargada debe seguir aplicando solo a la nueva entrada prístina y no debe convertirse en rehidratación reactiva posterior.
- Mientras la misma `pageEntry` siga activa, el runtime no debe invalidar ni rehidratar el formulario por simples rerenders, por cambios internos del formulario o por cambios de datos externos ajenos a una nueva entrada.
- `persistOnUnmount: true` debe conservar el comportamiento histórico de persistencia también cuando el formulario permanezca montado entre dos `pageEntry` distintas de la misma página.
- La invalidación por cambio de `pageEntry` debe limitarse al formulario afectado y no debe alterar otros formularios o queries no relacionadas.
- La semántica de `resetForm`, validación local y submit declarativo debe seguir operando sobre el estado vigente del formulario una vez reconstruido para la nueva entrada.
- La navegación a la misma página con los mismos params efectivos debe seguir siendo un no-op observable y no debe invalidar el formulario.

## Requisitos no funcionales
- El contrato resultante debe seguir siendo pequeño y coherente: persistencia por defecto acotada a la vida de una `pageEntry`, con `persistOnUnmount` como excepción explícita.
- La terminología debe mantenerse alineada con la documentación vigente: `pageEntry`, `pageId`, `params.*`, `preloads`, `defaultValue`, `forms.*` y `persistOnUnmount`.
- El comportamiento debe poder verificarse con tests de integración sobre reentrada a la misma página, cambio de params y formularios alimentados por `queries.*`.
- La spec debe dejar claro que este cambio completa la política ya iniciada en features anteriores: limpiar datos obsoletos de queries no basta si el formulario sigue reteniendo su propio estado local.

## Criterios de aceptación
- Dada una página con un formulario sin `persistOnUnmount: true`, cuando el usuario navega a la misma `pageId` con params efectivos distintos y esa navegación crea una nueva `pageEntry`, el formulario no conserva los valores escritos en la entrada anterior.
- Dada esa misma reentrada a la misma `pageId`, si un campo usa `defaultValue: "params.id"`, el nuevo valor inicial corresponde al nuevo `params.id`.
- Dada esa misma reentrada con `preloads`, si un campo usa `defaultValue` derivado de `queries.*`, el formulario no muestra ni conserva el valor hidratado de la entrada anterior mientras la nueva carga está en curso.
- Dado un formulario reconstruido por cambio de `pageEntry`, si el dato fresco de la nueva tanda de `preloads` llega después y el campo sigue prístino, puede absorber ese primer dato fresco con la semántica ya vigente para nuevas entradas.
- Dado un cambio interno de estado o un rerender sin cambio de `pageEntry`, el formulario no se invalida ni pierde el valor actual del usuario.
- Dada una navegación a la misma página con los mismos params efectivos, el runtime sigue tratándola como no-op observable y el formulario no se reinicializa.
- Dado un formulario con `persistOnUnmount: true`, al cambiar a otra `pageEntry` de la misma página conserva sus valores dentro de la misma instancia del runtime.
- Dado un runtime con varios formularios, invalidar uno por cambio de `pageEntry` no debe limpiar el estado de otro formulario no afectado.
- Dado un flujo `#/page?id=1 -> #/page?id=2`, donde la query precargada se relanza correctamente, el formulario asociado también reconstruye sus defaults con los datos de la segunda entrada.

## Casos límite
- Reentrada a la misma página con distinto orden de query params pero mismos pares clave-valor efectivos: sigue siendo la misma entrada observable y no debe invalidar el formulario.
- Reentrada a la misma página con params distintos pero sin desmontaje real del nodo `form`.
- Vuelta atrás del navegador hacia una entrada previa de la misma página con `preloads`, donde el formulario debe reflejar otra vez esa entrada reactivada.
- Página con varios formularios donde solo algunos declaran `persistOnUnmount: true`.
- Formulario visible durante `loading` de una nueva `pageEntry`, con `defaultValue` basado en query precargada.
- Campos condicionales ocultos por `visibility` o `queryStateFeedback` dentro de un formulario que sigue perteneciendo a una nueva entrada y debe reconstruirse igual cuando cambie la `pageEntry`.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes; la decisión central es tratar `pageEntry` como frontera de invalidez para la persistencia por defecto del formulario.
- Debe vigilarse la regresión en flujos que hubieran pasado a depender implícitamente de conservar valores al cambiar params dentro de una misma página; esos casos deberán declarar `persistOnUnmount: true` de forma explícita.
- La implementación tendrá que coordinar esta invalidez con la semántica vigente de `preloads` y con la inicialización lazy para evitar dobles hidrataciones o pérdidas de persistencia no deseadas.

## Áreas de producto afectadas
- Formularios y validación.
- Páginas y navegación.
- Precargas automáticas y reentrada por `pageEntry`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/current-state.md`
