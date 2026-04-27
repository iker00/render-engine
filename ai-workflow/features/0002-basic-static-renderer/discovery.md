# Discovery: Basic static renderer

## Problema a resolver
El proyecto ya puede cargar una configuración de runtime, pero todavía no interpreta esa configuración para renderizar una página declarativa. Hace falta una primera implementación útil y acotada que sustituya el shell provisional por un renderer básico de contenido estático.

## Contexto funcional relevante
- El producto busca renderizar interfaces configurables desde JSON.
- El estado actual no incluye renderer declarativo, navegación interna, queries ni formularios.
- La petición acota esta primera pasada a componentes básicos de presentación: contenedores, títulos, párrafos y listas.
- Quedan fuera de esta feature formularios, eventos, llamadas a APIs, visibilidades condicionales y cualquier referencia dinámica a estado runtime.

## Supuestos actuales
- La página inicial seguirá saliendo de `initialPage`.
- La configuración puede declarar varias páginas, aunque en esta pasada solo se renderizará la resuelta por `initialPage`.
- El árbol de layout será declarativo y anidable.
- Los componentes soportados en esta fase serán solo de contenido y estructura, sin interactividad.
- Los errores por nodos no soportados deben ser visibles y diagnósticos en desarrollo, sin intentar “inventar” comportamiento.
- Las páginas no expondrán `title` ni `description` en esta fase; solo `id`, `layout` y más adelante `preloads`.

## Decisiones ya tomadas
- El conjunto inicial de nodos será deliberadamente simple y centrado en contenido estático: `container`, `heading`, `paragraph` y `list`.
- El shape mínimo de cada nodo seguirá un contrato homogéneo con `type`, `id` opcional, `props` opcional y `children` opcional.
- El contenido visible de la página vivirá en `layout`; las páginas no tendrán `title` ni `description` como campos renderizables en esta fase.
- Ante nodos no soportados o layout inválido, el runtime mostrará errores visibles y diagnósticos en desarrollo y degradará de forma controlada en producción.
- El render tendrá estilos mínimos por tipo de bloque, suficientes para validar jerarquía y legibilidad sin fijar todavía un sistema visual amplio.
- Aunque no habrá navegación aún, la configuración podrá contener varias páginas para no bloquear esa evolución.
- Las listas serán simples en esta iteración y no dependerán todavía de APIs ni de contenido dinámico complejo.

## Riesgos detectados
- Fijar un shape de layout demasiado rígido puede dificultar las siguientes fases de formularios y navegación.
- Si no se define pronto la estrategia ante nodos desconocidos, la evolución del contrato puede producir fallos difíciles de diagnosticar.
- Mantener listas simples en esta fase obliga a dejar claro en la spec que el soporte para items dinámicos llegará en iteraciones posteriores.

## Áreas o documentos a revisar después
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `src/app/app-shell.tsx`
- `src/dev/config.json`

## Recomendación final
Lista para `spec.md`.

La siguiente fase debe convertir estas decisiones en un contrato funcional explícito del layout estático inicial, definiendo con precisión el shape del JSON, los nodos soportados, la resolución de `initialPage` y la degradación esperada ante errores.
