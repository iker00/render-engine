# Spec: 0067 — dev-mode enable in production

## Objetivo

Permitir que `DevRuntime` (editor Monaco en vivo) se active en entornos de producción cuando el elemento raíz del runtime contenga el atributo HTML `data-enable-dev-mode`, eliminando la dependencia exclusiva de `import.meta.env.DEV` como único gate de activación.

El sitio web que embebe el runtime decide si poner ese atributo en el HTML servido; el runtime lo detecta en bootstrap y actúa en consecuencia.

## Alcance

- Cambio en la lógica de arranque (`main.tsx`): añadir una segunda condición de activación de `DevRuntime` basada en la presencia del atributo `data-enable-dev-mode` en el elemento raíz.
- En producción, si el atributo está presente, `DevRuntime` se carga de forma lazy (igual que ya ocurre en desarrollo): Monaco y el wrapper solo se descargan si la condición se cumple en el momento del bootstrap.
- En desarrollo (`import.meta.env.DEV`), el comportamiento actual se preserva sin cambios.

## Fuera de alcance

- Cambios en el comportamiento interno de `DevRuntime`, el editor Monaco o el drawer.
- Persistencia de la configuración editada entre sesiones.
- Autenticación, control de acceso adicional o validación del valor del atributo.
- Activación dinámica tras el montaje (añadir el atributo desde DevTools después de cargar la página no tiene efecto).
- Cambios en la configuración de Vite ni en el proceso de build.
- Modo "solo lectura" del editor para producción; el editor funciona igual que en desarrollo.

## Requisitos funcionales

1. Si `import.meta.env.DEV` es `true`, `DevRuntime` se monta con independencia del atributo (comportamiento actual).
2. Si `import.meta.env.DEV` es `false` y el elemento raíz tiene el atributo `data-enable-dev-mode` (basta con su presencia; el valor es irrelevante), `DevRuntime` se monta en lugar de `App`.
3. Si `import.meta.env.DEV` es `false` y el atributo está ausente, `App` se monta como hoy.
4. El atributo se lee en el momento del bootstrap, antes del primer render de React. Modificarlo en DevTools después de montar no tiene ningún efecto.
5. La carga de `DevRuntime` (y Monaco) en producción es lazy: el chunk no se incluye en el bundle inicial y solo se descarga cuando la condición es verdadera.

## Requisitos no funcionales

1. El bundle inicial de producción no incluye el chunk de `DevRuntime`/Monaco cuando el atributo no está presente en el HTML servido.
2. La comprobación del atributo en bootstrap no introduce delay perceptible en el arranque.

## Criterios de aceptación

1. Build de producción con `data-enable-dev-mode` en el HTML → `DevRuntime` se carga; el editor es funcional.
2. Build de producción sin `data-enable-dev-mode` → `App` se renderiza; Monaco no aparece en las peticiones de red.
3. Build de desarrollo, atributo ausente → `DevRuntime` se carga (comportamiento actual preservado).
4. Build de desarrollo, atributo presente → `DevRuntime` se carga (sin cambio respecto al punto anterior).
5. Atributo añadido desde DevTools después de montar la página → el runtime no cambia de modo sin recargar.

## Casos límite

- Atributo con valor vacío (`data-enable-dev-mode=""`) → activa `DevRuntime` (solo se comprueba presencia).
- Atributo con cualquier valor de string → activa `DevRuntime`.
- Atributo ausente o `null` → no activa `DevRuntime`.
- Elemento raíz no encontrado en el momento del bootstrap → fallo de bootstrap con el mismo comportamiento existente, sin cambios.

## Áreas de producto afectadas

- Bootstrap del runtime (`main.tsx`).
- Documentación de modo desarrollo (`dev-mode-editor.md`, sección Activación).

## Riesgos o preguntas abiertas

Ninguno. La estructura de lazy-load ya existe en `main.tsx`; el cambio reduce a añadir la segunda condición y leer el atributo del elemento raíz antes del primer render.
