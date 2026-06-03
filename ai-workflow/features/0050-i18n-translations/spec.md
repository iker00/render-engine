# Spec: 0050 — i18n Translations

## Objetivo

Permitir que la configuración JSON declare un catálogo de traducciones y que el runtime resuelva referencias `translations.key` al valor correspondiente al idioma activo, de modo que el contenido textual de los nodos pueda servirse en el idioma seleccionado sin cambiar la estructura de la configuración.

## Alcance

- Nueva sección opcional `translations` en la raíz del JSON de configuración.
- Nuevo atributo de entrada `data-lang` en el elemento raíz para declarar el idioma activo.
- Nueva familia de referencias `translations.{key}` resoluble en superficies textuales de nodos y en interpolación parcial `{{...}}`.
- Cadena de fallback: idioma activo → idioma por defecto (`es`) → nombre de la clave en desarrollo / string vacío en producción.
- Validación previa al render del bloque `translations`.
- Aplicable en desarrollo (vía `src/dev/config.json`) y en producción (vía `data-config`).

## Fuera de alcance

- `translations.*` en superficies de requests: `api.query`, `api.body`, `api.headers`, parámetros de acción de `button` o `form`.
- `translations.*` como referencia en `visibility.reference`.
- `translations.*` como origen de colecciones (`repeater.props.items.source`, `list`, `select`, `radioGroup`, `checkboxGroup`).
- Mensajes de validación de formulario traducibles.
- Cambio dinámico de idioma en tiempo de ejecución: `data-lang` se lee una sola vez al arrancar.
- Pluralización, formateo de fechas, números o expresiones de género.
- Carga lazy de traducciones por idioma.
- Theming ni variantes visuales asociadas al idioma.

## Requisitos funcionales

### Bloque `translations`

- La sección `translations` es opcional en la raíz del JSON.
- Su estructura es un objeto cuyas claves son strings arbitrarios (claves de traducción) y cuyos valores son objetos cuyas claves son slugs de idioma y cuyos valores son strings.

  ```json
  {
    "translations": {
      "confirmBtn": {
        "es": "Confirmar",
        "en": "Confirm"
      },
      "searchPlaceholder": {
        "es": "Busca aquí…",
        "en": "Search here…"
      }
    }
  }
  ```

- Si `translations` no está presente en el JSON, el runtime arranca y renderiza normalmente sin error.
- Si `translations` está presente pero vacío (`{}`), también es válido.

### Atributo `data-lang`

- El idioma activo se declara mediante el atributo `data-lang` en el elemento raíz, igual que `data-config` o `data-values`.
- El valor es un string que corresponde a un slug de idioma, por ejemplo `"es"`, `"en"`, `"ca"`.
- Si `data-lang` no está presente o su valor es vacío, el idioma activo es `"es"` por defecto.
- `data-lang` se lee una sola vez al arrancar el runtime; no es reactivo a cambios posteriores del atributo.

### Resolución de referencias `translations.*`

- El pattern `translations.{key}` es una nueva familia de referencias resoluble donde ya se admiten referencias completas en superficies textuales.
- El runtime resuelve `translations.confirmBtn` al valor `translations["confirmBtn"][idiomaActivo]`.
- La resolución sigue esta cadena de fallback en orden:
  1. `translations[key][idiomaActivo]` si existe.
  2. `translations[key]["es"]` si el idioma activo no es `"es"` y la clave existe en el idioma por defecto.
  3. En entorno de desarrollo: la propia clave como string (por ejemplo `"confirmBtn"`), para que el hueco sea obvio.
  4. En producción: string vacío.
- `translations.{key}` solo admite un único segmento después del namespace; rutas anidadas como `translations.group.key` son inválidas.

### Superficies donde aplica `translations.*`

`translations.*` puede usarse en todas las superficies textuales visibles donde actualmente se admiten referencias completas:

- `heading.props.text`
- `paragraph.props.text`
- elementos de `list.props.items` cuando sean strings literales manuales
- `button.props.label`
- `input.props.label`, `input.props.placeholder`
- `textarea.props.label`, `textarea.props.placeholder`
- `select.props.label`
- `radioGroup.props.label`
- `checkboxGroup.props.label`
- celdas string manuales de `table`
- `image.props.alt`
- cualquier posición de interpolación parcial `{{translations.key}}` en superficies que ya admiten `{{...}}`

`translations.*` queda fuera del catálogo de references en: requests, `visibility.reference`, orígenes de colección y `defaultValue` de campos de formulario.

### Validación previa al render

- El bloque `translations` se valida antes del render, igual que el resto del contrato.
- La validación rechaza valores no string en las hojas del objeto (el valor de cada entrada de idioma debe ser un string).
- La validación rechaza claves de idioma vacías.
- Una clave de traducción ausente en un idioma no es un error de validación: las claves pueden ser incompletas entre idiomas.
- Un `data-lang` que no coincide con ningún idioma declarado en `translations` no es un error de bootstrap; simplemente activa el fallback al idioma por defecto.

## Requisitos no funcionales

- La nueva familia `translations.*` se integra en `runtime-references/` siguiendo el mismo patrón que las familias existentes; no debe haber lógica de resolución dispersa en nodos visuales.
- La lectura de `data-lang` sigue el mismo patrón que `data-config` y `data-values` en `src/app/`.
- El bloque `translations` se valida desde `src/config/` antes de que el runtime lo consuma.
- El idioma activo debe estar accesible para el resolver de referencias sin acoplar los nodos visuales a la fuente del atributo.

## Criterios de aceptación

1. Un JSON sin `translations` arranca y renderiza sin error alguno.
2. Un JSON con `translations` válido arranca correctamente; sus claves son resolubles en props textuales.
3. Un prop `button.props.label: "translations.confirmBtn"` muestra `"Confirmar"` cuando `data-lang="es"` y `"Confirm"` cuando `data-lang="en"`.
4. Si `data-lang` no está presente, el runtime usa `"es"` y resuelve correctamente las claves del idioma español.
5. Si `data-lang="fr"` y la clave solo tiene `"es"` e `"en"`, el runtime devuelve el valor de `"es"` (fallback al idioma por defecto).
6. Si la clave no existe en ningún idioma, en desarrollo se renderiza el nombre de la clave; en producción se renderiza string vacío.
7. `{{translations.searchPlaceholder}}` dentro de un `heading.props.text` interpolado resuelve al valor correspondiente al idioma activo.
8. Una entrada `translations` con un valor no string (por ejemplo `{ "es": 42 }`) es rechazada en validación con un error comprensible.
9. `translations.group.key` (ruta de dos segmentos) no se reconoce como referencia válida y se trata como string literal.
10. `translations.*` en `api.body` se trata como string literal, no como referencia.

## Casos límite

- `data-lang=""` equivale a idioma no declarado: se usa `"es"` como defecto.
- `data-lang="es"` con clave que no tiene entrada `"es"`: se salta al paso 3 del fallback (clave en dev, vacío en prod).
- `translations: {}` es válido; cualquier referencia `translations.*` activa el fallback completo.
- Clave con caracteres especiales como puntos en el nombre (`"search.term"`) se puede declarar como clave de diccionario, pero la referencia `translations.search.term` no es soportada (dos segmentos); el acceso a esa clave queda fuera de alcance.
- Si `translations` está presente pero `data-lang` no, el idioma activo sigue siendo `"es"`.

## Áreas de producto afectadas

- Contrato JSON: nuevo bloque raíz `translations`.
- Runtime: nueva familia de referencias `translations.*`.
- Bootstrap: lectura de `data-lang` del elemento raíz.
- Desarrollo local: `data-lang` en el elemento raíz del entorno dev funciona igual que en producción.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/config/structure.md` — nuevo bloque raíz `translations`.
- `ai-workflow/docs/app-features/references/reference-resolution.md` — nueva familia `translations.*`, superficies admitidas y fronteras.
- `ai-workflow/docs/app-features/development/local-config.md` — mención de `data-lang`.
- `ai-workflow/docs/current-state.md` — actualizar área de referencias si cambia su estado.

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones de producto quedaron cerradas en la exploración previa.
