## General

- (🚨 low - 🧠 easy) Añadir iconos en títulos, inputs, botones y párrafos (https://lucide.dev/guide/react/)
- (🚨 medium - 🧠 medium) Componente tabs
- (🚨 medium - 🧠 medium) Componente accordion
- (🚨 medium - 🧠 easy) Componente enlace
- (🚨 high - 🧠 high) Crear una nueva sección en el raiz del JSON de configuración para las traducciones. Será un objeto {string: object<
  string, string>} donde el string es el slug del idioma y el object es un objeto con las traducciones. También añadir un nuevo valor de entrada data-lang para poder seleccionar el idioma de estas traducciones.
- Hacer que el editor guarde los cambios en el local storage por si hay un reinicio involuntario o bloquear la recarga de la página si el JSON ha sido modificado (bloquear preguntando si se quiere reiniciar de verdad)
- Añadir función `.describe()` en los schemas de Zod para el schema del prompt.

## Llamadas a APIs
- (🚨 medium - 🧠 medium) Permitir navegar dentro del objeto de error de una query (`queries.myQuery.error.message`) para mostrar el mensaje de error dinámico del servidor en nodos de texto. Actualmente el parser solo permite `queries.myQuery.error` como referencia completa, sin acceso a propiedades anidadas como `.message` o `.code`.
- (🚨 high - 🧠 medium) Permitir indicar cuando una respuesta a API es incorrecta ya que algunos endpoints de la sede no van a devolver error 4xx o 5xx si no un json con un mensaje de error
- (🚨 high - 🧠 high) Permitir ejecutar múltiples queries en un solo envío de formulario o acción de botón
- (🚨 medium - 🧠 low) Interpolar valores en las llamadas a los endpoints 
 "buscarPersona": {
      "endpoint": "http://localhost:3000/api/personas/{{form.persona-form.documentacion}}/global",
      "method": "GET"
    },

## Forms

- (🚨 high - 🧠 medium) Añadir estados para el formSubmit de onSuccess y onError
- (🚨 low - 🧠 low) Añadir placeholder en los inputs

## Estilos

- (🚨 medium - 🧠 high) Estilos condicionales para textos. Por ejemplo poder cambiar color según un estado.

## Botón

- (🚨 low - 🧠 medium) Añadir variantes de estilos para los botones

