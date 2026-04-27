# Contexto global del proyecto

## ¿Qué es el proyecto?
Runtime frontend para construir interfaces configurables desde JSON. El backend define la estructura de páginas, layouts, formularios, eventos y endpoints, y el frontend la interpreta para renderizar la experiencia y coordinar sus interacciones.

## Objetivo del producto
Permitir que una aplicación legacy o de negocio pueda describir pantallas y flujos UI sin desarrollar una pantalla React específica para cada caso de uso. El resultado buscado es un renderer declarativo capaz de mostrar formularios, listados, estados de carga y navegación interna a partir de una configuración controlada por backend.

## Stack
- `pnpm`
- `Vite`
- `React`
- `Tailwind CSS`
- `Zod` para validación de configuración JSON en frontend
- testing basado en la infraestructura del repositorio con umbral mínimo global de cobertura del 80% sobre `src/`

## Restricciones globales
- La v1 es intencionadamente acotada: no busca resolver un motor UI completamente genérico.
- La configuración de producción llega en `data-config` desde backend.
- En desarrollo debe existir un mecanismo local para cargar y editar la configuración sin depender del backend.
- La navegación inicial es interna al renderer y no modifica la URL del navegador.
- La configuración usa referencias string por convención, por ejemplo `queries.searchUsers.data` o `forms.user.name`, para reducir fricción con el backend legacy.
- La primera versión deja fuera autenticación, permisos, subida de archivos, tablas avanzadas y plantillas de texto interpolado complejas.

## Propiedad de datos
- La configuración JSON es global para la instancia renderizada del componente.
- El estado de navegación es local al runtime.
- El estado de formularios es local al runtime y se organiza por `formId.fieldId`.
- El estado de cada query o acción API es global dentro del runtime para que varios bloques de la UI puedan reaccionar al mismo resultado.
- Los datos devueltos por backend se tratan como entrada no confiable hasta validarse o consumirse con defensas de render y manejo de errores.

## Cómo leer el contexto funcional detallado
El detalle funcional del producto vive en las fichas funcionales y en las features del workflow:

- [`./app-features/index.md`](./app-features/index.md)
- [`../features/index.md`](../features/index.md)
