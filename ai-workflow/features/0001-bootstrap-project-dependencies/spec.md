# Spec: Bootstrap project dependencies

## Objetivo
Dejar el repositorio en un estado en el que una persona del equipo pueda instalar las dependencias del proyecto de forma reproducible, arrancar el entorno local esperado y ejecutar las validaciones base sin depender de conocimiento oral ni de pasos implícitos.

## Alcance
- Definir el arranque inicial mínimo que debe existir para que el proyecto pueda instalar dependencias con `pnpm`.
- Dejar claro qué artefactos de proyecto deben estar presentes para que la instalación sea consistente en una máquina limpia.
- Alinear la instalación de dependencias con el flujo de desarrollo local descrito en la documentación vigente.
- Asegurar que, tras la instalación, exista una forma verificable de comprobar que el bootstrap técnico quedó operativo.

## Fuera de alcance
- Implementar el runtime declarativo completo de la aplicación.
- Resolver integración real con backend.
- Añadir capacidades funcionales de producto como navegación, formularios o queries más allá de lo necesario para que el proyecto arranque.
- Diseñar un sistema de gestión de versiones o dependencias compartidas entre varios paquetes si el proyecto sigue siendo de un solo frontend.

## Requisitos funcionales
- El proyecto debe exponer una definición explícita y única de sus dependencias instalables para desarrollo local.
- La instalación debe poder ejecutarse en una copia limpia del repositorio siguiendo un flujo documentado y sin pasos manuales ocultos.
- El resultado de la instalación debe dejar disponible el arranque local esperado del proyecto.
- El proyecto debe ofrecer una forma explícita de ejecutar las validaciones base posteriores a la instalación, al menos para comprobar arranque, lint y tests básicos.
- Si falta un prerrequisito de entorno soportado, el proyecto debe indicarlo de forma clara para que el bloqueo sea entendible.
- La documentación de onboarding debe seguir siendo coherente con el comportamiento real del bootstrap resultante.

## Requisitos no funcionales
- La instalación debe ser reproducible entre máquinas de desarrollo compatibles.
- El flujo debe minimizar ambigüedad sobre versiones y herramientas requeridas.
- El bootstrap inicial no debe introducir dependencias o pasos pensados para capacidades todavía fuera de la v1 documentada.
- El resultado debe ser mantenible por el equipo sin depender de configuraciones locales no versionadas.

## Criterios de aceptación
- En una máquina con una versión LTS compatible de Node.js y `pnpm`, una persona puede clonar el repositorio, instalar dependencias y obtener un resultado consistente sin pasos adicionales no documentados.
- Tras la instalación, existe un comando de arranque local que inicia la aplicación en el modo de desarrollo esperado por el proyecto.
- Tras la instalación, existen comandos explícitos para ejecutar al menos lint y tests básicos, y forman parte del flujo documentado de verificación rápida.
- La documentación del proyecto indica con claridad los prerrequisitos mínimos y el orden de arranque inicial.
- Si el repositorio todavía no soporta backend real, el flujo de arranque deja disponible el modo local de trabajo sin backend descrito por la documentación del proyecto.

## Casos límite
- Primera instalación en un repositorio sin `node_modules`.
- Reinstalación después de borrar artefactos locales.
- Ejecución con una versión de Node.js no soportada.
- Diferencias entre instalación limpia y reinstalación cuando exista fichero de lock.
- Falta temporal de conectividad o fallo del registro de paquetes durante la instalación.

## Riesgos o preguntas abiertas
- La petición original habla de "instalar todas las dependencias", pero el repositorio todavía no contiene el manifiesto del proyecto ni scripts de arranque; la implementación deberá concretar si esta feature incluye también crear ese bootstrap técnico inicial.
- Queda por decidir el conjunto mínimo exacto de herramientas de validación que debe existir en este primer arranque para cumplir el estándar del repositorio sin sobredimensionar la v1.
- Si durante la planificación aparece la necesidad de varios entornos o paquetes, podría crecer el alcance respecto al supuesto actual de un único frontend.

## Áreas de producto afectadas
- Flujo de desarrollo local
- Onboarding técnico del proyecto
- Base operativa para futuras features del runtime

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/onboarding.md`
- `README.md`
