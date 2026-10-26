import { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  ArrowLeft,
  MessageSquare,
  Signal,
  BatteryFull,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { LANDING_SITES } from '../data/sites';
import { evaluateRisk } from '../lib/riskEngine';
import { weatherClient, summarizeHours, toWeatherMetrics } from '../lib/weather';
import { marineClient } from '../lib/marine/marineClient';
import { getWorstWaveHeight } from '../lib/marine/marineBridge';

interface FeaturePhoneSimulatorProps {
  onBackToHome?: () => void;
}

type Site = (typeof LANDING_SITES)[number];
type Screen = 'home' | 'dialer' | 'ussd' | 'inbox' | 'thread' | 'compose';
type UssdStep = 'main' | 'region' | 'sitelist' | 'info' | 'result';
type Msg = { id: number; dir: 'in' | 'out'; body: string; time: string };
type Thread = { id: string; name: string; unread: boolean; msgs: Msg[] };
type Report =
  | { state: 'offline' }
  | { state: 'error' }
  | { state: 'ok'; level: string; score: number; windKmh: number; waves: number; safe: boolean };

const KMH_PER_KNOT = 1.852;
const LAKE_WAVE_PER_KNOT = 0.04;
const USSD_CODE = '*483#';
const SHORTCODE = '20880';

const MULTITAP: Record<string, string> = {
  '1': '.,?!1',
  '2': 'ABC2',
  '3': 'DEF3',
  '4': 'GHI4',
  '5': 'JKL5',
  '6': 'MNO6',
  '7': 'PQRS7',
  '8': 'TUV8',
  '9': 'WXYZ9',
  '0': ' 0',
};

const KEYS = [
  { key: '1', sub: '.,?' },
  { key: '2', sub: 'ABC' },
  { key: '3', sub: 'DEF' },
  { key: '4', sub: 'GHI' },
  { key: '5', sub: 'JKL' },
  { key: '6', sub: 'MNO' },
  { key: '7', sub: 'PQRS' },
  { key: '8', sub: 'TUV' },
  { key: '9', sub: 'WXYZ' },
  { key: '*', sub: '' },
  { key: '0', sub: '␣' },
  { key: '#', sub: '' },
];

const nairobiTime = (d: Date) =>
  d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
const nairobiDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Nairobi' });

async function fetchReport(site: Site): Promise<Report> {
  try {
    const weather = await weatherClient.getForecast({ latitude: site.lat, longitude: site.lon });
    if (weather.status === 'unavailable') return { state: 'offline' };

    const hours = weather.data.hours.slice(0, 12);
    const summary = summarizeHours(hours);
    let waves = 0.5;

    if (site.isOcean) {
      const marine = await marineClient.getMarineForecast(site.lat, site.lon);
      if (marine.status === 'fresh') waves = getWorstWaveHeight(marine.data, 12);
    } else {
      const windKnots = (summary.maxWindGustKmh ?? 0) / KMH_PER_KNOT;
      waves = Math.round(windKnots * LAKE_WAVE_PER_KNOT * 10) / 10;
    }

    const bridged = toWeatherMetrics(summary, waves);
    if (!bridged) return { state: 'error' };
    const assessment = evaluateRisk(bridged.metrics);
    return {
      state: 'ok',
      level: String(assessment.level),
      score: assessment.score,
      windKmh: Math.round(bridged.metrics.windSpeedKnots * KMH_PER_KNOT),
      waves,
      safe: assessment.canGoFishing,
    };
  } catch {
    return { state: 'error' };
  }
}

export function FeaturePhoneSimulator({ onBackToHome }: FeaturePhoneSimulatorProps) {
  const [screen, setScreen] = useState<Screen>('home');
  const [lang, setLang] = useState<'EN' | 'SWA'>('EN');
  const [now, setNow] = useState(new Date());
  const [homeSel, setHomeSel] = useState(0);

  // Dialer + USSD
  const [dial, setDial] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [ussdStep, setUssdStep] = useState<UssdStep>('main');
  const [ussdText, setUssdText] = useState('');
  const [ussdInput, setUssdInput] = useState('');
  const [ussdBusy, setUssdBusy] = useState(false);
  const [siteList, setSiteList] = useState<Site[]>([]);

  // Messages
  const [threads, setThreads] = useState<Thread[]>([
    {
      id: SHORTCODE,
      name: 'BahariSafe',
      unread: false,
      msgs: [
        {
          id: 1,
          dir: 'in',
          body: 'Welcome to BahariSafe. Send BAHARI KISUMU to 20880 for a fishing safety report.',
          time: '08:00',
        },
      ],
    },
    {
      id: 'kma',
      name: 'KMA Alerts',
      unread: true,
      msgs: [
        {
          id: 2,
          dir: 'in',
          body: 'KMA: Strong winds expected along the Coast this afternoon. Fishers take caution.',
          time: '07:30',
        },
      ],
    },
  ]);
  const [inboxSel, setInboxSel] = useState(0);
  const [activeThread, setActiveThread] = useState<string>(SHORTCODE);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const lastTap = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const threadEnd = useRef<HTMLDivElement>(null);
  const msgId = useRef(100);

  const t = (en: string, sw: string) => (lang === 'EN' ? en : sw);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const activeMsgCount = threads.find(th => th.id === activeThread)?.msgs.length ?? 0;
  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end' });
  }, [activeMsgCount, screen, sending]);

  /* ---------------------------- Messages ---------------------------- */

  const addMessage = (threadId: string, dir: 'in' | 'out', text: string) => {
    msgId.current += 1;
    const msg: Msg = { id: msgId.current, dir, body: text, time: nairobiTime(new Date()) };
    setThreads(prev =>
      prev.map(th => (th.id === threadId ? { ...th, msgs: [...th.msgs, msg], unread: false } : th))
    );
  };

  const smsReply = (site: Site, r: Report) => {
    if (r.state !== 'ok') {
      return t(
        `BAHARISAFE ${site.name}: Live data unavailable. Stay near shore and call 112 if in danger.`,
        `BAHARISAFE ${site.name}: Hali ya hewa haipatikani. Kaa karibu na pwani, piga 112 ukiwa hatarini.`
      );
    }
    return t(
      `BAHARISAFE ${site.name}: ${r.level} ${r.score}/100. Wind ${r.windKmh}km/h, Waves ${r.waves}m. ${
        r.safe ? 'Safe to fish.' : 'Do NOT go out.'
      } Emerg: 112.`,
      `BAHARISAFE ${site.name}: ${r.level} ${r.score}/100. Upepo ${r.windKmh}km/h, Mawimbi ${r.waves}m. ${
        r.safe ? 'Salama kuvua.' : 'USIENDE baharini.'
      } Dharura: 112.`
    );
  };

  const sendSms = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setBody('');
    setActiveThread(SHORTCODE);
    addMessage(SHORTCODE, 'out', text);
    setScreen('thread');
    setSending(true);

    const query = text.toUpperCase().replace('BAHARI', '').trim();
    const site = query
      ? LANDING_SITES.find(
          s => s.name.toUpperCase().includes(query) || String(s.id).toUpperCase() === query
        )
      : undefined;

    if (!site) {
      await new Promise(r => setTimeout(r, 900));
      addMessage(
        SHORTCODE,
        'in',
        t(
          'Format: BAHARI [SITE]. Example: BAHARI KISUMU. Site not found.',
          'Muundo: BAHARI [MWALO]. Mfano: BAHARI KISUMU. Mwalo haukupatikana.'
        )
      );
      setSending(false);
      return;
    }

    const report = await fetchReport(site);
    addMessage(SHORTCODE, 'in', smsReply(site, report));
    setSending(false);
  };

  /* ------------------------------ USSD ------------------------------ */

  const goMain = () => {
    setUssdStep('main');
    setUssdText(
      t(
        'Welcome to BahariSafe\n1. Check weather by region\n2. Emergency contacts\n3. Select site',
        'Karibu BahariSafe\n1. Angalia hali kwa eneo\n2. Nambari za dharura\n3. Chagua mwalo'
      )
    );
  };

  const showSites = (list: Site[]) => {
    setSiteList(list);
    setUssdStep('sitelist');
    setUssdText(
      `${t('Select site:', 'Chagua mwalo:')}\n${list.map((s, i) => `${i + 1}. ${s.name}`).join('\n')}\n0. ${t('Back', 'Rudi')}`
    );
  };

  const openUssd = () => {
    setDial('');
    setUssdInput('');
    setScreen('ussd');
    goMain();
  };

  const processUssd = async () => {
    if (ussdBusy) return;
    const v = ussdInput.trim();
    setUssdInput('');
    if (!v) return;

    if (ussdStep === 'main') {
      if (v === '1') {
        setUssdStep('region');
        setUssdText(
          t(
            'Select region:\n1. Coast (Ocean)\n2. Lake Victoria\n3. Turkana\n0. Back',
            'Chagua eneo:\n1. Pwani (Bahari)\n2. Ziwa Victoria\n3. Turkana\n0. Rudi'
          )
        );
      } else if (v === '2') {
        setUssdStep('info');
        setUssdText(
          t(
            'EMERGENCY\nCoast Guard: 112\nKMA: 0800720021\n0. Back',
            'DHARURA\nWalinzi wa Pwani: 112\nKMA: 0800720021\n0. Rudi'
          )
        );
      } else if (v === '3') {
        showSites(LANDING_SITES.slice(0, 4));
      } else {
        setUssdText(t('Invalid option. Reply 1, 2 or 3.', 'Chaguo si sahihi. Jibu 1, 2 au 3.'));
      }
      return;
    }

    if (ussdStep === 'region') {
      if (v === '0') return goMain();
      const regions: Record<string, string> = { '1': 'Coast', '2': 'Lake Victoria', '3': 'Turkana' };
      const region = regions[v];
      if (!region) return setUssdText(t('Invalid option. Reply 1-3 or 0.', 'Chaguo si sahihi. Jibu 1-3 au 0.'));
      const list = LANDING_SITES.filter(s => s.region.includes(region)).slice(0, 4);
      return showSites(list.length ? list : LANDING_SITES.slice(0, 4));
    }

    if (ussdStep === 'sitelist') {
      if (v === '0') return goMain();
      const site = siteList[parseInt(v, 10) - 1];
      if (!site) return setUssdText(t('Invalid site. Try again or 0 to go back.', 'Mwalo si sahihi. Jaribu tena au 0 kurudi.'));

      setUssdBusy(true);
      setUssdText(t(`Loading forecast for ${site.name}...`, `Inapakia utabiri wa ${site.name}...`));
      const r = await fetchReport(site);
      setUssdBusy(false);
      setUssdStep('result');

      if (r.state === 'offline') {
        setUssdText(t(`${site.name}\nAPI offline. Safe mode active.\n0. Home`, `${site.name}\nHuduma imezimwa. Hali ya tahadhari.\n0. Mwanzo`));
      } else if (r.state === 'error') {
        setUssdText(t(`${site.name}\nUnable to load live metrics.\n0. Home`, `${site.name}\nHaiwezi kupakia data.\n0. Mwanzo`));
      } else {
        setUssdText(
          `${site.name}: ${r.level} (${r.score}/100)\n` +
            `${t('Wind', 'Upepo')}: ${r.windKmh}km/h\n` +
            `${t('Waves', 'Mawimbi')}: ${r.waves}m\n` +
            `${r.safe ? t('✅ Safe to fish.', '✅ Salama kuvua.') : t('❌ Do not go!', '❌ Usiende!')}\n0. ${t('Home', 'Mwanzo')}`
        );
      }
      return;
    }

    // info / result
    if (v === '0') goMain();
    else setUssdText(t('Invalid option. Reply 0 to go back.', 'Chaguo si sahihi. Jibu 0 kurudi.'));
  };

  /* ------------------------------ Dialer ----------------------------- */

  const placeCall = () => {
    const n = dial.trim();
    if (!n) return;
    if (n === USSD_CODE) return openUssd();
    if (n === '112' || n === '999') {
      setNotice(t('Emergency call simulated. Real services not contacted.', 'Simu ya dharura imeigizwa.'));
    } else {
      setNotice('Connection problem or invalid MMI code.');
    }
    setDial('');
  };

  /* ---------------------------- Input / keys ------------------------- */

  const openApp = (i: number) => {
    if (i === 0) {
      setDial('');
      setScreen('dialer');
    } else {
      setInboxSel(0);
      setScreen('inbox');
    }
  };

  const openCompose = () => {
    setBody('');
    lastTap.current = { key: '', time: 0 };
    setScreen('compose');
  };

  const handleKey = (key: string) => {
    if (notice) return setNotice(null);

    if (screen === 'home') {
      setDial(key);
      return setScreen('dialer');
    }
    if (screen === 'dialer') return setDial(p => (p.length < 20 ? p + key : p));
    if (screen === 'ussd') return setUssdInput(p => (p.length < 12 ? p + key : p));

    if (screen === 'compose') {
      const chars = MULTITAP[key];
      const nowMs = Date.now();
      const same = lastTap.current.key === key && nowMs - lastTap.current.time < 900;
      lastTap.current = { key, time: nowMs };
      if (!chars) return setBody(p => (p.length < 160 ? p + key : p));
      setBody(p => {
        if (same && p.length > 0) {
          const idx = chars.indexOf(p[p.length - 1]);
          if (idx >= 0) return p.slice(0, -1) + chars[(idx + 1) % chars.length];
        }
        return p.length < 160 ? p + chars[0] : p;
      });
    }
  };

  const handleChar = (ch: string) => {
    if (screen === 'compose' && /^[a-z ]$/i.test(ch)) {
      return setBody(p => (p.length < 160 ? p + ch.toUpperCase() : p));
    }
    if (/^[0-9*#]$/.test(ch)) handleKey(ch);
  };

  const clearOne = () => {
    if (screen === 'dialer') setDial(p => p.slice(0, -1));
    else if (screen === 'ussd') setUssdInput(p => p.slice(0, -1));
    else if (screen === 'compose') setBody(p => p.slice(0, -1));
  };

  const handleEnd = () => {
    setNotice(null);
    setDial('');
    setBody('');
    setUssdInput('');
    setUssdBusy(false);
    setScreen('home');
  };

  const handleBack = () => {
    if (notice) return setNotice(null);
    if (screen === 'dialer' || screen === 'inbox') return setScreen('home');
    if (screen === 'ussd') {
      setUssdInput('');
      return setScreen('dialer');
    }
    if (screen === 'thread') return setScreen('inbox');
    if (screen === 'compose') return setScreen('inbox');
  };

  const handleCall = () => {
    if (notice) return setNotice(null);
    if (screen === 'home') return openApp(0);
    if (screen === 'dialer') return placeCall();
    if (screen === 'ussd') return void processUssd();
    if (screen === 'compose') return void sendSms();
  };

  const openThread = (id: string) => {
    setActiveThread(id);
    setThreads(prev => prev.map(th => (th.id === id ? { ...th, unread: false } : th)));
    setScreen('thread');
  };

  const handleOk = () => {
    if (notice) return setNotice(null);
    if (screen === 'home') return openApp(homeSel);
    if (screen === 'inbox') return openThread(threads[inboxSel].id);
    handleCall();
  };

  const move = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (screen === 'home') {
      if (dir === 'left') setHomeSel(0);
      if (dir === 'right') setHomeSel(1);
    } else if (screen === 'inbox') {
      if (dir === 'up') setInboxSel(i => Math.max(0, i - 1));
      if (dir === 'down') setInboxSel(i => Math.min(threads.length - 1, i + 1));
    }
  };

  // Soft keys per screen
  const soft = (() => {
    if (notice) return { l: 'OK', lf: () => setNotice(null), r: 'OK', rf: () => setNotice(null) };
    switch (screen) {
      case 'home':
        return { l: t('Phone', 'Simu'), lf: () => openApp(0), r: t('Messages', 'Ujumbe'), rf: () => openApp(1) };
      case 'dialer':
        return { l: dial ? t('Call', 'Piga') : '', lf: placeCall, r: dial ? t('Clear', 'Futa') : t('Back', 'Rudi'), rf: dial ? clearOne : handleBack };
      case 'ussd':
        return { l: ussdBusy ? '' : t('Send', 'Tuma'), lf: () => void processUssd(), r: ussdInput ? t('Clear', 'Futa') : t('Cancel', 'Ghairi'), rf: ussdInput ? clearOne : handleBack };
      case 'inbox':
        return { l: t('New', 'Mpya'), lf: openCompose, r: t('Back', 'Rudi'), rf: handleBack };
      case 'thread':
        return { l: t('Reply', 'Jibu'), lf: openCompose, r: t('Back', 'Rudi'), rf: handleBack };
      case 'compose':
        return { l: body.trim() ? t('Send', 'Tuma') : '', lf: () => void sendSms(), r: body ? t('Clear', 'Futa') : t('Back', 'Rudi'), rf: body ? clearOne : handleBack };
    }
  })();

  // Physical keyboard support (always calls the latest handlers)
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') return clearOne();
    if (e.key === 'Enter') return handleCall();
    if (e.key === 'Escape') return handleBack();
    if (e.key === 'ArrowUp') return move('up');
    if (e.key === 'ArrowDown') return move('down');
    if (e.key === 'ArrowLeft') return move('left');
    if (e.key === 'ArrowRight') return move('right');
    if (e.key.length === 1) handleChar(e.key);
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  /* ------------------------------ Render ----------------------------- */

  const activeT = threads.find(th => th.id === activeThread);
  const apps = [
    { icon: Phone, label: t('Phone', 'Simu'), tint: 'from-emerald-400 to-emerald-600' },
    { icon: MessageSquare, label: t('Messages', 'Ujumbe'), tint: 'from-sky-400 to-blue-600' },
  ];
  const unreadCount = threads.filter(th => th.unread).length;

  return (
    <div className="min-h-screen bg-[#0a1118] flex flex-col items-center justify-center p-4 text-white font-sans">
      {onBackToHome && (
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-2xl text-xs font-bold border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Web App</span>
          </button>
        </div>
      )}

      <div className="text-center mb-4 space-y-1">
        <h2 className="text-xl font-black tracking-tight text-emerald-400">Kabambe Simulator</h2>
        <p className="text-xs text-slate-400">Feature phone USSD ({USSD_CODE}) and SMS ({SHORTCODE}) gateway</p>
      </div>

      <div className="flex space-x-2 mb-5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
        {(['EN', 'SWA'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-4 py-1.5 rounded-xl transition ${lang === l ? 'bg-sky-600 text-white shadow' : 'text-slate-400'}`}
          >
            {l === 'EN' ? 'English' : 'Kiswahili'}
          </button>
        ))}
      </div>

      {/* Phone body */}
      <div className="w-[300px] rounded-[44px] p-4 pb-5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border border-slate-600 shadow-[0_30px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] flex flex-col items-center">
        <div className="flex items-center space-x-2 mt-1 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950 ring-1 ring-slate-600" />
          <div className="w-16 h-1.5 bg-slate-950 rounded-full ring-1 ring-slate-600" />
        </div>

        {/* Screen */}
        <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border-[5px] border-slate-950 bg-slate-950 shadow-inner flex flex-col">
          {/* Status bar */}
          <div className="h-6 px-2.5 flex items-center justify-between text-[10px] font-semibold bg-black/40 text-white/90 z-10">
            <span className="flex items-center space-x-1">
              <Signal className="w-3 h-3" />
              <span>BAHARI•TEL</span>
            </span>
            <span className="flex items-center space-x-1">
              <span>{nairobiTime(now)}</span>
              <BatteryFull className="w-3.5 h-3.5 text-emerald-400" />
            </span>
          </div>

          {/* Content */}
          <div className="relative flex-1 min-h-0">
            {screen === 'home' && (
              <div className="absolute inset-0 bg-gradient-to-b from-sky-600 via-cyan-800 to-slate-900 flex flex-col">
                <svg className="absolute bottom-0 left-0 w-full opacity-30" viewBox="0 0 240 60" preserveAspectRatio="none">
                  <path d="M0 30 Q30 10 60 30 T120 30 T180 30 T240 30 V60 H0Z" fill="#0f172a" />
                  <path d="M0 42 Q30 24 60 42 T120 42 T180 42 T240 42 V60 H0Z" fill="#020617" />
                </svg>
                <div className="relative pt-5 text-center">
                  <div className="text-5xl font-light tracking-tight tabular-nums">{nairobiTime(now)}</div>
                  <div className="text-[11px] text-white/80 mt-1">{nairobiDate(now)}</div>
                </div>
                <div className="relative mt-auto mb-3 flex justify-center space-x-5">
                  {apps.map((a, i) => {
                    const Icon = a.icon;
                    const active = homeSel === i;
                    return (
                      <button
                        key={a.label}
                        onClick={() => {
                          setHomeSel(i);
                          openApp(i);
                        }}
                        className="flex flex-col items-center space-y-1 focus:outline-none"
                      >
                        <div
                          className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${a.tint} flex items-center justify-center shadow-lg transition ${
                            active ? 'ring-2 ring-white scale-105' : 'opacity-90'
                          }`}
                        >
                          <Icon className="w-7 h-7 text-white" />
                          {i === 1 && unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center border-2 border-slate-900">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-white/90">{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(screen === 'dialer' || screen === 'ussd') && (
              <div className="absolute inset-0 bg-slate-100 text-slate-900 flex flex-col">
                <div className="px-3 pt-2 text-[11px] font-semibold text-slate-500">{t('Phone', 'Simu')}</div>
                <div className="flex-1 flex items-center justify-center px-3">
                  <div className="text-3xl font-light tracking-wider break-all text-center tabular-nums">
                    {dial || <span className="text-slate-300 text-base tracking-normal">{t('Enter number', 'Weka nambari')}</span>}
                    {screen === 'dialer' && <span className="animate-pulse text-sky-600">|</span>}
                  </div>
                </div>
              </div>
            )}

            {screen === 'ussd' && (
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-2.5">
                <div className="w-full max-h-full bg-white text-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-2.5 text-[11px] leading-snug whitespace-pre-wrap overflow-y-auto max-h-[190px] flex items-start space-x-1.5">
                    {ussdBusy && <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin shrink-0 text-sky-600" />}
                    <span>{ussdText}</span>
                  </div>
                  <div className="border-t border-slate-200 px-2.5 py-1.5 text-sm font-bold tabular-nums text-sky-700 min-h-[28px]">
                    {ussdInput}
                    <span className="animate-pulse">|</span>
                  </div>
                </div>
              </div>
            )}

            {screen === 'inbox' && (
              <div className="absolute inset-0 bg-white text-slate-900 flex flex-col">
                <div className="px-3 py-1.5 text-[11px] font-bold bg-sky-600 text-white">{t('Messages', 'Ujumbe')}</div>
                <div className="flex-1 overflow-y-auto">
                  {threads.map((th, i) => {
                    const last = th.msgs[th.msgs.length - 1];
                    return (
                      <button
                        key={th.id}
                        onClick={() => {
                          setInboxSel(i);
                          openThread(th.id);
                        }}
                        className={`w-full text-left px-3 py-2 border-b border-slate-200 ${
                          inboxSel === i ? 'bg-sky-100' : 'bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-xs ${th.unread ? 'font-black' : 'font-semibold'}`}>{th.name}</span>
                          <span className="text-[9px] text-slate-400">{last.time}</span>
                        </div>
                        <div className={`text-[10px] truncate ${th.unread ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                          {last.body}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {screen === 'thread' && activeT && (
              <div className="absolute inset-0 bg-slate-100 text-slate-900 flex flex-col">
                <div className="px-3 py-1.5 text-[11px] font-bold bg-sky-600 text-white flex justify-between">
                  <span>{activeT.name}</span>
                  <span className="opacity-80">{activeT.id === 'kma' ? 'KMA' : SHORTCODE}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
                  {activeT.msgs.map(m => (
                    <div key={m.id} className={`flex ${m.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-2.5 py-1.5 text-[11px] leading-snug ${
                          m.dir === 'out' ? 'bg-sky-600 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm shadow-sm'
                        }`}
                      >
                        {m.body}
                        <div className={`text-[8px] mt-0.5 ${m.dir === 'out' ? 'text-sky-100' : 'text-slate-400'}`}>{m.time}</div>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{t('Waiting for reply...', 'Inasubiri jibu...')}</span>
                    </div>
                  )}
                  <div ref={threadEnd} />
                </div>
              </div>
            )}

            {screen === 'compose' && (
              <div className="absolute inset-0 bg-white text-slate-900 flex flex-col">
                <div className="px-3 py-1.5 text-[11px] font-bold bg-sky-600 text-white">{t('New message', 'Ujumbe mpya')}</div>
                <div className="px-3 py-1.5 text-[11px] border-b border-slate-200">
                  <span className="text-slate-500">{t('To', 'Kwa')}: </span>
                  <span className="font-bold">{SHORTCODE}</span>
                </div>
                <div className="flex-1 px-3 py-2 text-sm font-semibold break-words overflow-y-auto">
                  {body || <span className="text-slate-300 font-normal text-xs">{t('Type e.g. BAHARI KISUMU', 'Andika mfano BAHARI KISUMU')}</span>}
                  <span className="animate-pulse text-sky-600">|</span>
                </div>
                <div className="px-3 py-1 text-[9px] text-right text-slate-400 border-t border-slate-200">{body.length}/160</div>
              </div>
            )}

            {notice && (
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-3 z-20">
                <div className="bg-white text-slate-900 rounded-xl p-3 text-xs font-semibold text-center shadow-2xl">{notice}</div>
              </div>
            )}
          </div>

          {/* Soft key labels */}
          <div className="h-7 px-3 flex items-center justify-between text-[11px] font-bold bg-black/70 text-white">
            <span>{soft.l}</span>
            <span>{soft.r}</span>
          </div>
        </div>

        {/* Navigation cluster */}
        <div className="w-full mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1">
          <button
            onClick={soft.lf}
            className="h-9 rounded-full bg-slate-700 hover:bg-slate-600 active:scale-95 text-[10px] font-bold border border-slate-500/50 shadow transition"
            title="Left soft key"
          >
            ◖
          </button>

          <div className="grid grid-cols-3 grid-rows-3 w-[84px] h-[84px] rounded-full bg-slate-900 border border-slate-600 shadow-inner place-items-center">
            <span />
            <button onClick={() => move('up')} className="text-slate-300 hover:text-white active:scale-90"><ChevronUp className="w-4 h-4" /></button>
            <span />
            <button onClick={() => move('left')} className="text-slate-300 hover:text-white active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
            <button
              onClick={handleOk}
              className="w-7 h-7 rounded-full bg-slate-700 hover:bg-sky-600 border border-slate-500 text-[8px] font-black active:scale-90 transition"
            >
              OK
            </button>
            <button onClick={() => move('right')} className="text-slate-300 hover:text-white active:scale-90"><ChevronRight className="w-4 h-4" /></button>
            <span />
            <button onClick={() => move('down')} className="text-slate-300 hover:text-white active:scale-90"><ChevronDown className="w-4 h-4" /></button>
            <span />
          </div>

          <button
            onClick={soft.rf}
            className="h-9 rounded-full bg-slate-700 hover:bg-slate-600 active:scale-95 text-[10px] font-bold border border-slate-500/50 shadow transition"
            title="Right soft key"
          >
            ◗
          </button>
        </div>

        {/* Call / End */}
        <div className="w-full flex justify-between px-1 mt-3">
          <button
            onClick={handleCall}
            className="w-20 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center shadow-md transition active:scale-95"
            title="Call / Send"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={handleEnd}
            className="w-20 h-10 bg-rose-600 hover:bg-rose-500 rounded-full flex items-center justify-center shadow-md transition active:scale-95"
            title="End / Home"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full px-1 mt-4">
          {KEYS.map(btn => (
            <button
              key={btn.key}
              onClick={() => handleKey(btn.key)}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 py-2 rounded-xl flex flex-col items-center justify-center shadow border border-slate-600/50 transition"
            >
              <span className="text-base font-bold leading-none">{btn.key}</span>
              <span className="text-[8px] text-slate-400 tracking-wider mt-0.5 h-2.5">{btn.sub}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 text-[10px] font-black tracking-[0.35em] text-slate-500">KABAMBE</div>
      </div>

      <div className="mt-5 text-center text-xs text-slate-400 max-w-xs leading-relaxed">
        Tap the Phone icon, dial <span className="text-white font-bold">{USSD_CODE}</span> and press the green key. Tap Messages to
        text <span className="text-white font-bold">BAHARI KISUMU</span> to {SHORTCODE}. Your keyboard works too.
      </div>
    </div>
  );
}