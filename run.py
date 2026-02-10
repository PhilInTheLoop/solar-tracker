"""
Start the Solar Tracker application on localhost
"""
import uvicorn
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    print("Starting Solar Tracker on http://localhost:8000")
    print("Press Ctrl+C to stop")
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
