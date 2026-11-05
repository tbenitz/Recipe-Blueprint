# Recipe Blueprint — Public Recipe Library

A **read-only, public-facing recipe website** built from the Recipe Blueprint Studio v6 JSON library export. It is designed for GitHub Pages and requires no server, database, signup, API key, or generation requests.

## Your published recipe library

The complete recipe export has now been published: **11,941 recipes** across **9 collections**.

Because GitHub's connected upload interface rejected the original 59.7 MiB JSON as a single request, the library is losslessly gzip-compressed and hosted in four small text assets under `data/`. The root `recipes.json` is a tiny manifest listing those assets.

The website automatically downloads, combines, decompresses, and parses those assets **in the visitor's browser**. There is no external API or server application. The compressed payload is about 9.2 MiB rather than the original 59.7 MiB.

To update recipes later, you can replace the root `recipes.json` with a **regular full library export** from Recipe Blueprint Studio (the site supports both normal JSON and the special compressed manifest). GitHub's browser uploader limits may require using Git to push exports over 25 MiB.

## Enable the live website

In the GitHub repository: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.

The site URL will be:

**https://tbenitz.github.io/Recipe-Blueprint/**

After GitHub Pages finishes its first deployment, visit the link. If a JSON warning appears, check the filename is exactly `recipes.json` and is saved at the root; the root file should be the published JSON manifest or a full exported library.

## Featured U.S. recipes and collection names

The Discover homepage leads with a curated selection of familiar American recipes (chicken pot pie, macaroni and cheese, pancakes, cookies and more). Air-fryer recipes and international dishes are **not** used for this first featured block. The All Recipes page also defaults to **Featured · U.S. classics first**, but visitors can use the country filter or select a different sorting method.

"Popular" means hand-selected widely familiar dishes, **not** actual traffic or star ratings: the site does not track views or collect visitor data.

The original export includes **9 named collections**, but references **35 additional cookbook IDs without names**. Those 35 cookbook groups are preserved and assigned **descriptive, reconstructed labels** in [`collection-names.json`](collection-names.json), rather than repeatedly appearing as "Other collection." The exact original titles are not in the export, so these labels are **not presented as the original saved names**. If you remember a title, edit its value in `collection-names.json` and commit; the site will display it automatically without changing any recipes. The 9 names present in the export take precedence.

## Features

- Discover homepage featuring published recipes, cookbooks, and event menus
- All cookbooks and events visible, even when they currently have zero completed recipes
- Searches recipe titles, ingredients, categories, countries, regions, and cookbook names
- Country, region, and dish type filters, plus sorting and pagination for large collections
- Full-screen recipe with ingredient checklist, time-proportional blueprint table, and directions
- **One-page PDF download** with ingredients, timeline, and full instructions; generated inside the browser without dependencies
- Browser print, shareable recipe links, next/previous recipe, and favorites saved in the visitor's browser
- Responsive layout for phones, tablets, laptops, and desktop

## What isn't included

There is **no** recipe generator, DeepSeek integration, API key form, usage metering, editing, admin dashboard, account system, or deletion capability on the public website. The live site's recipes are managed **only** by replacing the `recipes.json` file in GitHub.

Only recipes containing actual ingredient or cooking-step data are treated as published recipes. Planned recipe titles in a cookbook do **not** become fully published recipes.

## Data format

The full Studio export is a JSON object with a `recipes` array, `collections` array, and optional planning metadata. Each recipe includes its ingredients, timed cooking steps, geographic classification, category, and collection ID.

The published `recipes.json` currently contains a compressed-bundle manifest, with `format: "recipe-blueprint-compressed-v1"` and four `parts` URLs under `data/`. The reader also accepts direct JSON exports of the original Studio format.

Categories, cookbooks and countries are taken from the export without guessing.

## Running it locally

Because the site loads a sibling JSON file with `fetch`, it needs to be served over HTTP/HTTPS; opening `index.html` directly as a `file://` page may block loading.

On a computer with Python: `python -m http.server 8000` then visit `http://localhost:8000`. Otherwise, simply preview it on GitHub Pages after uploading your JSON.

## Privacy / hosting

Recipe data is a public JSON asset when hosted on GitHub Pages. Don't upload secrets, API keys, private notes, or personal information inside the export. No external CDN, analytics tracker, API, or external font is used by these site files. Favorites are stored in the visitor's own browser and do not modify `recipes.json`.
