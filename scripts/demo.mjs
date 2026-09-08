import { mkdir, writeFile, stat } from "node:fs/promises";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
const save = (path, data) =>
  writeFile(path, JSON.stringify(data, null, 2) + "\n");
const icon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#075965"/><g stroke="#fff" stroke-width="24" stroke-linecap="round"><path d="M160 221v70m64-142v214m64-242v270m64-172v102"/></g></svg>';
await writeFile("public/icons/icon.svg", icon);
for (const size of [192, 512])
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
await save("public/manifest.webmanifest", {
  id: "/",
  name: "ГазКонтур — помощник инженера",
  short_name: "ГазКонтур",
  description: "Телеметрия и документы газовых объектов",
  lang: "ru",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#f5f7f7",
  theme_color: "#075965",
  icons: [
    {
      src: "/icons/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
});
await save("public/config/app.json", {
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
const entries = [
  {
    id: "grp-2",
    name: "ГРП-2",
    type: "ГРП",
    address: "ул. Промышленная, 14",
    aliases: ["второй грп", "грп два", "грп на промышленной"],
  },
  {
    id: "shrp-5",
    name: "ШРП-5",
    type: "ШРП",
    address: "ул. Садовая, 8",
    aliases: ["пятый шрп", "шрп пять", "шрп на садовой"],
  },
  {
    id: "grpsh-12",
    name: "ГРПШ-12",
    type: "ГРПШ",
    address: "ул. Озёрная, 23",
    aliases: ["грпш двенадцать", "двенадцатый грпш", "грпш на озерной"],
  },
];
await save("public/config/objects.json", {
  objects: entries.map((e) => ({
    ...e,
    configUrl: `/config/objects/${e.id}.json`,
  })),
});
const updatedAt = "2026-09-08T12:30:00+03:00";
function page(title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="1200" height="1600" fill="white"/><g font-family="DejaVu Sans, sans-serif" fill="#23464b"><rect x="60" y="60" width="1080" height="1480" fill="none" stroke="#bfd0ce" stroke-width="2"/><rect x="60" y="60" width="1080" height="12" fill="#075965"/><text x="110" y="145" font-size="24" fill="#6e908c">ГАЗКОНТУР / ТЕХНИЧЕСКАЯ ДОКУМЕНТАЦИЯ</text><text x="110" y="230" font-size="38" font-weight="bold">${title}</text><text x="110" y="280" font-size="22" fill="#718f8b">${subtitle}</text>${body}<path d="M110 1400H1090" stroke="#c9d8d5"/><text x="110" y="1450" font-size="20" fill="#8b9d99">ДЕМОНСТРАЦИОННЫЙ ОБРАЗЕЦ · НЕ ДЛЯ ЭКСПЛУАТАЦИИ</text><text x="110" y="1495" font-size="18" fill="#8b9d99">08.09.2026 · ГазКонтур</text></g></svg>`;
}
function valve(x, y) {
  return `<path d="M${x - 22} ${y - 20}l44 40v-40l-44 40Z" fill="white" stroke="#326e75" stroke-width="3"/>`;
}
for (const [index, e] of entries.entries()) {
  await mkdir(`public/documents/${e.id}`, { recursive: true });
  const metrics = [
    {
      id: "inlet-pressure",
      name: "Давление на входе",
      value: [0.42, 0.38, 0.45][index],
      unit: "МПа",
      status: "normal",
      range: { min: 0.35, max: 0.5 },
      icon: "gauge",
      aliases: ["входное давление", "давление на входе", "на входе"],
    },
    {
      id: "outlet-pressure",
      name: "Давление на выходе",
      value: [0.28, 0.32, 0.27][index],
      unit: "МПа",
      status: index === 1 ? "deviation" : "normal",
      range: { min: 0.2, max: 0.3 },
      icon: "gauge",
      aliases: ["выходное давление", "давление на выходе", "на выходе"],
    },
    {
      id: "filter-delta",
      name: "Перепад на фильтре",
      value: [4.2, 5.1, 3.8][index],
      unit: "кПа",
      status: "normal",
      range: { min: 0, max: 6 },
      icon: "filter",
      aliases: ["перепад", "перепад давления", "перепад давления на фильтре"],
    },
    {
      id: "room-temperature",
      name: "Температура в помещении",
      value: [8, 12, 9.5][index],
      unit: "°C",
      status: "normal",
      range: { min: 5, max: 35 },
      icon: "thermometer",
      aliases: ["температура", "температуру", "температуру в помещении"],
    },
  ].map((m) => ({ ...m, updatedAt }));
  const scheme = page(
    `Схема обвязки ${e.name}`,
    `${e.address} · Условная технологическая схема`,
    `<text x="110" y="410" font-size="22">Линия редуцирования газа</text><g stroke="#326e75" stroke-width="4" fill="none"><path d="M130 650H1070M270 650V950H930V650"/><rect x="400" y="615" width="70" height="70" fill="white"/><circle cx="660" cy="650" r="42" fill="white"/><path d="M660 608V520M660 520H760"/><circle cx="760" cy="500" r="24" fill="white"/><path d="M325 650V530M850 650V530"/><circle cx="325" cy="508" r="25" fill="white"/><circle cx="850" cy="508" r="25" fill="white"/></g>${[210, 530, 800, 980].map((x) => valve(x, 650)).join("")}${valve(580, 950)}<g font-size="20"><text x="120" y="610">Вход</text><text x="995" y="610">Выход</text><text x="397" y="740">Фильтр</text><text x="599" y="740">Регулятор</text><text x="305" y="460">P1</text><text x="830" y="460">P2</text><text x="740" y="450">ПЗК</text><text x="490" y="1010">Байпасная линия</text></g><rect x="110" y="1100" width="980" height="205" fill="#f2f7f5"/><text x="140" y="1150" font-size="23">Обозначения</text><text x="140" y="1200" font-size="20">P1, P2 — контроль давления на входе и выходе</text><text x="140" y="1245" font-size="20">ПЗК — предохранительный запорный клапан</text>`,
  );
  const table = metrics
    .map(
      (m, i) =>
        `<rect x="110" y="${470 + i * 110}" width="980" height="110" fill="${i % 2 ? "#fff" : "#f1f6f4"}"/><text x="135" y="${535 + i * 110}" font-size="22">${m.name}</text><text x="690" y="${535 + i * 110}" font-size="24">${m.value} ${m.unit}</text><text x="880" y="${535 + i * 110}" font-size="20">${m.range.min}–${m.range.max}</text>`,
    )
    .join("");
  const regime = page(
    `Режимная карта ${e.name}`,
    `${e.address} · Ручные демонстрационные значения`,
    `<g font-size="18" fill="#78938c"><text x="135" y="430">ПОКАЗАТЕЛЬ</text><text x="690" y="430">ЗНАЧЕНИЕ</text><text x="880" y="430">ДИАПАЗОН</text></g>${table}<text x="110" y="1040" font-size="23">Порядок проверки</text><text x="110" y="1100" font-size="21">1. Сверить выбранный объект и дату обновления.</text><text x="110" y="1150" font-size="21">2. Просмотреть показатели и статусы в приложении.</text><text x="110" y="1200" font-size="21">3. Открыть схему оборудования для демонстрации.</text>`,
  );
  const docs = [];
  for (const [kind, title, svg] of [
    ["scheme", `Схема обвязки ${e.name}`, scheme],
    ["regime-card", `Режимная карта ${e.name}`, regime],
  ]) {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const isImage = kind === "scheme";
    const file = `${kind}.${isImage ? "png" : "pdf"}`;
    let bytes = png;
    if (!isImage) {
      const pdf = await PDFDocument.create();
      const img = await pdf.embedPng(png);
      pdf
        .addPage([600, 800])
        .drawImage(img, { x: 0, y: 0, width: 600, height: 800 });
      bytes = await pdf.save();
    }
    await writeFile(`public/documents/${e.id}/${file}`, bytes);
    docs.push({
      id: `${e.id}-${kind}`,
      title,
      category: kind,
      url: `/documents/${e.id}/${file}`,
      mimeType: isImage ? "image/png" : "application/pdf",
      date: "2026-09-08",
      size: bytes.length,
      isPrimary: true,
    });
  }
  const passport = page(
    `Паспорт фильтра ${e.name}`,
    `${e.address} · Демонстрационный паспорт`,
    `<text x="110" y="440" font-size="25">Фильтр газовый ФГ-16</text><g font-size="23"><text x="110" y="540">Условный номер: ДЕМО-${index + 101}</text><text x="110" y="610">Год изготовления: 2025</text><text x="110" y="680">Дата условного осмотра: 28.08.2026</text><text x="110" y="750">Состояние в демонстрации: норма</text><text x="110" y="900">Документ создан для проверки просмотра файлов.</text><text x="110" y="955">Не является паспортом реального оборудования.</text></g>`,
  );
  const png = await sharp(Buffer.from(passport)).png().toBuffer();
  const pdf = await PDFDocument.create();
  const img = await pdf.embedPng(png);
  pdf
    .addPage([600, 800])
    .drawImage(img, { x: 0, y: 0, width: 600, height: 800 });
  const bytes = await pdf.save();
  await writeFile(`public/documents/${e.id}/passport.pdf`, bytes);
  docs.push({
    id: `${e.id}-passport`,
    title: "Паспорт фильтра ФГ-16",
    category: "passport",
    url: `/documents/${e.id}/passport.pdf`,
    mimeType: "application/pdf",
    date: "2026-08-28",
    size: bytes.length,
  });
  await save(`public/config/objects/${e.id}.json`, {
    id: e.id,
    updatedAt,
    metrics,
    equipment: [
      {
        id: "filter-1",
        name: "Фильтр ФГ-16",
        status: "normal",
        statusText: "Работает штатно",
      },
      {
        id: "temperature-1",
        name: "Датчик температуры",
        status: "normal",
        statusText: "Данные доступны",
      },
      {
        id: "outlet-1",
        name: "Выходной датчик давления",
        status: index === 1 ? "deviation" : "normal",
        statusText:
          index === 1 ? "Выше допустимого диапазона" : "Работает штатно",
      },
    ],
    documents: docs,
  });
}
console.log("Созданы три демообъекта, PNG-схемы, PDF и иконки.");
