import os

filepath = os.path.join(os.path.dirname(__file__), "src/pages/ReservationForm.tsx")

content = """PLACEHOLDER"""

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print(f"Written {len(content)} chars")