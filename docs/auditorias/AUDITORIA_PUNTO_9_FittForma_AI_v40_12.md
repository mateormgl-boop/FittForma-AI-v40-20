# Auditoría — FittForma AI v40.12 · Punto 9

## Implementado
- Descarga de recordatorio recurrente `.ics` en Perfil, con recurrencia semanal de los días elegidos, hora local elegida, evento de 15 minutos y alarma 10 minutos antes. El evento comienza en la próxima ocurrencia futura elegida.
- Validación: requiere recordatorios habilitados, días válidos y hora válida. La copia se genera localmente en respuesta a una acción explícita del usuario.
- Aviso de limitaciones: el evento importado en un calendario externo no sabe si el usuario ya registró actividad en FittForma. Los avisos internos siguen requiriendo que la app esté abierta o vuelva a abrirse; push remoto no implementado.
- GPX: se muestra confirmación antes de exportar porque contiene coordenadas precisas. El archivo no se envía a un servidor desde este código.
- Monetización: ads permanecen desactivados en `ads-config.js`, `paymentsEnabled` sigue falso en `membership-config.js`; la app no debe cobrar ni marcar una suscripción activa hasta integrar un proveedor real y verificar notificaciones/webhooks desde el backend.
- Se actualizó la caché PWA a `fittforma-ai-static-v40-12`, y ambos paquetes a `0.40.12`.

## Pruebas ejecutadas
- `npm test`: **114 pruebas aprobadas, 0 fallidas**. Incluye las pruebas nuevas para recurrencia local del `.ics`, selección de próxima ocurrencia, límite de líneas iCalendar, validación de estados inválidos, traducciones, confirmación GPX y configuración de monetización desactivada.
- Las pruebas de backend HTTP, sintaxis JS, estructura PWA y versiones también pasaron. Esto no equivale a prueba desde la URL de producción ni en dispositivos físicos.

## Límites y pendientes
- El `.ics` necesita importarse en un calendario compatible; no se configura ni sincroniza automáticamente con cuentas Google/Apple.
- No se implementaron notificaciones push remotas propias. Para ello hacen falta backend programado, gestión de suscripciones push, VAPID, almacenamiento seguro de tokens y limpieza/expiración de suscripciones.
- Pagos y suscripciones Pro no están activos. Antes de activar: elegir proveedor, implementar checkout seguro, validar webhooks firmados, guardar entitlement en backend, proteger cancelaciones y probar reembolsos/errores.
- No se ha probado en la instancia Render del usuario ni en dispositivos físicos.
- No requiere ejecutar `schema.sql` ni `community.sql` nuevamente.
