import { expect, test } from "@playwright/test";

function route(path = ""): string {
  return path.replace(/^\//, "");
}

test("home page renders without failed requests or console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto(route());
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Project Northstar.*A calmer way to review consequential changes/,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("link", { name: "github" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("page feedback and edit links include the current page", async ({ page }) => {
  await page.goto(route("proposal"));

  const feedback = page.getByRole("link", { name: "Open a GitHub issue" });
  const issueUrl = new URL(await feedback.getAttribute("href") || "");
  expect(issueUrl.pathname).toBe("/octocat/demo-site/issues/new");
  expect(issueUrl.searchParams.get("body")).toContain("docs/proposal.md");
  expect(issueUrl.searchParams.get("body")).toContain("/demo-site/proposal");

  await expect(
    page.getByRole("link", { name: "Edit this page on GitHub" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/octocat/demo-site/edit/__DEFAULT_BRANCH__/docs/proposal.md",
  );
});

test("selected article text exposes issue and edit actions", async ({ page }) => {
  await page.goto(route("proposal"));
  await page
    .locator(".vp-doc p", { hasText: "Project Northstar proposes" })
    .selectText();

  const toolbar = page.getByRole("toolbar", { name: "Review selected text" });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole("link", { name: /Edit this page/ })).toHaveAttribute(
    "href",
    "https://github.com/octocat/demo-site/edit/__DEFAULT_BRANCH__/docs/proposal.md",
  );

  await page.evaluate(() => {
    Reflect.set(window, "open", (url: string | URL | undefined) => {
      Reflect.set(window, "__spectatorOpenedUrl", String(url));
      return null;
    });
  });
  await toolbar.getByRole("button", { name: /Create a GitHub issue/ }).click();
  const openedUrl = await page.evaluate(() =>
    Reflect.get(window, "__spectatorOpenedUrl"),
  );
  const issueUrl = new URL(String(openedUrl));
  expect(issueUrl.searchParams.get("body")).toContain("**Selected text:**");
  expect(issueUrl.searchParams.get("body")).toContain("> Project Northstar");
});

test("keyboard shortcut focuses the selected-text review action", async ({
  page,
}) => {
  await page.goto(route("proposal"));
  await page
    .locator(".vp-doc p", { hasText: "Project Northstar proposes" })
    .selectText();
  await expect(
    page.getByRole("toolbar", { name: "Review selected text" }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        altKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
  });
  await expect(
    page.getByRole("button", { name: /Create a GitHub issue/ }),
  ).toBeFocused();
});

test("selection outside article content does not expose review actions", async ({
  page,
}) => {
  await page.goto(route("proposal"));
  await page.evaluate(() => {
    const navigation = document.querySelector(".VPNav");
    if (!navigation) throw new Error("Expected navigation.");
    const range = document.createRange();
    range.selectNodeContents(navigation);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.waitForTimeout(50);
  await expect(
    page.getByRole("toolbar", { name: "Review selected text" }),
  ).toHaveCount(0);
});

test("route changes dismiss selected-text review actions", async ({ page }) => {
  await page.goto(route("proposal"));
  await page
    .locator(".vp-doc p", { hasText: "Project Northstar proposes" })
    .selectText();
  await expect(
    page.getByRole("toolbar", { name: "Review selected text" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "System shape", exact: true }).first().click();
  await expect(page).toHaveURL(/system-shape$/);
  await expect(
    page.getByRole("toolbar", { name: "Review selected text" }),
  ).toHaveCount(0);
});

test("mobile navigation and page outline remain available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route("proposal"));
  await expect(page.getByRole("button", { name: "mobile navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "On this page" })).toBeVisible();
});

test("clean routes and 404 output are available", async ({ page, request }) => {
  await page.goto(route("system-shape"));
  await expect(page.getByRole("heading", { level: 1, name: /System shape/ })).toBeVisible();
  const missing = await request.get(route("not-a-real-page"));
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toMatch(/<title>404 \| Demo Site<\/title>/);
  const privateHandoff = await request.get(route("public/images/IMAGES"));
  expect(privateHandoff.status()).toBe(404);
});
