from backend.app.db.session import get_session
from sqlalchemy import text

def sync_sequences():
    with get_session() as db:
        # Check all tables with serial/identity columns
        tables = ["users", "experiments", "benchmark_annotations"]
        for table in tables:
            try:
                res = db.execute(text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table}), 0) + 1,
                        false
                    );
                """))
                print(f"Synced sequence for {table} successfully.")
            except Exception as e:
                print(f"Note for {table}: {e}")
        db.commit()
    print("All sequences updated!")

if __name__ == "__main__":
    sync_sequences()
