@echo off
echo.
echo  Installing packages...
call npm install
echo.
echo  Starting LiveBoard...
echo.
node server.js
pause
