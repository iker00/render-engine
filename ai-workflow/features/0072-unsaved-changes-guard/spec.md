# Spec: Guardia de configuración aplicada en el editor Monaco

## Objetivo

Evitar que el usuario pierda la configuración que ha aplicado al runtime mediante el botón Aplicar, interceptando los eventos del navegador que descargarían la página antes de que haya guardado esos cambios en disco.

El escenario concreto: el usuario edita el JSON en Monaco, pulsa Aplicar, prueba el runtime con la nueva config, y sin querer recarga o navega fuera. Al recargar, el runtime vuelve al `config.json` del disco y los cambios aplicados se pierden.

## Alcance

- Introducir un estado `hasAppliedChanges` (o similar) que se activa tras el primer Aplicar exitoso de la sesión y no se desactiva nunca más durante esa sesión.
- Registrar un listener `beforeunload` del navegador cuando `hasAppliedChanges` es `true` y `DevRuntime` está montado.
- El listener activa el diálogo de confirmación nativo del navegador, que avisa al usuario de que perderá los cambios aplicados si continúa.
- Si el usuario cancela, la página permanece; si confirma, la página descarga normalmente.
- Limpiar el listener cuando `DevRuntime` se desmonta.

## Fuera de alcance

- Interceptar la navegación interna del runtime (acciones `navigateTo` / `goBack` por hash). El hash routing no descarga la página y no pierde los cambios aplicados.
- Personalizar el texto del diálogo de confirmación. Los navegadores modernos ignoran el mensaje personalizado de `beforeunload` por política de seguridad.
- Persistir la configuración aplicada en `localStorage`, `sessionStorage` o disco.1
- Añadir ningún elemento visual propio (banner, badge, indicador) más allá del diálogo nativo.
- Activar la guardia por ediciones en el buffer de Monaco que no hayan pasado por Aplicar.

## Requisitos funcionales

- **RF-1** — Tras el primer Aplicar exitoso de la sesión, el estado de guardia pasa a `true` y permanece `true` hasta que la página se descargue. No existe ninguna acción que lo devuelva a `false`.
- **RF-2** — Mientras el estado de guardia es `true`, existe un listener activo en `window.beforeunload` que retorna una string no vacía para activar el diálogo nativo del navegador.
- **RF-3** — Si el usuario cancela el diálogo, la página no recarga y los cambios aplicados se conservan.
- **RF-4** — Si el usuario confirma el diálogo, la página recarga normalmente desde `config.json`.
- **RF-5** — Cuando `DevRuntime` se desmonta, el listener se elimina para evitar memory leaks.

## Requisitos no funcionales

- El listener debe registrarse y desregistrarse sin memory leaks.
- La guardia no añade latencia perceptible al flujo normal de edición o al render del runtime.
- Sin impacto en producción si `DevRuntime` no está montado.

## Criterios de aceptación

- [ ] Si el usuario no ha pulsado Aplicar en la sesión, recargar no muestra ningún diálogo.
- [ ] Tras el primer Aplicar exitoso, recargar muestra el diálogo nativo del navegador.
- [ ] Cancelar el diálogo cancela la recarga; el runtime sigue con la config aplicada.
- [ ] Confirmar el diálogo recarga la página; el runtime vuelve a `config.json`.
- [ ] Un segundo Aplicar exitoso no desactiva la guardia; sigue activa.
- [ ] Un Aplicar con error de validación o de sintaxis no activa la guardia (el apply no fue exitoso).
- [ ] Si `DevRuntime` no está montado (producción sin `data-enable-dev-mode`), el listener no existe.

## Casos límite

- **HMR auto-aplica desde disco** — Cuando Vite detecta cambios en `config.json` y actualiza el runtime automáticamente, el estado de guardia se mantiene `true` si ya hubo un Aplicar previo. HMR no lo resetea porque la sesión sigue activa.
- **Aplicar fallido seguido de Aplicar exitoso** — El primer apply válido activa la guardia; los fallidos anteriores no cuentan.
- **Drawer cerrado después de aplicar** — La guardia sigue activa aunque el drawer esté cerrado.
- **Primer apply exitoso en la misma sesión tras HMR** — Si HMR ha recargado automáticamente el config antes de que el usuario pulse Aplicar, el estado de guardia sigue siendo `false` hasta el primer Aplicar manual exitoso.

## Áreas de producto afectadas

- `development/` — El wrapper `DevRuntime` y el componente del editor Monaco son el único punto de impacto. No afecta al runtime ni al bootstrap de producción.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — añadir el comportamiento de la guardia como parte del contrato estable del editor.

## Riesgos o preguntas abiertas

Ninguno.
