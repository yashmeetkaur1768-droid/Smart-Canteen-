@echo off
echo ========================================================
echo Compiling C++ FDS Engine with MinGW GCC...
echo ========================================================
cd /d "%~dp0cpp"
g++ -std=c++14 -O2 engine.cpp -o engine.exe
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] C++ Engine compiled cleanly to cpp/engine.exe!
    echo Running automated unit tests...
    engine.exe --test
) else (
    echo [ERROR] Compilation failed. Please check GCC compiler.
)
pause
