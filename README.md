# APPVERSE — Application Publishing & Marketplace

APPVERSE is a free Android (`.apk`, `.aab`) and iOS (`.ipa`) application publishing, Owner security review, and marketplace sharing platform powered by React, TypeScript, Tailwind CSS, and Firebase.

## Publishing to GitHub Pages (No White Screen)

This repository includes `.github/workflows/deploy.yml` and relative asset configuration (`base: './'` in `vite.config.ts`) so the full APPVERSE interface renders cleanly on GitHub Pages.

1. Push this repository to GitHub (`main` or `master` branch).
2. Open **Repository → Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The workflow automatically runs `npm install && npm run build` and deploys `./dist` to your GitHub Pages URL.
5. In **Firebase Console → Authentication → Settings → Authorized domains**, add `<your-username>.github.io` so Google and Email Sign-In work on your published GitHub Pages domain.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
