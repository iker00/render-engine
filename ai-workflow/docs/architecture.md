# Arquitectura del proyecto

## Objetivo de la arquitectura
Describir la arquitectura estable de la aplicación para que las features nuevas se apoyen en una estructura clara y no tengan que deducir desde cero cómo se separan render, estado, validación e integraciones.

## Módulos principales
- `app/`: arranque, composición raíz, shell inicial y carga de configuración desde `src/dev/config.json` o `data-config`.
- `tests/`: fixtures, helpers y tests del bootstrap actual.

## Módulos previstos para próximas features
- `runtime/`: interpretación de la configuración, navegación interna, ejecución de acciones y coordinación del estado compartido.
- `components/`: componentes visuales soportados por el renderer declarativo.
- `forms/`: estado de formularios, validación básica y resolución de valores por `formId.fieldId`.
- `queries/`: definición y ejecución de endpoints declarados, junto con estado `status/data/error`.
- `config/`: tipos y validación estructural del JSON soportado.
- `devtools/`: soporte de desarrollo local para cargar y editar configuración sin backend.
- `shared/`: utilidades, adaptadores y piezas reutilizables entre módulos.

## Principios estructurales
- Separar interpretación de configuración y presentación.
- Mantener la red y las llamadas API fuera de los componentes visuales.
- Resolver referencias declarativas en una capa explícita de runtime.
- Validar la configuración antes de intentar renderizarla.
- Tratar la navegación interna como estado de aplicación, no como routing del navegador en la primera versión.

## Decisiones estables iniciales
- El repositorio arranca como frontend de paquete único en la raíz.
- El contrato operativo base del proyecto es `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint` y `pnpm test`.
- La entrada de producción será `data-config` en el elemento root HTML.
- En desarrollo existe una fuente local versionada en `src/dev/config.json` para iterar sin backend.
- La validación de configuración usará `Zod` cuando el contrato funcional del runtime se implemente.
- Los errores de bootstrap de configuración deben mostrarse con diagnóstico claro.
