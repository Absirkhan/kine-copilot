#!/bin/bash
# KineCopilot - Automated Frontend Setup for Linux/Mac
# This script creates a Next.js app and configures KineCopilot

set -e  # Exit on error

echo "============================================================"
echo "KINECOPILOT FRONTEND SETUP"
echo "============================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Download the LTS version and install it."
    exit 1
fi

echo "[1/5] Checking Node.js installation..."
node --version
npm --version
echo ""

echo "[2/5] Creating Next.js application..."
echo ""
echo "When prompted, choose these options:"
echo "  - TypeScript: Yes"
echo "  - ESLint: Yes"
echo "  - Tailwind CSS: Yes"
echo "  - src/ directory: Yes"
echo "  - App Router: Yes"
echo "  - Import alias: No (or default)"
echo ""
read -p "Press Enter to continue..."

npx create-next-app@latest nextjs-app

echo ""
echo "[3/5] Copying KineCopilot component..."
mkdir -p nextjs-app/src/components
cp frontend/KineCopilotPanel.tsx nextjs-app/src/components/
echo "Component copied to: nextjs-app/src/components/KineCopilotPanel.tsx"

echo ""
echo "[4/5] Creating environment configuration..."
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > nextjs-app/.env.local
echo "Created: nextjs-app/.env.local"

echo ""
echo "[5/5] Creating analysis page..."
mkdir -p nextjs-app/src/app/analyze

cat > nextjs-app/src/app/analyze/page.tsx << 'EOF'
import KineCopilotPanel from '@/components/KineCopilotPanel'

export default function AnalyzePage() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] p-8">
      <KineCopilotPanel />
    </main>
  )
}
EOF

echo "Created: nextjs-app/src/app/analyze/page.tsx"

echo ""
echo "============================================================"
echo "SETUP COMPLETE!"
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the backend server (in a new terminal):"
echo "   cd backend"
echo "   uvicorn main:app --reload --port 8000"
echo ""
echo "2. Start the frontend (in another new terminal):"
echo "   cd nextjs-app"
echo "   npm run dev"
echo ""
echo "3. Open in browser:"
echo "   http://localhost:3000/analyze"
echo ""
echo "============================================================"
