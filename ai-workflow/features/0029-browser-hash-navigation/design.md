# Design: Browser hash navigation

## Contexto
La navegación vigente del runtime ya soporta páginas, historial por entrada, `params.*`, `navigateTo`, `goBack` y `preloads` ligados a la entrada activa, pero todo ello vive hoy dentro del store compartido y no sincroniza con la URL del navegador. La documentación global todavía fija esa ausencia de routing como restricción de v1.

Esta feature cambia esa decisión: el hash del navegador pasa a ser la fuente observable de la entrada activa. El cambio es transversal porque afecta a navegación, reentrada, `params.*`, política de no-op, restauración atrás/adelante, bootstrap inicial y documentación de arquitectura.

## Objetivos
- Sincronizar la página activa con el hash del navegador usando una convención única y simple.
- Reutilizar `params.*` para leer query params desde la URL sin abrir un namespace nuevo.
- Hacer que `navigateTo` escriba la URL y que atrás/adelante del navegador restauren la entrada correspondiente.
- Preservar la semántica actual por entrada de `preloads` y de no-op para navegaciones equivalentes.

## No objetivos
- Introducir un router externo o navegación por `pathname`.
- Abrir rutas anidadas, segmentos dinámicos o `routeParams.*`.
- Tratar valores de query string como tipos enriquecidos más allá de string.

## Decisiones

### 1. La convención visible de URL será única
- Home funcional: `#/`
- Resto de páginas: `#/pageId`
- Con query params: `#/?k=v` para home y `#/pageId?k=v` para el resto

Razonamiento:
- evita tener dos URLs válidas para `initialPage`
- hace explícito que la home es una excepción normalizada
- simplifica el fallback cuando la ruta es inválida

### 2. El hash del navegador pasa a ser la fuente de verdad de la entrada activa
La navegación interna no debe decidir ya la página visible de forma autónoma y luego reflejarla en la URL como efecto secundario. La URL visible debe ser la referencia principal desde la que se deriva la entrada activa.

Consecuencias:
- bootstrap inicial: parsea `window.location.hash`
- navegación declarativa: escribe hash normalizado
- atrás/adelante del navegador: rehidrata la entrada desde el nuevo hash

Razonamiento:
- evita estados divergentes entre store y navegador
- convierte recarga y deep link por hash en casos nativos, no en sincronizaciones parciales

### 3. `params.*` seguirá siendo el único namespace para parámetros de navegación
Los query params del hash no abrirán `routeParams.*` ni otro namespace adicional. La entrada derivada de la URL alimentará directamente el contrato ya conocido de `params.*`.

Razonamiento:
- reduce complejidad funcional
- evita duplicar consumidores y documentación
- mantiene continuidad con `0020`

### 4. Los query params se tratan como strings y se normalizan de forma estable
La URL siempre trabaja con strings. El runtime no debe reinterpretar automáticamente `"true"` como boolean ni `"42"` como número al leer desde el hash.

Semántica:
- al leer desde la URL, todos los valores quedan como string
- un query param presente sin `=` explícito se interpreta como string vacío `''`
- si una misma clave aparece repetida en el hash, prevalece la última ocurrencia observable
- al escribir desde `navigateTo.params`, solo se serializan valores escalares efectivos
- `null`, ausentes y no escalares se omiten
- la serialización canónica ordena las claves de forma lexicográfica ascendente y omite `?` cuando no quedan params efectivos

Razonamiento:
- la URL no preserva tipos JSON simples de forma inequívoca
- mantener strings evita coerciones sorpresivas y comparaciones inconsistentes entre entrada manual y navegación interna

### 5. La equivalencia de entrada debe comparar ruta normalizada y params normalizados
La política de no-op no debe depender del orden textual de los query params en la URL. Dos hashes que representen la misma página y el mismo conjunto de pares clave-valor deben tratarse como la misma entrada observable.

Razonamiento:
- evita relanzar `preloads` por diferencias cosméticas de serialización
- deja una regla robusta para navegaciones originadas desde URL manual o desde `navigateTo`

### 6. El historial funcional propio deja de ser el mecanismo primario de atrás/adelante
La app puede seguir manteniendo una representación interna de la entrada activa para `pageEntry` y selectores, pero `goBack` y la navegación histórica deben apoyarse en `window.history` y en los eventos de cambio de hash.

Razonamiento:
- el navegador ya pasa a gestionar la pila visible
- duplicar una pila histórica paralela aumentaría el riesgo de divergencia

### 7. El fallback de rutas inválidas será redirección silenciosa a home normalizada
Si el hash no puede resolverse a una página válida del catálogo o usa un shape fuera de contrato, el runtime debe corregir la URL a `#/` y activar `initialPage`.

Razonamiento:
- coincide con la decisión de producto cerrada
- evita retener slugs inválidos
- simplifica el comportamiento esperado frente a errores de entrada manual

### 8. El store conserva una traza interna mínima, pero el navegador gobierna atrás/adelante
El runtime mantendrá `navigation.currentPageId`, `navigation.history` y `pageEntry` porque el resto del runtime ya depende de esa superficie, pero esa estructura deja de ser la fuente primaria de verdad.

Semántica:
- al arrancar, el store se hidrata desde la entrada normalizada derivada del hash actual
- `navigateTo` escribe primero un hash canónico; la actualización efectiva de la entrada activa ocurre cuando el runtime observa ese hash como entrada vigente
- si un cambio de hash del navegador coincide con la entrada previa inmediata conocida, el store puede reutilizar la semántica actual de `goBack` para podar la cola local
- si el cambio de hash apunta a una entrada válida distinta de la actual y no coincide con la previa inmediata conocida, el store la registra como una nueva entrada observada en la sesión
- la equivalencia se decide por `pageId + params` ya normalizados, no por igualdad textual del hash original

Razonamiento:
- evita reescribir de golpe demasiados selectores y tests internos
- mantiene estable `pageEntry` como unidad de reentrada para `preloads`
- permite que atrás y adelante del navegador gobiernen la navegación real sin exigir al runtime inspeccionar toda la pila histórica del browser

### 9. `goBack` solo debe delegar en `window.history.back()` cuando exista una entrada previa observada dentro de la sesión del runtime
La spec exige que `goBack` sea un no-op visible cuando no exista una entrada previa utilizable del navegador. Para que eso no dependa del historial global de la pestaña ni pueda sacar al usuario fuera de la app en una entrada directa, el runtime debe distinguir entre:
- historial global del navegador, que no controla
- historial de hashes ya observados por esta instancia del runtime durante la sesión actual

Semántica:
- una carga directa en `#/pageId` o `#/` arranca la sesión con una sola entrada observada y `goBack` debe ser no-op visible
- cada navegación efectiva originada por `navigateTo` o por `hashchange` añade o reactiva una entrada observada dentro de la sesión
- `goBack` solo llama a `window.history.back()` cuando la sesión conoce una entrada previa observable a la actual
- si la navegación del navegador reactiva una entrada ya observada, el runtime debe mover su cursor interno a esa entrada en vez de duplicarla
- si el navegador avanza a una entrada ya observada hacia delante, el runtime también debe reactivar esa entrada sin inventar una nueva
- si aparece un hash válido no visto antes dentro de la sesión, el runtime lo incorpora como nueva entrada observada

Razonamiento:
- evita salir accidentalmente de la app al usar `goBack` desde una entrada directa
- permite soportar atrás y adelante del navegador sin volver a tomar el historial interno antiguo como fuente de verdad
- deja explícita la necesidad de una traza con cursor o semántica equivalente, en lugar de una pila simple sin posición

## Impacto arquitectónico
- `runtime-state` deja de ser dueño exclusivo de la navegación y pasa a consumir una entrada derivada del navegador.
- `pageEntry` sigue siendo necesario como unidad de reentrada y orquestación de `preloads`.
- La frontera de parsing/normalización de navegación necesitará una capa explícita para:
  - leer hash
  - validar/normalizar slug
  - extraer params string
  - generar hash canónico desde `pageId + params`
  - comparar entradas equivalentes

## Riesgos y trade-offs
- Riesgo: mezclar source of truth entre store y navegador.
  Mitigación: fijar el hash como origen primario y derivar desde él la entrada activa.

- Riesgo: romper la semántica actual de `navigateTo` con params tipados.
  Mitigación: distinguir entre params efectivos del runtime y representación URL; la URL se lee siempre como string y la navegación declarativa solo serializa escalares.

- Riesgo: reentradas redundantes por hashes equivalentes con orden distinto.
  Mitigación: usar normalización estable y comparación semántica, no textual.

- Riesgo: que `goBack` use el historial global de la pestaña y abandone la app cuando la sesión del runtime no tenga una entrada previa propia.
  Mitigación: gatear `window.history.back()` con una traza observada por la propia sesión y tratar el caso contrario como no-op visible.

- Riesgo: conflicto con documentación base de v1.
  Mitigación: tratar la feature como cambio explícito de contrato y exigir actualización documental posterior.

## Preguntas abiertas
- No quedan preguntas abiertas de producto ni de arquitectura que bloqueen la planificación.
