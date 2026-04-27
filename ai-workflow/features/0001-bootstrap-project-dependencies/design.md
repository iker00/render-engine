# Design: Feature 0001 - bootstrap-project-dependencies

## Contexto
El repositorio solo contiene documentación de producto y workflow. No existe todavía un `package.json`, lockfile, configuración de `Vite`, aplicación React inicial ni infraestructura de lint o tests. La feature 0001 debe crear una base técnica reproducible para que el equipo pueda instalar dependencias con `pnpm`, arrancar el frontend local y validar el bootstrap sin depender de backend real ni de conocimiento oral.

La complejidad no está en el dominio del producto, sino en fijar varias decisiones técnicas que hoy admiten implementaciones divergentes: estructura de paquete único o monorepo, nivel mínimo del scaffold inicial, estrategia de carga de configuración en desarrollo y conjunto exacto de validaciones base. Sin estas decisiones previas, dos agentes distintos podrían producir bootstraps incompatibles.

## Objetivos / No objetivos

### Objetivos
- Definir un bootstrap de frontend de paquete único en la raíz del repositorio.
- Hacer explícitos los prerrequisitos de entorno y los scripts base de trabajo.
- Permitir `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint` y `pnpm test` como contrato inicial del repositorio.
- Dejar un shell de aplicación mínimo que arranque sin backend real.
- Introducir una frontera explícita para cargar configuración desde `src/dev/config.json` en desarrollo y desde `data-config` cuando exista integración real.

### No objetivos
- Implementar el runtime declarativo descrito en la documentación de producto.
- Implementar todavía el panel editable de desarrollo.
- Validar todavía el contrato funcional completo del JSON con `Zod`.
- Resolver integración real con backend, navegación, formularios o queries.
- Convertir el repositorio en monorepo o introducir paquetes compartidos prematuros.

## Decisiones
- La feature se implementará como una aplicación única en la raíz del repositorio. No se introducirá `pnpm-workspace.yaml` ni separación por paquetes en esta fase.
- El bootstrap debe usar el stack ya fijado por la documentación del proyecto: `Vite`, `React`, `Tailwind CSS` y `pnpm`. Para reducir ambigüedad entre agentes, la base de código se planifica con TypeScript y tests con `Vitest` + `Testing Library`.
- El contrato de entorno debe quedar versionado con un fichero de versión de Node y con restricciones equivalentes en el manifiesto (`engines` y/o `packageManager`) para evitar instalaciones implícitas con versiones no alineadas.
- El primer arranque debe exponer un shell mínimo de aplicación, no un runtime funcional. Ese shell solo necesita demostrar que el scaffold está vivo, que el bundle compila y que existe una fuente de configuración conectada al arranque.
- La carga de configuración debe quedar encapsulada en una frontera de bootstrap (`app/bootstrap` o equivalente). En desarrollo, la fuente primaria será un `src/dev/config.json` versionado. En producción o integración futura, la misma frontera debe poder leer `data-config` desde el nodo root.
- Cuando la configuración falte o no pueda parsearse, el bootstrap debe mostrar un estado claro y acotado al arranque. No debe inventar lógica del runtime ni ocultar el problema con un error genérico.
- La validación base del repositorio se limitará a `build`, `lint` y `test`, con umbral mínimo global del 80% sobre `src/` según el estándar del proyecto. No se añadirá e2e en esta feature.
- La documentación deberá quedar alineada con el alcance real del bootstrap: soporte de `config.json` sí, editor en vivo y validación completa del runtime no todavía.

## Riesgos y trade-offs
- Introducir TypeScript, lint y tests desde el inicio aumenta el número de archivos del scaffold, pero reduce divergencia futura y alinea mejor el estándar del repositorio con las próximas features.
- Añadir una frontera de carga de configuración en esta feature crea una pequeña pieza de runtime antes de tiempo, pero evita que futuras features acoplen el origen de datos directamente al árbol React.
- No implementar todavía el panel de desarrollo obliga a corregir la documentación vigente para no prometer capacidades inexistentes después del bootstrap.
- El lockfile quedará fijado por la primera instalación real. Eso aporta reproducibilidad, pero obliga a que la implementación ejecute `pnpm install` y revise el resultado versionado.

## Migración o despliegue
No aplica despliegue ni migración de datos. La feature solo introduce el bootstrap local del frontend y artefactos versionados de desarrollo.

## Preguntas abiertas
- La implementación deberá elegir una versión LTS concreta de Node.js y reflejarla de forma consistente en los archivos de entorno. La planificación no fija el número exacto, pero sí exige que quede un único contrato explícito.
