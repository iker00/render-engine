# Spec: 0084 — Page document.title

## Objetivo

Permitir que cada página declare un `title` opcional que controle `document.title` mientras esa página está activa,
usando el formato `{page.title} | {título inicial}`.

## Alcance

- Nueva propiedad opcional `title` (string estático) en el modelo de página del JSON de configuración.
- Al activarse una página con `title`, el runtime actualiza `document.title` con el formato
  `{page.title} | {título inicial}`.
- Al activarse una página sin `title`, el runtime restaura `document.title` al título inicial capturado al montar el
  runtime.
- El título inicial se captura una sola vez al montar el runtime y se conserva durante toda la sesión.

## Fuera de alcance

- Interpolación dinámica `{{...}}` en `title`: es un string literal; las referencias `queries.*`, `forms.*`, `params.*`
  u otras no se resuelven.
- Modificación del separador `|` o del formato del título mediante configuración.
- Animaciones, transiciones ni cambios visuales adicionales vinculados al cambio de título.
- Persistencia del título al recargar la página (responsabilidad del atributo HTML `<title>` del documento base, fuera
  del runtime).

## Requisitos funcionales

1. **Declaración en JSON**: cada entrada de `pages` puede incluir `title` como string no vacío. La propiedad es
   opcional; su ausencia es válida.
2. **Captura del título inicial**: el runtime captura `document.title` una única vez en el momento de su montaje. Este
   valor no cambia durante la sesión aunque `document.title` sea modificado externamente.
3. **Activación de página con `title`**: cuando el runtime navega a una página que declara `title`, establece
   `document.title` con el patrón `{page.title} | {título inicial}`.
4. **Activación de página sin `title`**: cuando el runtime navega a una página que no declara `title` (o `title` es
   ausente), restaura `document.title` al título inicial capturado.
5. **Página inicial**: la misma lógica aplica a la página inicial al montar el runtime.
6. **`title` vacío**: un string vacío `""` se trata como ausencia de `title`; el comportamiento es restaurar al título
   inicial.

## Requisitos no funcionales

- La captura del título inicial no debe interferir con el ciclo de validación del runtime ni añadir lógica al flujo de
  bootstrap de configuración.
- El efecto sobre `document.title` es un efecto secundario del cambio de página; no debe acoplarse al árbol de render ni
  producir renders adicionales.

## Criterios de aceptación

1. Una página con `title: "Alta de usuario"` activa establece `document.title` como
   `"Alta de usuario | {título inicial}"`.
2. Navegar desde esa página a otra sin `title` restaura `document.title` al título inicial.
3. Si el documento HTML tiene `<title>Mi App</title>` al montar el runtime, el título inicial es `"Mi App"` y se
   conserva aunque la página lo haya sobrescrito.
4. Una página con `title: ""` (string vacío) restaura `document.title` al título inicial, sin producir `" | Mi App"`.
5. La validación del JSON rechaza `title` con un valor que no sea string (por ejemplo, `title: 42`).
6. La validación del JSON acepta páginas sin `title` y páginas con `title` como string no vacío sin emitir advertencias.
7. La navegación entre páginas con y sin `title` en cualquier orden mantiene el comportamiento correcto en cada
   transición.

## Casos límite

- `document.title` en blanco al montar el runtime: el título inicial es `""`. Una página con `title` produce
  `"Alta de usuario | "` (el separador con string vacío a la derecha). Comportamiento aceptable; no se requiere
  tratamiento especial.
- Múltiples instancias del runtime en la misma página: cada instancia captura su propio título inicial al montar, pero
  comparten el mismo `document.title` del documento. El comportamiento cuando coexisten varias instancias queda fuera
  del alcance de esta feature; es coherente con la restricción general de v1 de una instancia por documento.
- Página inicial sin `title`: el runtime monta, captura el título inicial y lo deja intacto sin escribir nada en
  `document.title`.

## Áreas de producto afectadas

- Modelo de página (`config/structure.md`, `navigation/page-model.md`): se añade `title` como campo opcional al shape de
  página.
- Runtime de navegación: el cambio de página activa el efecto sobre `document.title`.
- Validación Zod: se extiende el schema de página para admitir `title` como string opcional.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/config/structure.md`
- `ai-workflow/docs/app-features/navigation/page-model.md`

## Riesgos o preguntas abiertas

Ninguno. Las ambigüedades de producto han quedado resueltas.
