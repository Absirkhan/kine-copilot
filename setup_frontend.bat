@echo off
REM KineCopilot - Automated Frontend Setup for Windows
REM This script creates a Next.js app and configures KineCopilot

echo ============================================================
echo KINECOPILOT FRONTEND SETUP
echo ============================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and install it.
    pause
    exit /b 1
)

echo [1/5] Checking Node.js installation...
node --version
npm --version
echo.

echo [2/5] Creating Next.js application...
echo.
echo When prompted, choose these options:
echo   - TypeScript: Yes
echo   - ESLint: Yes
echo   - Tailwind CSS: Yes
echo   - src/ directory: Yes
echo   - App Router: Yes
echo   - Import alias: No (or default)
echo.
pause

call npx create-next-app@latest nextjs-app
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create Next.js app
    pause
    exit /b 1
)

echo.
echo [3/5] Copying KineCopilot component...
if not exist "nextjs-app\src\components" mkdir "nextjs-app\src\components"
copy "frontend\KineCopilotPanel.tsx" "nextjs-app\src\components\" >nul
echo Component copied to: nextjs-app\src\components\KineCopilotPanel.tsx

echo.
echo [4/5] Creating environment configuration...
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > "nextjs-app\.env.local"
echo Created: nextjs-app\.env.local

echo.
echo [5/5] Creating analysis page...
if not exist "nextjs-app\src\app\analyze" mkdir "nextjs-app\src\app\analyze"

(
echo import KineCopilotPanel from '@/components/KineCopilotPanel'^

echo.
echo export default function AnalyzePage(^) {
echo   return (
echo     ^<main className="min-h-screen bg-[#0f0f0f] p-8"^>
echo       ^<KineCopilotPanel /^>
echo     ^</main^>
echo   ^)
echo }
) > "nextjs-app\src\app\analyze\page.tsx"

echo Created: nextjs-app\src\app\analyze\page.tsx

echo.
echo ============================================================
echo SETUP COMPLETE!
echo ============================================================
echo.
echo Next steps:
echo.
echo 1. Start the backend server (in a new terminal):
echo    cd backend
echo    uvicorn main:app --reload --port 8000
echo.
echo 2. Start the frontend (in another new terminal):
echo    cd nextjs-app
echo    npm run dev
echo.
echo 3. Open in browser:
echo    http://localhost:3000/analyze
echo.
echo ============================================================
pause
