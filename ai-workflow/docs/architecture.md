# Arquitectura del proyecto

## Objetivo de la arquitectura
Describir la arquitectura estable de la aplicación para que las features nuevas se apoyen en una estructura clara y no tengan que deducir desde cero cómo se separan render, estado, validación e integraciones.

## Módulos principales
- `app/`: arranque, composición raíz y carga de configuración desde desarrollo local o `data-config`.
- `runtime/`: interpretación de la configuración, navegación interna, ejecución de acciones y coordinación del estado compartido.
- `components/`: componentes visuales soportados por el renderer declarativo.
- `forms/`: estado de formularios, validación básica y resolución de valores por `formId.fieldId`.
- `queries/`: definición y ejecución de endpoints declarados, junto con estado `status/data/error`.
- `config/`: tipos y validación estructural del JSON soportado.
- `devtools/`: soporte de desarrollo local para cargar y editar configuración sin backend.
- `shared/`: utilidades, adaptadores y piezas reutilizables entre módulos.
- `tests/`: fixtures, helpers y soporte común de testing.

## Principios estructurales
- Separar interpretación de configuración y presentación.
- Mantener la red y las llamadas API fuera de los componentes visuales.
- Resolver referencias declarativas en una capa explícita de runtime.
- Validar la configuración antes de intentar renderizarla.
- Tratar la navegación interna como estado de aplicación, no como routing del navegador en la primera versión.

## Decisiones estables iniciales
- La entrada de producción será `data-config` en el elemento root HTML.
- En desarrollo existirá una fuente local editable para iterar sin backend.
- La validación de configuración usará `Zod`.
- Los errores de configuración deben mostrarse con diagnóstico claro en desarrollo y degradación controlada en producción.
