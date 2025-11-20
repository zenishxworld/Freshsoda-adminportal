# 🚀 Netlify Deployment Guide for Freshsoda Admin Portal

This guide will walk you through deploying your admin portal to Netlify.

## Prerequisites

- ✅ Git repository (GitHub, GitLab, or Bitbucket)
- ✅ Netlify account (free tier works fine)
- ✅ Supabase credentials from `.env.local`

## Step 1: Push Code to Git Repository

If you haven't already, push your code to a Git repository:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - ready for Netlify deployment"

# Add remote (replace with your repository URL)
git remote add origin https://github.com/yourusername/fs-adminportal.git

# Push to main branch
git push -u origin main
```

> [!IMPORTANT]
> Make sure `.env.local` is in your `.gitignore` file and NOT committed to the repository. Your environment variables will be configured in Netlify's dashboard.

## Step 2: Connect Repository to Netlify

### Option A: Deploy via Netlify Dashboard (Recommended)

1. **Log in to Netlify**: Go to [app.netlify.com](https://app.netlify.com)

2. **Create New Site**: Click "Add new site" → "Import an existing project"

3. **Connect Git Provider**: 
   - Choose your Git provider (GitHub, GitLab, or Bitbucket)
   - Authorize Netlify to access your repositories
   - Select your `fs-adminportal` repository

4. **Configure Build Settings**:
   - **Branch to deploy**: `main` (or your default branch)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   
   These settings are already configured in `netlify.toml`, so Netlify will auto-detect them.

5. **Click "Deploy site"** (don't worry about environment variables yet, we'll add them next)

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize and deploy
netlify init

# Follow the prompts to connect your repository
```

## Step 3: Configure Environment Variables

After the initial deployment, you need to add your Supabase credentials:

1. **Go to Site Settings**: In your Netlify dashboard, click "Site settings"

2. **Navigate to Environment Variables**: 
   - Click "Environment variables" in the left sidebar
   - Or go to: Site settings → Build & deploy → Environment variables

3. **Add Variables**: Click "Add a variable" and add the following:

   | Key | Value |
   |-----|-------|
   | `VITE_SUPABASE_URL` | `https://kpngqobuoknvwfmemngn.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwbmdxb2J1b2tudndmbWVtbmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MzM3MTAsImV4cCI6MjA3OTEwOTcxMH0.lwFEEo61H-j1ksVJX63oI32SdMM2OYqIqYBQGJpFk5I` |

   > [!TIP]
   > You can copy these values from your `.env.local` file

4. **Save and Redeploy**: 
   - After adding the variables, go to "Deploys" tab
   - Click "Trigger deploy" → "Deploy site"

## Step 4: Verify Deployment

Once the deployment completes:

1. **Open Your Site**: Click the generated URL (e.g., `https://your-site-name.netlify.app`)

2. **Test Functionality**:
   - ✅ Application loads without errors
   - ✅ Can view products from Supabase
   - ✅ Can add new products
   - ✅ All routes work (try refreshing on different pages)
   - ✅ No console errors in browser developer tools

3. **Check Build Logs**: If something doesn't work, check the deploy logs in Netlify dashboard

## Step 5: Custom Domain (Optional)

To use a custom domain:

1. Go to "Domain settings" in your Netlify dashboard
2. Click "Add custom domain"
3. Follow the instructions to configure DNS

## Troubleshooting

### Build Fails

- Check the build logs in Netlify dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version compatibility

### 404 on Routes

- Verify `netlify.toml` and `public/_redirects` files exist
- Check that redirects are configured correctly

### Supabase Connection Issues

- Verify environment variables are set correctly in Netlify
- Check that the Supabase URL and anon key are correct
- Ensure Supabase RLS policies allow the operations you're trying to perform

### Environment Variables Not Working

- Make sure variable names start with `VITE_` prefix
- Redeploy after adding/changing environment variables
- Check that you're using `import.meta.env.VITE_*` in your code

## Continuous Deployment

Netlify automatically redeploys your site when you push to your connected Git branch:

```bash
# Make changes to your code
git add .
git commit -m "Update feature"
git push

# Netlify will automatically build and deploy! 🎉
```

## Useful Commands

```bash
# Test production build locally
npm run build
npm run preview

# View build output
ls dist

# Check Netlify deploy status (if using CLI)
netlify status
```

## Next Steps

- 🎨 Customize your site name in Netlify settings
- 🔒 Set up custom domain with SSL
- 📊 Monitor analytics in Netlify dashboard
- 🔔 Set up deploy notifications (Slack, email, etc.)

---

**Need Help?** 
- [Netlify Documentation](https://docs.netlify.com/)
- [Netlify Support](https://www.netlify.com/support/)
