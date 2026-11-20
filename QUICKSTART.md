# KineCopilot Quick Start Guide

Choose your path based on what you want to do:

---

## 🎯 Just Want to See the UI? (30 seconds)

**View the design prototype** - No setup required!

```bash
# Open the HTML file in your browser
start frontend/KineCopilot.html

# OR use a simple server
cd frontend
python -m http.server 8080
# Then open http://localhost:8080/KineCopilot.html
```

**What you get:**
- ✅ See all 5 UI states (upload/processing/results/error)
- ✅ Interactive design reference
- ✅ Monochrome theme with animations
- ❌ Not connected to real API (uses mock data)

---

## 🧪 Want to Test the Backend? (5 minutes)

**Run the API and test with sample data**

### Step 1: Setup
```bash
cd backend
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your-key-here
pip install -r requirements.txt
```

### Step 2: Start Server
```bash
uvicorn main:app --reload --port 8000
```

### Step 3: Test (in new terminal)
```bash
cd test_data
python test_api.py
```

**What you get:**
- ✅ Full backend API running
- ✅ Test with sample pose data
- ✅ See AI coaching feedback
- ✅ Verify all endpoints work

---

## 🚀 Want the Full Stack? (10 minutes)

**Run both frontend and backend together**

### Terminal 1: Backend
```bash
cd backend
cp .env.example .env
# Add your ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Terminal 2: Frontend (Create Next.js app)
```bash
# From project root
npx create-next-app@latest nextjs-app
# Choose: TypeScript=Yes, Tailwind=Yes, App Router=Yes

cd nextjs-app

# Add environment variable
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Copy component
cp ../frontend/KineCopilotPanel.tsx src/components/

# Create page: src/app/analyze/page.tsx
cat > src/app/analyze/page.tsx << 'EOF'
import KineCopilotPanel from '@/components/KineCopilotPanel'

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] p-8">
      <KineCopilotPanel />
    </main>
  )
}
EOF

# Start dev server
npm run dev
```

**Access:**
- Frontend: http://localhost:3000/analyze
- Backend API: http://localhost:8000/docs
- Health check: http://localhost:8000/health

**What you get:**
- ✅ Complete working application
- ✅ Upload videos or pose JSON
- ✅ Real AI analysis
- ✅ Professional coaching feedback

---

## 📊 Directory Guide

```
kine-copilot/
├── frontend/
│   ├── KineCopilot.html          ← Open this for quick UI preview
│   ├── kinecopilot-app.jsx       ← React prototype source
│   └── KineCopilotPanel.tsx      ← Production component
│
├── backend/
│   ├── main.py                   ← Start server: uvicorn main:app
│   ├── .env.example              ← Copy to .env, add API key
│   └── requirements.txt          ← pip install -r requirements.txt
│
├── test_data/
│   ├── sample_squat_pose.json    ← Test data
│   ├── test_api.py               ← Run: python test_api.py
│   └── TESTING_GUIDE.md          ← Detailed testing instructions
│
├── SETUP_NEXTJS.md               ← Full Next.js setup guide
└── QUICKSTART.md                 ← You are here!
```

---

## 🎓 Learning Path

### Day 1: Understand the System
1. Open `KineCopilot.html` - See the UI design
2. Read `README.md` - Understand architecture
3. Look at `test_data/sample_squat_pose.json` - See data format

### Day 2: Test Backend
1. Setup backend with API key
2. Run `python test_data/test_api.py`
3. Try manual curl commands
4. Check API docs at http://localhost:8000/docs

### Day 3: Run Frontend
1. Create Next.js app
2. Copy component
3. Test with sample data
4. Upload real video

### Day 4: Customize
1. Update styling (see `claude_design.md`)
2. Add more sports
3. Customize coaching feedback
4. Deploy to production

---

## 🆘 Quick Troubleshooting

### Backend won't start
```bash
# Check Python version (need 3.11+)
python --version

# Reinstall dependencies
pip install -r backend/requirements.txt --force-reinstall
```

### "ANTHROPIC_API_KEY not set"
```bash
cd backend
echo "ANTHROPIC_API_KEY=sk-ant-api03-your-key" >> .env
```

### Frontend can't connect to API
```bash
# Check backend is running
curl http://localhost:8000/health

# Check environment variable
cat nextjs-app/.env.local
# Should have: NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Tests fail
```bash
# Make sure you're in the right directory
cd test_data
python test_api.py

# Check backend server logs for errors
```

---

## 📚 More Resources

- **Testing Guide**: `test_data/TESTING_GUIDE.md`
- **Next.js Setup**: `SETUP_NEXTJS.md`
- **Architecture**: `README.md`
- **Development Context**: `CLAUDE.md`
- **Design Integration**: `claude_design.md`

---

## 🎉 Success Checklist

You're fully set up when:

- [ ] HTML prototype opens and shows all UI states
- [ ] Backend health check returns 200
- [ ] Test suite passes all 4 tests
- [ ] Next.js app runs without errors
- [ ] Can analyze sample pose JSON
- [ ] Can upload and analyze a video

**Need help?** Check the relevant guide above or review `CLAUDE.md` for known issues.

---

**Ready to start?** Pick your path above and follow the steps! 🚀
