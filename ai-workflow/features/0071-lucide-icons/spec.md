# Feature 0071-lucide-icons — Sistema de iconos con Lucide React

## Objetivo

Integrar `lucide-react` como librería de iconos del runtime para añadir soporte declarativo de iconos en los nodos `button`, `heading`, `paragraph`, `link`, `stat` e `input`, y reemplazar el icono placeholder del nodo `alert` por iconos semánticos reales fijos por tipo.

## Alcance

- Instalación de `lucide-react` como dependencia de producción.
- Nuevo prop opcional `props.icon` en los nodos: `button`, `heading`, `paragraph`, `link`, `stat` e `input`.
- El icono se renderiza siempre a la izquierda del contenido del nodo.
- En `input`, el icono aparece visualmente dentro del campo, a la izquierda del área de texto, sin desplazar ni ocultar el placeholder ni el texto escrito.
- El nodo `alert` reemplaza el `<span>icon</span>` placeholder por el icono Lucide semántico apropiado según `props.type`. No se añade prop nueva al contrato de `alert`.
- La resolución del icono es dinámica en runtime: el string declarado en JSON se mapea al export correspondiente de `lucide-react` por nombre. Si el nombre no existe, el nodo se renderiza sin icono (degradación silenciosa).
- La librería se importa de forma completa; el coste de ~100 KB gzipped es aceptado.

## Fuera de alcance

- `badge`: no recibe `props.icon`.
- `accordion`: el chevron ya existe como feedback visual de apertura/cierre (`0068`); fuera de alcance.
- `list`, `table`, `image`, `divider`, `skeleton`, `modal`, `container`, `repeater`, nodos de formulario (`textarea`, `select`, `radioGroup`, `checkboxGroup`): no reciben `props.icon`.
- Icono configurable en `alert` por JSON (el icono lo fija el tipo semántico, igual que hasta ahora).
- Posición del icono configurable: siempre a la izquierda, sin opción de colocarlo a la derecha.
- Tamaño del icono configurable por JSON.
- Color del icono configurable por JSON de forma independiente al color del nodo.
- Catálogo cerrado: cualquier nombre válido de Lucide React es aceptado como valor de `props.icon`.
- Icono interactivo, con tooltip o con estado visual propio.
- Animaciones en los iconos.
- Dynamic imports por icono individual (lazy loading por icono).

## Requisitos funcionales

### RF-1 — Instalación de `lucide-react`

Se instala `lucide-react` como dependencia de producción del proyecto. Se importa el paquete completo; no se usan dynamic imports ni chunking por icono.

### RF-2 — Prop `props.icon` en nodos de presentación: `heading`, `paragraph`, `link`, `stat`

Los nodos `heading`, `paragraph`, `link` y `stat` admiten un nuevo prop opcional `props.icon`:

- Tipo: string.
- Valor: nombre del icono en el formato de export de `lucide-react` (PascalCase, por ejemplo `"Search"`, `"User"`, `"ArrowRight"`).
- El icono se renderiza a la izquierda del contenido principal del nodo.
- Si el string no corresponde a ningún export conocido de `lucide-react`, el nodo se renderiza sin icono. No se rechaza la configuración en bootstrap.
- Si `props.icon` está ausente o es string vacío, el nodo se renderiza sin icono.

### RF-3 — Prop `props.icon` en `button`

El nodo `button` admite un nuevo prop opcional `props.icon` con las mismas reglas de tipo, formato y degradación de RF-2:

- El icono se renderiza a la izquierda del `props.label` del botón.
- La variante, el color y el `fullWidth` del botón no se ven afectados por la presencia del icono.

### RF-4 — Prop `props.icon` en `input`

El nodo `input` admite un nuevo prop opcional `props.icon` con las mismas reglas de tipo, formato y degradación de RF-2:

- El icono aparece visualmente dentro del campo, a la izquierda del área de texto, simulando formar parte del campo.
- Cuando el icono está presente, el `<input>` lleva `padding-left` suficiente para que el texto escrito y el placeholder no queden ocultos ni solapados por el icono.
- El icono es puramente decorativo: no afecta al valor del campo, a la validación ni al submit del formulario.
- El icono no recibe foco y no es interactivo.

### RF-5 — Iconos semánticos fijos en `alert`

El nodo `alert` reemplaza su icono placeholder por el icono Lucide semántico fijo correspondiente a cada `props.type`. No se añade prop nueva:

- `neutral`: icono neutro o de mensaje genérico.
- `primary`: icono de información destacada.
- `success`: icono de confirmación o check.
- `warning`: icono de advertencia triangular.
- `danger`: icono de error o cancelación.
- `info`: icono de información.

Los iconos son fijos por tipo y no configurables desde JSON.

## Requisitos no funcionales

### RNF-1 — Bundle completo

Se importa el paquete completo de `lucide-react` (~90–100 KB gzipped). No se aplica lazy loading por icono ni tree-shaking dinámico. El coste es fijo e independiente del número de iconos que declare el backend.

### RNF-2 — Degradación silenciosa

Un `props.icon` con nombre no reconocido no causa error de render ni rechazo de configuración en bootstrap. El nodo se renderiza sin icono.

### RNF-3 — Styling con Tailwind

Los iconos se estilizan con utilidades de Tailwind CSS exclusivamente, sin estilos inline. El tamaño del icono es coherente con la escala tipográfica del nodo que lo contiene.

### RNF-4 — Accesibilidad

Los iconos son decorativos y se renderizan con `aria-hidden="true"`. No aportan texto alternativo al árbol de accesibilidad. La accesibilidad existente de cada nodo (label, texto, aria-describedby en inputs) no se ve alterada.

## Criterios de aceptación

- **CA-1**: Un `button` con `props.icon: "Search"` renderiza el icono Lucide `Search` a la izquierda del label, en cualquier combinación de variante y color.
- **CA-2**: Un `heading` con `props.icon: "User"` renderiza el icono Lucide `User` a la izquierda del texto, respetando el nivel del heading.
- **CA-3**: Un `paragraph` con `props.icon: "Info"` renderiza el icono Lucide `Info` a la izquierda del texto del párrafo.
- **CA-4**: Un `link` con `props.icon: "ExternalLink"` renderiza el icono Lucide `ExternalLink` a la izquierda del label del enlace.
- **CA-5**: Un `stat` con `props.icon: "TrendingUp"` renderiza el icono Lucide `TrendingUp` a la izquierda del bloque label/value.
- **CA-6**: Un `input` con `props.icon: "Mail"` renderiza el icono Lucide `Mail` visualmente dentro del campo a la izquierda; el placeholder y el texto escrito son visibles sin solapamiento.
- **CA-7**: Un `alert` de tipo `success` renderiza el icono Lucide de confirmación en lugar del placeholder `<span>icon</span>` anterior. El mismo patrón aplica a todos los tipos semánticos.
- **CA-8**: Un nodo con `props.icon: "NonExistentIconXyz"` se renderiza sin icono, sin error en consola y sin rechazo de configuración en bootstrap.
- **CA-9**: Todos los nodos sin `props.icon` se renderizan exactamente igual que antes de esta feature (sin regresiones visuales).
- **CA-10**: Todos los iconos renderizan con `aria-hidden="true"`.

## Casos límite

- `props.icon: ""` (string vacío): se trata como ausente; el nodo se renderiza sin icono.
- `props.icon` en minúsculas (`"search"` en lugar de `"Search"`): resolución fallida; degradación silenciosa sin icono, igual que cualquier nombre no reconocido.
- `input` con `props.icon` y validación activa: el mensaje de error, el `aria-describedby` y el comportamiento de validación no se ven afectados por la presencia del icono.
- `button` con `props.icon` y `props.fullWidth: true`: el icono aparece a la izquierda del label; el botón sigue ocupando el 100% del ancho.
- `stat` con `props.icon` en variante `tinted`: el icono se renderiza de forma coherente con los colores del tipo semántico del stat.
- `heading` con `props.icon` en cualquier `props.level`: el icono aparece a la izquierda del texto en todos los niveles; la jerarquía semántica del heading no se altera.

## Riesgos o preguntas abiertas

Ninguno. El alcance y las decisiones de producto están cerrados.
