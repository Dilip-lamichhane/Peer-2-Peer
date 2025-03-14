@echo off
echo Setting up GitHub repository for P2P File-Sharing Platform...

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Git is not installed. Please install git first.
    exit /b 1
)

REM Initialize git repository if not already initialized
if not exist .git (
    echo Initializing git repository...
    git init
) else (
    echo Git repository already initialized.
)

REM Add all files to git
echo Adding files to git...
git add .

REM Commit changes
echo Committing changes...
git commit -m "Initial commit: P2P File-Sharing Platform"

REM Instructions for connecting to GitHub
echo.
echo Repository setup complete!
echo.
echo To connect to GitHub, run the following commands:
echo.
echo    git remote add origin https://github.com/Dilip-lamichhane/Peer-2-Peer.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo Note: You may be prompted for your GitHub credentials.
echo.
echo Happy coding!

pause 