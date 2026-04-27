# Estilo de código

## Objetivo
Mantener un código claro, predecible y fácil de modificar, priorizando la simplicidad sobre la abstracción prematura.

## Principios generales
- Escribir código orientado al dominio del producto.
- Evitar lógica innecesariamente genérica si solo existe un caso de uso real.
- Preferir claridad de lectura frente a ahorro de líneas.
- Mantener separadas UI, estado de aplicación, dominio e integraciones.

## Reglas de estilo
- Usar nombres descriptivos y específicos.
- Evitar funciones con múltiples responsabilidades.
- Evitar condicionales anidados si se pueden resolver con retornos tempranos.
- Extraer funciones cuando un bloque deje de ser legible, no por reflejo.
- No introducir helpers genéricos si todavía no hay una repetición real.

## Componentes UI
- Los componentes deben centrarse en presentación e interacción.
- No deben contener lógica de negocio relevante.
- La transformación de datos compleja debe ocurrir fuera del componente.
- Si un componente crece demasiado, separar vista y comportamiento.

## Casos de uso y servicios
- Cada caso de uso debe resolver una intención concreta del producto.
- Deben coordinar validación, estado, integraciones y reglas de negocio cuando aplique.
- No deben mezclar detalles de presentación.

## Estado e integraciones
- Encapsular acceso a red, almacenamiento, persistencia o APIs externas detrás de adaptadores o utilidades con intención clara.
- Evitar acceso directo a integración externa desde componentes o lógica de presentación cuando eso dificulte probar o reutilizar el flujo.
- Las integraciones deben devolver estructuras útiles para el caso de uso, no respuestas crudas sin intención.

## Dominio
- Modelar solo lo que el producto necesita hoy.
- No intentar reflejar un dominio más amplio que el comportamiento realmente soportado por el producto.
- Si una regla requiere demasiadas excepciones, dejarla fuera del automatismo y permitir edición manual.

## Buscadores y automatismos
- Los automatismos deben actuar como ayuda inicial.
- La lógica derivada debe ser explicable y trazable.
- No bloquear la edición manual salvo que exista una razón clara de integridad o consistencia.

## Comentarios
- Añadir comentarios solo cuando expliquen una decisión no obvia.
- No comentar código evidente.
- Si un bloque necesita demasiados comentarios, probablemente necesita mejor estructura.

## Refactor
- Refactorizar cuando mejore claridad o reduzca duplicación real.
- No mezclar un refactor amplio con una feature pequeña si aumenta el riesgo de revisión.
- Mantener los cambios acotados y fáciles de comprobar.
