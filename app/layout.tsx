import type {Metadata} from 'next';
import './style.css';
export const metadata:Metadata={title:{default:'By Erdoğan | Isparta Gelinlik Atölyesi',template:'%s | By Erdoğan'},description:'By Erdoğan gelinlik seçkisini keşfedin. Isparta atölyesinde ilk provanızı planlayın.',icons:{icon:'/images/logo.webp'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}
