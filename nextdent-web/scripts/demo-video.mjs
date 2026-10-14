// Records a screen-capture walkthrough of the live app with Playwright.
// Usage: node scripts/demo-video.mjs   (dev server must be running on :3300)
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3300";
const VIEW = { width: 1440, height: 900 };
const RAW = "demo/raw";
const USER = process.env.DEMO_USER || "nayeem";
const PASS = process.env.DEMO_PASS || "NewPass#2026";

mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir: RAW, size: VIEW }, colorScheme: "light" });
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

async function caption(text, sub = "") {
  await page.evaluate(([t, s]) => {
    let el = document.getElementById("demo-cap");
    if (!el) { el = document.createElement("div"); el.id = "demo-cap"; document.body.appendChild(el);
      el.style.cssText = "position:fixed;left:22px;bottom:22px;z-index:99999;background:rgba(13,148,136,.96);color:#fff;padding:11px 18px;border-radius:14px;font-family:system-ui;box-shadow:0 10px 30px rgba(0,0,0,.28)"; }
    el.innerHTML = `<div style="font:700 19px system-ui">${t}</div>${s ? `<div style="font:400 13px system-ui;opacity:.9;margin-top:2px">${s}</div>` : ""}`;
  }, [text, sub]);
}
async function card(title, subtitle) {
  await page.evaluate(([t, s]) => {
    const d = document.createElement("div"); d.id = "demo-title";
    d.style.cssText = "position:fixed;inset:0;z-index:100000;background:linear-gradient(135deg,#0f766e,#0891b2);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;text-align:center";
    d.innerHTML = `<div style="font-size:14px;letter-spacing:4px;opacity:.85">🦷 NEXTDENT</div><div style="font-size:46px;font-weight:800;margin-top:10px">${t}</div><div style="font-size:19px;opacity:.92;margin-top:8px">${s}</div>`;
    document.body.appendChild(d);
  }, [title, subtitle]);
}
const clearCard = () => page.evaluate(() => document.getElementById("demo-title")?.remove());
async function go(path) { await page.goto(BASE + path, { waitUntil: "domcontentloaded" }); await pause(700); }
async function section(label, sub, path, dwell = 2600, scroll = true) {
  await go(path);
  await caption(label, sub);
  await pause(900);
  if (scroll) { await page.mouse.wheel(0, 400); await pause(dwell / 2); await page.mouse.wheel(0, 400); await pause(dwell / 2); await page.mouse.wheel(0, -800); }
  else await pause(dwell);
}

try {
  // ── intro on the login screen ──
  await go("/login");
  await card("Practice Manager", "Rebuilt from the legacy Access system — on the web");
  await pause(2600); await clearCard();

  await caption("Secure sign-in", "argon2 passwords · role-based access · audit trail");
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', PASS);
  await pause(900);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|patients)/, { timeout: 15000 }).catch(() => {});
  await pause(1200);

  // ── modules ──
  await section("Dashboard", "Live clinic overview & module cards", "/dashboard", 2800);
  await go("/patients");
  await caption("Patients", "3,230 migrated records — type-ahead search");
  await page.fill('input[placeholder*="Search by name"]', "").catch(() => {});
  const search = page.locator('input[placeholder*="Search by name"]').first();
  await search.click().catch(() => {});
  await search.type("Rahman", { delay: 130 }).catch(() => {});
  await pause(2600);

  await section("Patient profile", "Dental chart · clinical timeline · billing balance", "/patients/4579", 3200);

  await go("/prescriptions/new");
  await caption("Prescriptions", "Search across 46,000 drugs — Bengali dosing");
  const drug = page.locator('input[placeholder*="drugs"]').first();
  await drug.click().catch(() => {});
  await drug.type("Napa", { delay: 130 }).catch(() => {});
  await pause(2600);
  await section("Printed prescription", "Clinic letterhead · print / PDF", "/prescriptions/52", 2600);

  await section("Appointments", "Day agenda · overdue & upcoming · configurable slots", "/appointments", 2600, false);
  await section("Treatment & billing", "Cases, procedures, discounts & payments", "/cases/1154", 2400);
  await section("Invoice", "Printable invoice on the clinic letterhead", "/cases/1154/invoice", 2600);
  await section("Finance", "Income vs expense · profit · expense tracking", "/finance", 2600);
  await section("Inventory", "Products, stock levels & low-stock alerts", "/inventory", 2400);
  await section("Lab work", "Crown/denture orders · shades · overdue tracking", "/labs", 2400, false);
  await section("Doctor payouts", "Revenue split from each doctor's contract", "/team/payouts", 2400, false);
  await section("Settings", "Catalog, lists, schedule, letterhead & more", "/settings", 2200, false);

  // ── dark mode ──
  await go("/dashboard");
  await caption("Dark mode", "Smooth theme switch across the whole app");
  const theme = page.locator('button[aria-label^="Theme"]').first();
  await theme.click().catch(() => {}); await pause(700);
  await theme.click().catch(() => {}); await pause(2600);

  // ── outro ──
  await card("13 modules · one system", "Auth · RBAC · audit · dark mode · ready for staging");
  await pause(3000);
} catch (e) {
  console.error("demo step failed:", e.message);
}

await context.close(); // flushes the video file
await browser.close();
console.log("done — raw video in", RAW);
