# Regenerate the STAGING Supabase secret key (exact steps)

Why: the staging secret key was visible in screenshots taken while Vercel was being set up. Anyone holding it could read and change the **staging** database (never production; production uses a different project and key). Replace it now.

Staging project reference: `wodgrgowxtfucjwbbwwk`. If the address bar shows `lgeqyisotgtsnviwonia` you are in PRODUCTION: stop, do nothing there.

The staging project uses Supabase's newer key system: a **publishable** key (public by design, no need to change) and a **secret** key (starts with `sb_secret_`). Only the secret key is replaced.

## Steps
1. Open the Supabase dashboard and pick the **staging** project. Check the address contains `wodgrgowxtfucjwbbwwk`.
2. Go to **Project Settings, API Keys**, tab **Secret keys**.
3. Click **New secret key**, name it `staging-server-2`, create it, and copy it. Keep the page open.
4. Update the three places that use the old key, typing the new value yourself:
   - **Your computer:** open `~/hasiru-nidhi-website-2/.env.staging.local` in a text editor and replace the value on the line `SUPABASE_SERVICE_ROLE_KEY=`. Save. (This file is git-ignored.)
   - **Vercel:** project `hasiru-nidhi`, **Settings, Environment Variables**. Find `SUPABASE_SERVICE_ROLE_KEY` limited to the Preview branch `marketplace/develop`. Edit, paste the new value, **Save**. Do **not** touch any variable that applies to Production.
   - **Redeploy** the `marketplace/develop` preview in Vercel (it asks for your 2FA).
5. Tell me "rotated". I will run the staging checks to confirm the new key works (`node tests/staging/verify-schema.mjs`), without ever seeing the key.
6. Only after step 5 passes: back in Supabase, **Secret keys**, find the **old** key (compare its first and last characters with what you had) and **Delete** it. Confirm.
7. Check the old one is dead: I will call staging with it if you still have it in a note, or you can simply trust the deletion.

## Rules going forward
- Take screenshots only after hiding key fields; never paste keys into chat.
- Production keys live only in Vercel's Production environment and the Supabase production project.
- If you ever think a production key was exposed, tell me at once: that needs a rotation of the production secret key and a look at the audit log.
