import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const html = await read('index.html');
function extractFunction(source,name,nextName){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`No se encontró ${name}`);
  const pattern=new RegExp(`\\n  (?:async )?function ${nextName}\\(`);
  const match=pattern.exec(source.slice(start+1));
  assert.ok(match,`No se encontró el límite de ${name}`);
  return source.slice(start,start+1+match.index).trim();
}
const normalizeSource=extractFunction(html,'normalizeReminderDays','buildCalendarReminderIcs');
const buildSource=extractFunction(html,'buildCalendarReminderIcs','downloadCalendarReminderIcs');
const normalizeReminderDays=Function(`${normalizeSource}; return normalizeReminderDays;`)();
const buildCalendarReminderIcs=Function('normalizeReminderDays',`${buildSource}; return buildCalendarReminderIcs;`)(normalizeReminderDays);

test('el calendario crea recurrencia semanal en hora local y alarma anticipada',()=>{
  const mondayLate=new Date(2026,9,12,19,0,0); // lunes luego de las 18:00
  const ics=buildCalendarReminderIcs({enabled:true,days:[1,3,5],time:'18:00'},mondayLate);
  assert.match(ics,/BEGIN:VCALENDAR/);
  assert.match(ics,/DTSTART:20261014T180000/); // siguiente día elegido: miércoles
  assert.match(ics,/RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/);
  assert.match(ics,/TRIGGER:-PT10M/);
  assert.match(ics,/END:VCALENDAR\r\n$/);
});

test('las líneas del iCalendar respetan el límite de 75 octetos',()=>{
  const ics=buildCalendarReminderIcs({enabled:true,days:[1,3,5],time:'18:00'},new Date(2026,9,12,9,0,0));
  for(const line of ics.split('\r\n').filter(Boolean))assert.ok(new TextEncoder().encode(line).length<=75,`Línea demasiado larga: ${line}`);
});

test('el calendario usa el día de hoy si la hora todavía no pasó',()=>{
  const mondayMorning=new Date(2026,9,12,9,0,0);
  const ics=buildCalendarReminderIcs({enabled:true,days:[1],time:'18:00'},mondayMorning);
  assert.match(ics,/DTSTART:20261012T180000/);
});

test('el calendario rechaza recordatorios apagados, sin días u hora inválida',()=>{
  const now=new Date(2026,9,12,9,0,0);
  assert.throws(()=>buildCalendarReminderIcs({enabled:false,days:[1],time:'18:00'},now),/Activá y guardá/);
  assert.throws(()=>buildCalendarReminderIcs({enabled:true,days:[],time:'18:00'},now),/Elegí al menos un día/);
  assert.throws(()=>buildCalendarReminderIcs({enabled:true,days:[1],time:'99:00'},now),/hora válida/);
});

test('la interfaz explica que el .ics es independiente de la app y no es un push remoto',()=>{
  assert.match(html,/id="downloadCalendarReminder"/);
  assert.match(html,/el calendario no sabe si ya registraste tu entrenamiento/);
  assert.match(html,/No se garantiza la entrega si queda en segundo plano o cerrada/);
});

test('las etiquetas nuevas de calendario tienen traducciones en los seis idiomas',async()=>{
  const i18n=await read('i18n.js');
  const block=i18n.slice(i18n.indexOf('const languageRows='),i18n.indexOf('const labels='));
  const rows=Function(`${block}; return languageRows;`)();
  const bySource=new Map(rows.map(row=>[row[0],row]));
  for(const label of ['Descargar recordatorio para calendario (.ics)','Importá el archivo .ics en Google Calendar, Apple Calendar u otra agenda para tener un aviso programado aunque FittForma esté cerrada. Es un evento recurrente independiente: el calendario no sabe si ya registraste tu entrenamiento.'])assert.equal(bySource.get(label)?.length,6,`Faltan traducciones para ${label}`);
});

test('monetización mantiene anuncios y pagos desactivados mientras no haya proveedor real',async()=>{
  const ads=await read('ads-config.js');
  const member=await read('membership-config.js');
  assert.match(ads,/enabled:\s*false/);
  assert.match(member,/paymentsEnabled:\s*false/);
  assert.match(html,/Todavía no hay proveedor de pagos conectado ni suscripciones verificadas/);
});

test('la exportación GPX solicita confirmación porque contiene coordenadas precisas',()=>{
  assert.match(html,/El archivo GPX incluye coordenadas precisas de tu recorrido/);
  assert.match(html,/function downloadActivityGpx\(/);
});


test('el día de comunidad y anuncios usa fecha local, no UTC', async () => {
  const community = await read('community.js');
  const ads = await read('ads.js');
  assert.match(community, /const localDateKey=\(date=new Date\(\)\)=>`\$\{date\.getFullYear\(\)\}/);
  assert.doesNotMatch(community, /new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
  // v48: el día de los límites de anuncios lo decide el servidor con la zona horaria de la app.
  assert.doesNotMatch(ads, /toISOString\(\)\.slice\(0, ?10\)/);
  const monetization = await read('backend/monetization.mjs');
  assert.match(monetization, /Intl\.DateTimeFormat\('en-CA', \{ timeZone: TZ/);
});
