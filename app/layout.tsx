import type {Metadata,Viewport} from 'next';
import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/jost/index.css';
import './style.css';
export const metadata:Metadata={title:{default:'By Erdoğan | Isparta Gelinlik Atölyesi',template:'%s | By Erdoğan'},description:'By Erdoğan gelinlik seçkisini keşfedin, sanal denemeyle üzerinizde görün ve Isparta atölyesinde ilk provanızı planlayın.',icons:{icon:'/images/logo.webp'}};
export const viewport:Viewport={themeColor:'#f5f0e6'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}
