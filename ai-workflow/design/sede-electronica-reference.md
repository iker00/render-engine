# Sede electrónica reference design

## Objetivo
Traducir la imagen de referencia de "Solicitud general" a un contrato visual reutilizable para el runtime y para futuras pantallas relacionadas.

Alcance efectivo de esta referencia:
- usar solo la parte de la captura a partir del bloque de título y descripción
- excluir cabecera, barra lateral izquierda, pasos del trámite, ayuda lateral y tarjeta de confianza
- aplicar el resultado a todas las pantallas renderizadas por el runtime, no solo a una demo concreta
- permitir tematización mediante variables CSS estables, consumidas desde clases y utilidades de `Tailwind CSS` siempre que sea posible

Fuente de referencia:
- imagen proporcionada por el usuario en el hilo
- copia existente en el repositorio: `ai-workflow/sede.png`

## Intención visual
- Producto institucional y confiable.
- Interfaz clara, sobria y ordenada.
- Sensación de trámite guiado, no de dashboard comercial.
- Prioridad absoluta a comprensión, validación y cierre de la acción principal.

## Prioridades de fidelidad
1. Jerarquía de información.
2. Composición general de la página.
3. Espaciado, bordes y densidad.
4. Tono cromático institucional.
5. Estilo de campos, tarjetas y acciones.
6. Coherencia visual de nodos no presentes en la captura.

Si hay conflicto entre copiar la imagen al píxel y mantener claridad/reutilización, priorizar claridad y coherencia sistémica.

## Anatomía de la pantalla

### Desktop
- Área de contenido con margen amplio y fondo claro.
- Bloque introductorio del contenido con:
  - eyebrow opcional
  - título principal
  - descripción o texto explicativo
- Columna principal ancha para el formulario o el contenido estructurado.
- Formulario dentro de una tarjeta grande blanca con secciones internas separadas por líneas y espacio vertical generoso.
- Cierre inferior con checkbox legal y barra de acciones alineada.

### Tablet
- Contenido en una sola columna dominante.
- Bloque introductorio seguido del contenido principal.
- El formulario sigue dentro de una tarjeta principal.

### Móvil
- Todo el contenido en una sola columna.
- El orden recomendado es:
  - título
  - explicación
  - secciones del formulario
  - declaración legal
  - acciones
- La imagen sugiere secciones plegables. Si no se implementan todavía, mantener la separación visual por tarjetas o encabezados y documentar la diferencia.

## Tokens visuales aproximados

### Color
```txt
Primary blue: #2563eb
Primary blue hover: #1d4ed8
Primary blue soft: #eff6ff
Page background: #f8fafc
Surface: #ffffff
Surface muted: #f1f5f9
Border soft: #e2e8f0
Border strong: #cbd5e1
Text strong: #0f172a
Text body: #334155
Text muted: #64748b
Success/trust tint: usar azul suave, no verde dominante
```

Variables mínimas recomendadas:
```css
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-soft: #eff6ff;
  --color-page-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-muted: #f1f5f9;
  --color-border-soft: #e2e8f0;
  --color-border-strong: #cbd5e1;
  --color-text-strong: #0f172a;
  --color-text-body: #334155;
  --color-text-muted: #64748b;
  --color-danger: #dc2626;
}
```

### Tipografía
- Sans sobria y neutra.
- Título principal grande y compacto.
- Subtítulos de sección de peso medio/semibold.
- Texto auxiliar pequeño pero legible.
- Los labels de campo no deben competir con los títulos.

Escala orientativa:
```txt
Hero title: 40-48
Section title: 24-28
Card title: 18-20
Body: 16
Small/help text: 13-14
Meta label: 12
```

### Radio y borde
```txt
Page cards: 20-24px
Inner cards/sections: 14-18px
Inputs/buttons: 10-12px
Border width: 1px
```

Variables recomendadas:
```css
:root {
  --radius-page-card: 24px;
  --radius-section-card: 16px;
  --radius-control: 12px;
  --border-width-default: 1px;
}
```

### Espaciado
```txt
Page outer padding desktop: 40-56px
Card padding desktop: 24-32px
Section gap: 24-32px
Field grid gap: 12-16px
Inline control gap: 8-12px
```

Variables recomendadas:
```css
:root {
  --space-page-x: 48px;
  --space-page-y: 40px;
  --space-card: 32px;
  --space-section: 32px;
  --space-field-gap: 16px;
  --space-inline-gap: 12px;
}
```

## Componentes visuales

### Intro del trámite
- Eyebrow o categoría en azul y mayúscula suave.
- Título principal oscuro y muy legible.
- Texto explicativo corto, en 2-3 líneas como máximo.

### Tarjeta principal de formulario
- Superficie blanca.
- Borde fino y sombra muy ligera.
- Secciones internas separadas por espaciado amplio o divisores discretos.
- Cada sección debe poder empezar con título propio si el contenido lo necesita.
- La primera implementación debe intentar resolver esa separación con composición y estilos existentes antes de introducir una abstracción declarativa nueva.

### Campos
- Labels alineados por encima del control.
- Obligatorio marcado con asterisco rojo discreto.
- Inputs blancos con borde gris suave.
- Altura cómoda, sin densidad compacta extrema.
- Placeholder y ayuda con tono apagado.
- Focus con anillo azul suave y claramente visible.
- Error con texto rojo controlado y sin exagerar el borde.

### Botones
- Primario:
  - azul sólido
  - texto blanco
  - ancho suficiente para CTA principal
- Secundario:
  - fondo blanco
  - borde azul
  - texto azul
- Ambos con radio medio y altura consistente.

### Barra final de acciones
- Debe cerrar visualmente el formulario.
- En desktop, secundario a la izquierda y primario a la derecha.
- En móvil, ambos botones deben seguir siendo cómodos y muy distinguibles.

### Nodos fuera de captura
- Si un nodo existente del runtime no aparece en la imagen, debe derivar su apariencia de este sistema:
  - misma tipografía
  - mismos radios
  - misma escala de bordes
  - misma densidad de espaciado
  - mismo lenguaje cromático
- No se debe inventar una estética paralela para esos nodos.
- Las listas deben mantenerse con bullets sobrios por defecto.

## Reglas de composición para futuros componentes
- No usar superficies oscuras como base del producto.
- No introducir gradientes, brillos ni sombras pesadas.
- No convertir la UI en un dashboard genérico.
- Las tarjetas y bloques deben respirar; evitar contenedores pegados entre sí.
- El azul institucional debe reservarse para acciones, enlaces, estados activos e iconografía funcional.
- El contenido principal debe vivir dentro de un ancho de lectura controlado.
- Los componentes nuevos deben poder colocarse dentro de una tarjeta blanca o de una columna de formulario sin desentonar.

## Traducción operativa al runtime actual
- El shell general debe pasar de oscuro a claro.
- Los tokens visuales deben vivir en variables CSS estables.
- La convención visual base de `heading`, `paragraph`, `list`, `button`, `form`, `input`, `select`, `textarea`, `radioGroup` y `checkboxGroup` debe alinearse con este documento.
- La convención visual también debe extenderse de forma coherente a cualquier nodo existente del runtime que no tenga referencia directa en la captura.
- Los contenedores deben permitir composiciones de página y secciones sin depender de estilos inline salvo la excepción ya admitida para gaps arbitrarios.
- La implementación debe usar `Tailwind CSS` como mecanismo principal, apoyando colores, radios, espaciados y estados en variables cuando haga falta tematización.

## Gaps conocidos respecto a la imagen
- La imagen incluye subida de archivos y listado de adjuntos.
- La imagen móvil sugiere acordeones de sección.

Mientras esas capacidades no existan de forma estable en el runtime, tratarlas como:
- referencia de composición
- referencia de tono visual
- posible alcance futuro, nunca comportamiento supuesto
