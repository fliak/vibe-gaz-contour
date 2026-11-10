import { test, expect } from "@playwright/test";
test("three sections, commands, selection persistence and documents", async ({
  page,
  context,
}, info) => {
  await context.route("**/documents/**/*.pdf", async (route) => {
    if (
      route.request().isNavigationRequest() ||
      route.request().headers()["accept"]?.includes("text/html")
    )
      await route.fulfill({
        contentType: "text/html",
        body: "<h1>Browser PDF page</h1>",
      });
    else await route.continue();
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Голосовой помощник", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".focus-title h3")).toHaveText("ГРП-2");
  await expect(page.getByRole("navigation").getByRole("button")).toHaveCount(3);
  await page
    .getByRole("textbox", { name: "Ваш вопрос" })
    .fill("Какое давление на входе ГРП-2?");
  await page.getByRole("button", { name: "Выполнить запрос" }).click();
  await expect(page.locator(".answer-value")).toContainText("0.42");
  await page.getByRole("button", { name: "Телеметрия", exact: true }).click();
  await expect(page.locator(".metric-card")).toHaveCount(4);
  await page.getByLabel("Текущий объект").selectOption("shrp-5");
  await expect(page.locator(".object-summary")).toContainText("Отклонение");
  await page.reload();
  await expect(page.getByLabel("Текущий объект")).toHaveValue("shrp-5");
  await page.getByRole("button", { name: "Документы", exact: true }).click();
  await expect(page.locator(".document-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Паспорта", exact: true }).click();
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Все документы", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Поиск документов" }).fill("схема");
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page.locator(".document-card").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".image-scroll img")).toBeVisible();
  await page.getByRole("button", { name: "Увеличить", exact: true }).click();
  await expect(page.locator(".zoom-tools")).toContainText("125%");
  await page.getByRole("button", { name: "Закрыть просмотр" }).click();
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await page
    .getByRole("button", { name: /Режимные карты.*Режимная карта ШРП-5/ })
    .click();
  // The headless browser also falls back when its embedded PDF plugin fails.
  await expect(page).toHaveURL(/\/documents\/shrp-5\/regime-card.pdf$/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Документы", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Голос", exact: true }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-voice.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Телеметрия", exact: true }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-telemetry.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Документы", exact: true }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-documents.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("offline reload retains data and an opened document", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page.reload();
  await expect(page.getByLabel("Текущий объект")).toBeVisible();
  await page.getByRole("button", { name: "Документы", exact: true }).click();
  await page.getByRole("button", { name: /Схемы.*Схема обвязки/ }).click();
  await expect(page.locator(".image-scroll img")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть просмотр" }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".notice")).toContainText("Нет соединения");
  await expect(page.getByLabel("Текущий объект")).toBeVisible();
  await page.getByRole("button", { name: "Документы", exact: true }).click();
  await page.getByRole("button", { name: /Схемы.*Схема обвязки/ }).click();
  await expect(page.locator(".image-scroll img")).toBeVisible();
});
test("broken object, missing document and empty search have useful states", async ({
  page,
  context,
}) => {
  await page.route("**/config/objects/shrp-5.json", (route) =>
    route.fulfill({ body: "{broken", contentType: "application/json" }),
  );
  await page.goto("/");
  await expect(page.getByLabel("Текущий объект")).toBeVisible();
  await page.getByRole("button", { name: "Телеметрия", exact: true }).click();
  await page.getByLabel("Текущий объект").selectOption("shrp-5");
  await expect(page.getByRole("alert")).toContainText(
    "/config/objects/shrp-5.json",
  );
  await page.getByLabel("Текущий объект").selectOption("grp-2");
  await expect(page.locator(".metric-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Документы", exact: true }).click();
  await page.getByLabel("Поиск документов").fill("несуществующий");
  await expect(
    page.getByRole("heading", { name: "Документы не найдены" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await context.route("**/documents/grp-2/scheme.png", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.getByRole("button", { name: /Схемы.*Схема обвязки/ }).click();
  await expect(page.getByRole("alert")).toContainText("Документ не найден");
});
test("refresh loads new values without navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Текущий объект")).toBeVisible();
  await page.route("**/config/objects/grp-2.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.metrics[0].value = 0.49;
    await route.fulfill({ json: data });
  });
  await page.getByRole("button", { name: "Телеметрия", exact: true }).click();
  await page.getByRole("button", { name: "Обновить", exact: true }).click();
  await expect(page.locator(".metric-card").first()).toContainText("0.49");
});

for (const mode of ["no-viewer", "android-native"] as const) {
  test(`PDF direct page and Back restore document filters: ${mode}`, async ({
    page,
    context,
  }) => {
    await context.addInitScript((mode) => {
      Object.defineProperty(navigator, "pdfViewerEnabled", {
        get: () => mode === "android-native",
      });
      Object.defineProperty(navigator, "userAgent", {
        get: () =>
          mode === "android-native"
            ? "Mozilla/5.0 (Linux; Android 14)"
            : "Mozilla/5.0 (Windows NT 10.0)",
      });
    }, mode);
    // Headless Chromium cannot validate Android's native PDF UI. Substitute only
    // its navigation response; the application's preliminary PDF fetch stays real.
    await context.route("**/documents/**/*.pdf", async (route) => {
      if (
        route.request().isNavigationRequest() ||
        route.request().headers()["accept"]?.includes("text/html")
      )
        await route.fulfill({
          contentType: "text/html",
          body: "<h1>Browser PDF page</h1>",
        });
      else await route.continue();
    });
    await page.goto("/");
    await expect(page.getByLabel("Текущий объект")).toBeVisible();
    await page.getByLabel("Текущий объект").selectOption("shrp-5");
    await page.getByRole("button", { name: "Документы", exact: true }).click();
    await page
      .getByRole("button", { name: "Режимные карты", exact: true })
      .click();
    await page.getByLabel("Поиск документов").fill("ШРП-5");
    await page.locator(".document-card").click();
    await expect(page).toHaveURL(/\/documents\/shrp-5\/regime-card.pdf$/);
    expect(context.pages()).toHaveLength(1);
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Документы", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Текущий объект")).toHaveValue("shrp-5");
    await expect(page.getByLabel("Поиск документов")).toHaveValue("ШРП-5");
    await expect(
      page.getByRole("button", { name: "Режимные карты", exact: true }),
    ).toHaveClass("active");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // A fresh load, without the back-forward cache, restores the same state too.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Документы", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Поиск документов")).toHaveValue("ШРП-5");
  });
}
