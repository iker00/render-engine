# Spec: escala de tamaños del nodo `modal`

## Objetivo
Hacer que los tres tamaños del nodo `modal` (`sm | md | lg`) se perciban visualmente diferenciados. Hoy los tres valores producen anchos casi idénticos (`max-w-sm`, `max-w-md`, `max-w-lg`: 384px, 448px y 512px respectivamente, solo 64px de diferencia entre pasos), por lo que en la práctica `props.size` no cumple su función de comunicar intención de tamaño.

## Alcance
- Redefinir el ancho máximo asociado a cada valor del catálogo cerrado existente `sm | md | lg` en `getModalPanelClassName` (`src/runtime/runtime-node-styling.ts`).
- Nueva escala de anchos:
  - `sm` → `max-w-md` (28rem / 448px) — equivalente al `md` actual.
  - `md` → `max-w-2xl` (40rem / 640px).
  - `lg` → `max-w-4xl` (56rem / 896px).
- El default sigue siendo `md` cuando `props.size` no se declara.
- Actualizar la ficha funcional `ai-workflow/docs/app-features/nodes/modal.md` para reflejar los nuevos anchos si la ficha llega a detallar valores concretos (hoy solo usa los adjetivos "estrecho/estándar/ancho", que siguen siendo válidos).

## Fuera de alcance
- Ampliar el catálogo de `props.size` con valores nuevos (`xs`, `xl`, `full`, etc.). El catálogo cerrado sigue siendo exactamente `sm | md | lg`.
- Cambiar el contrato de validación Zod de `props.size`: sigue rechazando cualquier valor fuera de `sm | md | lg`.
- Cambiar la altura del panel. La altura sigue ajustándose siempre al contenido; `props.size` continúa afectando únicamente al ancho máximo.
- Cambiar el comportamiento responsive del overlay o el padding del panel (`p-6`, `sm:p-8` se mantienen).
- Cualquier otro aspecto del nodo `modal` no relacionado con el ancho: apertura/cierre, foco atrapado, `defaultOpen`, `label`/`aria-label`, comportamiento dentro de `repeater.props.template`, etc.

## Requisitos funcionales
1. Un `modal` con `props.size: "sm"` renderiza el panel con `max-w-md` (28rem / 448px) en lugar del actual `max-w-sm`.
2. Un `modal` con `props.size: "md"` o sin `props.size` declarado renderiza el panel con `max-w-2xl` (40rem / 640px) en lugar del actual `max-w-md`.
3. Un `modal` con `props.size: "lg"` renderiza el panel con `max-w-4xl` (56rem / 896px) en lugar del actual `max-w-lg`.
4. El resto de clases del panel (`w-full`, `rounded-card`, `border`, `bg-white`, `p-6`, `sm:p-8`, `shadow-shell`, etc.) no cambian.
5. El catálogo de valores válidos de `props.size` sigue siendo exactamente `sm | md | lg`; la validación de config no cambia.

## Requisitos no funcionales
- Cambio implementado únicamente con utilidades de `Tailwind CSS`, sin estilos inline, manteniendo la centralización de estilos en `runtime-node-styling.ts`.
- Sin cambios en el contrato JSON, en `src/config/` ni en el modelo de estado del runtime.

## Criterios de aceptación
- Un modal con `size: "sm"` tiene la clase `max-w-md` en su panel (y no `max-w-sm`).
- Un modal con `size: "md"` tiene la clase `max-w-2xl` en su panel (y no `max-w-md`).
- Un modal con `size: "lg"` tiene la clase `max-w-4xl` en su panel (y no `max-w-lg`).
- Un modal sin `props.size` se comporta igual que `size: "md"` (mismo default de siempre, con el nuevo ancho).
- Un `props.size` fuera de `sm | md | lg` sigue rechazando el config completo (sin regresión de validación).
- Las demás reglas de render del modal (overlay, foco atrapado, cierre por ESC/click exterior/`closeModal`, `defaultOpen`, `aria-label`) no cambian su comportamiento.

## Casos límite
- Modal dentro de `repeater.props.template`: cada instancia iterada aplica el mismo mapeo de tamaño nuevo; no hay diferencia de comportamiento respecto al modal fuera de un `repeater`.
- Contenido del modal más ancho que el nuevo `max-w` en pantallas pequeñas: el panel sigue limitado por `w-full` dentro del overlay (sin margen lateral propio), igual que hoy; este comportamiento no es parte del alcance de este cambio.
- Configuraciones existentes que ya declaran `props.size` explícitamente: el cambio es puramente visual (mismo valor de `size`, ancho resultante distinto); no requiere migración de datos ni cambia la validación.

## Áreas de producto afectadas
- Catálogo de nodos (`modal`), documentado en `ai-workflow/docs/app-features/nodes/modal.md`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/modal.md`: revisar la línea `props.size traduce a tres anchos visuales diferenciados: sm (estrecho), md (estándar) y lg (ancho)` para confirmar que sigue siendo precisa con la nueva escala (sigue siéndolo en términos cualitativos; no se documentan valores en rem/px hoy, así que no hace falta más detalle salvo que se decida documentarlos).

## Riesgos o preguntas abiertas
Ninguno bloqueante. Riesgo bajo: cambio acotado a una función de estilos centralizada (`getModalPanelClassName`), sin impacto en contrato de config, validación ni estado del runtime. Los tests existentes que puedan asumir las clases `max-w-sm|md|lg` literales se identificarán y actualizarán durante la planificación de implementación (`generate-implementation-plan`), no es una decisión de producto pendiente.
