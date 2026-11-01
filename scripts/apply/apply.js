#!/usr/bin/env node
/**
 * Assistant de candidature semi-automatique (à lancer SUR TA MACHINE).
 *
 * - Ouvre un navigateur visible avec un profil persistant : tu te connectes une
 *   seule fois à Indeed / LinkedIn / HelloWork / WTTJ, la session est gardée.
 * - Pour chaque offre de offers.json : ouvre la page, clique sur "Postuler",
 *   remplit les champs connus (profile.json), joint le CV, prend une capture.
 * - S'ARRÊTE AVANT L'ENVOI : tu relis, tu cliques sur "Envoyer" toi-même, puis
 *   tu réponds o (envoyé) / n (non envoyé) dans le terminal.
 * - Écrit results.json : à me renvoyer pour que je mette JobTracker à jour.
 *
 * Usage :
 *   cd scripts/apply
 *   npm i playwright && npx playwright install chromium
 *   cp profile.example.json profile.json   # puis le remplir
 *   node apply.js                          # toutes les offres
 *   node apply.js --only hublo,grdf        # certaines offres (clé = champ "id")
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

const dir = __dirname;
const profile = JSON.parse(fs.readFileSync(path.join(dir, 'profile.json'), 'utf8'));
const offers = JSON.parse(fs.readFileSync(path.join(dir, 'offers.json'), 'utf8'));
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > -1 ? process.argv[onlyArg + 1].split(',') : null;
const resultsPath = path.join(dir, 'results.json');
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf8')) : {};
const cvPath = path.resolve(dir, profile.cv_path);

const ask = (q) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); res(a.trim().toLowerCase()); });
});

// Correspondance champ du formulaire -> valeur du profil (par label/placeholder/name).
const FIELD_MAP = [
  [/pr[ée]nom|first.?name/i, () => profile.first_name],
  [/^nom$|last.?name|family.?name|nom de famille/i, () => profile.last_name],
  [/e-?mail|courriel/i, () => profile.email],
  [/t[ée]l[ée]phone|phone|mobile/i, () => profile.phone],
  [/ville|city|localit/i, () => profile.city],
  [/linkedin/i, () => profile.linkedin],
  [/github/i, () => profile.github],
  [/portfolio|site web|website/i, () => profile.portfolio],
  [/disponib|availability|date de d[ée]but|start date/i, () => profile.availability],
  [/salaire|pr[ée]tention|salary|r[ée]mun/i, () => profile.salary_expectation],
];

async function fillKnownFields(page) {
  const inputs = page.locator('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=submit]), textarea');
  const n = await inputs.count();
  let filled = 0;
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    if ((await el.inputValue().catch(() => '')) !== '') continue;
    const meta = await el.evaluate((node) => {
      const id = node.id;
      const label = id ? (document.querySelector(`label[for="${id}"]`) || {}).innerText : '';
      return [label, node.placeholder, node.name, node.getAttribute('aria-label')].filter(Boolean).join(' ');
    });
    for (const [re, get] of FIELD_MAP) {
      const value = get();
      if (value && re.test(meta)) {
        await el.fill(String(value)).catch(() => {});
        filled++;
        break;
      }
    }
  }
  return filled;
}

async function attachCv(page) {
  const files = page.locator('input[type=file]');
  if ((await files.count()) > 0) {
    await files.first().setInputFiles(cvPath).catch(() => {});
    return true;
  }
  return false;
}

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(dir, '.browser-profile'), {
    headless: false,
    locale: 'fr-FR',
    viewport: { width: 1280, height: 900 },
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  for (const offer of offers) {
    if (only && !only.includes(offer.id)) continue;
    if (results[offer.id] && results[offer.id].status === 'sent') {
      console.log(`- ${offer.id} déjà envoyé, on saute.`);
      continue;
    }
    console.log(`\n=== ${offer.company} — ${offer.title} ===\n${offer.url}`);
    try {
      await page.goto(offer.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);

      const applyBtn = page.locator('a,button').filter({ hasText: /postuler|candidater|apply/i }).first();
      if (await applyBtn.count()) {
        await applyBtn.click().catch(() => {});
        await page.waitForTimeout(3000);
      }

      const filled = await fillKnownFields(page);
      const cv = await attachCv(page);
      const shot = path.join(dir, `shot-${offer.id}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      console.log(`Champs remplis : ${filled} | CV joint : ${cv ? 'oui' : 'non (à faire à la main)'} | capture : ${shot}`);
      console.log('-> Complète ce qui manque (connexion, questions), relis, puis ENVOIE toi-même dans le navigateur.');

      const a = await ask('Envoyé ? (o = envoyé, n = non envoyé, s = quitter) : ');
      if (a === 's') break;
      results[offer.id] = {
        status: a === 'o' ? 'sent' : 'not_sent',
        company: offer.company,
        title: offer.title,
        url: offer.url,
        sent_at: a === 'o' ? new Date().toISOString() : null,
        application_id: offer.application_id || null,
      };
    } catch (e) {
      console.log('Erreur :', e.message);
      results[offer.id] = { status: 'error', company: offer.company, title: offer.title, url: offer.url, error: e.message.slice(0, 200) };
    }
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  }

  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nTerminé. Résultats : ${resultsPath}`);
  await ctx.close();
})();
