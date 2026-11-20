# KineCopilot Frontend Setup - Complete Guide

This guide shows you how to set up the Next.js frontend for KineCopilot.

---

## 🚀 Automated Setup (Recommended)

### Windows

1. **Run the setup script**:
   ```cmd
   setup_frontend.bat
   ```

2. **Follow the prompts** when creating the Next.js app

3. **Done!** The script will:
   - Create a Next.js app with TypeScript + Tailwind
   - Copy the KineCopilot component
   - Configure environment variables
   - Create the analysis page

### Linux / macOS

1. **Make the script executable**:
   ```bash
   chmod +x setup_frontend.sh
   ```

2. **Run the setup**:
   ```bash
   ./setup_frontend.sh
   ```

3. **Follow the prompts** and you're done!

---

## 🛠️ Manual Setup (Step-by-Step)

If you prefer to do it manually or the script doesn't work:

### Step 1: Create Next.js App

```bash
npx create-next-app@latest nextjs-app
```

**Configuration prompts - Choose these:**
```
✔ Would you like to use TypeScript? … Yes
✔ Would you like to use ESLint? … Yes
✔ Would you like to use Tailwind CSS? … Yes
✔ Would you like to use `src/` directory? … Yes
✔ Would you like to use App Router? … Yes
✔ Would you like to customize the default import alias? … No
```

### Step 2: Copy the Component

```bash
# Create components directory
mkdir -p nextjs-app/src/components

# Copy the component
cp frontend/KineCopilotPanel.tsx nextjs-app/src/components/
```

### Step 3: Configure Environment

Create `nextjs-app/.env.local`:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > nextjs-app/.env.local
```

Or manually create the file with:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 4: Create Analysis Page

Create `nextjs-app/src/app/analyze/page.tsx`:

```tsx
import KineCopilotPanel from '@/components/KineCopilotPanel'

export default function AnalyzePage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] p-8">
      <KineCopilotPanel />
    </main>
  )
}
```

### Step 5: Install Dependencies

```bash
cd nextjs-app
npm install
```

---

## ▶️ Running the Application

You need **two terminals** - one for backend, one for frontend.

### Terminal 1: Backend Server

```bash
cd backend

# First time setup
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your-key-here
pip install -r requirements.txt

# Start server
uvicorn main:app --reload --port 8000
```

**Check it's running:**
- Visit http://localhost:8000/health
- Should return `{"status": "healthy", ...}`

### Terminal 2: Frontend Dev Server

```bash
cd nextjs-app
npm run dev
```

**Check it's running:**
- Visit http://localhost:3000/analyze
- Should see the KineCopilot UI

---

## ✅ Verification Checklist

After setup, verify everything works:

### Backend Checks
- [ ] Health endpoint works: http://localhost:8000/health
- [ ] API docs available: http://localhost:8000/docs
- [ ] Can run tests: `cd test_data && python test_api.py`

### Frontend Checks
- [ ] Next.js dev server starts without errors
- [ ] Analysis page loads: http://localhost:3000/analyze
- [ ] Component renders (upload section visible)
- [ ] Console shows no TypeScript errors

### Integration Checks
- [ ] Can upload `test_data/sample_squat_pose.json`
- [ ] Analysis request goes to backend
- [ ] Results display correctly
- [ ] All 5 states work: upload/processing/results/error/reset

---

## 📁 Project Structure

After setup, your structure should look like:

```
kine-copilot/
├── nextjs-app/                    ← Your new Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── analyze/
│   │   │   │   └── page.tsx       ← Analysis page (KineCopilot)
│   │   │   └── ...
│   │   └── components/
│   │       └── KineCopilotPanel.tsx  ← The main component
│   ├── .env.local                 ← API URL configuration
│   └── package.json
│
├── backend/                       ← FastAPI backend
├── frontend/                      ← Design prototypes
├── test_data/                     ← Test data & scripts
└── ...
```

---

## 🎨 Customization

### Change API URL

Edit `nextjs-app/.env.local`:
```
NEXT_PUBLIC_API_URL=http://your-api-server:8000
```

Restart the dev server after changing.

### Add to Different Page

Copy the component usage to any page:

```tsx
// app/my-page/page.tsx
import KineCopilotPanel from '@/components/KineCopilotPanel'

export default function MyPage() {
  return (
    <div className="container mx-auto">
      <h1>My Custom Page</h1>
      <KineCopilotPanel />
    </div>
  )
}
```

### Update Styling

The component uses Tailwind classes. To match the design prototype, follow the instructions in `claude_design.md`.

---

## 🐛 Troubleshooting

### Issue: "Module not found: Can't resolve '@/components/KineCopilotPanel'"

**Solution:** Check the file is in the right place:
```bash
ls nextjs-app/src/components/KineCopilotPanel.tsx
```

If missing:
```bash
cp frontend/KineCopilotPanel.tsx nextjs-app/src/components/
```

### Issue: "process.env.NEXT_PUBLIC_API_URL is undefined"

**Solution:** Create/check `.env.local`:
```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > nextjs-app/.env.local
```

Then restart the dev server (`npm run dev`).

### Issue: CORS errors in browser console

**Solution:** The backend already allows all origins in development. If you still see errors:

1. Check the backend is running: `curl http://localhost:8000/health`
2. Verify the URL in `.env.local` matches the backend port
3. Restart both backend and frontend

### Issue: TypeScript errors about types

**Solution:** The types are defined in the component. If you see errors:

1. Check you're using TypeScript (not JavaScript)
2. The component should be `.tsx` not `.jsx`
3. Try: `cd nextjs-app && npm run build` to see detailed errors

### Issue: Component shows but upload doesn't work

**Solution:** Check browser console for:
- Network errors → Backend not running
- CORS errors → See CORS section above
- 500 errors → Check backend logs

### Issue: "npm: command not found"

**Solution:** Install Node.js:
- Windows: https://nodejs.org/ (download and install)
- Mac: `brew install node`
- Linux: `sudo apt install nodejs npm`

---

## 🚀 Production Deployment

When ready to deploy:

### Build the Frontend

```bash
cd nextjs-app
npm run build
```

### Deploy Options

**Vercel (Recommended - easiest)**
```bash
npm install -g vercel
vercel
```

**Docker**
```dockerfile
# Dockerfile for Next.js
FROM node:18-alpine
WORKDIR /app
COPY nextjs-app/package*.json ./
RUN npm ci
COPY nextjs-app/ .
RUN npm run build
CMD ["npm", "start"]
```

**Static Export** (if not using API routes)
```bash
npm run build
# Deploy the 'out' directory to any static host
```

### Environment Variables in Production

Set in your hosting platform:
```
NEXT_PUBLIC_API_URL=https://your-production-api.com
```

---

## 📚 Next Steps

After getting the frontend running:

1. **Test with sample data**
   - Upload `test_data/sample_squat_pose.json`
   - Verify results display correctly

2. **Test with video**
   - Record a short video of someone doing a squat
   - Upload via the frontend
   - See end-to-end processing

3. **Customize the design**
   - Follow `claude_design.md` to port the prototype styling
   - Update colors, fonts, animations

4. **Add features**
   - Session history
   - User accounts (with Firebase)
   - Export results as PDF
   - Share results via URL

---

## 🆘 Need Help?

- **Setup issues**: Check [QUICKSTART.md](QUICKSTART.md)
- **Backend issues**: Check [test_data/TESTING_GUIDE.md](test_data/TESTING_GUIDE.md)
- **Design updates**: Check [claude_design.md](claude_design.md)
- **Architecture**: Check [README.md](README.md)

---

## ✨ Success!

You're ready when you can:
- ✅ Start both backend and frontend
- ✅ Access http://localhost:3000/analyze
- ✅ See the upload interface
- ✅ Upload sample_squat_pose.json
- ✅ Get analysis results

**Happy coding! 🎉**
