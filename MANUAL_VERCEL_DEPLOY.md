# Manual Vercel deployment — clean project recovery

This guide is for deploying VouchGuard AI manually from the Vercel dashboard when the existing `vouchguard-ai` project/domain is returning a Vercel platform-level `404 NOT_FOUND`.

## Important: use a NEW Vercel project

Do **not** use the existing `vouchguard-ai` project for this recovery test.

Create a fresh project from the same GitHub repository. Recommended project name:

```text
vouchguard-ai-manual
```

or another new unique name such as:

```text
vouchguard-commons-live
```

The purpose is to force Vercel to create a new project ID, new deployment routing state, and a new `.vercel.app` production domain rather than reusing the currently broken project routing.

Repository:

```text
https://github.com/mssystem1/x-account-authentication-for-commons-
```

---

## 1. Open Vercel and import the repository

1. Sign in to Vercel.
2. Make sure the correct Vercel account/team is selected.
3. Click **Add New** → **Project**.
4. Find the GitHub repository:

   ```text
   mssystem1/x-account-authentication-for-commons-
   ```

5. Click **Import**.
6. For **Project Name**, use a NEW name, for example:

   ```text
   vouchguard-ai-manual
   ```

7. Do not select or reuse the old `vouchguard-ai` Vercel project.

---

## 2. Configure build settings

Vercel should detect Next.js automatically.

Use these settings:

| Setting | Value |
|---|---|
| Framework Preset | `Next.js` |
| Root Directory | `./` |
| Node.js | `22.x` |
| Install Command | leave default (`npm install`) |
| Build Command | leave default / `npm run build` |
| Output Directory | leave default |

Do not set a custom output directory such as `out`.

The repository is a normal Next.js App Router application and requires server-side routes for `/api/scan`, `/api/health`, and `/u/[handle]`.

---

## 3. Add environment variables before the first deployment

In the import screen open **Environment Variables**.

Add the following values for **Production**.

### Required live variable

```text
XAI_API_KEY=<your real xAI API key>
```

Keep this secret. Never name it `NEXT_PUBLIC_XAI_API_KEY`.

### Model

```text
XAI_MODEL=grok-4.5-latest
```

### Cache TTL

```text
SCAN_CACHE_TTL_SECONDS=21600
```

### Rate limit

```text
SCAN_RATE_LIMIT_PER_MINUTE=12
```

### Live mode

```text
VOUCHGUARD_DEMO_MODE=false
```

### Do NOT set this yet

For the first deployment, leave this unset:

```text
NEXT_PUBLIC_APP_URL
```

The app can run without it. We will set it after Vercel gives the new project its final production domain.

### Do NOT manually copy the old Blob token

Do not copy the old project's `BLOB_READ_WRITE_TOKEN` into the new project yet. A new Blob store should be connected from the new project's Storage tab so Vercel creates/injects the correct token automatically.

---

## 4. Deployment Protection

For a public production app, use:

```text
Project → Settings → Deployment Protection
Vercel Authentication → Standard Protection
```

Standard Protection keeps preview/generated deployment URLs protected while the actual production domain remains public.

For troubleshooting the first deployment, the important test is the new project's short production domain, for example:

```text
https://vouchguard-ai-manual.vercel.app
```

Do not judge the public deployment only from a long generated URL because generated URLs can legitimately require Vercel authentication under Standard Protection.

---

## 5. Click Deploy

Click **Deploy** on the import screen.

A correct build should identify these routes:

```text
/
/api/health
/api/scan
/methodology
/u/[handle]
```

Wait until Vercel reports the deployment as **Ready**.

Do not stop at the green `Ready` state. A Ready build does not prove that edge routing is actually serving the app.

---

## 6. First routing test — before Blob setup

Vercel should give the new project a short domain similar to:

```text
https://vouchguard-ai-manual.vercel.app
```

Open that URL in an incognito/private browser window.

### Test A — homepage

Open:

```text
https://NEW-DOMAIN.vercel.app/
```

Expected result: the VouchGuard scanner UI.

### Test B — health API

Open:

```text
https://NEW-DOMAIN.vercel.app/api/health
```

Expected response is JSON, not HTML and not a Vercel error page.

Before Blob is connected, an acceptable response can look like:

```json
{
  "ok": true,
  "mode": "live",
  "model": "grok-4.5-latest",
  "xaiConfigured": true,
  "storage": "stateless",
  "methodologyVersion": "vg-2026.08.1"
}
```

The critical fields at this stage are:

```text
ok = true
mode = live
xaiConfigured = true
```

### If you see Vercel `404: NOT_FOUND`

If a completely new Vercel project and its newly generated short production domain still return:

```text
404: NOT_FOUND
Code: NOT_FOUND
```

then the request is still failing in Vercel routing before it reaches the Next.js application. Do not keep changing application code to fix that specific response.

Take a screenshot of:

1. the new Vercel project's **Overview** page showing the Ready deployment;
2. **Settings → Domains**;
3. the browser showing the new domain's `404 NOT_FOUND`;
4. the deployment's build logs / deployment ID.

---

## 7. Set the canonical application URL

Only after the new short production domain works, go to:

```text
Project → Settings → Environment Variables
```

Add:

```text
NEXT_PUBLIC_APP_URL=https://NEW-DOMAIN.vercel.app
```

Example:

```text
NEXT_PUBLIC_APP_URL=https://vouchguard-ai-manual.vercel.app
```

Set it for **Production**.

Then redeploy because environment-variable changes only affect new deployments.

Use:

```text
Project → Deployments → latest deployment → ... → Redeploy
```

Deploy to Production.

---

## 8. Create the Blob cache in the NEW project

After basic routing works:

1. Open the new Vercel project.
2. Open **Storage**.
3. Click **Create Database**.
4. Choose **Blob**.
5. Click **Continue**.
6. Choose **Public** access.
7. Name it, for example:

   ```text
   vouchguard-cache
   ```

8. Connect it to the new project and select the **Production** environment.

Vercel should automatically add:

```text
BLOB_READ_WRITE_TOKEN
```

Do not expose this as a `NEXT_PUBLIC_*` variable.

After the Blob store is connected, redeploy Production again.

---

## 9. Final health test

Open:

```text
https://NEW-DOMAIN.vercel.app/api/health
```

Final expected JSON:

```json
{
  "ok": true,
  "mode": "live",
  "model": "grok-4.5-latest",
  "xaiConfigured": true,
  "storage": "vercel-blob",
  "methodologyVersion": "vg-2026.08.1"
}
```

The important final state is:

```text
ok = true
mode = live
xaiConfigured = true
storage = vercel-blob
```

---

## 10. Test a real scan

On the homepage enter a real public X handle and start a scan.

Verify all of the following:

1. the request does not immediately return an API configuration error;
2. the scan calls the live xAI path rather than demo mode;
3. the results contain Authenticity, Farmer Risk, Bot Risk, Sybil Risk and Vouch Confidence;
4. evidence links are rendered when available;
5. the result has a `/u/<handle>` permalink;
6. reload the `/u/<handle>` page and confirm the result remains available.

If the scan works but the public result disappears later, re-check Blob configuration and `/api/health`.

---

## 11. Domains page sanity check

Open:

```text
Project → Settings → Domains
```

The new project domain should be attached to the new project and should show a valid configuration.

For the recovery deployment, do not manually add the old broken domain:

```text
vouchguard-ai.vercel.app
```

until the new project is confirmed healthy.

Use the NEW project domain as the production URL first.

---

## 12. Do not create competing deployments

The GitHub Actions Vercel workflow in this repository has been changed to **manual-only**. Normal pushes to `main` will no longer launch the separate Vercel CLI deployment workflow.

This is intentional. Let the new Vercel project's normal Git integration own deployment while testing the manual recovery path.

If you later decide to use GitHub Actions instead, use only one deployment mechanism at a time.

---

## 13. If the new project works

Keep the new project as production temporarily.

Recommended order:

1. verify homepage;
2. verify `/api/health`;
3. set `NEXT_PUBLIC_APP_URL`;
4. connect Blob;
5. redeploy;
6. verify `storage=vercel-blob`;
7. run a real X scan;
8. verify the public `/u/<handle>` result;
9. only then consider moving a custom domain or retiring the broken old Vercel project.

---

## 14. If the new project also returns Vercel NOT_FOUND

Do not delete the repository or rewrite Next.js routing.

Collect these items:

```text
New Vercel project name
New `.vercel.app` domain
Deployment ID
Deployment status (Ready)
Build log result
Screenshot of Settings → Domains
Screenshot of the browser 404
The `x-vercel-id` shown in the response/error
```

At that point the clean-project test has ruled out the old project configuration as the primary cause and gives Vercel support a minimal reproducible deployment-routing case.

---

## Repository readiness

The repository is prepared for this manual path:

- Next.js build is standard and needs no custom output directory.
- Node is pinned to `22.x`.
- `.env*` local secret files are ignored by Git.
- `XAI_API_KEY` remains server-side.
- `NEXT_PUBLIC_APP_URL` is optional for the initial deployment.
- Vercel Blob is optional for the initial routing test and can be connected after the site is reachable.
- GitHub Actions production deployment is manual-only to avoid a deployment race with the manually imported Vercel project.
