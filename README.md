# APPVERSE — Application Publishing & Marketplace

APPVERSE is a free Android (`.apk`, `.aab`) and iOS (`.ipa`) application publishing, Owner security review, and marketplace sharing platform powered by React, TypeScript, Tailwind CSS, and Firebase.

## Publishing to GitHub Pages (Works Automatically)

This repository works with **both** GitHub Pages deployment modes with zero manual build steps:

- **Option 1 (Deploy from a branch — zero setup):** Push the repository to GitHub and set **Settings → Pages → Source** to `Deploy from a branch` (`main` / `(root)`). `index.html` and `static-boot.js` automatically compile and render the live APPVERSE interface directly from `src/` with no build artifacts required.
- **Option 2 (GitHub Actions):** Set **Settings → Pages → Source** to **GitHub Actions**. `.github/workflows/deploy.yml` builds `./dist` and deploys it automatically on every push.

After publishing, open **Firebase Console → Authentication → Settings → Authorized domains** and add `<your-username>.github.io` so Google and Email Sign-In work on your live GitHub Pages URL.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
