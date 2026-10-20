export const SYSTEM_PACKAGES = new Set(['android','com.android.systemui','com.android.settings','com.android.permissioncontroller','com.google.android.permissioncontroller','com.sec.android.app.launcher','com.android.launcher','com.android.launcher3','com.google.android.apps.nexuslauncher','com.samsung.android.honeyboard','com.google.android.inputmethod.latin','com.android.packageinstaller','com.google.android.packageinstaller'])
export const validPackage = p => typeof p==='string' && (p==='android'||/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(p)) && p.length<=180
export const protectedPackage = p => SYSTEM_PACKAGES.has(p) || p==='app.tuto.mobile' || p.startsWith('app.tuto.mobile.')
export function validateReportOptions(value={}) {
 const hidden=value.hidden||[]
 if(!Array.isArray(hidden)||hidden.length>200||hidden.some(p=>!validPackage(p)))throw Error('invalid_report')
 return {hidden:[...new Set(hidden)]}
}
export function screenEventMessage(event,child,lang='en') {
 const app=event.label||event.package;const mins=event.minutes||15;const prefix=child?`${child}: `:'';const subject=child||({tr:'Çocuğun',es:'Tu hijo',en:'Your child'}[lang]||'Your child')
 const words={
  limit:{en:`${prefix}${app} reached its screen-time limit.`,tr:`${prefix}${app} kullanım süresi doldu.`,es:`${prefix}${app} agotó su tiempo.`},
  request:{en:`${subject} asks for ${mins} more minutes in ${app}. Open Screen time to approve or decline.`,tr:`${subject}, ${app} için ${mins} dakika ek süre istiyor. Ekran süresinden onaylayabilir veya reddedebilirsin.`,es:`${subject} pide ${mins} minutos más en ${app}. Aprueba o rechaza en Tiempo de pantalla.`},
  extra:{en:`${prefix}${mins} extra minutes approved for ${app}, today only. Waiting for the tablet to sync.`,tr:`${prefix}${app} için yalnızca bugün ${mins} dakika ek süre onaylandı. Tabletin eşitlemesi bekleniyor.`,es:`${prefix}aprobados ${mins} minutos extra para ${app}, solo hoy. Esperando sincronización.`},
  purchase:{en:`${subject} bought ${mins} minutes in ${app} for ${event.gems} Gems.`,tr:`${subject}, ${event.gems} Gem ile ${app} için ${mins} dakika aldı.`,es:`${subject} compró ${mins} minutos en ${app} por ${event.gems} Gems.`},
  rejected:{en:`${prefix}the extra-time request for ${app} was declined.`,tr:`${prefix}${app} için ek süre talebi reddedildi.`,es:`${prefix}se rechazó la solicitud de tiempo para ${app}.`}
 }
 return (words[event.kind]||words.extra)[lang]||(words[event.kind]||words.extra).en
}
