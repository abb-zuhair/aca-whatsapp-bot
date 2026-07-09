/**
 * Run this script yourself (on your own machine or server) to pull text content
 * from your school website and append it to data/knowledge_base.js.
 *
 * Why you run this instead of Claude doing it automatically: the environment
 * that built this project could only reach a small allowlist of domains and
 * could not fetch aca.edu.kw directly. This script has no such restriction.
 *
 * Usage:
 *   npm install
 *   node scrape-website.js
 *
 * Edit PAGES_TO_SCRAPE below to list the exact pages you want indexed
 * (about page, admissions, FAQ, calendar, handbook page, etc).
 */

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const PAGES_TO_SCRAPE = [
  "https://www.aca.edu.kw/",
  // Add more specific pages here, e.g.:
  // "https://www.aca.edu.kw/admissions",
  // "https://www.aca.edu.kw/about",
  // "https://www.aca.edu.kw/faq",
];

async function scrapePage(url) {
  const { data: html } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ACA-KB-Builder/1.0)" },
    timeout: 15000,
  });
  const $ = cheerio.load(html);

  // Strip script/style/nav/footer noise, then grab visible text.
  $("script, style, nav, footer, header, noscript").remove();
  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

async function main() {
  const scraped = [];

  for (const url of PAGES_TO_SCRAPE) {
    try {
      console.log(`Scraping ${url} ...`);
      const text = await scrapePage(url);
      scraped.push({
        source: `ACA Website: ${url}`,
        language: "Mixed",
        content: text.slice(0, 8000), // cap length per page to keep KB manageable
      });
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err.message);
    }
  }

  if (scraped.length === 0) {
    console.log("Nothing scraped, exiting without changes.");
    return;
  }

  const outPath = path.join(__dirname, "data", "website_knowledge.json");
  fs.writeFileSync(outPath, JSON.stringify(scraped, null, 2));
  console.log(`\nSaved ${scraped.length} page(s) to ${outPath}`);
  console.log(
    "Next step: open data/knowledge_base.js and either:\n" +
      "  (a) manually copy relevant entries from website_knowledge.json into the KNOWLEDGE_BASE array, or\n" +
      "  (b) add this near the bottom of knowledge_base.js:\n" +
      "      const website = require('./website_knowledge.json');\n" +
      "      KNOWLEDGE_BASE.push(...website);\n" +
      "     (then export KNOWLEDGE_BASE as usual)"
  );
}

main();
