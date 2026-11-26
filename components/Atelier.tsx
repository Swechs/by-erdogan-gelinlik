'use client';
import {useEffect, useState} from 'react';
import type {Data, Model, Story} from './types';
import {src, event, wa, ig} from './types';
import Icon from './Icons';
import Booking from './Booking';
import Admin from './Admin';
import TryOn from './TryOn';

type Actions = {data: Data, favorites: string[], toggle: (id: string) => void, open: (id?: string) => void};

const address = <>Yayla Mahallesi, Cumhuriyet Caddesi No. 25/3<br/>Merkez, Isparta</>;

function Wordmark({light = false}: {light?: boolean}) {
  // Same mark as the original logo, in one tone to sit within the ivory/charcoal palette.
  return <img className="wordmark" src={src(light ? '/images/logo-ivory.png' : '/images/logo-charcoal.png')} width={420} height={97} alt="by erdoğan"/>;
}

function ConceptNote({models}: {models: Model[]}) {
  if (!models.some(m => m.concept)) return null;
  return <p className="conceptNote">Gördüğünüz modeller silüetleri tanıtmak için hazırlanmış konsept tasarımlardır; mağaza stoğunu temsil etmez. Güncel koleksiyonu atölyede birlikte keşfedebiliriz.</p>;
}

function Card({m, favorites, toggle, size = 'regular'}: {m: Model, favorites: string[], toggle: (id: string) => void, size?: 'regular' | 'feature'}) {
  const liked = favorites.includes(m.id);
  return <article className={'modelCard ' + size}>
    <div className="modelPhoto">
      <a href={'/koleksiyon/' + m.id} aria-label={m.name + ' modelini incele'}>
        <img src={src(m.images[0])} alt={m.name + ', ' + m.silhouette.toLocaleLowerCase('tr') + ' gelinlik, önden görünüm'} loading="lazy"/>
      </a>
      {m.concept && <span className="tag">Konsept</span>}
      <button className={'heart' + (liked ? ' saved' : '')} aria-label={liked ? m.name + ' favorilerden çıkar' : m.name + ' favorilere ekle'} aria-pressed={liked} onClick={() => toggle(m.id)}>
        <Icon name="heart" filled={liked} size={18}/>
      </button>
    </div>
    <a href={'/koleksiyon/' + m.id} className="modelLine">
      <h3>{m.name}</h3>
      <span>{m.silhouette}, {m.fabric.toLocaleLowerCase('tr')}</span>
    </a>
  </article>;
}

function Journey({open}: {open: () => void}) {
  return <section className="journey wrap" aria-labelledby="journeyTitle">
    <h2 id="journeyTitle">Gelinliğinizi bulmanın üç adımı</h2>
    <ol className="tape">
      <li>
        <span className="tick" aria-hidden="true">1</span>
        <h3>Seçin</h3>
        <p>Koleksiyonda size yakın gelen silüeti bulun, beğendiklerinizi kalbe dokunarak saklayın.</p>
        <a className="under" href="/koleksiyon">Koleksiyonu keşfet</a>
      </li>
      <li>
        <span className="tick" aria-hidden="true">2</span>
        <h3>Üzerinizde görün</h3>
        <p>Tam boy bir fotoğrafınızla gelinliğin üzerinizde nasıl durduğuna ilk bakışı atın.</p>
        <button className="under" onClick={open}>Sanal denemeyi aç</button>
      </li>
      <li>
        <span className="tick" aria-hidden="true">3</span>
        <h3>Provaya gelin</h3>
        <p>Seçtiğiniz modeli Isparta’daki atölyemizde, aynanın karşısında birlikte deneyelim.</p>
        <a className="under" href="/randevu">Prova randevusu al</a>
      </li>
    </ol>
  </section>;
}

function Home(a: Actions) {
  const {data, open} = a;
  const story = data.content.stories[0];
  const [first, ...rest] = data.models;
  return <main>
    <section className="hero">
      <img className="heroPhoto" fetchPriority="high" src={src(data.content.hero)} alt="Pencereden gelen ışıkta fildişi gelinlik ve uzun saten kuyruk"/>
      <div className="heroShade"/>
      <div className="heroBody">
        <p className="place">Gelinlik atölyesi, Isparta</p>
        <h1>Hayalinizdeki gelinliğe bir adım daha yakın.</h1>
        <p className="heroIntro">Her aşk hikâyesi eşsizdir. Sizin hikâyenize eşlik edecek gelinliği birlikte keşfedelim.</p>
        <div className="buttons">
          <a href="/koleksiyon" className="btn ivory">Koleksiyonu keşfet</a>
          <button className="btn glass" onClick={() => open()}>Üzerimde gör</button>
        </div>
      </div>
    </section>

    <Journey open={() => open()}/>

    <section className="wrap section" id="secki" aria-labelledby="seckiTitle">
      <div className="sectionHead">
        <h2 id="seckiTitle">Koleksiyon</h2>
        <a className="under" href="/koleksiyon">Tüm modeller</a>
      </div>
      {first ? <div className="showcase">
        <Card m={first} {...a} size="feature"/>
        {rest.slice(0, 2).map(m => <Card key={m.id} m={m} {...a}/>)}
      </div> : <p>Güncel koleksiyonu atölyede keşfedebilirsiniz.</p>}
      <ConceptNote models={data.models}/>
    </section>

    <section className="editorial">
      <div className="edPhoto"><img src={src('/images/atelier.webp')} loading="lazy" alt="Fildişi kumaş üzerinde kaplı düğmeler dikilirken"/></div>
      <div className="edText">
        <h2>Gelinliği önce fotoğrafınızda görün.</h2>
        <p>Tam boy bir fotoğraf yükleyin, seçtiğiniz model üzerinizde dijital olarak canlansın. Sonuç bir ön izlemedir; asıl karar provada, kumaşa dokunarak verilir.</p>
        <button className="btn dark" onClick={() => open()}>Sanal denemeyi aç</button>
      </div>
    </section>

    {story && <section className="wrap journalTeaser">
      <h2>{story.title}</h2>
      <div>
        <p>{story.intro}</p>
        <a href={'/hikayeler/' + story.id} className="under">Yazının devamı</a>
      </div>
    </section>}
    <Visit/>
  </main>;
}

function Visit() {
  return <section className="visitBand">
    <div className="wrap visitInner">
      <h2>İlk provada buluşalım.</h2>
      <div className="visitInfo">
        <p className="visitAddress"><Icon name="pin"/><span>{address}</span></p>
        <p>Provalar randevuyla yapılır. Size uygun saati seçin, onayı biz iletelim.</p>
        <div className="buttons">
          <a href="/randevu" className="btn ivory">Prova randevusu al</a>
          <a href={wa} target="_blank" rel="noreferrer" className="btn glass">WhatsApp’tan yazın</a>
        </div>
      </div>
    </div>
  </section>;
}

function Collection({saved = false, ...a}: Actions & {saved?: boolean}) {
  const [filter, setFilter] = useState('Tümü');
  const base = a.data.models.filter(m => !saved || a.favorites.includes(m.id));
  const filtered = base.filter(m => filter === 'Tümü' || m.silhouette === filter);
  return <main className="wrap innerPage">
    <a className="crumb" href="/">Ana sayfa</a>
    <header className="pageHead">
      <h1>{saved ? 'Favorileriniz' : 'Koleksiyon'}</h1>
      <p className="lead">{saved ? 'Beğendiğiniz modeller bu cihazda sizin için bir arada duruyor.' : 'Bir kesim, bir kumaş, bir duruş. Size yakın gelen silüeti keşfedin.'}</p>
    </header>
    {base.length > 0 && <div className="filters">
      <div className="chips" role="group" aria-label="Silüete göre filtrele">
        {['Tümü', ...new Set(base.map(x => x.silhouette))].map(f => <button className={filter === f ? 'chosen' : ''} aria-pressed={filter === f} key={f} onClick={() => setFilter(f)}>{f}</button>)}
      </div>
      <span>{filtered.length} model</span>
    </div>}
    <div className="modelGrid">{filtered.map(m => <Card key={m.id} m={m} {...a}/>)}</div>
    {!saved && <ConceptNote models={filtered}/>}
    {!base.length && <div className="empty">
      <Icon name="heart"/>
      <h2>{saved ? 'Henüz favoriniz yok.' : 'Koleksiyon hazırlanıyor.'}</h2>
      <p>{saved ? 'Bir modelin üzerindeki kalbe dokunduğunuzda burada saklanır.' : 'Mağazada deneyebileceğiniz modeller için atölyemize ulaşabilirsiniz.'}</p>
      <a href={saved ? '/koleksiyon' : '/randevu'} className="btn dark">{saved ? 'Koleksiyonu keşfet' : 'Prova randevusu al'}</a>
    </div>}
  </main>;
}

function Product({m, ...a}: Actions & {m: Model}) {
  const [n, setN] = useState(0);
  const liked = a.favorites.includes(m.id);
  const views = ['önden görünüm', 'arkadan görünüm', 'detay'];
  return <main className="wrap innerPage">
    <a className="crumb" href="/koleksiyon">Koleksiyona dön</a>
    <div className="productGrid">
      <div className="productMedia">
        <div className="largePhoto"><img src={src(m.images[n] || m.images[0])} alt={m.name + ', ' + (views[n] || 'görsel ' + (n + 1))}/></div>
        {m.images.length > 1 && <div className="gallery">
          {m.images.map((im, i) => <button aria-pressed={i === n} aria-label={views[i] || 'Görsel ' + (i + 1)} key={im + i} onClick={() => setN(i)}><img src={src(im)} alt=""/></button>)}
        </div>}
      </div>
      <div className="productInfo">
        {m.concept && <span className="tag inline">Konsept model</span>}
        <h1>{m.name}</h1>
        <p className="lead">{m.description}</p>
        <dl>
          <div><dt>Silüet</dt><dd>{m.silhouette}</dd></div>
          <div><dt>Kumaş</dt><dd>{m.fabric}</dd></div>
        </dl>
        {m.concept && <p className="hint">Bu görseller bir tasarım konseptini gösterir. Provanızda stil referansı olarak kullanabilirsiniz.</p>}
        <div className="stack actions">
          <button className="btn dark" onClick={() => a.open(m.id)}>Üzerimde gör</button>
          <a href={'/randevu?model=' + m.id} className="btn line">Bu model için randevu al</a>
          <button className="favText" aria-pressed={liked} onClick={() => a.toggle(m.id)}>
            <Icon name="heart" size={18} filled={liked}/>{liked ? 'Favorilerinizde' : 'Favorilere ekle'}
          </button>
        </div>
      </div>
    </div>
  </main>;
}

function Stories({data, story}: {data: Data, story?: Story}) {
  const clients = data.content.stories.filter(s => s.category === 'Gelin hikâyeleri' && s.permission);
  if (story) return <main className="wrap innerPage">
    <a href="/hikayeler" className="crumb">Atölye günlüğüne dön</a>
    <article className="article">
      <p className="category">{story.category}</p>
      <h1>{story.title}</h1>
      <p className="lead">{story.intro}</p>
      <img src={src(story.image)} alt=""/>
      {story.body.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      <a href="/randevu" className="btn dark">Prova randevusu al</a>
    </article>
  </main>;
  return <main className="wrap innerPage">
    <a href="/" className="crumb">Ana sayfa</a>
    <header className="pageHead">
      <h1>Atölye günlüğü</h1>
      <p className="lead">Kumaşlar, silüetler ve prova günü üzerine notlar.</p>
    </header>
    <div className="storyGrid">
      {data.content.stories.filter(s => s.category !== 'Gelin hikâyeleri').map(s => <a key={s.id} href={'/hikayeler/' + s.id}>
        <img src={src(s.image)} alt="" loading="lazy"/>
        <p className="category">{s.category}</p>
        <h2>{s.title}</h2>
        <p>{s.intro}</p>
      </a>)}
    </div>
    <section className="realStories">
      <h2>Gelinlerimizden</h2>
      {clients.length
        ? clients.map(s => <a key={s.id} className="under" href={'/hikayeler/' + s.id}>{s.title}</a>)
        : <p>Gelinlerimizin kendi sözlerine ve izinli fotoğraflarına ayrılan bu bölümde henüz yayımlanmış bir hikâye yok.</p>}
    </section>
  </main>;
}

function Privacy({d}: {d: Data}) {
  return <main className="wrap innerPage article">
    <a className="crumb" href="/">Ana sayfa</a>
    <h1>Gizlilik ve verileriniz</h1>
    <p className="lead">Bu sayfa, sitede paylaştığınız bilgilerin nasıl işlendiğini anlatır.</p>
    <h2>Veri sorumlusu</h2>
    <p>{d.controller ? d.controller + '. Başvuru adresi: ' + d.privacyEmail : 'İşletmenin resmî veri sorumlusu ve başvuru bilgileri henüz girilmedi. Bu bilgiler girilene kadar çevrim içi randevu kapalıdır.'}</p>
    <h2>Barındırma</h2>
    <p>Site, randevu kayıtları ve ürün görselleri Cloudflare altyapısında barındırılır. Cloudflare yurt dışında bulunan bir hizmet sağlayıcıdır; bu nedenle kayıtlar yurt dışındaki sunucularda işlenebilir.</p>
    <h2>Prova randevusu</h2>
    <p>Randevu formuna yazdığınız ad, soyad, telefon, model, seçilen saat ve isteğe bağlı düğün tarihi, talebinizi almak, planlamak ve durumunu bildirmek için işlenir. Dayanak, KVKK 5/2(c) kapsamında talebiniz üzerine sözleşmenin kurulması veya ifasıyla doğrudan ilgili işlemlerdir. Kayıtlara yalnızca işletme yöneticisi erişir. Yeni talepler işletmenin e-posta adresine bildirim olarak iletilebilir. Randevu tarihinden 180 gün sonra kayıtlar silinir.</p>
    <h2>Sanal deneme için fotoğraf</h2>
    <p>Sanal deneme isteğe bağlıdır. Ücretsiz deneysel provada fotoğrafınız, ayrı izin kutusunu işaretleyip oluştur düğmesine bastığınızda, gelinlik görseliyle birlikte tarayıcınızdan doğrudan Hugging Face üzerindeki FASHN demosuna gönderilir. Fotoğraf ve sonuç bu sitenin veritabanına yazılmaz. Demo dosyalarına bağlantıya sahip kişilerce erişilebilir; saklama süresini ve silinmesini Hugging Face ve demo işletmecisi yönetir. “Sonucu bu cihazdan kaldır” seçeneği yalnızca bu tarayıcıdaki sonucu kaldırır.</p>
    <p>Bu işlem sırasında fotoğrafınız yurt dışındaki bir sağlayıcıya aktarılır. Sıra, kullanım kotası ve hizmetin erişilebilirliği sağlayıcının koşullarına bağlıdır. <a className="under" href="https://huggingface.co/privacy" target="_blank" rel="noreferrer">Hugging Face gizlilik koşulları</a></p>
    <p>{d.transfer || 'İşletmeye özel bir yapay zekâ sağlayıcısı etkinleştirildiğinde sağlayıcının adı, aktarım ve saklama bilgileri burada ayrıca belirtilir.'}</p>
    <h2>WhatsApp ve ölçüm</h2>
    <p>WhatsApp bağlantılarına dokunduğunuzda kendi WhatsApp uygulamanıza geçersiniz; mesajı siz gönderirsiniz. {d.notifications ? 'İsteğe bağlı WhatsApp bildirimini seçerseniz ad, telefon, prova saati ve durum onaylı bir şablonla Meta hizmetine iletilir.' : 'Otomatik WhatsApp bildirimi şu anda kullanılmıyor.'} Ölçüm etkinse Google Analytics ve Meta Pixel yalnızca izin vermeniz hâlinde yüklenir. Form alanları, takip kodu ve fotoğraflar ölçüm verisine eklenmez.</p>
    <h2>Haklarınız</h2>
    <p>KVKK’nın 11. maddesi kapsamında verinizin işlenip işlenmediğini öğrenebilir, bilgi isteyebilir, amaca uygun kullanımı ve aktarılan alıcıları öğrenebilir, düzeltme veya silme talebinde bulunabilirsiniz. Düzeltme ve silme işlemlerinin alıcılara bildirilmesini isteyebilir, otomatik analizden doğan aleyhinize bir sonuca itiraz edebilir ve hukuka aykırı işlem nedeniyle zararınızın giderilmesini talep edebilirsiniz. Başvurunuzu yukarıdaki veri sorumlusuna iletebilirsiniz.</p>
    <p><a className="under" href="https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-" target="_blank" rel="noreferrer">KVKK aydınlatma yükümlülüğü</a></p>
  </main>;
}

function Metrics({d}: {d: Data}) {
  const [choice, setChoice] = useState('no');
  useEffect(() => { try { setChoice(localStorage.getItem('be:measure') || ''); } catch { setChoice('no'); } }, []);
  useEffect(() => {
    if (choice !== 'yes' || d.preview) return;
    const w = window as any;
    const script = (url: string) => { const s = document.createElement('script'); s.src = url; s.async = true; document.head.appendChild(s); };
    if (d.analytics.ga && !w.gtag) {
      w.dataLayer = w.dataLayer || [];
      w.gtag = function () { w.dataLayer.push(arguments); };
      w.gtag('js', new Date());
      w.gtag('config', d.analytics.ga, {page_location: location.origin + location.pathname});
      script('https://www.googletagmanager.com/gtag/js?id=' + d.analytics.ga);
    }
    if (d.analytics.pixel && !w.fbq) {
      const fb: any = function (...args: any[]) { fb.callMethod ? fb.callMethod(...args) : fb.queue.push(args); };
      fb.queue = []; fb.loaded = true; fb.version = '2.0'; w.fbq = fb;
      fb('init', d.analytics.pixel); fb('track', 'PageView');
      script('https://connect.facebook.net/en_US/fbevents.js');
    }
  }, [choice, d]);
  if (!d.analytics.ga && !d.analytics.pixel) return null;
  function select(v: string) { try { localStorage.setItem('be:measure', v); } catch {} setChoice(v); if (v === 'no') location.reload(); }
  return choice
    ? <button className="footLink" onClick={() => setChoice('')}>Çerez tercihleri</button>
    : <div className="cookie" role="dialog" aria-label="Çerez tercihi">
      <p>Site kullanımını ölçmek için isteğe bağlı Google Analytics ve Meta Pixel çerezlerine izin verir misiniz?</p>
      <button onClick={() => select('no')}>Reddet</button>
      <button onClick={() => select('yes')}>İzin ver</button>
    </div>;
}

export default function Atelier({data, initialPath = '/'}: {data: Data, initialPath?: string}) {
  const [route, setRoute] = useState(initialPath);
  const [menu, setMenu] = useState(false);
  const [trial, setTrial] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem('be:favorites') || '[]');
      if (Array.isArray(r)) setFavorites(r.filter(x => typeof x === 'string'));
    } catch {}
  }, []);
  useEffect(() => {
    if (!data.preview) return;
    const read = () => {
      const hash = location.hash.slice(1);
      setRoute(hash.startsWith('/') ? hash : '/'); setMenu(false); setTrial(null);
      if (hash === 'secki') setTimeout(() => document.getElementById('secki')?.scrollIntoView(), 0); else window.scrollTo(0, 0);
    };
    read();
    const click = (e: MouseEvent) => {
      const anchor = (e.target as Element)?.closest('a[href]');
      const to = anchor?.getAttribute('href');
      if (!to?.startsWith('/') || to.startsWith('//') || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      if (location.hash === '#' + to) read(); else location.hash = to;
    };
    document.addEventListener('click', click);
    window.addEventListener('hashchange', read);
    return () => { document.removeEventListener('click', click); window.removeEventListener('hashchange', read); };
  }, [data.preview]);

  function toggle(id: string) {
    setFavorites(old => {
      const next = old.includes(id) ? old.filter(i => i !== id) : [...old, id];
      try { localStorage.setItem('be:favorites', JSON.stringify(next)); } catch {}
      return next;
    });
    event('favorite_interaction');
  }
  const open = (id?: string) => { setTrial(id || ''); setMenu(false); };
  const a = {data, favorites, toggle, open};
  const [base, query] = route.split('?');
  const [section, sub] = base.split('/').filter(Boolean);
  const m = data.models.find(x => x.id === sub);
  const s = data.content.stories.find(x => x.id === sub);
  const isHome = !section;
  let body;
  if (!section) body = <Home {...a}/>;
  else if (section === 'koleksiyon' && !sub) body = <Collection {...a}/>;
  else if (section === 'koleksiyon' && m) body = <Product key={m.id} {...a} m={m}/>;
  else if (section === 'favoriler') body = <Collection key="favoriler" {...a} saved/>;
  else if (section === 'hikayeler' && (!sub || s)) body = <Stories data={data} story={s}/>;
  else if (section === 'randevu') body = <Booking data={data} initial={new URLSearchParams(query).get('model') || ''}/>;
  else if (section === 'yonetim') body = <Admin preview={data.preview}/>;
  else if (section === 'gizlilik') body = <Privacy d={data}/>;
  else body = <main className="wrap innerPage"><h1>Sayfa bulunamadı.</h1><a href="/" className="under">Ana sayfaya dön</a></main>;

  return <>
    <a className="skip" href="#icerik">İçeriğe geç</a>
    <header className={'header' + (isHome ? ' overHero' : '') + (menu ? ' menuOpen' : '')}>
      <div className="navInner">
        <button className="menuBtn iconBtn" aria-label={menu ? 'Menüyü kapat' : 'Menüyü aç'} aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'}/></button>
        <nav className="navL" aria-label="Ana menü">
          <a href="/koleksiyon" aria-current={section === 'koleksiyon' ? 'page' : undefined}>Koleksiyon</a>
          <button onClick={() => open()}>Sanal deneme</button>
          <a href="/hikayeler" aria-current={section === 'hikayeler' ? 'page' : undefined}>Atölye günlüğü</a>
        </nav>
        <a href="/" className="brand" aria-label="By Erdoğan ana sayfa"><Wordmark light={isHome && !menu}/></a>
        <div className="navR">
          <a className="navFav" href="/favoriler" aria-label={'Favoriler, ' + favorites.length + ' model'}><Icon name="heart" size={20}/>{favorites.length > 0 && <sup>{favorites.length}</sup>}</a>
          <a className="navBooking" href="/randevu">Randevu al</a>
        </div>
      </div>
      {menu && <nav className="mobileNav" aria-label="Mobil menü">
        <a href="/koleksiyon">Koleksiyon</a>
        <button onClick={() => open()}>Sanal deneme</button>
        <a href="/favoriler">Favorilerim{favorites.length > 0 ? ' (' + favorites.length + ')' : ''}</a>
        <a href="/hikayeler">Atölye günlüğü</a>
        <a href="/randevu">Randevu al</a>
      </nav>}
    </header>
    <div id="icerik" tabIndex={-1}>{body}</div>
    <footer>
      <div className="wrap footerTop">
        <div className="footBrand"><a href="/" className="brand"><Wordmark/></a><p>{address}</p></div>
        <nav aria-label="Site"><a href="/koleksiyon">Koleksiyon</a><a href="/hikayeler">Atölye günlüğü</a><a href="/randevu">Prova randevusu</a><a href="/favoriler">Favoriler</a></nav>
        <nav aria-label="İletişim"><a href={ig} target="_blank" rel="noreferrer">Instagram</a><a href={wa} target="_blank" rel="noreferrer">WhatsApp</a><a href="/gizlilik">Gizlilik ve KVKK</a></nav>
      </div>
      <div className="wrap footerBottom"><span>By Erdoğan Gelinlik, Isparta</span><Metrics d={data}/><a href="/yonetim">Atölye girişi</a></div>
    </footer>
    {trial !== null && <TryOn data={data} initial={trial} close={() => setTrial(null)} favorites={favorites} toggle={toggle}/>}
  </>;
}
