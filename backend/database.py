import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "solar_data.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Readings table (monthly meter readings)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            meter_reading REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Insert default settings if not exist
    default_settings = {
        'plant_size_kwp': '4.84',
        'price_per_kwh': '0.518',
        'expected_yield_per_kwp': '950',
        'start_date': '2006-04-20',
        'initial_meter_reading': '2110.5',
        'address': 'Deutschland',
        'latitude': '48.1351',
        'longitude': '11.5820',
        'currency': 'EUR',
        'meter_change_date': '2017-09-01',
        'meter_change_offset': '60712.35',
        'pin_hash': '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'  # SHA256 of "1234"
    }

    for key, value in default_settings.items():
        cursor.execute('''
            INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
        ''', (key, value))

    conn.commit()
    conn.close()

def get_setting(key: str) -> str:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
    row = cursor.fetchone()
    conn.close()
    return row['value'] if row else None

def get_all_settings() -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT key, value FROM settings')
    rows = cursor.fetchall()
    conn.close()
    return {row['key']: row['value'] for row in rows}

def update_setting(key: str, value: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    ''', (key, value))
    conn.commit()
    conn.close()

def get_all_readings() -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM readings ORDER BY date ASC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def add_reading(date: str, meter_reading: float) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO readings (date, meter_reading) VALUES (?, ?)
    ''', (date, meter_reading))
    conn.commit()
    reading_id = cursor.lastrowid
    conn.close()
    return reading_id

def delete_reading(reading_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM readings WHERE id = ?', (reading_id,))
    conn.commit()
    conn.close()

def import_readings_bulk(readings: list):
    conn = get_db()
    cursor = conn.cursor()
    for r in readings:
        cursor.execute('''
            INSERT OR REPLACE INTO readings (date, meter_reading) VALUES (?, ?)
        ''', (r['date'], r['meter_reading']))
    conn.commit()
    conn.close()

# Initialize DB on module load
init_db()
