> Cuándo leer: cargar configuración en desarrollo, prioridad de `data-config`, errores de bootstrap, ejemplos locales con `api`/`preloads`, o la config de endpoints externos (`data-endpoints-config`) que consume el editor para Guardar/Traducciones.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../config/validation.md]], [[../auth/tokens.md]], [[dev-mode-editor.md]].

# Configuración local del runtime

## Objetivo
Permitir iterar sobre la configuración JSON sin depender del backend real.

## Soporte vigente
- un `config.json` local versionado para cargar la configuración en desarrollo
- una frontera de arranque que también pueda leer `data-config` cuando el contenedor lo aporte
- un `data-values.json` local para pre-cargar datos iniciales en queries sin necesidad de API real
- un atributo `data-lang` en el elemento raíz para declarar el idioma activo (default: `"es"`), que se propaga al resolver referencias `translations.*`
- un `endpoints-config.json` local, análogo al resto, para declarar la config de endpoints externos que consume el editor de desarrollo (ver [[#Config de endpoints externos]])

## Qué permite
- cargar una configuración inicial desde `src/dev/config.json` en desarrollo
- priorizar `data-config` cuando exista en el elemento root
- pre-cargar datos iniciales en queries desde `src/dev/data-values.json` en desarrollo, sin necesidad de API real
- detectar errores de bootstrap con mensajes comprensibles cuando el JSON sea inválido o falte la fuente esperada
- mantener la misma frontera pública de errores aunque la validación interna del runtime ya se apoye en `Zod`
- facilitar el arranque y la validación inicial del runtime antes de implementar capacidades funcionales
- permitir ejemplos locales que ya ejerciten `api` y `preloads` sin depender de un backend real, por ejemplo mediante recursos estáticos servidos por Vite desde `public/`
- declarar, con el mismo patrón atributo-de-host/fichero-local, la config de endpoints externos que usa el editor de desarrollo para guardar el config activo y sincronizar Traducciones (ver [[#Config de endpoints externos]])

## Config de endpoints externos

Bloque de configuración, independiente de `config.json`, que declara los endpoints de backend externo que
consume el editor de desarrollo: el botón "Guardar" de la barra flotante y las dos acciones de sincronización de
la sección Traducciones (ver [[dev-mode-editor.md#Sección Traducciones (dominio de configuración)]] y
[[dev-mode-editor.md#Botón Guardar]]).

- **Origen**: mismo patrón de prioridad que `data-config` — si el elemento raíz declara el atributo
  `data-endpoints-config`, se usa ese JSON; si no está presente, se usa `src/dev/endpoints-config.json` como
  respaldo versionado; sin ninguno de los dos, la config de endpoints se considera no declarada.
- **Invalidez**: un JSON sintácticamente inválido, o que no cumpla el shape mínimo esperado, se trata exactamente
  igual que ausente — todas las operaciones quedan sin declarar, sin bloquear el arranque del resto del editor ni
  del runtime.
- **Shape**: una `baseUrl` común, y un bloque `operations` con hasta tres claves independientes —
  `searchTexts`, `getTranslationsBatch` y `saveConfig` — cada una opcional por separado (0, 1, 2 o las 3 pueden
  estar declaradas a la vez). `searchTexts` y `getTranslationsBatch` declaran `path` y `tokenId`; `saveConfig`
  declara además los tres identificadores de negocio que exige la operación de guardado:
  `idGestion`, `idSeccion` e `idObjetoOcurrencia` (enteros).
- **`tokenId`**: referencia a un token ya declarado en `tokens.*` del config activo (ver
  [[../auth/tokens.md]]); no es una interpolación `{{tokens.*}}` nueva, solo un lookup que hace el editor para
  resolver el `Authorization: Bearer` de cada llamada.
- **`path` de `searchTexts`/`getTranslationsBatch`**: se declara en el shape por paridad con `saveConfig` y por
  si un despliegue futuro lo necesita, pero hoy no participa en la URL que llaman esas dos operaciones — Buscar
  y Refrescar todo solo toman de la config de endpoints la `baseUrl` y el token resuelto por `tokenId`; la ruta
  concreta de cada una sigue fija en el proveedor de Traducciones. El `path` de `saveConfig`, en cambio, sí se usa
  íntegro para construir la URL de guardado.
- **Habilitación independiente por operación**: cada una de las tres se resuelve por separado contra el config
  activo; es válido declarar solo la de guardado, solo las dos de Traducciones, o cualquier combinación. Sin la
  operación declarada, o con un `tokenId` que no resuelve contra ningún `tokens.*` del config activo, el control
  correspondiente en el editor queda deshabilitado con un mensaje explicando la causa.

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
- la config de endpoints externos no tiene panel de edición propio; se declara solo vía atributo de host o
  fichero local, igual que `config.json`
