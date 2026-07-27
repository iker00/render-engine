## Reglas de eficiencia

### Lectura en paralelo
Cuando necesites leer varios archivos, invocar todas las lecturas 
en un único turno emitiendo múltiples tool_use en el mismo mensaje. 
No hacer un Read por turno. Esto aplica especialmente a las listas 
"Leer siempre" de las skills, y a la exploración de código relacionado.

### Justificación de lectura de código fuente
Antes de leer código de `src/`, indicar en una frase qué decisión 
concreta requiere esa lectura. Si no puedes justificarlo, no leas.