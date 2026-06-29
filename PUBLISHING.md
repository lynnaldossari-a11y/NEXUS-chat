# Publish Nexus Social to GitHub Pages

This project is already structured as a static site, so it can be published live with GitHub Pages.

## What you need
- A GitHub account
- A GitHub repository for this project
- Your project files committed to that repository

## 1. Create a GitHub repository
1. Go to GitHub and click New repository.
2. Name it something like `nexus-social`.
3. Create the repository.

## 2. Upload or push your project files
You can either:
- upload the files directly in GitHub, or
- use Git from your computer.

If you use Git, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

## 3. Enable GitHub Pages
1. Open your repository on GitHub.
2. Go to Settings.
3. Open Pages.
4. Under Source, choose:
   - Branch: `main`
   - Folder: `/root`
5. Click Save.

## 4. Wait for deployment
GitHub Pages usually takes a few minutes to publish the site.

When it is ready, your site will be available at:

```text
https://your-username.github.io/your-repo/
```

## 5. Important checks
Before sharing the live link, confirm that:
- `index.html`, `styles.css`, `app.js`, `patch-notes.html`, and `admin.html` are in the repository root.
- Your Supabase project is configured and the database schema has been applied.
- Your Supabase RLS policies allow the app to read and write the required tables.

## 6. Troubleshooting
- If the page shows a 404, wait a little longer or confirm the Pages source settings.
- If the UI loads but login/chat does not work, check your Supabase connection and database policies.
- If you want a custom domain later, GitHub Pages can support that too.

## Live URL example
Once published, the site will be available at a URL like:

```text
https://your-username.github.io/nexus-social/
```
