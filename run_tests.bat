@echo off
echo ========================================================
echo Running Full Smart Canteen Automated Test Suite...
echo ========================================================
cd /d "%~dp0"

echo [1/3] Running C++ FDS Data Structures Automated Tests...
.\cpp\engine.exe --test
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] C++ Engine tests failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Running Python Backend Integration Tests...
python -m unittest backend/test_backend.py
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Python Backend tests failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Running Live End-to-End Workflow Verification...
python test_e2e_live.py

echo.
echo ========================================================
echo ALL SYSTEM TESTS COMPLETED SUCCESSFULLY!
echo ========================================================
pause
