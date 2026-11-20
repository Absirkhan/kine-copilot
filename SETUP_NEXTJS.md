# Setting Up Next.js for KineCopilot Frontend

## Quick Start (Create New Next.js App)

### 1. Create Next.js App

```bash
cd kine-copilot
npx create-next-app@latest nextjs-app
```

When prompted, choose:
- ✅ TypeScript: **Yes**
- ✅ ESLint: **Yes**
- ✅ Tailwind CSS: **Yes**
- ✅ `src/` directory: **Yes**
- ✅ App Router: **Yes**
- ❌ Import alias: **No** (or use default @/*)

### 2. Copy Component

```bash
# Copy the component
cp frontend/KineCopilotPanel.tsx nextjs-app/src/components/

# OR copy the prototype design files if you want to update styling
cp frontend/KineCopilot.html nextjs-app/
cp frontend/kinecopilot-app.jsx nextjs-app/
```

### 3. Configure Environment

Create `nextjs-app/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Create a Page

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

### 5. Run the App

```bash
cd nextjs-app
npm run dev
```

Open http://localhost:3000/analyze

---

## Alternative: Use Existing Next.js Project

If you already have a Next.js app:

### 1. Copy Component
```bash
cp frontend/KineCopilotPanel.tsx your-nextjs-app/src/components/
```

### 2. Add Environment Variable

In `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Use in Any Page

```tsx
import KineCopilotPanel from '@/components/KineCopilotPanel'

export default function MyPage() {
  return <KineCopilotPanel />
}
```

---

## Option: Update Component to Match Prototype Design

The current `KineCopilotPanel.tsx` has basic styling. To match the polished monochrome design from `KineCopilot.html`:

Follow instructions in `claude_design.md` to port the prototype styling.

---

## Testing the Full Stack

### Terminal 1: Backend
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Terminal 2: Frontend (Next.js)
```bash
cd nextjs-app
npm run dev
```

### Terminal 3: Test API (Optional)
```bash
cd test_data
python test_api.py
```

Now visit:
- Frontend: http://localhost:3000/analyze
- Backend API: http://localhost:8000/docs
- Health check: http://localhost:8000/health

---

## Troubleshooting

### "Module not found" error
Make sure the component is in the right place:
```
nextjs-app/
  src/
    components/
      KineCopilotPanel.tsx  ← Here
```

### TypeScript errors
The component uses these types - make sure they're defined in the file or add them:
```tsx
interface CoachingObservation {
  joint: string
  severity: 'good' | 'warning' | 'critical'
  observation: string
  correction: string
  drill: string | null
}

interface AnalysisResponse {
  session_id: string
  sport: string
  overall_score: number
  summary: string
  observations: CoachingObservation[]
  key_frames: number[]
  agent_reasoning: string
  processing_time_ms: number
}
```

### API connection error
1. Check backend is running: `curl http://localhost:8000/health`
2. Verify NEXT_PUBLIC_API_URL in `.env.local`
3. Check browser console for CORS errors

### Dark mode not working
The component uses dark colors. Make sure your page has a dark background:
```tsx
<div className="min-h-screen bg-[#0f0f0f]">
  <KineCopilotPanel />
</div>
```

---

## What's Next?

1. **Test with mock data first** - The component handles both video and JSON upload
2. **Upload a test video** - Any .mp4 of someone doing a squat/exercise
3. **Use sample JSON** - Copy `test_data/sample_squat_pose.json` for quick testing
4. **Update styling** - Follow `claude_design.md` to port the monochrome design

The component is **fully functional** and will work with your backend API once both are running!
