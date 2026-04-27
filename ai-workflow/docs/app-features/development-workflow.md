# Desarrollo local del runtime

## Objetivo
Permitir iterar sobre la configuración JSON sin depender del backend real.

## Soporte esperado en v1
- un `config.json` local para cargar la configuración en desarrollo
- un panel visible/ocultable para inspeccionar y editar la configuración en tiempo real

## Qué debe permitir
- cargar una configuración inicial desde fichero local
- editar la configuración y rerenderizar
- detectar errores de configuración con mensajes comprensibles
- facilitar iteración de pantallas, formularios, queries y navegación sin integración backend completa

## Valor funcional
- reduce la fricción para desarrollar el runtime
- permite validar contratos antes de integrarlos con backend
- ayuda a depurar referencias, layouts y estados visuales

## Límites de v1
- no sustituye la integración real con backend
- no pretende ser un editor visual completo
- no incluye todavía herramientas avanzadas de inspección o exportación
