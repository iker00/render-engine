# Reglas de testing

## Objetivo
Usar tests para validar comportamiento importante del producto, no solo para cubrir líneas.

## Umbral mínimo de cobertura
- El repositorio exige un mínimo global del 80% de cobertura en `functions`, `lines` y `statements` sobre el código de `src/`.
- `pnpm test` debe fallar automáticamente cuando cualquiera de esos umbrales quede por debajo del 80%.
- `pnpm test:watch` puede usarse para iterar sin cobertura continua, pero el cambio no debe darse por válido hasta pasar `pnpm test`.

## Principios generales
- Probar comportamiento observable.
- Priorizar tests sobre reglas de negocio, casos de uso y flujos críticos.
- Evitar tests frágiles acoplados a detalles internos de implementación.
- Mantener cada test enfocado en una intención clara.

## Qué debe tener tests
- validaciones críticas de entrada
- reglas de negocio principales
- flujos de creación y actualización relevantes
- transformaciones de datos importantes
- estado derivado o configuración editable por usuario
- integraciones o importaciones relevantes para el producto

## Unit tests
Usarlos para:
- funciones de transformación de datos
- reglas de negocio
- construcción de estado derivado o filtros sugeridos
- validaciones
- hooks, stores o casos de uso con dependencias aisladas

Un unit test debe:
- tener entradas pequeñas y explícitas
- cubrir un único comportamiento principal
- ser rápido y determinista

## Integration tests
Usarlos para:
- servicios, adaptadores o capas de integración
- composición entre varias capas del flujo
- flujos donde intervienen varias capas
- operaciones de creación y actualización importantes
- importación o sincronización de datos desde fuentes externas o archivos locales

Un integration test debe comprobar:
- entrada
- efecto persistido o respuesta
- errores esperados cuando aplique

## Qué no hacer
- No probar detalles visuales triviales con tests complejos.
- No snapshotear pantallas enteras sin motivo claro.
- No escribir tests que dependan del orden incidental de resultados si ese orden no es parte del contrato.
- No duplicar el mismo caso en unit e integration test sin aportar cobertura distinta.
- No usar mocks tan amplios que el test deje de verificar comportamiento real.

## Reglas para automatismos y sugerencias
- Probar que los filtros sugeridos aparecen cuando existe contexto suficiente.
- Probar que el usuario puede desactivar esos filtros.
- Probar que la selección manual sigue siendo posible aunque una sugerencia no exista.
- Probar que cualquier carga o sugerencia automática solo cubre los casos soportados explícitamente.

## Reglas para contenido editable por usuario
- Probar creación de contenido personalizado cuando la aplicación lo permita.
- Probar edición y eliminación cuando formen parte del flujo soportado.
- Probar que el contenido personalizado aparece en los flujos donde debe estar disponible.
- Probar que el origen o tipo del contenido se conserva correctamente si forma parte del contrato.

## Reglas para importación
- Probar transformación y normalización de archivos de entrada.
- Probar que el comando o flujo de importación soportado carga datos válidos en el destino previsto.
- Probar que una entrada inválida produce errores diagnósticos útiles.

## Calidad de los tests
- Los nombres de test deben describir el comportamiento esperado.
- Los datos de test deben ser pequeños y legibles.
- Cada test debe dejar claro qué prepara, qué ejecuta y qué verifica.
- Si un test requiere demasiada preparación, crear builders o fixtures simples.

## Organización de ficheros de test

### Estructura de carpetas
Los tests viven en `src/tests/` organizado en subcarpetas temáticas:

```
src/tests/
├── setup.ts                    — configuración global de Vitest (no mover)
├── app/                        — bootstrap y shell de la aplicación
├── config-validation/          — validación de la config en tiempo de carga
├── layout-renderer/            — renderizado de nodos del layout
├── runtime-state/              — store de estado compartido en runtime
├── runtime/                    — comportamiento runtime por área funcional
└── dev-runtime/                — modo desarrollo (editor, drawer, bundle)
```

Añadir una nueva carpeta solo cuando aparezca un grupo temático claramente distinto de los existentes.

### Un fichero por área funcional
- Cada fichero de test debe cubrir un único dominio de comportamiento.
- No acumular tests de dominios distintos en un mismo fichero aunque compartan el módulo fuente.

### Nombrado
- Formato: `<módulo>-<área>.test.ts` o `<módulo>-<área>.test.tsx`.
- Ejemplos: `runtime-config-validation-api.test.ts`, `layout-renderer-table.test.tsx`, `runtime-state-forms.test.tsx`.
- El área debe ser suficientemente específica para que el nombre del fichero describa qué comportamiento valida sin necesidad de abrirlo.
- Los helpers compartidos dentro de una carpeta se llaman simplemente `helpers.ts` o `helpers.tsx`.

### Imports en ficheros de test
Los ficheros de test están un nivel más profundo que `src/tests/`, por lo que los imports a código fuente usan `../../`:
- Código fuente: `import { Foo } from '../../runtime/foo'`
- Helper de la misma carpeta: `import { bar } from './helpers'`
- Mock con ruta relativa: `vi.mock('../../runtime/foo', ...)`

### Reuso antes de inventar
Antes de crear un harness, helper o fixture nuevo en una carpeta, revisar los `*.test.ts(x)` existentes de esa carpeta y reusar el patrón ya establecido. La duplicación de utilidades de test es una causa recurrente de divergencia entre ficheros y rompe el principio de "un fichero por área funcional".

### Cuándo dividir un fichero existente
- Cuando supere ~500 líneas y agrupe más de un dominio funcional.
- Cuando tenga múltiples `describe` de alto nivel que puedan leerse de forma independiente.
- Cuando añadir un nuevo test requiera leer contexto de un dominio distinto para entender el fichero.
- No dividir si el fichero es un único flujo cohesionado aunque sea largo.

### Cómo dividir
1. Identificar los `describe` o grupos temáticos naturales.
2. Extraer cada grupo a un fichero con nombre `<módulo>-<área>.test.ts` dentro de la carpeta correspondiente.
3. Mover los imports y fixtures compartidos: si una fixture es usada por varios ficheros de la misma carpeta, extraerla a `helpers.ts` en esa carpeta.
4. Verificar que `pnpm test` pasa tras cada fichero extraído, no solo al final.
5. Actualizar `ai-workflow/docs/test-index.md` con los ficheros nuevos: una sola línea por fichero, con el módulo o comportamiento que cubre, sin enumerar casos. Comprobar el desfase con `ai-workflow/scripts/check-test-index.sh`.
