# Guía completa: desarrollo local con mocks y paso a producción

## Índice

1. [Por qué existe este sistema](#por-qué-existe-este-sistema)
2. [Estructura de ficheros](#estructura-de-ficheros)
3. [Cómo funciona internamente](#cómo-funciona-internamente)
4. [Uso diario: operaciones habituales](#uso-diario-operaciones-habituales)
5. [Navegación local entre pantallas](#navegación-local-entre-pantallas)
6. [Paso a producción: checklist completo](#paso-a-producción-checklist-completo)
7. [Cambios realizados en el motor](#cambios-realizados-en-el-motor)
8. [Preguntas frecuentes y gotchas](#preguntas-frecuentes-y-gotchas)

---

## Por qué existe este sistema

El render engine es un motor de renderizado de layouts declarativos que ejecuta llamadas a una API real. En desarrollo local, esa API no siempre está disponible (tokens caducados, servidor inaccesible, VPN necesaria, etc.).

Este sistema permite:
- Trabajar completamente offline con datos hardcodeados verosímiles
- Simular la navegación entre pantallas del portal sin necesidad de la integración real
- Mantener los ficheros de configuración de cada pantalla exactamente como irían a producción
- Añadir nuevas pantallas con mínimo esfuerzo (soltar ficheros en carpetas)

---

## Estructura de ficheros

```
src/dev/
  tests-config/                         ← configs de pantalla (versión dev, ver § diferencias)
    ADE_PantallaInicio.json
    ADE_BuscarPersona.json
    ADE_ObtenerFichaPersona.json
    (añadir aquí cada nueva pantalla)
  mocks/                                ← un fichero JSON por operación API
    obtenerPermisosPantallaInicio.json
    obtenerHistorialHechos.json
    obtenerHistorialPersonas.json
    buscarPersona.json
    obtenerFichaPersona.json
    (añadir aquí cada nueva operación)
  dev-settings.json                     ← página de arranque del dev local
  dev-config.ts                         ← orquestador: auto-fusiona configs y mocks
  data-values.json                      ← pre-carga de datos en queries (sin cambios)
  config.json                           ← legacy, ya no se usa como entrada principal
```

### Convención clave

> **El nombre del fichero en `mocks/` debe coincidir exactamente con el nombre de la operación en `api.*` del config.**

`mocks/obtenerFichaPersona.json` → se inyecta como `mockResponse` en `api.obtenerFichaPersona`.
No hay configuración adicional: solo naming convention.

---

## Cómo funciona internamente

### 1. `dev-config.ts` — el orquestador

Usa `import.meta.glob` de Vite para auto-descubrir todos los ficheros de ambas carpetas:

```
tests-config/*.json  →  se fusionan sus secciones api + pages
mocks/*.json         →  se indexan por nombre de fichero (= nombre de operación)
```

Para cada operación que tenga un fichero mock correspondiente, se inyecta automáticamente la propiedad `mockResponse` con el contenido del JSON mock. El resultado es un único objeto de configuración que el `DevRuntime` consume.

### 2. El campo `mockResponse` en el motor

Se añadió `mockResponse?: unknown` a `RuntimeApiOperation`. Cuando esta propiedad existe y el motor está en modo desarrollo (`import.meta.env.DEV`), `executeBuiltRuntimeApiRequest` devuelve directamente los datos del mock **sin realizar ninguna llamada de red**.

La guardia `import.meta.env.DEV` garantiza que en el bundle de producción (`vite build`) ese bloque es eliminado por tree-shaking: no existe en el código final.

### 3. Flujo completo en dev

```
Vite dev server arranca
  → dev-runtime.tsx importa dev-config.ts
  → dev-config.ts auto-descubre tests-config/*.json y mocks/*.json
  → fusiona: inyecta mockResponse en cada operación que tenga mock
  → el config fusionado llega al RuntimeStateProvider
  → al ejecutar una operación: buildRuntimeApiRequest → executeBuiltRuntimeApiRequest
  → si mockResponse existe + DEV mode → devuelve datos mock sin llamada HTTP
  → el layout se renderiza con datos reales de los ficheros mock
```

### 4. HMR (recarga en caliente)

Cuando editas cualquier fichero en `tests-config/` o `mocks/`, Vite propaga el cambio a través de `dev-config.ts` y el `DevRuntime` recibe el config actualizado, aplicando la migración de estado estándar del motor.

---

## Uso diario: operaciones habituales

### Añadir una pantalla nueva

1. Crear `src/dev/tests-config/ADE_NuevaPantalla.json` con la estructura de config (sección `api` + sección `pages`)
2. Si tiene operaciones API, crear `src/dev/mocks/{nombreOperacion}.json` por cada una
3. Si la pantalla tiene links a otras pantallas que existen localmente, usar `action.navigateTo` (ver § navegación)
4. Si quiere que sea la primera en cargar, editar `dev-settings.json`

**No hay que tocar `dev-config.ts` ni ningún otro fichero.**

### Añadir un mock para una operación existente

Crear `src/dev/mocks/{nombreExactoOperacion}.json` con los datos de respuesta. En el próximo HMR o reinicio, el mock se aplica automáticamente.

### Cambiar la página de arranque

Editar `src/dev/dev-settings.json`:

```json
{ "initialPage": "buscar-persona" }
```

### Actualizar datos mock

Editar el fichero JSON correspondiente en `mocks/`. El HMR lo propaga automáticamente.

### Ver el config fusionado completo

El editor en vivo del DevRuntime (botón flotante esquina inferior derecha, o `Ctrl+Shift+J`) muestra el config fusionado completo tal como está activo.

---

## Navegación local entre pantallas

En producción, los links entre pantallas del portal usan URLs del portal (`<PORTAL_URL_BUSCAR_PERSONA>`, etc.). En desarrollo local no existe ese portal, por lo que los configs en `tests-config/` usan **navegación interna** del engine.

### Diferencia entre config de producción y config en tests-config

| Situación | Config de producción | Config en tests-config |
|-----------|---------------------|------------------------|
| Link a otra pantalla del portal | `"href": "<PORTAL_URL_BUSCAR_PERSONA>"` | `"action": { "type": "navigateTo", "pageId": "buscar-persona" }` |
| Link a pantalla no implementada localmente | — | `"href": "#"` |
| Token JWT | Token real vigente | `"Bearer TOKEN"` (ignorado por mockResponse) |

### Sintaxis `navigateTo` dentro de `props`

El campo `action` va **dentro** de `props` en un link:

```json
{
  "type": "link",
  "props": {
    "label": "Ver ficha",
    "action": {
      "type": "navigateTo",
      "pageId": "ficha-persona",
      "params": {
        "personaId": "item.Id"
      }
    }
  }
}
```

Para pasar parámetros desde un repeater, usar la referencia sin llaves (`"item.Id"`, no `"{{item.Id}}"`).

### Navegación de vuelta

El botón "Volver" usa `action: { "type": "goBack" }`, que funciona igual en dev y en producción.

---

## Paso a producción: checklist completo

Cuando el widget esté listo para integrarse en el portal real, hay que asegurarse de los siguientes puntos. **Nada de lo que está en `src/dev/` se incluye en el bundle de producción** (`vite build` no importa la carpeta `dev/` desde código de producción). El único riesgo es si la config que sirve el portal tiene campos no deseados.

### Fichero de config que entrega el portal

El portal sirve la config de cada widget por separado. Ese fichero es **diferente** a los ficheros en `tests-config/`. Debe:

- [ ] **No tener `mockResponse`** en ninguna operación API. Si se cuela, el engine lo ignoraría en producción (la guardia `import.meta.env.DEV` lo desactiva), pero es buena práctica no incluirlo.
- [ ] **Usar URLs reales** en los links (`href: "<PORTAL_URL_*>"` que el portal sustituye con URLs reales, o directamente la URL).
- [ ] **Incluir un token JWT válido** en los headers de cada operación (o usar el mecanismo de token dinámico del engine si está implementado).
- [ ] **Apuntar al endpoint correcto** (producción, no pre).
- [ ] **Tener el `initialPage` correcto** para ese widget concreto.

### Diferencias entre tests-config y config de producción

```
tests-config/ADE_PantallaInicio.json (dev)    →    config producción de PantallaInicio
─────────────────────────────────────────────────────────────────────────────────────
mockResponse: ...                              →    (no existe)
"href": "#"  (para páginas sin impl. local)   →    href real del portal
action.navigateTo para páginas locales         →    href del portal o acción del portal
"Bearer TOKEN"                                 →    token real o mecanismo de refresh
```

### Vite proxy en producción

El `vite.config.ts` solo aplica en desarrollo. En producción, el bundle se sirve directamente y las llamadas van a la URL configurada en el `endpoint` de cada operación. Asegurarse de que:

- [ ] Los endpoints en el config de producción son URLs absolutas correctas o el portal las resuelve
- [ ] No hay dependencia de Vite proxy en los URLs de los endpoints

### El campo `mockResponse` es inerte en producción

Aunque un config de producción llevara `mockResponse` por error, el código en el engine tiene:

```typescript
if (import.meta.env.DEV && request.operation.mockResponse !== undefined) {
  return { status: 'success', data: request.operation.mockResponse }
}
```

`import.meta.env.DEV` es `false` en builds de producción, por lo que nunca se ejecutaría ese bloque. Aun así, no incluir `mockResponse` en configs de producción es la práctica correcta.

---

## Cambios realizados en el motor

Estos cambios son parte del motor y permanentes. No requieren reversión al pasar a producción.

### `src/config/runtime-config-types.ts`

Añadido campo opcional a `RuntimeApiOperation`:

```typescript
export interface RuntimeApiOperation extends RuntimeApiRequestParams {
  method: RuntimeApiMethod
  endpoint: string
  mockResponse?: unknown    // ← nuevo
  // ...
}
```

### `src/config/runtime-config-zod.ts`

Añadido al schema de validación para que Zod no lo elimine con `.strip()`:

```typescript
export const runtimeApiOperationShellSchema = z
  .object({
    method: z.enum(supportedApiMethods),
    endpoint: nonEmptyStringSchema,
    mockResponse: z.unknown().optional(),    // ← nuevo
    // ...
  })
  .strip()
```

### `src/queries/runtime-api-executor.ts`

Intercepción antes del fetch, solo activa en modo dev:

```typescript
export async function executeBuiltRuntimeApiRequest({ request, fetch }) {
  if (import.meta.env.DEV && request.operation.mockResponse !== undefined) {
    return { status: 'success', data: request.operation.mockResponse }
  }
  // ... resto del fetch normal
}
```

### `src/dev-runtime/dev-runtime.tsx`

Cambiado el import del config de entrada:

```typescript
// Antes:
import devConfigJson from '../dev/config.json'

// Después:
import devConfigJson from '../dev/dev-config'
```

Y actualizado el listener HMR correspondiente.

---

## Preguntas frecuentes y gotchas

**¿Qué pasa si una operación no tiene fichero mock?**
Se usa tal cual está en el config — hará la llamada HTTP real. Si el servidor no está disponible, el query quedará en estado `error` y los `queryStateFeedback` de `error` se mostrarán.

**¿Puedo tener mocks solo para algunas operaciones y dejar otras llamar a la API real?**
Sí. Solamente se inyecta `mockResponse` en las operaciones que tienen fichero mock. Las demás hacen la llamada HTTP normal.

**¿El HMR funciona al editar un fichero de mock?**
Sí. Vite propaga el cambio a través de `dev-config.ts` y el DevRuntime recibe el nuevo config. El estado de navegación y formularios se migra automáticamente.

**¿Puedo usar el editor en vivo del drawer con este sistema?**
Sí. El editor muestra el config fusionado completo (con `mockResponse` incluido). Los cambios aplicados desde el editor tienen el mismo efecto. Recuerda que los cambios en el editor no persisten entre sesiones.

**¿El mock funciona para operaciones que se lanzan desde un botón de formulario?**
Sí. El `mockResponse` se aplica en el momento de ejecutar la operación, independientemente de cómo se lance (preload, acción de botón, submit de formulario).

**¿El orden de las páginas en el merge importa?**
El `initialPage` en `dev-settings.json` controla cuál se muestra primero. El orden en `pages[]` es irrelevante para la navegación: las páginas se identifican por `id`.

**¿Puede haber conflicto de nombres de operación entre distintos configs?**
Si dos ficheros en `tests-config/` definen la misma clave en `api`, el último en orden alfabético gana (comportamiento de `Object.assign`). Evitar nombres duplicados de operaciones entre distintas pantallas.

**¿Debo versionar los ficheros en `mocks/` y `tests-config/`?**
Sí, forman parte del proyecto y son necesarios para que el dev local funcione. Commitearlos es la práctica correcta.
