import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
const index = await readFile("dist/index.html", "utf8");
const assets = (await readdir("dist/assets")).map((f) => "/assets/" + f);
const version = createHash("sha256")
  .update(index + (await readFile("public/sw-template.js", "utf8")))
  .digest("hex")
  .slice(0, 12);
const source = (await readFile("public/sw-template.js", "utf8"))
  .replace("__VERSION__", version)
  .replace(
    "__PRECACHE__",
    JSON.stringify([
      "/",
      "/index.html",
      "/manifest.webmanifest",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon.svg",
      ...assets,
    ]),
  );
await writeFile("dist/service-worker.js", source);

await unlink("dist/sw-template.js");
