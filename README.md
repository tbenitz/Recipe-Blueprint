# Recipe Blueprint — Public Recipe Library

A **read-only, public-facing recipe website** built from the Recipe Blueprint Studio v6 JSON library export. It is designed for GitHub Pages and requires no server, database, signup, API key, or generation requests.

## Publish your recipes

1. Open this repository on GitHub.
2. Choose **Add file → Upload files** and upload your complete library backup named **`recipes.json`** (lowercase).
3. Put `recipes.json` at the **repository root**, beside `index.html`, `app.js`, `pdf.js`, and `styles.css`.
4. Commit the upload. The website reads `./recipes.json` when visitors load the site.

**Export the full library backup from Recipe Blueprint Studio** (Library → Backup library), not just a single recipe JSON. The full backup has `recipes` and `collections` arrays and carries the cookbook/event grouping. The website also accepts a plain array of recipes, but that may not carry the bookshelf information.

## Enable the live website

In the GitHub repository: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**.

The site URL will be:

**https://tbenitz.github.io/Recipe-Blueprint/**

After GitHub Pages finishes its first deployment, visit the link. If a JSON warning appears, check the filename is exactly `recipes.json` and is saved at the root; it is **not included in this initial commit** because you said you would upload it separately.

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

The site's expected full Studio export is:

```json
{
  "recipes": [
    {
      "id": "recipe-1",
      "title": "Example dish",
      "category": "Main dishes",
      "country": "Italy",
      "region": "Europe",
      "collectionId": "book-1",
      "recipe": {
        "title": "Example dish",
        "yield": "4 servings",
        "intro": "Preparation note",
        "finish": "Serving note",
        "ingredients": [
          { "amount": "2 tbsp", "name": "olive oil", "prep": "" }
        ],
        "steps": [
          {
            "id": "step-1",
            "title": "Heat oil",
            "details": "Warm oil in a pan.",
            "start": 0,
            "duration": 2,
            "rowStart": 0,
            "rowEnd": 0,
            "kind": "heat"
          }
        ]
      }
    }
  ],
  "collections": [
    { "id": "book-1", "name": "Example cookbook", "type": "cookbook", "targetCount": 100 }
  ],
  "plans": []
}
```

Categories and regions are taken from your exported data; they are **not** guessed by the website.

## Running it locally

Because the site loads a sibling JSON file with `fetch`, it needs to be served over HTTP/HTTPS; opening `index.html` directly as a `file://` page may block loading.

On a computer with Python: `python -m http.server 8000` then visit `http://localhost:8000`. Otherwise, simply preview it on GitHub Pages after uploading your JSON.

## Privacy / hosting

Recipe data is a public JSON asset when hosted on GitHub Pages. Don't upload secrets, API keys, private notes, or personal information inside the export. No external CDN, analytics tracker, API, or external font is used by these site files. Favorites are stored in the visitor's own browser and do not modify `recipes.json`.
