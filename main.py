import os
import sqlite3
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DB_PATH = os.path.join(os.path.dirname(__file__), "family_health.db")

app = FastAPI(title="Family Meds & Health Tracker", version="1.0.0")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            age INTEGER,
            blood_type TEXT,
            allergies TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS medications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            dosage TEXT NOT NULL,
            schedule_time TEXT NOT NULL, -- Morning, Afternoon, Evening, Night
            meal_relation TEXT NOT NULL, -- Before food, With food, After food
            pills_remaining INTEGER NOT NULL DEFAULT 30,
            pills_per_dose INTEGER NOT NULL DEFAULT 1,
            low_stock_threshold INTEGER NOT NULL DEFAULT 7,
            is_active INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dose_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medication_id INTEGER NOT NULL,
            member_id INTEGER NOT NULL,
            taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vitals_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            systolic INTEGER,
            diastolic INTEGER,
            pulse INTEGER,
            glucose REAL,
            notes TEXT,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )
    """)

    # Populate initial family members if empty
    cursor.execute("SELECT COUNT(*) FROM members")
    if cursor.fetchone()[0] == 0:
        family = [
            ("Мама", "Мать", 48, "A(II) Rh+", "Пенициллин"),
            ("Папа", "Отец", 52, "O(I) Rh+", "Нет"),
            ("Бабушка", "Бабушка", 74, "B(III) Rh+", "Аспирин"),
            ("Асадбек", "Сын", 19, "A(II) Rh+", "Пыльца")
        ]
        cursor.executemany("INSERT INTO members (name, role, age, blood_type, allergies) VALUES (?, ?, ?, ?, ?)", family)

        meds = [
            (3, "Кардиомагнил", "75 мг", "Evening", "After food", 28, 1, 7),
            (3, "Амлодипин", "5 мг", "Morning", "Before food", 14, 1, 5),
            (1, "Витамин D3", "2000 ME", "Morning", "With food", 45, 1, 10),
            (2, "Омега-3 Complex", "1000 мг", "Morning", "With food", 60, 2, 10),
            (4, "Магний B6", "100 мг", "Night", "After food", 3, 1, 5) # low stock sample
        ]
        cursor.executemany("""
            INSERT INTO medications (member_id, name, dosage, schedule_time, meal_relation, pills_remaining, pills_per_dose, low_stock_threshold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, meds)

        vitals = [
            (3, 135, 85, 72, 5.6, "Утреннее измерение давления"),
            (2, 122, 78, 68, 5.2, "После пробежки"),
            (1, 118, 76, 70, 4.9, "Отличное самочувствие")
        ]
        cursor.executemany("""
            INSERT INTO vitals_logs (member_id, systolic, diastolic, pulse, glucose, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, vitals)

    conn.commit()
    conn.close()

init_db()

class MemberCreate(BaseModel):
    name: str = Field(..., min_length=2)
    role: str
    age: int = Field(..., ge=1, le=120)
    blood_type: Optional[str] = "Unknown"
    allergies: Optional[str] = "None"

class MedCreate(BaseModel):
    member_id: int
    name: str
    dosage: str
    schedule_time: str
    meal_relation: str
    pills_remaining: int = 30
    pills_per_dose: int = 1
    low_stock_threshold: int = 7

class VitalCreate(BaseModel):
    member_id: int
    systolic: Optional[int] = None
    diastolic: Optional[int] = None
    pulse: Optional[int] = None
    glucose: Optional[float] = None
    notes: Optional[str] = ""

@app.get("/api/members")
def get_members():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM members ORDER BY id ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"members": rows}

@app.post("/api/members")
def create_member(m: MemberCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO members (name, role, age, blood_type, allergies)
        VALUES (?, ?, ?, ?, ?)
    """, (m.name, m.role, m.age, m.blood_type, m.allergies))
    mid = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "created", "id": mid}

@app.get("/api/medications")
def get_medications(member_id: Optional[int] = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if member_id:
        cursor.execute("""
            SELECT m.*, mem.name as member_name 
            FROM medications m
            JOIN members mem ON m.member_id = mem.id
            WHERE m.member_id = ? AND m.is_active = 1
            ORDER BY m.id DESC
        """, (member_id,))
    else:
        cursor.execute("""
            SELECT m.*, mem.name as member_name 
            FROM medications m
            JOIN members mem ON m.member_id = mem.id
            WHERE m.is_active = 1
            ORDER BY m.id DESC
        """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"medications": rows}

@app.post("/api/medications")
def create_medication(med: MedCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO medications (member_id, name, dosage, schedule_time, meal_relation, pills_remaining, pills_per_dose, low_stock_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (med.member_id, med.name, med.dosage, med.schedule_time, med.meal_relation, med.pills_remaining, med.pills_per_dose, med.low_stock_threshold))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "created", "id": new_id}

@app.post("/api/medications/{med_id}/take")
def take_dose(med_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT member_id, pills_remaining, pills_per_dose FROM medications WHERE id = ?", (med_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Medication not found")

    member_id, remaining, per_dose = row
    new_remaining = max(0, remaining - per_dose)

    cursor.execute("UPDATE medications SET pills_remaining = ? WHERE id = ?", (new_remaining, med_id))
    cursor.execute("""
        INSERT INTO dose_logs (medication_id, member_id, notes)
        VALUES (?, ?, 'Marked taken via Web Dashboard')
    """, (med_id, member_id))

    conn.commit()
    conn.close()
    return {"status": "taken", "pills_remaining": new_remaining}

@app.get("/api/vitals")
def get_vitals(member_id: Optional[int] = None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if member_id:
        cursor.execute("""
            SELECT v.*, m.name as member_name 
            FROM vitals_logs v
            JOIN members m ON v.member_id = m.id
            WHERE v.member_id = ?
            ORDER BY v.recorded_at DESC LIMIT 30
        """, (member_id,))
    else:
        cursor.execute("""
            SELECT v.*, m.name as member_name 
            FROM vitals_logs v
            JOIN members m ON v.member_id = m.id
            ORDER BY v.recorded_at DESC LIMIT 30
        """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"vitals": rows}

@app.post("/api/vitals")
def log_vitals(v: VitalCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO vitals_logs (member_id, systolic, diastolic, pulse, glucose, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (v.member_id, v.systolic, v.diastolic, v.pulse, v.glucose, v.notes))
    vid = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "logged", "id": vid}

@app.get("/api/dashboard")
def get_dashboard_summary():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM medications WHERE pills_remaining <= low_stock_threshold")
    low_stock = cursor.fetchone()[0]

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    cursor.execute("SELECT COUNT(*) FROM dose_logs WHERE date(taken_at) = date('now')")
    doses_today = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM members")
    total_members = cursor.fetchone()[0]

    conn.close()
    return {
        "low_stock_count": low_stock,
        "doses_taken_today": doses_today,
        "total_members": total_members
    }

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(static_dir, "index.html"))
