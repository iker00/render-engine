# Spec: 0069 · accordion-body-gap

## Objetivo

Añadir un espaciado fijo entre los hijos del cuerpo del nodo `accordion`, de forma que los elementos internos no aparezcan pegados cuando el accordion está expandido.

## Alcance

- Aplicar un gap fijo entre los hijos del cuerpo del accordion, consistente con el espaciado `md` del sistema de diseño del proyecto.
- El gap solo afecta a la disposición interna del cuerpo. No altera la cabecera ni el comportamiento funcional del nodo.

## Fuera de alcance

- No se añade ninguna prop nueva (`props.gap` u otra). El gap es siempre fijo.
- No se cambia el contrato JSON ni los esquemas de validación.
- No se modifica el comportamiento de apertura/cierre, la coordinación de grupos ni ninguna otra propiedad existente del nodo.
- No se abre la posibilidad de configurar el gap por instancia desde el JSON de configuración.

## Requisitos funcionales

1. El cuerpo del accordion, cuando está expandido, aplica un gap fijo entre sus hijos directos.
2. El gap aplicado es el mismo valor que el alias `md` usa en el nodo `container` (referencia visual del proyecto).
3. El gap no se aplica cuando el cuerpo está colapsado (los hijos no están en el DOM).
4. El cambio no afecta accordions sin hijos ni accordions con un único hijo (el gap es transparente en esos casos).

## Requisitos no funcionales

- Solo cambio visual en el componente de render del accordion; sin modificaciones en validación, schema Zod ni tipos TypeScript del contrato JSON.
- Consistencia con el sistema de espaciado de Tailwind CSS v4 ya en uso.

## Criterios de aceptación

- [ ] Al expandir un accordion con dos o más hijos, existe un espacio visible entre ellos.
- [ ] El espacio es visualmente consistente con el gap `md` del nodo `container`.
- [ ] Un accordion con un único hijo o sin hijos no muestra ningún cambio visual inesperado.
- [ ] La transición de apertura y cierre del accordion no se ve afectada.
- [ ] Los tests existentes del accordion siguen en verde sin modificaciones forzadas.
- [ ] El nuevo comportamiento queda cubierto por al menos un test que verifique la presencia de la clase de gap en el wrapper del cuerpo.

## Casos límite

- **Accordion sin hijos o con hijos vacíos**: el gap es invisible; sin efecto observable.
- **Accordion con un solo hijo**: el gap no produce espacio adicional visible; sin efecto observable.
- **Accordion dentro de `form`**: el gap no interfiere con la validación ni el layout de los campos de formulario hijos.
- **Accordion dentro de `repeater`**: cada instancia recibe el mismo gap fijo; no hay interacción con el estado de paginación ni de grupo.

## Áreas de producto afectadas

- Nodo `accordion` (render visual del cuerpo expandido).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/accordion.md`: añadir mención al gap fijo del cuerpo en la sección de estilo visual.

## Riesgos o preguntas abiertas

Ninguno. El alcance es puntual y reversible.
