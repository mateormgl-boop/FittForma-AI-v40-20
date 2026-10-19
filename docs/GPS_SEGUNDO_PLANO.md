# GPS con el celular bloqueado (v50)

## Qué es la app hoy
FittForma AI es una **PWA**: una página web que se instala en el celular. iOS y Android **suspenden** las páginas
web cuando se bloquea la pantalla o se cambia de app, y con eso se detiene `navigator.geolocation`. Mantener la
pantalla encendida (Wake Lock) o usar temporizadores de JavaScript **no** evita esa suspensión.

## Qué hace la versión web (sin cambios en el celular)
- Guarda el recorrido cada 5 s en el dispositivo y, si el sistema cierra la página, al volver ofrece
  **recuperar la sesión en pausa** (sin inventar los minutos que no se registraron).
- Un corte breve de señal no detiene el registro: se marca «Sin señal» y, cuando vuelve, empieza un tramo nuevo
  sin unir el hueco con una línea recta ni sumar esa distancia.
- Muestra el estado de la señal (buena ±10 m, regular ±25 m, débil ±45 m, insuficiente) y descarta saltos
  imposibles según la actividad (correr 8 m/s, caminar 3,2 m/s, bici 22 m/s).
- Aviso claro en pantalla: con la pantalla bloqueada el navegador puede pausar el GPS.

## App Android (seguimiento real en segundo plano)
Carpeta `mobile/`: proyecto **Capacitor 8** que empaqueta la misma app web y agrega el complemento
`@capacitor-community/background-geolocation`. Al iniciar una actividad:
1. Android pide el permiso de ubicación (solo en ese momento) y, en Android 13+, el de notificaciones al abrir la app.
2. Se inicia un **servicio en primer plano de tipo ubicación** con una notificación persistente
   «FittForma AI registra tu actividad». El registro sigue con la pantalla apagada o en otra app.
3. Al pausar o finalizar se detiene el servicio y desaparece la notificación.
`native-gps.js` detecta la app nativa; en el navegador no simula nada.

Permisos declarados en `mobile/android/app/src/main/AndroidManifest.xml`: `ACCESS_FINE_LOCATION`,
`ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`.
No se pide `ACCESS_BACKGROUND_LOCATION` porque el servicio en primer plano no lo necesita.

### Cómo compilar (en una computadora con Android Studio)
```bash
cd mobile
npm install
# Opcional: que la app cargue tu servidor (FittAI, nube y pagos). Sin esto usa la copia local.
export FITTFORMA_APP_URL=https://tu-app.onrender.com
npm run sync      # copia la web a mobile/www y sincroniza Android
npm run open      # abre Android Studio → Run en un celular
```
En Google Play hay que completar la declaración de «ubicación en primer plano» (servicio de tipo location) y la
sección de seguridad de datos (la ubicación no se envía a FittForma; queda en el dispositivo salvo que la persona
sincronice o exporte).

### Pruebas que requieren un celular físico (no se pudieron hacer en este entorno)
| Caso | Qué verificar |
|---|---|
| Pantalla encendida | distancia, ritmo/velocidad, mapa y notificación visible |
| Pantalla bloqueada 10 min | al desbloquear, el recorrido no tiene huecos y la distancia es coherente |
| Otra app en primer plano | igual que el anterior |
| Pausa / reanudar / finalizar | la notificación desaparece al pausar o finalizar |
| Forzar cierre | Android detiene el servicio: se recupera el borrador hasta el último guardado (no se promete más) |
| Túnel o edificios | aparece «Sin señal» y no se suma distancia en línea recta |

## iOS
No hay proyecto iOS: se necesita una Mac con Xcode. Con `npx cap add ios` habría que agregar
`UIBackgroundModes = location` y los textos `NSLocationWhenInUseUsageDescription` /
`NSLocationAlwaysAndWhenInUseUsageDescription` en `Info.plist`.

## Sensores
La app no recibe frecuencia cardíaca ni cadencia de ningún dispositivo, por eso **no muestra** esos datos ni los
usa en las calorías. Para sumarlos haría falta un complemento Bluetooth LE (perfiles Heart Rate 0x180D y
Cycling Speed and Cadence 0x1816) en la app nativa.
