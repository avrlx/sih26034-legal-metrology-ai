import json
from extract_fields import extract_fields

# Helper to create OCR items from text lines
def make_ocr_items(lines):
    items = []
    for i, line in enumerate(lines):
        items.append({
            "text": line,
            "confidence": 0.98,
            "box": [[0, i*20], [100, i*20], [100, (i+1)*20], [0, (i+1)*20]]  # dummy boxes
        })
    return items

# Test Case 1: GO DESI
go_desi_ocr = [
    "Manufactured By:",
    "morc",
    "GO DESI MANDI PVT LTD.",
    "Go",
    "86/5- Manangl Grama. Kasba Hobli,",
    "Sira Taluk Karnataka-572137",
    "fssaNo: 11219327000016",
    "Marketed By:",
    "GO DESI MANDI PVT LTD.",
    "No. 145, 9th Main Rood.",
    "Sri Roghavendra Swamy Mutt Road,",
    "BEML Layout, RR Nogar",
    "Bangalore-560098",
    "SSaiNo:11219332000941",
    "50 PCS",
    "Net Qty:",
    "30-07-20",
    "Mtd Date:",
    "S1300720C",
    "Batch No:",
    "250/-",
    ".DATE",
    "MRP.:"
]

print("=== TEST CASE 1: GO DESI ===")
go_desi_items = make_ocr_items(go_desi_ocr)
result1 = extract_fields(go_desi_items)
print(json.dumps(result1, indent=2))

# Expected:
# manufacturer: {name: "GO DESI MANDI PVT LTD.", address: "86/5- Manangl Grama. Kasba Hobli, Sira Taluk Karnataka-572137"}
# marketer: {name: "GO DESI MANDI PVT LTD.", address: "No. 145, 9th Main Rood. Sri Roghavendra Swamy Mutt Road, BEML Layout, RR Nogar Bangalore-560098"}
# net_quantity: {value: 50, unit: "N"}
# mrp: {currency: "INR", value: 250}

# Test Case 2: BIOWORLD T-SHIRT
bioworld_ocr = [
    "NET QUANTITY",
    ":1N",
    "M.R.P.",
    "999.00",
    "(inclusive of all taxes)",
    "Month & Year of Manufacture : February 2022",
    "MANUFACTURED/ LICENSED &",
    "MARKETED BY",
    "BIOWORLD MERCHANDISING INDIA PVT.",
    "LTD, 307-309 PARK CENTRA, SECTOR 30",
    "GURGAON, HARYANA, INDIA 122001."
]

print("\n=== TEST CASE 2: BIOWORLD T-SHIRT ===")
bioworld_items = make_ocr_items(bioworld_ocr)
result2 = extract_fields(bioworld_items)
print(json.dumps(result2, indent=2))

# Expected:
# manufacturer: {name: "BIOWORLD MERCHANDISING INDIA PVT. LTD.", address: "307-309 PARK CENTRA, SECTOR 30 GURGAON, HARYANA, INDIA 122001."}
# marketer: {name: "BIOWORLD MERCHANDISING INDIA PVT. LTD.", address: "307-309 PARK CENTRA, SECTOR 30 GURGAON, HARYANA, INDIA 122001."}
# net_quantity: {value: 1, unit: "N"}
# mrp: {currency: "INR", value: 999, inclusive_of_all_taxes: True}