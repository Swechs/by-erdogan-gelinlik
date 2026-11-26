import {useEffect, useRef, useState} from 'react';
import type {Data, Model} from './types';
import {request, readFile, err, event, src, ApiError} from './types';
import {tryOnMode, isTerminal, isFinalStatus, MAX_POLL_MS, downloadName} from './tryOnRules';
import {freeTryOn, type FreeProgress} from './freeTryOn';
import Icon from './Icons';

type Trial = {
  key: string;
  model: string;
  state: string;
  photo: string;
  free: boolean;
  started: number;
  failures?: number;
  mime?: string;
  url?: string;
  error?: string;
};

const progressLabels: Record<string, string> = {
  uploading: 'Fotoğraflar yükleniyor…',
  waiting: 'Ücretsiz servis şu an yoğun. Sıra açılınca denemeniz otomatik başlayacak…',
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
  const mode = tryOnMode(data, model);
  const useFree = mode === 'free';
  const allowed = mode !== null;
  const selected = trials.find(t => t.key === active);
  const resultModel = data.models.find(m => m.id === selected?.model);
  const shownModel = selected ? resultModel : model;

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
    const pending = trials.filter(t => !t.free && !isTerminal(t.state));
    if (!pending.length) return;
    let stopped = false;
    const update = (key: string, patch: Partial<Trial>) => {
      if (!stopped) setTrials(list => list.map(t => t.key === key ? {...t, ...patch} : t));
    };
    const timer = setTimeout(async () => {
      for (const trial of pending) {
        if (stopped) return;
        if (Date.now() - trial.started > MAX_POLL_MS) {
          update(trial.key, {state: 'failed', error: 'Deneme beklenenden uzun sürdü ve takibi durduruldu. Yeniden deneyebilirsiniz.'});
          continue;
        }
        try {
          const result = await request('try/status', {key: trial.key});
          if (result.state === 'succeeded') {
            const response = await fetch('/api/try/image', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({key: trial.key})
            });
            if (!response.ok) throw new ApiError('Sonuç görseli alınamadı.', response.status);
            const blob = await response.blob();
            if (stopped) return;
            const url = URL.createObjectURL(blob);
            urls.current.push(url);
            update(trial.key, {state: 'succeeded', url, mime: blob.type, failures: 0});
            event('try_on_completed');
          } else {
            update(trial.key, {state: result.state, error: result.error, failures: 0});
          }
        } catch (error) {
          if (error instanceof ApiError && isFinalStatus(error.status)) {
            update(trial.key, {state: 'expired', error: 'Bu denemenin süresi doldu veya silindi. Yeni bir deneme başlatabilirsiniz.'});
          } else if ((trial.failures || 0) >= 4) {
            update(trial.key, {state: 'failed', error: 'Deneme durumu alınamadı. Bağlantınızı kontrol edip yeniden deneyin.'});
          } else {
            update(trial.key, {failures: (trial.failures || 0) + 1});
          }
        }
      }
      if (!stopped) setPollSequence(n => n + 1);
    }, 3500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [trials, pollSequence]);

  async function start(retry?: Trial) {
    const modelId = retry ? retry.model : id;
    const target = data.models.find(m => m.id === modelId);
    const image = retry ? retry.photo : photo;
    const targetMode = tryOnMode(data, target);
    if (!targetMode || !target || !image || busy || (!retry && !consent)) return;
    const free = targetMode === 'free';
    setMessage('');
    setBusy(true);
    if (!free) {
      try {
        const result = await request('try/start', {model: modelId, photo: image, consent: true});
        if (!mounted.current) return;
        setTrials(list => [...list.filter(t => t.key !== retry?.key), {key: result.key, state: result.state, model: modelId, photo: image, free: false, started: Date.now()}]);
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
    setTrials(list => [...list.filter(t => t.key !== retry?.key), {key, model: modelId, photo: image, free: true, state: 'uploading', started: Date.now()}]);
    setActive(key);
    event('try_on_started');
    try {
      const blob = await freeTryOn({
        person: image,
        garment: src(target.images[0]),
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
      setTrials(list => list.map(t => t.key === key ? {...t, state: 'succeeded', url, mime: blob.type} : t));
      event('try_on_completed');
    } catch (error) {
      if (mounted.current) {
        const text = controller.signal.reason === 'timeout'
          ? 'Ücretsiz servis uzun süre yanıt vermedi. Daha sonra yeniden deneyebilirsiniz.'
          : controller.signal.aborted ? 'Deneme iptal edildi.' : err(error);
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
      setMessage('Sonuç bu cihazdan kaldırıldı. Hugging Face demosuna gönderilen dosyalar buradan silinemez; saklanmalarını sağlayıcı yönetir.');
      return;
    }
    setBusy(true);
    const forget = (text: string) => {
      if (selected.url) URL.revokeObjectURL(selected.url);
      setTrials(list => list.filter(t => t.key !== selected.key));
      setActive('');
      setMessage(text);
    };
    try {
      await request('try/delete', {key: selected.key});
      forget('Denemeye erişim kapatıldı ve sağlayıcıya silme talebi gönderildi.');
    } catch (error) {
      if (error instanceof ApiError && isFinalStatus(error.status)) {
        forget('Bu denemenin süresi zaten dolmuştu; sonuç bu cihazdan da kaldırıldı.');
      } else setMessage(err(error));
    } finally {
      setBusy(false);
    }
  }

  const booking = (m?: Model) => '/randevu' + (m ? '?model=' + encodeURIComponent(m.id) : '');

  return <dialog ref={dialog} className="tryDialog"
    onCancel={e => {e.preventDefault(); close();}} aria-labelledby="tryTitle">
    <div className="dialogTop">
      <span className="kicker">Sanal deneme</span>
      <button className="iconBtn" aria-label="Sanal denemeyi kapat" onClick={close}><Icon name="close"/></button>
    </div>
    <div className="tryGrid">
      <div className="tryVisual">
        <img src={src(shownModel?.images[0] || data.content.hero)} alt={shownModel?.name || 'Gelinlik'}/>
        <span>{shownModel?.name}{shownModel?.concept ? ' · Konsept' : ''}</span>
      </div>
      <div className="tryForm">
        <h2 id="tryTitle">Gelinliği üzerinizde görün.</h2>
        <p>Bir fotoğraf yükleyin, seçtiğiniz model üzerinizde dijital olarak canlansın.</p>
        {useFree && <p className="hint">Ücretsiz deneysel prova · FASHN / Hugging Face. Kullanım kotaya ve servis yoğunluğuna bağlıdır.</p>}
        <ol className="steps">
          <li>1 <span>Gelinliği seçin</span></li>
          <li>2 <span>Fotoğrafınızı yükleyin</span></li>
          <li>3 <span>Sonucu görün</span></li>
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
          <button className="btn dark" disabled={!photo || !consent || busy} onClick={() => start()}>
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
              <a className="under" href={selected.url} download={downloadName(resultModel?.name, selected.mime)}>Sonucu indir</a>
              <button onClick={() => toggle(selected.model)}>{favorites.includes(selected.model) ? 'Favoriden çıkar' : 'Favorilere ekle'}</button>
            </div>
            <p>Bu gelinliği gerçekte denemek ister misiniz?</p>
            <a className="btn dark" href={booking(resultModel)} onClick={close}>Bu Gelinlik İçin Randevu Al</a>
          </> : <p className="notice">
            {isTerminal(selected.state) ? selected.error || 'Deneme tamamlanamadı.'
              : progressLabels[selected.state] || 'Dijital provanız hazırlanıyor…'}
          </p>}
          {!selected.url && isTerminal(selected.state) && tryOnMode(data, resultModel) &&
            <button className="btn line" disabled={busy} onClick={() => start(selected)}>Aynı fotoğrafla yeniden dene</button>}
          <div className="linkrow">
            <button disabled={busy} onClick={() => setActive('')}>Başka bir model dene</button>
            <button onClick={remove}>{selected.free ? !isTerminal(selected.state) ? 'Denemeyi iptal et' : selected.url ? 'Sonucu bu cihazdan kaldır' : 'Denemeyi kapat' : 'Denemeyi sil'}</button>
          </div>
          {selected.free && isTerminal(selected.state) && !selected.url && <a className="under"
            href="https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5" target="_blank" rel="noreferrer">
            Hugging Face üzerinde dene
          </a>}
        </div>}
        {message && <p role="status" className="statusText">{message}</p>}
      </div>
    </div>
  </dialog>;
}
