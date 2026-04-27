# Manejo de errores

## Objetivo
Gestionar errores de forma consistente para facilitar depuración, revisión y una experiencia de usuario predecible.

## Principios generales
- Diferenciar errores de entrada, negocio e infraestructura.
- No ocultar errores relevantes.
- Devolver mensajes útiles al usuario sin exponer detalles internos.
- Mantener detalle técnico suficiente en logs para poder diagnosticar.

## Tipos de error

### Error de validación
Se produce cuando la entrada no cumple el formato o los requisitos mínimos.

Ejemplos:
- falta un nombre obligatorio
- un campo no tiene el formato válido
- un identificador no existe en el formato esperado

### Error de negocio
Se produce cuando la operación no encaja con el estado actual del sistema.

Ejemplos:
- intentar actualizar un recurso inexistente
- añadir un elemento duplicado si el caso de uso no lo permite
- realizar una operación sobre un recurso sin permisos suficientes

### Error de infraestructura
Se produce por fallos externos o técnicos.

Ejemplos:
- error de red o de API
- fallo en la importación de datos
- error al guardar o recuperar estado externo

## Reglas de manejo
- Validar pronto en el borde del sistema.
- Traducir errores técnicos a respuestas coherentes.
- No lanzar mensajes ambiguos si el problema es conocido.
- No usar `catch` genéricos que devuelvan siempre el mismo error sin clasificar.

## Mensajes al usuario
- Deben ser cortos y comprensibles.
- No deben incluir trazas, SQL ni detalles internos.
- Deben explicar qué ha fallado y, si aplica, qué puede hacer el usuario.

## Logs de error
- Deben incluir contexto suficiente para depurar.
- Deben registrar tipo de error y operación afectada.
- No deben incluir secretos ni información sensible innecesaria.

## En puntos de entrada de la aplicación
- Mapear errores de validación a respuestas de entrada inválida o feedback de formulario.
- Mapear errores de negocio a respuestas coherentes con la operación.
- Reservar los errores internos para fallos no esperados o de integración.

## En UI
- Mostrar feedback claro cuando una acción no se completa.
- No romper toda la pantalla por un error local recuperable.
- Ofrecer estado de carga, éxito y error cuando la interacción lo requiera.
