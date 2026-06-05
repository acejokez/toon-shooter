@echo off
cd /d "%~dp0"
echo Starting Toon Shooter...
start "" http://localhost:4173
npm run preview -- --port 4173
