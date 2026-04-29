import time
import os
import subprocess

# --- Configuration ---
FILE_TO_WATCH = "/home/usman/powerbi/backend/stock_settings.json"
SYNC_SCRIPT = "/home/usman/miniapps/backend/sync_settings.py"

def watch():
    if not os.path.exists(FILE_TO_WATCH):
        print(f"⚠️ Файл не найден: {FILE_TO_WATCH}. Ожидаю появления...")
        while not os.path.exists(FILE_TO_WATCH):
            time.sleep(5)
    
    last_mtime = os.path.getmtime(FILE_TO_WATCH)
    print(f"👀 Слежу за изменениями в {FILE_TO_WATCH}...")
    
    while True:
        try:
            current_mtime = os.path.getmtime(FILE_TO_WATCH)
            if current_mtime != last_mtime:
                print(f"🔔 Файл {FILE_TO_WATCH} изменен! Запуск синхронизации...")
                # Запускаем через python3 для изоляции
                subprocess.run(["python3", SYNC_SCRIPT])
                last_mtime = current_mtime
        except Exception as e:
            print(f"⚠️ Ошибка в вочере: {e}")
        
        time.sleep(2) # Проверка каждые 2 секунды

if __name__ == "__main__":
    try:
        watch()
    except KeyboardInterrupt:
        print("\n👋 Вочер остановлен.")
