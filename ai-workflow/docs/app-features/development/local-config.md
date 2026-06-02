> Cuándo leer: cargar configuración en desarrollo, prioridad de `data-config`, errores de bootstrap, ejemplos locales con `api`/`preloads`.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../config/validation.md]].

# Configuración local del runtime

## Objetivo
Permitir iterar sobre la configuración JSON sin depender del backend real.

## Soporte vigente
- un `config.json` local versionado para cargar la configuración en desarrollo
- una frontera de arranque que también pueda leer `data-config` cuando el contenedor lo aporte
- un `data-values.json` local para pre-cargar datos iniciales en queries sin necesidad de API real

## Qué permite
- cargar una configuración inicial desde `src/dev/config.json` en desarrollo
- priorizar `data-config` cuando exista en el elemento root
- pre-cargar datos iniciales en queries desde `src/dev/data-values.json` en desarrollo, sin necesidad de API real
- detectar errores de bootstrap con mensajes comprensibles cuando el JSON sea inválido o falte la fuente esperada
- mantener la misma frontera pública de errores aunque la validación interna del runtime ya se apoye en `Zod`
- facilitar el arranque y la validación inicial del runtime antes de implementar capacidades funcionales
- permitir ejemplos locales que ya ejerciten `api` y `preloads` sin depender de un backend real, por ejemplo mediante recursos estáticos servidos por Vite desde `public/`

## Pre-carga de datos iniciales vía `data-values`

Además de cargar la configuración, el runtime permite pre-cargar datos en queries desde el mismo arranque:

- en desarrollo: si `src/dev/data-values.json` contiene un JSON de objeto plano con entradas `{ "queryName": data, ... }`, se cargan automáticamente como si ya hubiera respondido la API con esos valores
- en producción: si el elemento raíz tiene el atributo `data-values`, se usa en su lugar (misma precedencia que `data-config`)
- el formato es un JSON objeto donde cada clave es el nombre de una query y el valor es cualquier dato JSON válido (objeto, array, primitivo, null)
- cada entrada se carga en `queries.{queryName}` con estado `success` antes del primer render
- el dato pre-cargado es inmediatamente utilizable desde el layout, por ejemplo proyectado en listas o formularios, sin esperar ninguna llamada API
- una vez que se ejecuta una operación con el mismo nombre, el dato pre-cargado se reemplaza con el resultado real
- no es necesario que el nombre de la query exista en `api`; la pre-carga es independiente de la declaración de operaciones

## Valor funcional
- reduce la fricción para desarrollar el runtime
- permite validar el punto de entrada del runtime antes de integrarlo con backend
- deja una base estable para evolucionar el contrato de configuración sin acoplarlo todavía al árbol React completo

## Límites de v1
- no sustituye la integración real con backend
- no incluye herramientas avanzadas de inspección ni exportación del config
- el panel editable en vivo existe; véase [[dev-mode-editor.md]]
