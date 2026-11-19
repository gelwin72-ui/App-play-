# APPVERSE — Application Publishing & Marketplace

APPVERSE is a free Android (`.apk`, `.aab`) and iOS (`.ipa`) application publishing, Owner security review, and marketplace sharing platform powered by React, TypeScript, Tailwind CSS, and Firebase.

## Publishing to GitHub Pages (No White Screen)

This repository works with **both** GitHub Pages modes out of the box:

- **Option 1 (Deploy from a branch — zero setup):** Push the repository (including the `gh-pages/` folder) and set **Settings → Pages → Source** to `Deploy from a branch` (`main` / `(root)`). `index.html` automatically loads the pre-built `./gh-pages/appverse.js` bundle.
- **Option 2 (GitHub Actions):** Set **Settings → Pages → Source** to **GitHub Actions**. `.github/workflows/deploy.yml` runs `npm install && npm run build` and deploys `./dist`.

After publishing, open **Firebase Console → Authentication → Settings → Authorized domains** and add `<your-username>.github.io` so Google and Email Sign-In work on your live GitHub Pages URL.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
