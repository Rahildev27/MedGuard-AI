from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path
from datetime import date
from difflib import SequenceMatcher

import json
import re
import io

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

import cv2
import numpy as np

import pytesseract
pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)te


# =========================================================
# MEDIGUARD AI
# OCR + BARCODE + MEDICINE DATABASE
# =========================================================

app = FastAPI(
    title="MediGuard AI API",
    version="2.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

DATABASE_FILE = BASE_DIR / "medicine_data.json"


# =========================================================
# TESSERACT
# =========================================================
#
# If Tesseract is installed in the normal Windows location,
# this will find it automatically.
#
# If your installation is somewhere else, change this path.
# =========================================================

TESSERACT_PATHS = [
    Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
    Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
]

for tesseract_path in TESSERACT_PATHS:
    if tesseract_path.exists():
        pytesseract.pytesseract.tesseract_cmd = str(tesseract_path)
        break


# =========================================================
# DATABASE
# =========================================================

def load_medicines():
    try:

        if not DATABASE_FILE.exists():

            print(
                f"WARNING: Database not found: {DATABASE_FILE}"
            )

            return []

        with open(
            DATABASE_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        if isinstance(data, list):

            return data

        if isinstance(data, dict):

            medicines = data.get(
                "medicines",
                []
            )

            if isinstance(medicines, list):

                return medicines

        print("WARNING: Invalid database format.")

        return []

    except Exception as error:

        print(
            "Database loading error:",
            error
        )

        return []


# =========================================================
# TEXT CLEANING
# =========================================================

def normalize_text(value):

    if value is None:
        return ""

    text = str(value)

    text = text.lower()

    text = text.replace(
        "\n",
        " "
    )

    text = text.replace(
        "\r",
        " "
    )

    text = re.sub(
        r"[^a-z0-9]+",
        " ",
        text
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


def clean_barcode(value):

    if value is None:
        return ""

    return re.sub(
        r"\D",
        "",
        str(value)
    )


# =========================================================
# IMAGE PREPROCESSING
# =========================================================

def prepare_image(image_bytes):

    image = Image.open(
        io.BytesIO(image_bytes)
    )

    image = image.convert("RGB")

    # Upscale small images.
    width, height = image.size

    if width < 1200:

        scale = 1200 / width

        image = image.resize(
            (
                int(width * scale),
                int(height * scale)
            ),
            Image.Resampling.LANCZOS
        )

    # Grayscale
    gray = ImageOps.grayscale(image)

    # Increase contrast
    gray = ImageEnhance.Contrast(
        gray
    ).enhance(2.0)

    # Sharpen
    gray = gray.filter(
        ImageFilter.SHARPEN
    )

    return image, gray


# =========================================================
# OCR
# =========================================================

def run_ocr(image, gray):

    results = []

    # -----------------------------------------------------
    # OCR VERSION 1
    # -----------------------------------------------------

    try:

        text = pytesseract.image_to_string(
            image,
            config="--psm 6"
        )

        if text.strip():

            results.append(text)

    except Exception as error:

        print(
            "OCR color image error:",
            error
        )

    # -----------------------------------------------------
    # OCR VERSION 2
    # -----------------------------------------------------

    try:

        text = pytesseract.image_to_string(
            gray,
            config="--psm 6"
        )

        if text.strip():

            results.append(text)

    except Exception as error:

        print(
            "OCR grayscale error:",
            error
        )

    # -----------------------------------------------------
    # OCR VERSION 3
    # -----------------------------------------------------

    try:

        threshold = gray.point(
            lambda p: 255 if p > 150 else 0
        )

        text = pytesseract.image_to_string(
            threshold,
            config="--psm 11"
        )

        if text.strip():

            results.append(text)

    except Exception as error:

        print(
            "OCR threshold error:",
            error
        )

    # Remove duplicates while preserving order.

    unique = []

    seen = set()

    for text in results:

        cleaned = text.strip()

        key = normalize_text(cleaned)

        if key and key not in seen:

            unique.append(cleaned)

            seen.add(key)

    return "\n".join(unique)


# =========================================================
# BARCODE DETECTION
# =========================================================

def detect_barcodes(image_bytes):

    detected = []

    try:

        np_array = np.frombuffer(
            image_bytes,
            np.uint8
        )

        image = cv2.imdecode(
            np_array,
            cv2.IMREAD_COLOR
        )

        if image is None:

            return []

        # -------------------------------------------------
        # OpenCV Barcode Detector
        # -------------------------------------------------

        try:

            detector = cv2.barcode.BarcodeDetector()

            result = detector.detectAndDecode(
                image
            )

            # Different OpenCV versions return
            # slightly different structures.

            if isinstance(result, tuple):

                decoded = None

                # Look for decoded strings.

                for item in result:

                    if isinstance(item, str):

                        if item.strip():

                            decoded = item.strip()

                            break

                    elif isinstance(item, (list, tuple)):

                        for sub in item:

                            if isinstance(sub, str):

                                if sub.strip():

                                    decoded = sub.strip()

                                    break

                        if decoded:
                            break

                if decoded:

                    barcode = clean_barcode(
                        decoded
                    )

                    if barcode:

                        detected.append(
                            barcode
                        )

        except Exception as error:

            print(
                "OpenCV barcode detector error:",
                error
            )

        # -------------------------------------------------
        # Fallback: search OCR text for long numbers
        # -------------------------------------------------

    except Exception as error:

        print(
            "Barcode processing error:",
            error
        )

    # Remove duplicates.

    unique = []

    for code in detected:

        if code not in unique:

            unique.append(code)

    return unique


# =========================================================
# FIND MEDICINE
# =========================================================

def find_medicine_from_ocr(
    ocr_text,
    medicines
):

    if not ocr_text:

        return None, 0

    normalized_ocr = normalize_text(
        ocr_text
    )

    best_medicine = None
    best_score = 0

    for medicine in medicines:

        if not isinstance(
            medicine,
            dict
        ):

            continue

        name = medicine.get(
            "name",
            ""
        )

        normalized_name = normalize_text(
            name
        )

        if not normalized_name:

            continue

        # -------------------------------------------------
        # Exact normalized phrase
        # -------------------------------------------------

        if normalized_name in normalized_ocr:

            return medicine, 1.0

        # -------------------------------------------------
        # Compare individual words
        # -------------------------------------------------

        name_words = normalized_name.split()

        matched_words = 0

        for word in name_words:

            if word in normalized_ocr:

                matched_words += 1

        word_score = (
            matched_words / len(name_words)
            if name_words
            else 0
        )

        # -------------------------------------------------
        # Fuzzy comparison
        # -------------------------------------------------

        score = SequenceMatcher(
            None,
            normalized_name,
            normalized_ocr
        ).ratio()

        final_score = max(
            word_score,
            score
        )

        if final_score > best_score:

            best_score = final_score

            best_medicine = medicine

    # Require reasonable confidence.

    if best_score >= 0.45:

        return (
            best_medicine,
            best_score
        )

    return None, best_score


# =========================================================
# FIND FIELD IN OCR
# =========================================================

def find_batch_number(
    ocr_text,
    medicine=None
):

    if medicine:

        database_batch = str(
            medicine.get(
                "batch_number",
                ""
            )
        ).strip()

        if database_batch:

            normalized_ocr = normalize_text(
                ocr_text
            )

            if normalize_text(
                database_batch
            ) in normalized_ocr:

                return database_batch

    # Common batch patterns.

    patterns = [

        r"(?:batch|batch\s*no|batch\s*number|lot)[\s:#-]*([A-Z0-9-]{4,})",

        r"\b[A-Z]{2,5}[-]?[0-9]{4,8}\b",

    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            ocr_text,
            re.IGNORECASE
        )

        if match:

            return match.group(1).strip()

    return ""


def find_expiry_date(
    ocr_text,
    medicine=None
):

    # First try database expiry.

    if medicine:

        database_expiry = str(
            medicine.get(
                "expiry_date",
                ""
            )
        ).strip()

        if database_expiry:

            year, month, day = (
                database_expiry.split("-")
            )

            possible_formats = [

                f"{year}-{month}-{day}",

                f"{month}/{year}",

                f"{month}-{year}",

                f"{month}/{day}/{year}",

                f"{day}/{month}/{year}",

            ]

            normalized_ocr = normalize_text(
                ocr_text
            )

            for value in possible_formats:

                if normalize_text(
                    value
                ) in normalized_ocr:

                    return database_expiry

    # YYYY-MM-DD

    match = re.search(
        r"\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b",
        ocr_text
    )

    if match:

        return (
            f"{match.group(1)}-"
            f"{int(match.group(2)):02d}-"
            f"{int(match.group(3)):02d}"
        )

    # MM/YYYY

    match = re.search(
        r"\b(0?[1-9]|1[0-2])[/\-](20\d{2})\b",
        ocr_text
    )

    if match:

        return (
            f"{match.group(2)}-"
            f"{int(match.group(1)):02d}"
            f"-01"
        )

    return ""


# =========================================================
# FIND MANUFACTURER
# =========================================================

def find_manufacturer(
    ocr_text,
    medicine
):

    if not medicine:

        return ""

    database_manufacturer = str(
        medicine.get(
            "manufacturer",
            ""
        )
    ).strip()

    if not database_manufacturer:

        return ""

    normalized_ocr = normalize_text(
        ocr_text
    )

    normalized_manufacturer = normalize_text(
        database_manufacturer
    )

    if normalized_manufacturer in normalized_ocr:

        return database_manufacturer

    return ""


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    medicines = load_medicines()

    return {

        "status": "online",

        "service": "MediGuard AI",

        "version": "2.0.0",

        "database_count":
            len(medicines),

        "message":
            "MediGuard AI backend is running."

    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    medicines = load_medicines()

    return {

        "status": "healthy",

        "database_loaded":
            len(medicines) > 0,

        "medicine_count":
            len(medicines)

    }


# =========================================================
# MEDICINES
# =========================================================

@app.get("/medicines")
def get_medicines():

    medicines = load_medicines()

    return {

        "success": True,

        "count": len(medicines),

        "medicines": medicines

    }


# =========================================================
# ACTUAL OCR + BARCODE ANALYSIS
# =========================================================

@app.post("/api/v1/analyze-image")
async def analyze_image(
    file: UploadFile = File(...)
):

    try:

        # -------------------------------------------------
        # READ IMAGE
        # -------------------------------------------------

        image_bytes = await file.read()

        if not image_bytes:

            return {

                "success": False,

                "message":
                    "Empty image received.",

                "medicine_name": "",

                "manufacturer": "",

                "batch_number": "",

                "expiry_date": "",

                "barcode": "",

                "detected_barcodes": [],

                "ocr_text": "",

                "medicine_found": False,

                "ocr_detected": False,

                "barcode_detected": False

            }

        print()
        print("=" * 60)
        print(
            "MEDIGUARD IMAGE ANALYSIS"
        )
        print(
            "File:",
            file.filename
        )
        print(
            "Size:",
            len(image_bytes),
            "bytes"
        )
        print("=" * 60)

        # -------------------------------------------------
        # PREPARE IMAGE
        # -------------------------------------------------

        image, gray = prepare_image(
            image_bytes
        )

        # -------------------------------------------------
        # OCR
        # -------------------------------------------------

        ocr_text = run_ocr(
            image,
            gray
        )

        print()
        print("OCR RESULT:")
        print(ocr_text)

        # -------------------------------------------------
        # BARCODE
        # -------------------------------------------------

        detected_barcodes = detect_barcodes(
            image_bytes
        )

        print()
        print(
            "BARCODES:",
            detected_barcodes
        )

        # -------------------------------------------------
        # DATABASE
        # -------------------------------------------------

        medicines = load_medicines()

        # -------------------------------------------------
        # FIND MEDICINE FROM OCR
        # -------------------------------------------------

        medicine, match_score = (
            find_medicine_from_ocr(
                ocr_text,
                medicines
            )
        )

        medicine_name = ""

        manufacturer = ""

        batch_number = ""

        expiry_date = ""

        barcode = ""

        # -------------------------------------------------
        # DATABASE MEDICINE FOUND
        # -------------------------------------------------

        if medicine:

            medicine_name = str(
                medicine.get(
                    "name",
                    ""
                )
            ).strip()

            manufacturer = (
                find_manufacturer(
                    ocr_text,
                    medicine
                )
                or str(
                    medicine.get(
                        "manufacturer",
                        ""
                    )
                ).strip()
            )

            batch_number = (
                find_batch_number(
                    ocr_text,
                    medicine
                )
            )

            expiry_date = (
                find_expiry_date(
                    ocr_text,
                    medicine
                )
            )

        # -------------------------------------------------
        # BARCODE MATCH
        # -------------------------------------------------

        if detected_barcodes:

            barcode = detected_barcodes[0]

            # Search database by barcode.

            for record in medicines:

                if not isinstance(
                    record,
                    dict
                ):

                    continue

                database_barcode = clean_barcode(
                    record.get(
                        "barcode",
                        ""
                    )
                )

                if (
                    barcode
                    and
                    barcode == database_barcode
                ):

                    medicine = record

                    medicine_name = str(
                        record.get(
                            "name",
                            medicine_name
                        )
                    ).strip()

                    manufacturer = str(
                        record.get(
                            "manufacturer",
                            manufacturer
                        )
                    ).strip()

                    batch_number = str(
                        record.get(
                            "batch_number",
                            batch_number
                        )
                    ).strip()

                    expiry_date = str(
                        record.get(
                            "expiry_date",
                            expiry_date
                        )
                    ).strip()

                    break

        # -------------------------------------------------
        # FALLBACK: SEARCH OCR FOR DATABASE BARCODE
        # -------------------------------------------------

        if not barcode:

            numbers_in_text = re.findall(
                r"\b\d{8,14}\b",
                ocr_text
            )

            for number in numbers_in_text:

                for record in medicines:

                    database_barcode = clean_barcode(
                        record.get(
                            "barcode",
                            ""
                        )
                    )

                    if number == database_barcode:

                        barcode = number

                        medicine = record

                        medicine_name = str(
                            record.get(
                                "name",
                                medicine_name
                            )
                        ).strip()

                        manufacturer = str(
                            record.get(
                                "manufacturer",
                                manufacturer
                            )
                        ).strip()

                        batch_number = str(
                            record.get(
                                "batch_number",
                                batch_number
                            )
                        ).strip()

                        expiry_date = str(
                            record.get(
                                "expiry_date",
                                expiry_date
                            )
                        ).strip()

                        break

                if barcode:

                    break

        # -------------------------------------------------
        # FINAL DETECTION STATUS
        # -------------------------------------------------

        ocr_detected = bool(
            ocr_text.strip()
        )

        barcode_detected = bool(
            detected_barcodes
        )

        medicine_found = bool(
            medicine_name
        )

        # -------------------------------------------------
        # DEBUG OUTPUT
        # -------------------------------------------------

        print()
        print("FINAL EXTRACTION:")
        print(
            "Medicine:",
            medicine_name
        )
        print(
            "Manufacturer:",
            manufacturer
        )
        print(
            "Batch:",
            batch_number
        )
        print(
            "Expiry:",
            expiry_date
        )
        print(
            "Barcode:",
            barcode
        )
        print(
            "OCR detected:",
            ocr_detected
        )
        print(
            "Barcode detected:",
            barcode_detected
        )
        print(
            "Medicine found:",
            medicine_found
        )
        print("=" * 60)
        print()

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return {

            "success": True,

            "message":
                "Image analyzed successfully.",

            "medicine_name":
                medicine_name,

            "manufacturer":
                manufacturer,

            "batch_number":
                batch_number,

            "expiry_date":
                expiry_date,

            "barcode":
                barcode,

            "detected_barcodes":
                detected_barcodes,

            "ocr_text":
                ocr_text,

            "medicine_found":
                medicine_found,

            "ocr_detected":
                ocr_detected,

            "barcode_detected":
                barcode_detected,

            "match_score":
                round(
                    match_score,
                    3
                )

        }

    except Exception as error:

        print()
        print(
            "IMAGE ANALYSIS ERROR:"
        )
        print(error)
        print()

        return {

            "success": False,

            "message":
                "Image analysis failed.",

            "error":
                str(error),

            "medicine_name": "",

            "manufacturer": "",

            "batch_number": "",

            "expiry_date": "",

            "barcode": "",

            "detected_barcodes": [],

            "ocr_text": "",

            "medicine_found": False,

            "ocr_detected": False,

            "barcode_detected": False

        }


# =========================================================
# EXPIRY
# =========================================================

def check_expiry(expiry_value):

    if not expiry_value:

        return False

    try:

        expiry = date.fromisoformat(
            str(expiry_value).strip()
        )

        return expiry >= date.today()

    except Exception:

        return False


# =========================================================
# VERIFY MEDICINE
# =========================================================

@app.post("/api/v1/verify-medicine")
async def verify_medicine(
    request: Request
):

    try:

        data = await request.json()

        if not isinstance(
            data,
            dict
        ):

            data = {}

        requested_name = str(
            data.get(
                "name",
                data.get(
                    "medicine_name",
                    ""
                )
            )
        ).strip()

        requested_manufacturer = str(
            data.get(
                "manufacturer",
                ""
            )
        ).strip()

        requested_batch = str(
            data.get(
                "batch_number",
                ""
            )
        ).strip()

        requested_expiry = str(
            data.get(
                "expiry_date",
                ""
            )
        ).strip()

        requested_barcode = clean_barcode(
            data.get(
                "barcode",
                ""
            )
        )

        if not requested_name:

            return {

                "success": False,

                "status":
                    "INVALID_REQUEST",

                "risk_score": 100,

                "confidence": 0,

                "medicine_name": "",

                "manufacturer":
                    requested_manufacturer,

                "batch_number":
                    requested_batch,

                "expiry_date":
                    requested_expiry,

                "barcode":
                    requested_barcode,

                "checks": {

                    "medicine": False,
                    "manufacturer": False,
                    "batch": False,
                    "expiry": False,
                    "barcode": False

                },

                "reasons": [
                    "No medicine name was detected."
                ],

                "recommendation":
                    "Please upload a clearer medicine image."

            }

        medicines = load_medicines()

        # -------------------------------------------------
        # FIND RECORD
        # -------------------------------------------------

        medicine, score = (
            find_medicine_from_ocr(
                requested_name,
                medicines
            )
        )

        # Also exact name lookup.

        if medicine is None:

            requested_normalized = normalize_text(
                requested_name
            )

            for record in medicines:

                if normalize_text(
                    record.get(
                        "name",
                        ""
                    )
                ) == requested_normalized:

                    medicine = record

                    break

        # -------------------------------------------------
        # NOT FOUND
        # -------------------------------------------------

        if medicine is None:

            return {

                "success": True,

                "status":
                    "HIGH_RISK",

                "risk_score": 85,

                "confidence": 80,

                "medicine_name":
                    requested_name,

                "manufacturer":
                    requested_manufacturer
                    or "Unknown",

                "batch_number":
                    requested_batch
                    or "Unknown",

                "expiry_date":
                    requested_expiry
                    or "Unknown",

                "barcode":
                    requested_barcode
                    or "Unknown",

                "checks": {

                    "medicine": False,
                    "manufacturer": False,
                    "batch": False,
                    "expiry": False,
                    "barcode": False

                },

                "reasons": [

                    "Medicine was not found in the MediGuard registry.",

                    "The OCR result could not be matched confidently.",

                    "Authenticity could not be established."

                ],

                "recommendation":
                    "Do not rely on this prototype result as proof "
                    "of authenticity. Verify the medicine with a "
                    "pharmacist or authorized manufacturer."

            }

        # -------------------------------------------------
        # DATABASE VALUES
        # -------------------------------------------------

        database_name = str(
            medicine.get(
                "name",
                ""
            )
        ).strip()

        database_manufacturer = str(
            medicine.get(
                "manufacturer",
                ""
            )
        ).strip()

        database_batch = str(
            medicine.get(
                "batch_number",
                ""
            )
        ).strip()

        database_expiry = str(
            medicine.get(
                "expiry_date",
                ""
            )
        ).strip()

        database_barcode = clean_barcode(
            medicine.get(
                "barcode",
                ""
            )
        )

        # -------------------------------------------------
        # CHECKS
        # -------------------------------------------------

        medicine_match = True

        manufacturer_match = (

            bool(requested_manufacturer)

            and

            normalize_text(
                requested_manufacturer
            )
            ==
            normalize_text(
                database_manufacturer
            )

        )

        batch_match = (

            bool(requested_batch)

            and

            normalize_text(
                requested_batch
            )
            ==
            normalize_text(
                database_batch
            )

        )

        expiry_match = (

            bool(requested_expiry)

            and

            requested_expiry
            ==
            database_expiry

            and

            check_expiry(
                requested_expiry
            )

        )

        barcode_match = (

            bool(requested_barcode)

            and

            requested_barcode
            ==
            database_barcode

        )

        # -------------------------------------------------
        # RISK
        # -------------------------------------------------

        failed_checks = sum([

            not medicine_match,

            not manufacturer_match,

            not batch_match,

            not expiry_match,

            not barcode_match

        ])

        if failed_checks == 0:

            status = "LOW_RISK"

            risk_score = 12

            confidence = 94

        elif failed_checks <= 2:

            status = "SUSPICIOUS"

            risk_score = 48

            confidence = 82

        else:

            status = "HIGH_RISK"

            risk_score = 82

            confidence = 88

        # -------------------------------------------------
        # REASONS
        # -------------------------------------------------

        reasons = []

        if medicine_match:

            reasons.append(
                "Medicine name matched the registry."
            )

        if manufacturer_match:

            reasons.append(
                "Manufacturer matched the registry."
            )

        else:

            reasons.append(
                "Manufacturer did not match or was not detected."
            )

        if batch_match:

            reasons.append(
                "Batch number matched the registry."
            )

        else:

            reasons.append(
                "Batch number did not match or was not detected."
            )

        if expiry_match:

            reasons.append(
                "Expiry date matched the registry and is valid."
            )

        else:

            reasons.append(
                "Expiry date did not match, was not detected, "
                "or is expired."
            )

        if barcode_match:

            reasons.append(
                "Barcode matched the registry."
            )

        else:

            reasons.append(
                "Barcode did not match or was not detected."
            )

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return {

            "success": True,

            "status": status,

            "risk_score": risk_score,

            "confidence": confidence,

            "medicine_name":
                database_name,

            "manufacturer":
                database_manufacturer,

            "batch_number":
                database_batch,

            "expiry_date":
                database_expiry,

            "barcode":
                database_barcode,

            "checks": {

                "medicine":
                    medicine_match,

                "manufacturer":
                    manufacturer_match,

                "batch":
                    batch_match,

                "expiry":
                    expiry_match,

                "barcode":
                    barcode_match

            },

            "reasons":
                reasons,

            "recommendation":

                (
                    "The supplied information is consistent "
                    "with the MediGuard registry."
                    if status == "LOW_RISK"

                    else

                    "Do not treat this prototype result as proof "
                    "of authenticity. Verify suspicious or "
                    "uncertain medicines with an authorized "
                    "pharmacist or manufacturer."
                )

        }

    except Exception as error:

        print(
            "Verification error:",
            error
        )

        return {

            "success": False,

            "status":
                "SERVER_ERROR",

            "risk_score": 100,

            "confidence": 0,

            "message":
                "Medicine verification failed.",

            "error":
                str(error),

            "checks": {

                "medicine": False,
                "manufacturer": False,
                "batch": False,
                "expiry": False,
                "barcode": False

            },

            "reasons": [

                "The backend encountered an unexpected error."

            ],

            "recommendation":
                "Check the Uvicorn terminal for the error."

        }