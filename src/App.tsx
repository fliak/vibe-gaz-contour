import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  Gauge,
  LoaderCircle,
  Mic,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
  Volume2,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  appSchema,
  catalogSchema,
  categories,
  labels,
  objectSchema,
  overall,
  readJson,
  stamp,
  type Doc,
  type SiteObject,
  type Metric,
} from "./data";
import { command, type Result } from "./commands";
type Tab = "voice" | "telemetry" | "documents";
type SpeechEngine = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        results: { [n: number]: { [n: number]: { transcript: string } } };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const speechWindow = window as unknown as {
  SpeechRecognition?: new () => SpeechEngine;
  webkitSpeechRecognition?: new () => SpeechEngine;
};
const Recognition =
  speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const C =
    name === "thermometer"
      ? Thermometer
      : name === "filter"
        ? SlidersHorizontal
        : Gauge;
  return <C size={size} />;
}
function Status({ status }: { status: Metric["status"] }) {
  return (
    <span className={`status ${status}`}>
      <i />
      {labels[status]}
    </span>
  );
}
function getSaved() {
  try {
    return localStorage.getItem("gazkontur-object") ?? "";
  } catch {
    return "";
  }
}
function returnView() {
  const saved = window.history.state?.gazkonturReturn;
  return saved && typeof saved === "object" ? saved : {};
}
// Android's native PDF page does not imply support for embedded <object>.
function needsPdfPage() {
  return (
    /Android/i.test(navigator.userAgent) || navigator.pdfViewerEnabled !== true
  );
}
export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
      const saved = returnView().tab;
      return saved === "documents" || saved === "telemetry" ? saved : "voice";
    }),
    [objects, setObjects] = useState<SiteObject[]>([]),
    [current, setCurrent] = useState(getSaved),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [query, setQuery] = useState(""),
    [result, setResult] = useState<Result | null>(null),
    [phase, setPhase] = useState(""),
    [search, setSearch] = useState(() =>
      typeof returnView().search === "string" ? returnView().search : "",
    ),
    [category, setCategory] = useState(() =>
      typeof returnView().category === "string" ? returnView().category : "all",
    ),
    [doc, setDoc] = useState<Doc | null>(null),
    [docUrl, setDocUrl] = useState(""),
    [docError, setDocError] = useState(""),
    [zoom, setZoom] = useState(1),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [toast, setToast] = useState(""),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [config, setConfig] = useState({
    name: "ГазКонтур",
    subtitle: "Помощник инженера",
    demoCommands: [
      "Какое давление на входе ГРП-2?",
      "Какое давление на выходе этого объекта?",
      "Покажи температуру в помещении",
      "Какая ситуация по ГРП-2?",
      "Покажи схему этого объекта",
      "Открой режимную карту ГРП-2",
      "Открой документы по этому объекту",
      "Обнови данные",
    ],
  });
  const engine = useRef<SpeechEngine | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    busy = useRef(false);
  const obj = objects.find((o) => o.id === current) ?? objects[0],
    data = obj?.data;
  async function load() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const list = await readJson("/config/objects.json", catalogSchema);
      const loaded = await Promise.all(
        list.objects.map(async (entry) => {
          try {
            const data = await readJson(entry.configUrl, objectSchema);
            if (data.id !== entry.id)
              throw Error(
                `Идентификатор в ${entry.configUrl} не совпадает с каталогом`,
              );
            return { ...entry, data };
          } catch (e) {
            return { ...entry, error: (e as Error).message };
          }
        }),
      );
      setObjects(loaded);
      setCurrent((old) =>
        loaded.some((o) => o.id === old) ? old : (loaded[0]?.id ?? ""),
      );
      return loaded;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }
  useEffect(() => {
    void load();
    readJson("/config/app.json", appSchema)
      .then(setConfig)
      .catch((e) => setToast(e.message));
    const net = () => setOnline(navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener("beforeinstallprompt", prompt);
    const update = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    update();
    window.speechSynthesis?.addEventListener("voiceschanged", update);
    return () => {
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.speechSynthesis?.removeEventListener("voiceschanged", update);
      engine.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  useEffect(() => {
    try {
      if (current) localStorage.setItem("gazkontur-object", current);
    } catch {
      /* Storage is optional. */
    }
  }, [current]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  function openDocumentPage(document: Doc) {
    window.history.replaceState(
      { ...window.history.state, gazkonturReturn: { tab, search, category } },
      "",
    );
    setDoc(null);
    window.location.assign(document.url);
  }
  useEffect(() => {
    const onReturn = (event: PageTransitionEvent) => {
      if (event.persisted) setDoc(null);
    };
    window.addEventListener("pageshow", onReturn);
    return () => window.removeEventListener("pageshow", onReturn);
  }, []);
  useEffect(() => {
    if (!doc) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    setDocUrl("");
    setDocError("");
    setZoom(1);
    let active = true,
      url = "";
    const controller = new AbortController();
    fetch(doc.url, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok || r.headers.get("content-type")?.includes("text/html"))
          throw Error("Документ не найден");
        const blob = await r.blob();
        if (!active) return;
        if (doc.mimeType === "application/pdf" && needsPdfPage()) {
          openDocumentPage(doc);
          return;
        }
        url = URL.createObjectURL(blob);
        setDocUrl(url);
      })
      .catch((e) => {
        if (active)
          setDocError(
            navigator.onLine
              ? (e as Error).message
              : "Документ недоступен офлайн. Откройте его при подключении к сети.",
          );
      });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc]);
  function speak(text: string) {
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith("ru"));
    if (!voice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = "ru-RU";
    utterance.onstart = () => setPhase("Говорю…");
    utterance.onend = () => setPhase("");
    utterance.onerror = () => setPhase("");
    window.speechSynthesis.speak(utterance);
  }
  async function run(text: string) {
    engine.current?.abort();
    window.speechSynthesis?.cancel();
    setQuery(text);
    setPhase("Ищу…");
    const found = command(text, objects, obj?.id ?? "");
    if (found.objectId) setCurrent(found.objectId);
    if (found.tab) {
      setTab(found.tab);
      setCategory("all");
      setSearch("");
    }
    if (found.doc) setDoc(found.doc);
    if (found.refresh) {
      const loaded = await load();
      found.text = loaded
        ? navigator.onLine
          ? "Демонстрационные данные обновлены."
          : "Нет соединения. Показаны ранее сохранённые данные."
        : "Не удалось обновить данные. Попробуйте ещё раз.";
    }
    setResult(found);
    setPhase("");
    speak(found.text);
  }
  function listen() {
    if (!Recognition) return;
    if (phase === "Слушаю…") {
      engine.current?.abort();
      setPhase("");
      return;
    }
    window.speechSynthesis?.cancel();
    const recognition = new Recognition();
    engine.current = recognition;
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      setPhase("Распознаю…");
      void run(e.results[0][0].transcript);
    };
    recognition.onerror = (e) => {
      setPhase("");
      setResult({
        text:
          e.error === "not-allowed"
            ? "Ошибка доступа к микрофону. Разрешите микрофон в настройках сайта Chrome и попробуйте снова."
            : e.error === "no-speech"
              ? "Не удалось расслышать. Попробуйте снова или введите запрос текстом."
              : e.error === "aborted"
                ? "Запись остановлена."
                : "Распознавание недоступно. Проверьте соединение или введите запрос текстом.",
      });
    };
    recognition.onend = () => setPhase((p) => (p === "Слушаю…" ? "" : p));
    try {
      recognition.start();
      setPhase("Слушаю…");
    } catch {
      setPhase("");
      setResult({
        text: "Не удалось включить микрофон. Введите запрос текстом.",
      });
    }
  }
  function openPrimary(type: Doc["category"]) {
    const found = data?.documents.find(
      (d) => d.category === type && d.isPrimary,
    );
    if (found) setDoc(found);
    else setToast("Документ для данного объекта не добавлен");
  }
  const docs =
    data?.documents.filter(
      (d) =>
        (category === "all" || d.category === category) &&
        d.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ) ?? [];
  const selector = (
    <div className="object-select">
      <Building2 size={20} />
      <select
        aria-label="Текущий объект"
        value={obj?.id ?? ""}
        onChange={(e) => {
          setCurrent(e.target.value);
          setResult(null);
        }}
      >
        {objects.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} · {o.address}
          </option>
        ))}
      </select>
      <ChevronDown size={17} />
    </div>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("voice");
          }}
        >
          <span className="brand-mark">
            <AudioLines size={25} />
          </span>
          <span>
            {config.name}
            <small>{config.subtitle}</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="demo-badge">
            <i />
            Демо<span className="desktop-only">нстрационная версия</span>
          </span>
          {install && (
            <button
              className="install"
              onClick={async () => {
                await install.prompt();
                const choice = await install.userChoice;
                if (choice.outcome === "accepted") setInstall(null);
              }}
            >
              <Download size={16} />
              <span>Установить</span>
            </button>
          )}
        </div>
      </header>
      <main>
        {!online && (
          <div className="notice">
            <WifiOff size={19} />
            Нет соединения. Показаны демонстрационные данные, сохранённые ранее.
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
            <button className="secondary" onClick={() => void load()}>
              Повторить
            </button>
          </div>
        )}
        {loading && !objects.length ? (
          <div className="empty">
            <LoaderCircle className="spin" />
            Загружаем объекты…
          </div>
        ) : !objects.length && !error ? (
          <div className="empty">
            <Building2 />
            Объекты не настроены
          </div>
        ) : (
          obj && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div>
                  <h1>
                    {tab === "voice"
                      ? "Голосовой помощник"
                      : tab === "telemetry"
                        ? "Телеметрия"
                        : "Документы"}
                  </h1>
                  <p>
                    {tab === "voice"
                      ? "Спросите об объекте. Остальное — за помощником."
                      : tab === "telemetry"
                        ? "Показатели и состояние оборудования"
                        : "Всё, что нужно для работы с объектом"}
                  </p>
                </div>
                <div className="connection">
                  <span className={online ? "online-dot" : "offline-dot"} />
                  {online ? "На связи" : "Нет сети"}
                </div>
              </div>
              {tab === "voice" ? (
                <div className="voice-layout">
                  <section className="voice-panel">
                    <div className="panel-top">
                      <span className="section-label">
                        <AudioLines size={16} /> ПОМОЩНИК
                      </span>
                      <span className="language">RU</span>
                    </div>
                    <h2 className="voice-title">{phase || "Готов помочь"}</h2>
                    <p className="voice-hint">
                      {phase === "Слушаю…"
                        ? "Произнесите вопрос об объекте"
                        : Recognition
                          ? "Нажмите на микрофон, чтобы задать вопрос"
                          : "Введите вопрос или выберите готовую команду"}
                    </p>
                    <div
                      className={`mic-orbit ${phase === "Слушаю…" ? "listening" : ""}`}
                    >
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="orbit orbit-three" />
                      <button
                        className="mic-button"
                        aria-label={
                          phase === "Слушаю…"
                            ? "Остановить запись"
                            : "Начать голосовой ввод"
                        }
                        disabled={!Recognition}
                        onClick={listen}
                      >
                        <Mic size={49} strokeWidth={1.5} />
                      </button>
                      <span className="orbit-point" />
                    </div>
                    <span className="mic-caption">
                      {Recognition
                        ? "ВАШ ГОЛОС — КОРОТКИЙ ПУТЬ К ДАННЫМ"
                        : "РАСПОЗНАВАНИЕ РЕЧИ НЕДОСТУПНО"}
                    </span>
                    <form
                      className="query-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(query);
                      }}
                    >
                      <input
                        aria-label="Ваш вопрос"
                        placeholder="Или напишите свой вопрос…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <button
                        aria-label="Выполнить запрос"
                        disabled={!query.trim() || loading}
                      >
                        <ArrowRight size={21} />
                      </button>
                    </form>
                    <div className="voice-context">
                      <span>Текущий объект</span>
                      {selector}
                    </div>
                  </section>
                  <div className="voice-side">
                    <section className="answer-panel">
                      <div className="panel-top">
                        <span className="section-label">
                          <Activity size={16} />{" "}
                          {result ? "ОТВЕТ ПОМОЩНИКА" : "В ФОКУСЕ"}
                        </span>
                        <span className="small-dot" />
                      </div>
                      {result ? (
                        <div aria-live="polite" className="answer-content">
                          {result.metric ? (
                            <>
                              <span className="muted">
                                {result.metric.name}
                              </span>
                              <div className="answer-value">
                                {result.metric.value}
                                <small>{result.metric.unit}</small>
                              </div>
                              <Status status={result.metric.status} />
                              <p>
                                {obj.name} · {stamp(data?.updatedAt)}
                              </p>
                            </>
                          ) : (
                            <p className="answer-text">{result.text}</p>
                          )}
                          {result.choices?.map((choice) => (
                            <button
                              className="choice"
                              key={choice.label}
                              onClick={() => void run(choice.query)}
                            >
                              {choice.label}
                              <ChevronRight size={16} />
                            </button>
                          ))}
                          {result.doc && (
                            <button
                              className="secondary"
                              onClick={() => setDoc(result.doc!)}
                            >
                              Открыть документ
                              <ArrowRight size={17} />
                            </button>
                          )}
                          {voices.some((v) => v.lang.startsWith("ru")) && (
                            <button
                              className="speak"
                              aria-label="Озвучить ответ"
                              onClick={() => speak(result.text)}
                            >
                              <Volume2 size={20} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="focus-title">
                            <span className="object-icon">
                              <Building2 size={24} />
                            </span>
                            <div>
                              <h3>{obj.name}</h3>
                              <p>{obj.address}</p>
                            </div>
                            {data && <Status status={overall(data)} />}
                          </div>
                          <div className="focus-metrics">
                            {data?.metrics.slice(0, 2).map((m) => (
                              <div key={m.id}>
                                <span>{m.name}</span>
                                <strong>
                                  {m.value}
                                  <small>{m.unit}</small>
                                </strong>
                              </div>
                            ))}
                          </div>
                          <button
                            className="text-link"
                            onClick={() => setTab("telemetry")}
                          >
                            Перейти к телеметрии
                            <ArrowRight size={17} />
                          </button>
                        </>
                      )}
                    </section>
                    <section className="examples-panel">
                      <div className="section-label">ПОПРОБУЙТЕ СПРОСИТЬ</div>
                      <h2>Один вопрос — и всё понятно</h2>
                      <div className="examples">
                        {config.demoCommands.map((q, i) => (
                          <button key={q} onClick={() => void run(q)}>
                            <span className="example-icon">
                              {i < 2 ? (
                                <Gauge size={19} />
                              ) : i === 2 ? (
                                <Thermometer size={19} />
                              ) : i === 3 ? (
                                <Activity size={19} />
                              ) : i === 7 ? (
                                <RefreshCw size={19} />
                              ) : (
                                <FileText size={19} />
                              )}
                            </span>
                            <span>{q}</span>
                            <ArrowRight size={16} />
                          </button>
                        ))}
                      </div>
                    </section>
                    <div className="privacy-note">
                      <ShieldCheck size={16} />
                      <span>
                        Показатели заданы вручную · Демонстрационные данные
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="object-toolbar">
                    {selector}
                    <span className="update-stamp">
                      Обновлено вручную · {stamp(data?.updatedAt)}
                    </span>
                    {tab === "telemetry" && (
                      <button
                        className="secondary refresh"
                        disabled={loading}
                        onClick={async () => {
                          const loaded = await load();
                          if (loaded)
                            setToast(
                              navigator.onLine
                                ? "Данные обновлены"
                                : "Показаны сохранённые данные",
                            );
                        }}
                      >
                        <RefreshCw
                          size={16}
                          className={loading ? "spin" : ""}
                        />
                        {loading ? "Обновляем…" : "Обновить"}
                      </button>
                    )}
                  </div>
                  {obj.error ? (
                    <div className="error-box" role="alert">
                      {obj.error}
                      <button onClick={() => void load()} className="secondary">
                        Повторить
                      </button>
                    </div>
                  ) : (
                    data &&
                    (tab === "telemetry" ? (
                      <>
                        <div className="object-summary">
                          <div>
                            <h2>
                              {obj.name}
                              <span>{obj.type}</span>
                            </h2>
                            <p>{obj.address}</p>
                          </div>
                          <Status status={overall(data)} />
                        </div>
                        <div className="metrics-grid">
                          {data.metrics.map((m) => (
                            <article className="metric-card" key={m.id}>
                              <div className="metric-title">
                                {m.name}
                                <Icon name={m.icon} />
                              </div>
                              <div className="metric-value">
                                {m.value}
                                <small>{m.unit}</small>
                              </div>
                              <Status status={m.status} />
                              {m.range && (
                                <div className="range">
                                  Допустимо: {m.range.min}–{m.range.max}{" "}
                                  {m.unit}
                                </div>
                              )}
                              <div className="metric-updated">
                                {stamp(m.updatedAt ?? data.updatedAt)}
                              </div>
                            </article>
                          ))}
                        </div>
                        <div className="telemetry-bottom">
                          <section className="equipment-panel">
                            <div className="panel-top">
                              <h2>Состояние оборудования</h2>
                              <span className="count">
                                {data.equipment.length}
                              </span>
                            </div>
                            {data.equipment.length ? (
                              data.equipment.map((e, i) => (
                                <div className="equipment-row" key={e.id}>
                                  <span className="equipment-icon">
                                    <Icon
                                      name={
                                        i === 0
                                          ? "filter"
                                          : i === 1
                                            ? "thermometer"
                                            : "gauge"
                                      }
                                    />
                                  </span>
                                  <span>
                                    {e.name}
                                    {e.statusText && (
                                      <small>{e.statusText}</small>
                                    )}
                                  </span>
                                  <Status status={e.status} />
                                </div>
                              ))
                            ) : (
                              <p className="muted">Оборудование не добавлено</p>
                            )}
                          </section>
                          <section className="quick-docs">
                            <h2>Документы объекта</h2>
                            <p>Схемы и техническая документация под рукой</p>
                            <button onClick={() => openPrimary("scheme")}>
                              <FileImage size={22} />
                              <span>
                                Схема объекта
                                <small>Технологическая схема обвязки</small>
                              </span>
                              <ArrowRight size={19} />
                            </button>
                            <button onClick={() => openPrimary("regime-card")}>
                              <FileText size={22} />
                              <span>
                                Режимная карта
                                <small>Параметры работы оборудования</small>
                              </span>
                              <ArrowRight size={19} />
                            </button>
                            <button
                              className="text-link"
                              onClick={() => {
                                setTab("documents");
                                setSearch("");
                                setCategory("all");
                              }}
                            >
                              Все документы
                              <ArrowRight size={17} />
                            </button>
                          </section>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="document-tools">
                          <label className="document-search">
                            <Search size={19} />
                            <input
                              placeholder="Поиск по названию документа"
                              aria-label="Поиск документов"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                              <button
                                aria-label="Очистить поиск"
                                onClick={() => setSearch("")}
                              >
                                <X size={17} />
                              </button>
                            )}
                          </label>
                          <span className="document-count">
                            Документов: {docs.length}
                          </span>
                        </div>
                        <div className="filters">
                          <button
                            className={category === "all" ? "active" : ""}
                            onClick={() => setCategory("all")}
                          >
                            Все документы
                          </button>
                          {Object.entries(categories).map(([id, title]) => (
                            <button
                              key={id}
                              className={category === id ? "active" : ""}
                              onClick={() => setCategory(id)}
                            >
                              {title}
                            </button>
                          ))}
                        </div>
                        <div className="documents-grid">
                          {docs.map((d) => (
                            <button
                              className="document-card"
                              key={d.id}
                              onClick={() => setDoc(d)}
                            >
                              <div
                                className={`file-icon ${d.mimeType.startsWith("image/") ? "image-file" : ""}`}
                              >
                                {d.mimeType.startsWith("image/") ? (
                                  <FileImage size={29} />
                                ) : (
                                  <FileText size={29} />
                                )}
                                <small>
                                  {d.mimeType === "application/pdf"
                                    ? "PDF"
                                    : d.url.split(".").pop()?.toUpperCase()}
                                </small>
                              </div>
                              <span className="document-info">
                                <span className="document-category">
                                  {categories[d.category]}
                                  {d.isPrimary && (
                                    <span className="primary-tag">
                                      Основной
                                    </span>
                                  )}
                                </span>
                                <strong>{d.title}</strong>
                                <span className="document-meta">
                                  {stamp(d.date)}
                                  {d.size
                                    ? ` · ${Math.round(d.size / 1024)} КБ`
                                    : ""}
                                </span>
                              </span>
                              <ChevronRight size={20} />
                            </button>
                          ))}
                        </div>
                        {!docs.length && (
                          <div className="empty">
                            <Search />
                            <h2>Документы не найдены</h2>
                            <p>
                              Попробуйте изменить запрос или выбрать другую
                              категорию.
                            </p>
                          </div>
                        )}
                        <div className="document-footnote">
                          <ShieldCheck size={17} />
                          Документы доступны для просмотра и скачивания
                        </div>
                      </>
                    ))
                  )}
                </>
              )}
            </>
          )
        )}
      </main>
      <footer className="desktop-footer">
        <span>ГазКонтур · Помощник инженера</span>
        <span>Демонстрационная версия · 2026</span>
      </footer>
      <nav className="bottom-nav" aria-label="Основные разделы">
        {(
          [
            { id: "voice", label: "Голос", icon: Mic },
            { id: "telemetry", label: "Телеметрия", icon: Activity },
            { id: "documents", label: "Документы", icon: FolderOpen },
          ] as const
        ).map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "active" : ""}
            aria-current={tab === n.id ? "page" : undefined}
            onClick={() => setTab(n.id)}
          >
            <span>
              <n.icon size={21} />
            </span>
            {n.label}
          </button>
        ))}
      </nav>
      <dialog
        ref={dialog}
        className="document-dialog"
        onCancel={() => setDoc(null)}
        onClose={() => setDoc(null)}
      >
        <div className="viewer-header">
          <button aria-label="Закрыть документ" onClick={() => setDoc(null)}>
            <ArrowLeft size={21} />
          </button>
          <div>
            <h2>{doc?.title}</h2>
            <small>Демонстрационный документ · {stamp(doc?.date)}</small>
          </div>
          <button aria-label="Закрыть просмотр" onClick={() => setDoc(null)}>
            <X size={21} />
          </button>
        </div>
        <div className="viewer-body">
          {docError ? (
            <div className="empty" role="alert">
              <FileText />
              {docError}
            </div>
          ) : !docUrl ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              Открываем документ…
            </div>
          ) : doc?.mimeType.startsWith("image/") ? (
            <div className="image-scroll">
              <img
                src={docUrl}
                alt={doc.title}
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              />
            </div>
          ) : doc?.mimeType === "application/pdf" ? (
            <object
              data={docUrl}
              type="application/pdf"
              aria-label={doc.title}
              onError={() => openDocumentPage(doc)}
            >
              <div className="empty">
                Браузер не поддерживает встроенный просмотр PDF.
                <a
                  className="secondary"
                  href={doc.url}
                  onClick={(event) => {
                    event.preventDefault();
                    openDocumentPage(doc);
                  }}
                >
                  Открыть PDF отдельной страницей
                </a>
                <span>Вернуться в приложение можно кнопкой «Назад».</span>
              </div>
            </object>
          ) : (
            <div className="empty">Для этого формата доступно скачивание.</div>
          )}
        </div>
        <div className="viewer-footer">
          {doc?.mimeType.startsWith("image/") && (
            <div className="zoom-tools">
              <button
                aria-label="Уменьшить"
                onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
              >
                <ZoomOut size={20} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Увеличить"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              >
                <ZoomIn size={20} />
              </button>
            </div>
          )}
          {docUrl && (
            <>
              <a
                className="secondary"
                href={doc?.mimeType === "application/pdf" ? doc.url : docUrl}
                target={
                  doc?.mimeType === "application/pdf" ? undefined : "_blank"
                }
                rel="noreferrer"
                onClick={
                  doc?.mimeType === "application/pdf"
                    ? (event) => {
                        event.preventDefault();
                        openDocumentPage(doc);
                      }
                    : undefined
                }
              >
                Открыть отдельно
              </a>
              <a
                className="primary"
                href={docUrl}
                download={doc?.url.split("/").pop()}
              >
                <ArrowDownToLine size={18} />
                Скачать
              </a>
            </>
          )}
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="Закрыть уведомление" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
