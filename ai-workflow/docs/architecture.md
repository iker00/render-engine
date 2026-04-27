# Arquitectura del proyecto

## Objetivo de la arquitectura
Describir la arquitectura estable de la aplicación para que las features nuevas se apoyen en una estructura clara y no tengan que deducir desde cero cómo se separan render, estado, validación e integraciones.

## Módulos principales
- `app/`: arranque, composición raíz, lectura de configuración desde `src/dev/config.json` o `data-config` y surface de errores visibles.
- `config/`: fachada pública del contrato, tipos del runtime config y validación estructural mínima del árbol `layout`.
- `runtime/`: renderer estático de layout, dispatcher central por tipo de nodo, piezas concretas por nodo soportado y composición de la página resuelta por `initialPage`.
- `tests/`: tests del bootstrap, validación de configuración y renderer visible.

## Estructura estable vigente

```txt
src/
  app/
    bootstrap/
  config/
    runtime-config.ts
    runtime-config-types.ts
    validate-runtime-config.ts
  runtime/
    layout-renderer.tsx
    layout-node-renderer.tsx
    runtime-node-styling.ts
    runtime-page.tsx
    nodes/
      container-layout-node.tsx
      heading-layout-node.tsx
      list-layout-node.tsx
      paragraph-layout-node.tsx
  tests/
```

Lectura operativa de esa estructura:
- `runtime-config.ts` mantiene una superficie pública austera para no acoplar consumidores a la organización interna.
- `validate-runtime-config.ts` concentra la validación previa al render y deja `config/` preparada para crecer sin mezclar contrato y lógica.
- `layout-renderer.tsx` conserva la responsabilidad de renderizar colecciones ordenadas de nodos.
- `layout-node-renderer.tsx` es el punto central de resolución `type -> pieza de render`.
- `runtime-node-styling.ts` concentra la convención visual base del runtime y la compatibilidad acotada para `gap` arbitrarios.
- `runtime/nodes/` materializa solo nodos con uso real inmediato, sin introducir subsistemas vacíos para capacidades futuras.

## Módulos previstos para próximas features
- `components/`: componentes visuales soportados por futuras ampliaciones del renderer declarativo.
- `forms/`: estado de formularios, validación básica y resolución de valores por `formId.fieldId`.
- `queries/`: definición y ejecución de endpoints declarados, junto con estado `status/data/error`.
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
- La configuración se valida antes de renderizar y falla con errores semánticos explícitos cuando `initialPage` o `layout` no cumplen el contrato soportado.
- La primera UI estable del runtime es un renderer estático para `container`, `heading`, `paragraph` y `list`.
- La organización interna del runtime separa contrato, validación, render de colecciones y render concreto por nodo sin cambiar el comportamiento observable.
- La presentación base de los nodos visibles del runtime se expresa con utilidades de `Tailwind`, con una excepción acotada basada en variable CSS para `container.props.gap` cuando llega un valor arbitrario.
- Los errores de bootstrap y validación deben ser diagnósticos en desarrollo; en producción, los errores marcados como solo de desarrollo degradan sin mensaje visible genérico.
