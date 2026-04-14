@echo off
REM Start local MongoDB instance with data stored inside the project
set MONGOD="C:\Users\chris.macabugao\web-applications\mongodb-win32-x86_64-windows-8.2.6\bin\mongod.exe"
set DATADIR="%~dp0..\mongodb-data"

echo Starting MongoDB...
echo   Binary : %MONGOD%
echo   Data   : %DATADIR%
echo.

%MONGOD% --dbpath %DATADIR% --port 27017
