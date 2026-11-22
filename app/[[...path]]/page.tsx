import {notFound} from 'next/navigation';
import {publicData} from '../../lib/backend';
import Atelier from '../../components/Atelier';
import type {Metadata} from 'next';
import type {Data} from '../../components/types';
export const dynamic='force-dynamic';
type P={params:Promise<{path?:string[]}>,searchParams:Promise<{model?:string}>};
const titles:Record<string,string>={koleksiyon:'Gelinlik Koleksiyonu',hikayeler:'Atölye Günlüğü',favoriler:'Favoriler',randevu:'Prova Randevusu',gizlilik:'Gizlilik ve KVKK',yonetim:'Atölye Yönetimi'};
export async function generateMetadata({params}:P):Promise<Metadata>{const [s,id]=(await params).path||[],d=await publicData() as Data;if(!s)return {};const m=d.models.find(x=>x.id===id),article=d.content.stories.find((x:{id:string})=>x.id===id);return {title:m?.name||article?.title||titles[s],description:m?.description||article?.intro,robots:{index:!['yonetim','favoriler'].includes(s),follow:true}}}
export default async function Page({params,searchParams}:P){const path=(await params).path||[],d=await publicData() as Data,[s,id]=path;const model=(await searchParams).model;if(path.length>2||(s&&!Object.hasOwn(titles,s))||(id&&!(s==='koleksiyon'&&d.models.some(v=>v.id===id))&&!(s==='hikayeler'&&d.content.stories.some((v:{id:string})=>v.id===id))))notFound();return <Atelier data={d} initialPath={'/'+path.join('/')+(s==='randevu'&&model?'?model='+encodeURIComponent(model):'')}/>}
