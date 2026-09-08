import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { appSchema, catalogSchema, objectSchema } from "../src/data";
const root = resolve("public");
function local(url: string) {
  const file = resolve(root, "." + decodeURIComponent(url));
  if (!file.startsWith(root + sep)) throw Error(`Путь вне public: ${url}`);
  return file;
}
async function json(url: string) {
  try {
    return JSON.parse(await readFile(local(url), "utf8"));
  } catch (e) {
    throw Error(`${url}: ${(e as Error).message}`);
  }
}
try {
  appSchema.parse(await json("/config/app.json"));
  const catalog = catalogSchema.parse(await json("/config/objects.json"));
  const ids = new Set<string>();
  for (const entry of catalog.objects) {
    try {
      const obj = objectSchema.parse(await json(entry.configUrl));
      if (obj.id !== entry.id) throw Error("id не совпадает с каталогом");
      for (const doc of obj.documents) {
        if (ids.has(doc.id))
          throw Error(`Повторяющийся id документа ${doc.id}`);
        ids.add(doc.id);
        await stat(local(doc.url));
      }
    } catch (e) {
      throw Error(`${entry.configUrl}: ${(e as Error).message}`);
    }
  }
  console.log(
    `Конфигурация корректна: ${catalog.objects.length} объекта, ${ids.size} документов.`,
  );
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
