> Cuándo leer: cargar configuración en desarrollo, prioridad de `data-config`, errores de bootstrap, ejemplos locales con `api`/`preloads`.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../config/validation.md]].

# Configuración local del runtime

## Objetivo
Permitir iterar sobre la configuración JSON sin depender del backend real.

## Soporte vigente
- un `config.json` local versionado para cargar la configuración en desarrollo
- una frontera de arranque que también pueda leer `data-config` cuando el contenedor lo aporte

## Qué permite
- cargar una configuración inicial desde `src/dev/config.json` en desarrollo
- priorizar `data-config` cuando exista en el elemento root
- detectar errores de bootstrap con mensajes comprensibles cuando el JSON sea inválido o falte la fuente esperada
- mantener la misma frontera pública de errores aunque la validación interna del runtime ya se apoye en `Zod`
- facilitar el arranque y la validación inicial del runtime antes de implementar capacidades funcionales
- permitir ejemplos locales que ya ejerciten `api` y `preloads` sin depender de un backend real, por ejemplo mediante recursos estáticos servidos por Vite desde `public/`

## Valor funcional
- reduce la fricción para desarrollar el runtime
- permite validar el punto de entrada del runtime antes de integrarlo con backend
- deja una base estable para evolucionar el contrato de configuración sin acoplarlo todavía al árbol React completo

## Límites de v1
- no sustituye la integración real con backend
- no incluye todavía panel editable en vivo
- no incluye todavía herramientas avanzadas de inspección, edición en vivo o exportación del config
