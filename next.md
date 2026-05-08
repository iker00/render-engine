1. X Estado base del runtime
   Definir la primera capa de estado compartido del runtime para soportar página activa, historial interno y
   contenedores base para formularios y queries futuras, sin depender todavía
   de un router externo ni de lógica de datos remotos.
2. X Resolución de referencias dinámicas
   Introducir una convención explícita para resolver referencias string dentro del JSON, como forms.*, queries.* o futuras rutas de estado, de forma centralizada y extensible, evitando lógica dispersa en los nodos visuales.
3. X Navegación interna entre páginas
   Añadir navegación declarativa entre páginas del config, con acciones como navigateTo y goBack, manteniendo la URL intacta y permitiendo que el runtime deje de ser una experiencia estática de una sola página visible.
4. X Capa api y cliente de ejecución
   Convertir la sección api del config en una frontera funcional capaz de describir endpoints, métodos HTTP, query string y cuerpos JSON, con una abstracción estable para ejecutar llamadas sin acoplar red y UI.
5. X Queries y preloads de página
   Incorporar ejecución declarativa de queries y precargas al entrar en una página, con estado observable por el runtime para que varias zonas de la UI puedan reaccionar al mismo ciclo de carga y resultado.
6. X Feedback visual de datos
   Permitir que la UI declarativa exprese qué mostrar en estados de loading, error, vacío o éxito, con fallbacks razonables del runtime cuando la configuración no defina explícitamente esas superficies.
7. X Sistema de acciones declarativas
   Diseñar una base común para acciones disparadas por la UI, como navegar, llamar endpoints, relanzar queries o resetear formularios, de forma que los eventos del runtime no dependan de lógica imperativa ad hoc.
8. X Nodo form y estado de formulario
   Introducir el nodo form en el catálogo del runtime junto con su estado interno por formId.fieldId, para que la configuración pueda definir formularios reales sin necesitar componentes React específicos por caso de uso.
9. Campos v1
   Soportar un primer conjunto útil de campos reutilizables, como input, textarea, select, radioGroup y checkboxGroup, cubriendo los patrones mínimos necesarios para búsqueda, edición y captura básica de datos.
10. Validación básica de formularios
    Añadir validación declarativa de primer nivel, con reglas como required, min y max, junto con errores simples por campo y bloqueo del submit cuando el estado no cumpla el contrato esperado.
11. X Valores por defecto e items dinámicos
    Permitir que los campos se inicialicen con valores literales o dinámicos y que ciertos controles resuelvan sus opciones desde datos declarativos o resultados previos, habilitando formularios de edición y filtros dependientes de backend. 
12. X Visibilidad condicional
    Habilitar reglas declarativas para mostrar u ocultar campos o bloques en función del estado actual del runtime, especialmente valores de formularios y estados de queries, sin convertir esta primera versión en un motor complejo de reglas. 
13. X Validación del config con Zod
    Sustituir o reforzar la validación estructural actual con esquemas Zod, para mejorar trazabilidad de errores, mantenibilidad del contrato y evolución segura del JSON soportado por el runtime.
14. Devtools/editor local de configuración
    Crear una vía de desarrollo local para cargar, editar y validar configuración sin depender del backend, acelerando la iteración sobre el runtime declarativo durante la construcción de la v1.
15. Hardening final de v1
    Cerrar la primera versión con pruebas de integración de flujos reales, revisión de cobertura, consolidación documental y limpieza de APIs internas, dejando una base estable antes de ampliar alcance funcional.