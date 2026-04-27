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
