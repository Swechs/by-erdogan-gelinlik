export type Model={id:string,name:string,silhouette:string,fabric:string,description:string,images:string[],concept:boolean,tryOn:boolean};
export type Story={id:string,title:string,category:string,image:string,intro:string,body:string,permission?:boolean};
export type Content={hero:string,stories:Story[]};
export type Data={freeTryOn?:boolean,models:Model[],content:Content,tryOn:boolean,bookingReady:boolean,notifications:boolean,preview:boolean,transfer:string,controller:string,privacyEmail:string,analytics:{ga:string,pixel:string}};
export type Booking={id:string,name:string,phone:string,model:string,start:string,wedding:string,status:string,notify:number,delivery:string|null};
export type Dashboard={settings?:{controller:string,privacyEmail:string,transfer:string},models:Model[],content:Content,slots:{start:string,enabled:number}[],available:string[],bookings:Booking[],usage:{day:string,tries:number}[],tryOn:boolean,notifications:boolean,bookingsEnabled:boolean};
export const statuses:Record<string,string>={pending:'Onay bekliyor',confirmed:'Onaylandı',rejected:'Reddedildi'};
export const dayLabel=(s:string)=>new Date(s).toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long',timeZone:'Europe/Istanbul'});
export const hourLabel=(s:string)=>new Date(s).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'});
export const fullDate=(s:string)=>dayLabel(s)+' · '+hourLabel(s);
export class ApiError extends Error{status:number;constructor(message:string,status:number){super(message);this.status=status}}
export async function request<T=any>(path:string,data?:unknown):Promise<T>{const r=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});let j:unknown=null;try{j=await r.json()}catch{if(r.ok)throw new ApiError('Sunucu yanıtı okunamadı.',r.status)}if(!r.ok)throw new ApiError(typeof j==='object'&&j!==null&&'error' in j?String(j.error):'İşlem tamamlanamadı.',r.status);return j as T}
export const err=(e:unknown)=>e instanceof Error?e.message:'Bağlantı kurulamadı.';
export async function readFile(file:File):Promise<string>{if(file.size>6*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('6 MB veya daha küçük bir JPG, PNG veya WebP seçin.');const bitmap=await createImageBitmap(file);try{if(bitmap.width<100||bitmap.height<100)throw Error('Daha büyük bir fotoğraf seçin.');const ratio=Math.min(1,1500/bitmap.width,1900/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.89)}finally{bitmap.close()}}
export const wa='https://wa.me/905325122100';
export const ig='https://www.instagram.com/_by_erdogan/';
export function event(name:string){if(typeof window==='undefined'||localStorage.getItem('be:measure')!=='yes')return;const w=window as any;w.gtag?.('event',name);w.fbq?.('trackCustom',name)}
export function src(path:string){return typeof window!=='undefined'?((window as any).__ASSETS__?.[path]||path):path}
