## Reglas de eficiencia

### Lectura en paralelo
<use_parallel_tool_calls>
For maximum efficiency, whenever you perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially. Prioritize calling tools in parallel whenever possible. For example, when reading 3 files, run 3 tool calls in parallel to read all 3 files into context at the same time. When running multiple read-only commands like `ls` or `list_dir`, always run all of the commands in parallel. Err on the side of maximizing parallel tool calls rather than running too many tools sequentially. Only batch tool calls that are independent of each other; if one read depends on the content of another (e.g. an index file that determines which sub-document to read next), keep those sequential instead of forcing them into the same batch.
</use_parallel_tool_calls>
Esto aplica especialmente a las listas "Leer siempre" de las skills, y a la exploración de código relacionado.

### No comprobar existencia antes de leer
No uses `ls`, `test -f`, `find` ni similares para comprobar si un fichero 
existe antes de leerlo. `Read` tolera que el fichero no exista; leerlo 
directamente evita un turno adicional desperdiciado en la comprobación.

### Justificación de lectura de código fuente
Antes de leer código de `src/`, indicar en una frase qué decisión 
concreta requiere esa lectura. Si no puedes justificarlo, no leas.