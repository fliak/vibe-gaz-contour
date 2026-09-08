import {
  labels,
  overall,
  type SiteObject,
  type Doc,
  type Metric,
} from "./data";
export const normalize = (s: string) =>
  s
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9]+/g, " ")
    .trim();
export type Result = {
  text: string;
  objectId?: string;
  metric?: Metric;
  doc?: Doc;
  tab?: "telemetry" | "documents";
  refresh?: boolean;
  choices?: { label: string; query: string }[];
};
export function command(
  query: string,
  objects: SiteObject[],
  currentId: string,
): Result {
  const q = normalize(query);
  if (!q) return { text: "Введите вопрос или выберите пример ниже." };
  if (/обнов/.test(q))
    return { text: "Обновляю демонстрационные данные…", refresh: true };
  const matches = objects.filter((o) =>
    [o.name, ...o.aliases].some((a) => ` ${q} `.includes(` ${normalize(a)} `)),
  );
  if (matches.length > 1)
    return {
      text: "Уточните объект",
      choices: matches.map((o) => ({
        label: o.name,
        query:
          query.replace(
            new RegExp(
              matches
                .flatMap((m) => [m.name, ...m.aliases])
                .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join("|"),
              "gi",
            ),
            "",
          ) +
          " " +
          o.name,
      })),
    };
  if (!matches.length && /(?:грпш|шрп|грп)\s*\d+/.test(q))
    return { text: "Такой объект не найден. Выберите объект из списка." };
  const obj = matches[0] ?? objects.find((o) => o.id === currentId);
  if (!obj) return { text: "Объекты не настроены." };
  if (!obj.data)
    return {
      text: obj.error ?? "Данные объекта недоступны.",
      objectId: obj.id,
    };
  const base = { objectId: obj.id };
  const data = obj.data;
  if (/схем|режимн/.test(q)) {
    const category = /схем/.test(q) ? "scheme" : "regime-card";
    const doc = data.documents.find(
      (d) => d.category === category && d.isPrimary,
    );
    return {
      ...base,
      text: doc ? doc.title : "Документ для данного объекта не добавлен",
      doc,
    };
  }
  if (/документ|библиотек/.test(q))
    return { ...base, text: `Документы объекта ${obj.name}`, tab: "documents" };
  const metrics = data.metrics.filter((m) =>
    [m.name, ...m.aliases].some((a) => ` ${q} `.includes(` ${normalize(a)} `)),
  );
  if (metrics.length > 1)
    return {
      ...base,
      text: "Какой показатель показать?",
      choices: metrics.map((m) => ({
        label: m.name,
        query: `${m.name} ${obj.name}`,
      })),
    };
  if (metrics.length === 1) {
    const m = metrics[0];
    return {
      ...base,
      metric: m,
      text: `${obj.name}. ${m.name}: ${m.value} ${m.unit}. ${labels[m.status]}.`,
    };
  }
  if (/давлен/.test(q))
    return {
      ...base,
      text: "Уточните показатель давления",
      choices: data.metrics
        .filter((m) => /давлен/.test(normalize(m.name)))
        .map((m) => ({ label: m.name, query: `${m.name} ${obj.name}` })),
    };
  if (/ситуац|состояни|показател|сводк/.test(q))
    return {
      ...base,
      text: `${obj.name}: ${labels[overall(data)]}. ${data.metrics.map((m) => `${m.name}: ${m.value} ${m.unit}, ${labels[m.status].toLowerCase()}`).join(". ")}.`,
    };
  if (matches.length && /покаж|открой|объект/.test(q))
    return { ...base, text: `Открываю ${obj.name}`, tab: "telemetry" };
  return {
    ...base,
    text: "Команда не распознана. Попробуйте «Какое давление на входе?» или выберите пример.",
  };
}
