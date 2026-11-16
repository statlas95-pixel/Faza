@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Установите LTS-версию ^(22.13 или новее^) с https://nodejs.org и запустите файл снова.
  echo Без установки можно открыть dist\index.html двойным щелчком: темы и занятия работают, аккаунты и поиск — нет.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Первая установка зависимостей, это займёт 1-2 минуты...
  call npm install
)
echo Запуск сервера «Фаза». Откройте http://localhost:8787  Для остановки закройте это окно.
start "" cmd /c "timeout /t 6 >nul & start http://localhost:8787"
call npm start
pause
