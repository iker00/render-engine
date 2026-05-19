# Design: Feature 0032 - compact-institutional-density

## Contexto
La feature `0026` fijó una baseline institucional clara para el runtime y `0028` corrigió la composición de secciones dentro de formulario. La petición actual no cambia esa dirección visual, pero sí corrige una percepción concreta: la UI sigue respirando demasiado, con alturas, paddings y separaciones que hacen que el formulario se vea exageradamente grande.

La imagen de referencia aportada por el usuario confirma que el objetivo no es un rediseño total, sino una versión más compacta del mismo lenguaje: títulos más contenidos, bloques introductorios menos altos, campos más bajos y una distancia vertical menor entre secciones y acciones.

## Objetivos / No objetivos

### Objetivos
- Compactar la densidad general del runtime sin abandonar la baseline institucional existente.
- Ajustar de forma coordinada cuatro palancas visuales:
  - escala tipográfica
  - padding interno de controles
  - altura percibida de botones
  - espaciado vertical entre bloques
- Conseguir que el conjunto recuerde más a la referencia de sede electrónica aportada por el usuario, especialmente en la zona de formulario.

### No objetivos
- Cambiar color, branding, tono visual o semántica de CTA ya fijados.
- Reabrir el layout funcional de la página, el contrato JSON o el catálogo de nodos.
- Convertir la interfaz en una UI densa de backoffice sin aire.
- Añadir variantes declarativas nuevas para tamaño o densidad.

## Decisiones

### 1. La compactación es sistémica, no por componente aislado
No basta con reducir solo inputs o solo títulos. La implementación debe tocar la relación entre:
- bloque introductorio
- títulos
- labels y texto auxiliar
- campos
- secciones
- acciones finales

Motivo:
- si solo se reduce una pieza, la UI sigue viéndose desproporcionada
- la referencia transmite una densidad general más contenida, no un único control más pequeño

### 2. La jerarquía tipográfica debe seguir existiendo, pero con menos salto entre niveles
La página debe seguir teniendo:
- un título principal dominante
- títulos de sección identificables
- labels legibles
- texto auxiliar secundario

Pero el salto entre esos niveles debe ser menor que hoy.

Motivo:
- la captura transmite orden y sobriedad
- la UI actual se percibe grande en parte por el peso de sus encabezados y separaciones

### 3. Los controles deben sentirse administrativos y compactos, no mínimos
`input`, `textarea` y `select` deben reducir altura y padding respecto al baseline actual, pero sin perder:
- confort mínimo de lectura
- foco visible
- claridad del borde
- facilidad razonable de uso táctil en móvil

Motivo:
- la petición es "más parecido a la imagen", no "lo más pequeño posible"

### 4. Los botones reducen tamaño conservando jerarquía de acción
La CTA principal y la acción secundaria deben compactarse a la vez.

La CTA principal debe seguir sintiéndose dominante por contraste y color, no por ser desproporcionadamente más alta que el resto.

Motivo:
- en la referencia, los botones son contenidos pero siguen viéndose inequívocos

### 5. El mayor recorte debe darse en el espaciado vertical acumulado
El espacio a revisar prioritariamente es:
- entre breadcrumb/bloque de retorno y cabecera
- entre título y descripción
- entre descripción y contenido principal
- entre secciones del formulario
- entre último bloque y barra de acciones

Motivo:
- la sensación de tamaño excesivo suele venir más de la suma de separaciones que de una sola fuente o un solo control

### 6. En móvil, la compactación debe ser más conservadora
La versión móvil también debe verse más contenida, pero con más cautela que desktop al reducir:
- padding horizontal utilizable
- altura de campos
- altura de botones

Motivo:
- la referencia móvil sigue siendo compacta, pero no sacrifica tocabilidad ni claridad

### 7. La dirección visual debe fijarse con helpers y clases responsivas estables
La implementación y su validación no deben depender de una comparación manual contra screenshots ni de medir píxeles en navegador como contrato principal.

La compactación debe quedar cerrada mediante:
- helpers centralizados en `src/runtime/runtime-node-styling.ts`
- clases base para móvil
- modificadores responsivos estables para `sm` y `lg` cuando haga falta matizar la densidad en breakpoints mayores

Motivo:
- el repositorio ya fija la gramática visual visible mediante helpers testeables
- reduce el riesgo de reinterpretar "más compacto" de forma distinta entre tareas
- mantiene la regresión visual verificable con tests unitarios e integrados legibles

## Prioridades visuales
1. Reducir la altura percibida del bloque superior.
2. Reducir la altura percibida de campos y botones.
3. Reducir huecos verticales grandes entre secciones.
4. Mantener intacta la claridad de la jerarquía y la acción principal.

## Señales de que la implementación va en la dirección correcta
- El formulario entra antes en pantalla sin sentirse comprimido.
- El título deja de monopolizar tanto espacio vertical.
- Los campos parecen parte de un sistema administrativo compacto.
- El paso entre secciones se percibe más fluido.
- La barra de acciones deja de quedar demasiado separada del contenido.

## Señales de sobrecompactación a evitar
- Labels o texto auxiliar demasiado pegados al control.
- Botones que parecen pequeños o poco táctiles.
- Secciones que dejan de leerse como bloques distintos.
- Títulos que pierden presencia y hacen que todo parezca del mismo nivel.

## Riesgos y trade-offs

### Riesgo: compactar solo en desktop
Si la reducción se concentra en desktop y móvil casi no cambia, el sistema seguirá sintiéndose inconsistente.

Mitigación:
- definir la compactación como una dirección común a todos los breakpoints, con prudencia adicional solo en móvil

### Riesgo: romper la baseline institucional
Si la compactación introduce nuevos estilos locales o excepciones dispersas, el runtime perderá coherencia.

Mitigación:
- aplicar el cambio desde la convención visual central existente y desde los tokens compartidos

### Riesgo: perseguir una copia exacta de la captura
La captura es referencia de proporción, no layout contractual completo.

Mitigación:
- evaluar cercanía por jerarquía, densidad y tono visual general
- no intentar reproducir partes que no pertenecen al alcance del runtime actual

## Preguntas abiertas
- No quedan preguntas bloqueantes para la fase de spec.
