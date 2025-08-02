# 🚀 Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Supabase Project**: Have your Supabase URL and keys ready

## Step 1: Prepare for Deployment

### Environment Variables You'll Need:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository
4. Set **Root Directory** to `frontend`
5. Click **"Deploy"**

### Option B: Deploy via CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend folder
cd frontend

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? Choose your account
# - Link to existing project? N
# - Project name? review-analyzer (or your choice)
# - Directory? ./
# - Auto-detected settings? Y
```

## Step 3: Configure Environment Variables

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables
2. **Add these variables:**
   ```
   Name: SUPABASE_URL
   Value: your_supabase_project_url
   Environment: Production
   
   Name: SUPABASE_ANON_KEY  
   Value: your_supabase_anon_key
   Environment: Production
   
   Name: OPENAI_API_KEY
   Value: your_openai_api_key
   Environment: Production
   ```
3. **Redeploy** your project after adding variables

## Step 4: Update Supabase Settings

1. **Go to Supabase Dashboard** → Authentication → URL Configuration
2. **Update Site URL:** `https://your-app-name.vercel.app`
3. **Add Redirect URLs:**
   ```
   https://your-app-name.vercel.app/**
   http://localhost:3000/** (keep for development)
   ```

## Step 5: Test Your Deployment

1. **Visit your deployed app:** `https://your-app-name.vercel.app`
2. **Test authentication:**
   - Register a new account
   - Login/logout
   - Try "Forgot Password" flow
3. **Test core features:**
   - Create a project with Google Maps URL
   - View projects list
   - Delete a project

## Troubleshooting

### Common Issues:

**1. Environment Variables Not Working**
- Make sure you set them in Vercel Dashboard
- Redeploy after adding variables
- Check spelling and format

**2. Authentication Issues**
- Verify Supabase Site URL is correct
- Check redirect URLs include your Vercel domain
- Ensure SUPABASE_URL and SUPABASE_ANON_KEY are correct

**3. API Routes Not Working**
- All API routes are internal (`/api/*`)
- No external backend needed
- Check browser network tab for errors

**4. Build Errors**
- Check Vercel deployment logs
- Ensure all dependencies are in package.json
- TypeScript errors will fail the build

## Development vs Production

### Development:
- Run: `npm run dev` in frontend folder
- Uses: `http://localhost:3000`
- APIs: Internal `/api/*` routes

### Production:
- Deployed to: `https://your-app.vercel.app`
- APIs: Internal `/api/*` routes (same)
- Environment: Production variables from Vercel

## Success! 🎉

Your Review Analyzer is now deployed on Vercel with:
- ✅ Full authentication system
- ✅ User isolation and security
- ✅ Session management
- ✅ Password reset functionality
- ✅ Project management
- ✅ Serverless architecture
- ✅ Auto-scaling and global CDN

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Test authentication flow step by step 