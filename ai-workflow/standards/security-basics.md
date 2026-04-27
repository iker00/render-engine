# Fundamentos de seguridad

## Objetivo
Reducir riesgos básicos de seguridad desde el inicio sin sobrediseñar el sistema.

## Principios generales
- Validar toda entrada externa.
- Aplicar el mínimo acceso necesario.
- No confiar en datos que vienen del cliente.
- Mantener separados los datos globales de la aplicación y los datos privados del usuario cuando corresponda.

## Acceso a datos
- Toda operación sobre recursos privados o contenido personalizado debe comprobar propiedad o permisos del usuario.
- No asumir que un `id` recibido desde cliente pertenece al usuario actual.
- Cualquier acceso a datos privados debe filtrar por usuario o por alcance autorizado.

## Validación de entrada
- Validar entradas en el punto donde entren al sistema.
- Restringir tamaños, formatos y campos esperados.
- Ignorar campos extra si no forman parte del contrato o rechazarlos explícitamente.

## Contenido personalizado
- Tratar cualquier contenido editable por usuario como datos no confiables hasta validarlos.
- Limitar longitud de textos y campos libres.
- Escapar o sanear correctamente cualquier contenido mostrado en UI si existe riesgo de render inseguro.

## Secretos y configuración
- No hardcodear secretos en código o documentación.
- Usar variables de entorno para credenciales y configuración sensible.
- No registrar secretos en logs.

## Integraciones y almacenamiento
- No construir consultas o peticiones inseguras con entrada directa del usuario.
- Preferir el uso del acceso a datos o almacenamiento estándar del proyecto y validaciones previas.
- Revisar con cuidado cualquier cambio de formato, migración o persistencia compartida.

## Archivos e imágenes
- Si en el futuro se soporta subida de imágenes o iconos, validar tipo, tamaño y origen.
- No asumir que un archivo subido es seguro por su extensión.

## Dependencias
- Evitar dependencias innecesarias.
- Mantener dependencias actualizadas cuando el proyecto esté en marcha.
- Revisar especialmente librerías que procesen entrada externa o archivos.

## Errores y exposición
- No devolver al cliente detalles internos de infraestructura.
- No exponer rutas internas, consultas o configuración sensible en mensajes de error.
