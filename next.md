## General

- (🚨 low - 🧠 easy) Añadir iconos en títulos, inputs, botones y párrafos (https://lucide.dev/guide/react/)
- (🚨 high - 🧠 medium) Nuevo nodo `modal` para mostrar contenido en ventana flotante
  (Quique necesita un botón `más info` en las tablas de datos para mostrar el resto de datos que no aparecen en las
  tablas)
- (🚨 medium - 🧠 medium) Componente tabs
- (🚨 medium - 🧠 medium) Componente accordion
- (🚨 medium - 🧠 easy) Componente enlace
- (🚨 high - 🧠 high) Añadir nuevos json de configuración como data-lang y data-values.
    - (🚨 high - 🧠 easy) data-lang contendrá el slug del idioma
    - (🚨 high - 🧠 medium) data-values contendrá un objeto con los valores que se quieran mostrar en el componente y estos valores se
      introducirán en la carga dentro del namespace queries
- (🚨 high - 🧠 high) Crear una nueva sección en el raiz del JSON de configuración para las traducciones. Será un objeto {string: object<
  string, string>} donde el string es el slug del idioma y el object es un objeto con las traducciones.
- Hacer que el editor guarde los cambios en el local storage por si hay un reinicio involuntario o bloquear la recarga de la página si el JSON ha sido modificado (bloquear preguntando si se quiere reiniciar de verdad)

## Llamadas a APIs
- (🚨 high - 🧠 medium) Permitir indicar cuando una respuesta a API es incorrecta ya que algunos endpoints de la sede no van a devolver error
  4xx o 5xx si no un json con un mensaje de error
- (🚨 high - 🧠 high) Permitir ejecutar múltiples queries en un solo envío de formulario o acción de botón
- Interpolar valores en las llamadas a los endpoints 
 "buscarPersona": {
      "endpoint": "http://localhost:3000/api/personas/{{form.persona-form.documentacion}}/global",
      "method": "GET"
    },

## Tablas

- (🚨 medium - 🧠 high) Permitir meter imágenes, listas, botones y enlaces en las celdas

## Forms

- (🚨 high - 🧠 medium) Añadir estados para el formSubmit de onSuccess y onError
- Añadir placeholder en los inputs

## Estilos

- (🚨 medium - 🧠 high) Estilos condicionales para textos. Por ejemplo poder cambiar color según un estado.

## Imagenes

- (🚨 medium - 🧠 high) Posibilidad de obtener las imágenes por post. Ver donde se van a guardar los resultados de las imágenes ya que las
  queries actuales solo pueden tener un solo resultado y si hubiera múltiples imágenes se machacarían.

## Botón

- (🚨 low - 🧠 medium) Añadir variantes de estilos para los botones

