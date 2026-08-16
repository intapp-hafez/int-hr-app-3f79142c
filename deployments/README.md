# Deployment Guide for New Database

This guide will walk you through setting up a fresh Supabase project and migrating all your database schemas, policies, and edge functions to it.

## Prerequisites
- A new project created in [Supabase](https://supabase.com/dashboard/projects)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed on your machine
- Supabase CLI logged in (`supabase login`)

---

## Step 1: Apply the Database Schema

You have two options for applying the schema to your new database.

### Option A: Manual Copy & Paste (Recommended for simplicity)
1. Go to your new Supabase Project Dashboard.
2. Navigate to the **SQL Editor** on the left sidebar.
3. Open the `full_schema.sql` file in this folder.
4. Copy all of its contents.
5. Paste it into a new query in the SQL Editor and click **Run**.
*This will create all your tables, views, policies, triggers, and seed data in the correct order.*

### Option B: Using the Supabase CLI
1. Open your terminal in the `deployments` folder.
2. Link your local project to the new remote project:
   ```bash
   supabase link --project-ref <your-new-project-ref>
   ```
   *(You can find your project ref in your Supabase Project Settings -> General -> Reference ID)*
3. Push the migrations:
   ```bash
   supabase db push
   ```

---

## Step 2: Deploy Edge Functions

Your edge functions (`create-employee-account` and `send-smtp-email`) need to be deployed to the new environment.

1. Open your terminal in the `deployments` folder.
2. Link your project if you haven't already (from Option B above):
   ```bash
   supabase link --project-ref <your-new-project-ref>
   ```
3. Deploy all functions:
   ```bash
   supabase functions deploy
   ```
4. **Set Function Secrets**: If your functions rely on environment variables (like SMTP credentials or Resend API keys), make sure to set them in the new project:
   ```bash
   supabase secrets set MY_SECRET_NAME=my_secret_value
   ```
   *(Alternatively, you can set secrets directly in the Supabase Dashboard under Edge Functions -> Secrets).*

---

## Step 3: Update App Environment Variables

Now that your database and functions are running, you need to point your frontend application to the new Supabase project.

1. Go to your new Supabase Project Dashboard.
2. Navigate to **Project Settings** -> **API**.
3. Copy the **Project URL** and the **anon `public` API Key**.
4. Open your local `.env` file (or your hosting provider's environment variables settings, like Vercel/Netlify).
5. Update the values:
   ```env
   VITE_SUPABASE_URL=your-new-project-url
   VITE_SUPABASE_ANON_KEY=your-new-anon-key
   ```
6. Restart your local development server if it's currently running.

---

## Step 4: Verify

1. Run your app locally using `npm run dev` or `bun dev`.
2. Try creating a new account or performing an action that triggers a database read/write to ensure policies are working.
3. Test an action that triggers your edge functions to verify they were deployed successfully.
