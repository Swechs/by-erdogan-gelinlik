import {useEffect, useRef, useState} from 'react';
import type {Data, Model} from './types';
import {request, readFile, err, event, src} from './types';
import {freeTryOn, type FreeProgress} from './freeTryOn';
import Icon from './Icons';

type Trial = {
  key: string;
  model: string;
  state: string;
  photo: string;
  free: boolean;
  url?: string;
  error?: string;
};

const progressLabels: Record<string, string> = {
  uploading: 'Fotoğraflar yükleniyor…',
  queued: 'Denemeniz sırada. Bu işlem birkaç dakika sürebilir.',
  processing: 'Dijital provanız hazırlanıyor…',
  downloading: 'Sonuç görseliniz alınıyor…'
};

export default function TryOn({
  data, initial, close, favorites, toggle
}: {
  data: Data;
  initial: string;
  close: () => void;
  favorites: string[];
  toggle: (id: string) => void;
}) {
  const [id, setModel] = useState(initial || data.models.find(m => m.tryOn)?.id || data.models[0]?.id || '');
  const [photo, setPhoto] = useState('');
  const [consent, setConsent] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [active, setActive] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [split, setSplit] = useState(50);
  const [pollSequence, setPollSequence] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const urls = useRef<string[]>([]);
  const mounted = useRef(false);
  const operation = useRef<AbortController | null>(null);
  const model = data.models.find(m => m.id === id);
  const useFree = !!data.freeTryOn && (!data.tryOn || !model?.tryOn || model.concept);
  const allowed = !data.preview && !!model && (useFree || (model.tryOn && data.tryOn && !model.concept));
  const selected = trials.find(t => t.key === active);
  const resultModel = data.models.find(m => m.id === selected?.model);

  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      mounted.current = false;
      operation.current?.abort();
      document.body.style.overflow = previous;
      urls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const pending = trials.filter(t => !t.free && !['succeeded', 'failed'].includes(t.state));
    if (!pending.length) return;
    let stopped = false;
    const timer = setTimeout(async () => {
      for (const trial of pending) {
        try {
          const result = await request('try/status', {key: trial.key});
          let url: string | undefined;
          if (result.state === 'succeeded') {
            const response = await fetch('/api/try/image', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({key: trial.key})
            });
            if (!response.ok) throw Error('Sonuç görseli alınamadı.');
            url = URL.createObjectURL(await response.blob());
            if (stopped) {
              URL.revokeObjectURL(url);
              return;
            }
            urls.current.push(url);
          }
          if (!stopped) {
            setTrials(list => list.map(t => t.key === trial.key
              ? {...t, state: result.state, url, error: result.error}
              : t));
          }
        } catch (error) {
          if (!stopped) setMessage(err(error));
        }
      }
      if (!stopped) setPollSequence(n => n + 1);
    }, 3500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [trials, pollSequence]);

  async function start() {
    if (!allowed || !photo || !consent || busy || !model) return;
    setMessage('');
    setBusy(true);
    if (!useFree) {
      try {
        const result = await request('try/start', {model: id, photo, consent});
        if (!mounted.current) return;
        setTrials(list => [...list, {...result, model: id, photo, free: false}]);
        setActive(result.key);
        event('try_on_started');
      } catch (error) {
        if (mounted.current) setMessage(err(error));
      } finally {
        if (mounted.current) setBusy(false);
      }
      return;
    }

    const key = crypto.randomUUID();
    const controller = new AbortController();
    operation.current = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 240000);
    setTrials(list => [...list, {key, model: id, photo, free: true, state: 'uploading'}]);
    setActive(key);
    try {
      const blob = await freeTryOn({
        person: photo,
        garment: src(model.images[0]),
        signal: controller.signal,
        progress: (state: FreeProgress) => {
          if (mounted.current && !controller.signal.aborted) {
            setTrials(list => list.map(t => t.key === key ? {...t, state} : t));
          }
        }
      });
      if (!mounted.current || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setTrials(list => list.map(t => t.key === key ? {...t, state: 'succeeded', url} : t));
      event('try_on_completed');
    } catch (error) {
      if (mounted.current) {
        const text = controller.signal.reason === 'timeout'
          ? 'Ücretsiz servis uzun süre yanıt vermedi. Daha sonra yeniden deneyebilirsiniz.'
          : controller.signal.aborted ? 'Deneme takibi durduruldu.' : err(error);
        setTrials(list => list.map(t => t.key === key ? {...t, state: 'failed', error: text} : t));
      }
    } finally {
      clearTimeout(timeout);
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;
    if (selected.free) {
      operation.current?.abort();
      if (selected.url) URL.revokeObjectURL(selected.url);
      setTrials(list => list.filter(t => t.key !== selected.key));
      setActive('');
      setMessage('Bu cihazdaki deneme kaldırıldı. Hugging Face dosyalarının saklanmasını sağlayıcı yönetir.');
      return;
    }
    setBusy(true);
    try {
      await request('try/delete', {key: selected.key});
      if (selected.url) URL.revokeObjectURL(selected.url);
      setTrials(list => list.filter(t => t.key !== selected.key));
      setActive('');
      setMessage('Denemenize erişim kapatıldı. Silme işlemi sıraya alındı.');
    } catch (error) {
      setMessage(err(error));
    } finally {
      setBusy(false);
    }
  }

  const booking = (m?: Model) => '/randevu' + (m ? '?model=' + encodeURIComponent(m.id) : '');

  return <dialog ref={dialog} className="tryDialog"
    onCancel={e => {e.preventDefault(); close();}} aria-labelledby="tryTitle">
    <div className="dialogTop">
      <span className="kicker">BY ERDOĞAN · SANAL PROVA</span>
      <button className="iconBtn" aria-label="Sanal denemeyi kapat" onClick={close}><Icon name="close"/></button>
    </div>
    <div className="tryGrid">
      <div className="tryVisual">
        <img src={src(model?.images[0] || data.content.hero)} alt={model?.name || 'Gelinlik'}/>
        <span>{model?.name}{model?.concept ? ' · Konsept' : ''}</span>
      </div>
      <div className="tryForm">
        <h2 id="tryTitle">Hayalini Kurduğun Gelinliği <em>Üzerinde Gör.</em></h2>
        <p>Bir fotoğraf, bir hayal ve sana özel bir ilk bakış.</p>
        {useFree && <p className="hint">Ücretsiz deneysel prova · FASHN / Hugging Face. Kullanım kotaya ve servis yoğunluğuna bağlıdır.</p>}
        <ol className="steps">
          <li>01 <span>Gelinliğini seç</span></li>
          <li>02 <span>Fotoğrafını yükle</span></li>
          <li>03 <span>Hayalini gör</span></li>
        </ol>
        <label>Gelinlik modeli
          <select value={id} disabled={busy} onChange={e => {
            setModel(e.target.value); setActive(''); setMessage(''); setConsent(false);
          }}>
            {data.models.map(m => <option value={m.id} key={m.id}>{m.name}{m.concept ? ' · konsept' : ''}</option>)}
          </select>
        </label>

        {!allowed && !selected && <div className="notice">
          <strong>Sanal deneme bu model için kapalı.</strong>
          <p>Modeli atölye provanız için seçebilirsiniz.</p>
          <a className="under" href={booking(model)} onClick={close}>Atölyede prova planla</a>
        </div>}

        {allowed && !selected && <div className="stack">
          <div className="photoGuide">
            <img src={src('/images/photo-guide.svg')} alt="Karşıdan, baştan ayağa kadraj örneği"/>
            <p>Gün ışığında, sade bir fonda, baştan ayağa göründüğünüz ve yalnız olduğunuz bir fotoğraf seçin. Kollarınızı hafifçe iki yana açın.</p>
          </div>
          <label className="upload"><Icon name="upload"/>{photo ? 'Fotoğrafı değiştir' : 'Tam boy fotoğrafını seç'}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {setPhoto(await readFile(file)); setConsent(false); setMessage('');}
              catch (error) {setMessage(err(error));}
            }}/>
          </label>
          {photo && <div className="thumbrow">
            <img src={photo} alt="Yüklemeye hazır kişisel fotoğraf"/>
            <button onClick={() => {setPhoto(''); setConsent(false);}}>Fotoğrafı kaldır</button>
          </div>}
          <p className="hint">Sonuç dijital ön izlemedir. Yüz, ten tonu, kumaş ve kalıp ayrıntıları değişebilir.
            {' '}<a className="under" href="/gizlilik" target="_blank">Fotoğraf aydınlatması</a>
          </p>
          {useFree && <p className="hint">Fotoğrafınız ve gelinlik görseli tarayıcınızdan Hugging Face üzerindeki FASHN demosuna gönderilir. Servisin görsel dosyalarına bağlantıyla erişilebilir. Saklama süresini sağlayıcı yönetir.</p>}
          <label className="check">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>
            <span>{useFree
              ? 'Fotoğrafımın bu koşullarla Hugging Face / FASHN demosuna gönderilmesine ve dijital prova için işlenmesine izin veriyorum.'
              : 'Fotoğrafımın seçtiğim gelinliği üzerimde görselleştirmek için işlenmesine izin veriyorum.'}</span>
          </label>
          <button className="btn dark" disabled={!photo || !consent || busy} onClick={start}>
            {busy ? 'Gönderiliyor…' : useFree ? 'Ücretsiz provayı oluştur' : 'Dijital provayı oluştur'}
          </button>
        </div>}

        {trials.length > 0 && <div className="chips trialTabs">
          {trials.map((t, index) => <button key={t.key} disabled={busy && t.key !== active}
            onClick={() => setActive(t.key)} aria-pressed={active === t.key}>
            {data.models.find(m => m.id === t.model)?.name} · {index + 1}
          </button>)}
        </div>}

        {selected && <div className="stack" aria-live="polite">
          {selected.url ? <>
            <div className="compare">
              <img src={selected.url} alt="Dijital prova sonucu"/>
              <img src={selected.photo} style={{clipPath: 'inset(0 ' + (100 - split) + '% 0 0)'}} alt="Önceki fotoğraf"/>
              <i style={{left: split + '%'}}/>
            </div>
            <label>Öncesi / sonrası
              <input type="range" min="0" max="100" value={split} onChange={e => setSplit(+e.target.value)}/>
            </label>
            <div className="linkrow">
              <a className="under" href={selected.url} download={'By-Erdogan-' + resultModel?.name + '.webp'}>Sonucu indir</a>
              <button onClick={() => toggle(selected.model)}>{favorites.includes(selected.model) ? 'Favoriden çıkar' : 'Favorilere ekle'}</button>
            </div>
            <p>Bu gelinliği gerçekte denemek ister misiniz?</p>
            <a className="btn dark" href={booking(resultModel)} onClick={close}>Bu Gelinlik İçin Randevu Al</a>
          </> : <p className="notice">
            {selected.state === 'failed' ? selected.error || 'Deneme tamamlanamadı.'
              : progressLabels[selected.state] || 'Dijital provanız hazırlanıyor…'}
          </p>}
          <div className="linkrow">
            <button disabled={busy} onClick={() => setActive('')}>Başka bir model dene</button>
            <button onClick={remove}>{selected.free ? busy ? 'Takibi durdur ve kaldır' : 'Cihazdaki sonucu kaldır' : 'Denemeyi sil'}</button>
          </div>
          {selected.free && selected.state === 'failed' && <a className="under"
            href="https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5" target="_blank" rel="noreferrer">
            Hugging Face üzerinde dene
          </a>}
        </div>}
        {message && <p role="status" className="statusText">{message}</p>}
      </div>
    </div>
  </dialog>;
}
