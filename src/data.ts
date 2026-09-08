import { z } from "zod";
export const statuses = [
  "unknown",
  "normal",
  "warning",
  "deviation",
  "alarm",
] as const;
export const labels = {
  normal: "Норма",
  warning: "Предупреждение",
  deviation: "Отклонение",
  alarm: "Авария",
  unknown: "Нет данных",
};
const status = z.enum(statuses);
const url = z.string().regex(/^\/(?!\/)[^\s]+$/, "Нужен путь от корня сайта");
export const metricSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().default(""),
  status: status.default("unknown"),
  range: z
    .object({ min: z.number(), max: z.number() })
    .refine((r) => r.min <= r.max)
    .optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  icon: z.string().default("gauge"),
  aliases: z.array(z.string()).default([]),
});
export const documentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    "scheme",
    "regime-card",
    "passport",
    "act",
    "instruction",
    "other",
  ]),
  url,
  mimeType: z.string(),
  date: z.string().optional(),
  size: z.number().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
});
export const objectSchema = z
  .object({
    id: z.string(),
    updatedAt: z.string().datetime({ offset: true }),
    status: status.optional(),
    metrics: z.array(metricSchema),
    equipment: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          status,
          statusText: z.string().optional(),
        }),
      )
      .default([]),
    documents: z.array(documentSchema),
  })
  .superRefine((obj, ctx) => {
    for (const key of ["metrics", "equipment", "documents"] as const) {
      const ids = obj[key].map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: "custom", message: `Повторяющийся id: ${key}` });
    }
    for (const category of ["scheme", "regime-card"])
      if (
        obj.documents.filter((d) => d.category === category && d.isPrimary)
          .length > 1
      )
        ctx.addIssue({
          code: "custom",
          message: `Несколько основных документов: ${category}`,
        });
  });
export const catalogSchema = z
  .object({
    objects: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        type: z.string(),
        address: z.string(),
        aliases: z.array(z.string()).default([]),
        configUrl: url,
      }),
    ),
  })
  .refine(
    (v) => new Set(v.objects.map((o) => o.id)).size === v.objects.length,
    "Повторяющийся id объекта",
  );
export const appSchema = z.object({
  name: z.string(),
  subtitle: z.string(),
  demoCommands: z.array(z.string()),
});
export type Metric = z.infer<typeof metricSchema>;
export type Doc = z.infer<typeof documentSchema>;
export type Entry = z.infer<typeof catalogSchema>["objects"][number];
export type ObjectData = z.infer<typeof objectSchema>;
export type SiteObject = Entry & { data?: ObjectData; error?: string };
export function overall(data: ObjectData) {
  return (
    data.status ??
    data.metrics.reduce<Metric["status"]>(
      (s, m) =>
        statuses.indexOf(m.status) > statuses.indexOf(s) ? m.status : s,
      "unknown",
    )
  );
}
export function stamp(value?: string) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(value.includes("T") ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "Не указано";
}
export async function readJson<T>(
  path: string,
  schema: z.ZodType<T, any, any>,
): Promise<T> {
  try {
    let r: Response;
    try {
      r = await fetch(path, {
        cache: "no-cache",
        signal: AbortSignal.timeout(12000),
      });
    } catch (networkError) {
      const cached =
        "caches" in globalThis
          ? await caches
              .open("gazkontur-validated-v1")
              .then((cache) => cache.match(path))
              .catch(() => undefined)
          : undefined;
      if (!cached) throw networkError;
      r = cached;
    }
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const parsed = schema.parse(await r.clone().json());
    if ("caches" in globalThis) {
      try {
        await (await caches.open("gazkontur-validated-v1")).put(path, r);
      } catch {
        /* Storage quota must not prevent reading data. */
      }
    }
    return parsed;
  } catch (e) {
    throw Error(
      `Не удалось загрузить ${path}: ${e instanceof z.ZodError ? e.issues.map((i) => i.message).join(", ") : (e as Error).message}`,
    );
  }
}
export const categories: Record<Doc["category"], string> = {
  scheme: "Схемы",
  "regime-card": "Режимные карты",
  passport: "Паспорта",
  act: "Акты",
  instruction: "Инструкции",
  other: "Прочее",
};
