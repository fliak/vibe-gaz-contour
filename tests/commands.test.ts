import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { command } from "../src/commands";
import { catalogSchema, objectSchema, overall, appSchema } from "../src/data";
const read = (url: string) => JSON.parse(readFileSync("public" + url, "utf8"));
const objects = catalogSchema
  .parse(read("/config/objects.json"))
  .objects.map((e) => ({ ...e, data: objectSchema.parse(read(e.configUrl)) }));
test("all configured demo commands resolve", () => {
  for (const q of appSchema.parse(read("/config/app.json")).demoCommands) {
    assert.doesNotMatch(
      command(q, objects, "grp-2").text,
      /не распознана|не найден/,
    );
  }
});
test("explicit aliases override context", () => {
  const result = command(
    "Какое выходное давление у шрп пять?",
    objects,
    "grp-2",
  );
  assert.equal(result.objectId, "shrp-5");
  assert.equal(result.metric?.value, 0.32);
});
test("contextual document commands use selected object", () => {
  assert.equal(
    command("Покажи схему этого объекта", objects, "grpsh-12").doc?.id,
    "grpsh-12-scheme",
  );
});
test("unknown objects must not return another object’s data", () => {
  assert.match(
    command("Давление на входе ГРП-99", objects, "grp-2").text,
    /не найден/,
  );
});
test("ambiguous metrics and objects offer choices", () => {
  assert.equal(command("Какое давление?", objects, "grp-2").choices?.length, 2);
  const result = command("Давление на входе ГРП-2 и ШРП-5", objects, "grp-2");
  assert.equal(result.choices?.length, 2);
  for (const choice of result.choices ?? [])
    assert.ok(command(choice.query, objects, "grp-2").metric);
});
test("broken object remains selectable without crashing commands", () => {
  assert.match(
    command(
      "Покажи ГРП-2",
      [{ ...objects[0], data: undefined, error: "bad JSON" }],
      "grp-2",
    ).text,
    /bad JSON/,
  );
});
test("overall status uses most severe metric unless explicitly set", () => {
  assert.equal(overall(objects[1].data), "deviation");
  assert.equal(overall({ ...objects[1].data, status: "alarm" }), "alarm");
});
test("duplicate metrics and multiple primary documents rejected", () => {
  const original = objects[0].data;
  assert.equal(
    objectSchema.safeParse({
      ...original,
      metrics: [original.metrics[0], original.metrics[0]],
    }).success,
    false,
  );
  assert.equal(
    objectSchema.safeParse({
      ...original,
      documents: [
        ...original.documents,
        { ...original.documents[0], id: "duplicate-primary" },
      ],
    }).success,
    false,
  );
});
