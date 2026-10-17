# Auditoría — FittForma AI v40.10 · Punto 7: Comunidad

## Cambios de esta entrega
- Se incorpora un selector para ordenar el feed comunitario por actividad, publicaciones recientes o cantidad de "Me gusta".
- El orden por actividad mantiene el ranking de comunidad de Supabase cuando la función `community_ranked_post_ids` está disponible.
- Se conserva el orden por fecha como alternativa y se mantiene la carga de fotos firmadas desde el bucket privado.
- Se actualizan la versión visible, los paquetes y la caché PWA a v40.10.

## Configuración necesaria para comunidad online
- `supabase/schema.sql` y `supabase/community.sql` deben haberse ejecutado en el SQL Editor del proyecto Supabase.
- `supabase-config.js` debe tener la URL del proyecto y la clave pública `anon`/publishable. Nunca colocar `service_role` en el frontend.
- En Render, mantener las variables privadas solo en Environment. La comunidad necesita que el navegador pueda acceder a Supabase con la configuración pública y las políticas RLS.
- Si se usa Google Login, habilitar el proveedor y configurar las URL de redirección en Supabase.

## Límites de validación
- No se puede confirmar desde este paquete que las credenciales del proyecto del usuario sean correctas ni que Supabase/Render estén conectados en producción.
- Las pruebas automatizadas verifican estructura y reglas del proyecto; no sustituyen una prueba real con dos cuentas distintas.
