# Onboarding local

## Estado actual
La implementación todavía no existe, pero este documento fija el arranque local esperado para la v1 y evita depender de conocimiento oral cuando se haga el bootstrap técnico.

## Requisitos
- versión LTS actual de Node.js
- `pnpm`
- variables de entorno solo si aparecen durante la integración real con backend
- no se requiere backend para la iteración inicial si se usa el `config.json` local de desarrollo

## Primer arranque
- instalar dependencias
- arrancar el entorno local con la configuración de desarrollo
- cargar una configuración JSON local
- abrir el panel de edición/inspección de config si está habilitado

## Verificación rápida
- comprobar que la aplicación levanta
- comprobar que el renderer valida la configuración
- comprobar que el panel de desarrollo refleja cambios en tiempo real
- comprobar que una página simple con preload, formulario y lista se renderiza correctamente
- comprobar que los tests básicos y el lint pasan

## Estructura inicial esperada
- `src/app/`
- `src/features/`
- `src/shared/`
- `src/tests/` o `tests/` según la organización final
- `src/dev/config.json` o ubicación equivalente para la configuración local
