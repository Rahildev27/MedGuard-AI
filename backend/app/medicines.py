from pydantic import BaseModel
import httpx
from urllib.parse import quote


class MedicineCheck(BaseModel):
    name: str
    manufacturer: str = ""
    batch_number: str = ""

async def verify_medicine(medicine: MedicineCheck):

    medicine_name = medicine.name.strip()

    if not medicine_name:
        return {
            "status": "error",
            "message": "Medicine name is required."
        }

    # Search the real FDA openFDA drug-label database
    search_query = f'openfda.brand_name:"{medicine_name}" OR openfda.generic_name:"{medicine_name}"'

    url = (
        "https://api.fda.gov/drug/label.json"
        f"?search={quote(search_query)}&limit=5"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)

        if response.status_code == 404:
            return {
                "status": "not_verified",
                "message": "Medicine was not found in the FDA database.",
                "medicine": medicine.model_dump()
            }

        response.raise_for_status()

        data = response.json()
        results = data.get("results", [])

        if not results:
            return {
                "status": "not_verified",
                "message": "Medicine was not found in the FDA database.",
                "medicine": medicine.model_dump()
            }

        matches = []

        for item in results:
            openfda = item.get("openfda", {})

            brand_names = openfda.get("brand_name", [])
            generic_names = openfda.get("generic_name", [])
            manufacturers = openfda.get("manufacturer_name", [])
            product_ndcs = openfda.get("product_ndc", [])

            matches.append({
                "brand_name": brand_names[0] if brand_names else "",
                "generic_name": generic_names[0] if generic_names else "",
                "manufacturer": manufacturers[0] if manufacturers else "",
                "product_ndc": product_ndcs[0] if product_ndcs else ""
            })

        # Check manufacturer if the user provided one
        manufacturer_match = True

        if medicine.manufacturer:
            manufacturer_match = any(
                medicine.manufacturer.lower() in
                match["manufacturer"].lower()
                for match in matches
            )

        if manufacturer_match:
            status = "verified"
            message = "Medicine information matched a product record in the FDA openFDA database."
        else:
            status = "manufacturer_mismatch"
            message = "Medicine was found, but the supplied manufacturer did not match the returned FDA records."

        return {
            "status": status,
            "message": message,
            "batch_status": "not_independently_verified",
            "batch_message": (
                "The batch number cannot be independently authenticated "
                "using this public FDA lookup."
            ),
            "medicine": {
                "name": medicine.name,
                "manufacturer": medicine.manufacturer,
                "batch_number": medicine.batch_number
            },
            "fda_matches": matches
        }

    except httpx.HTTPError as error:
        return {
            "status": "error",
            "message": "Could not connect to the FDA database.",
            "details": str(error)
        }

    except Exception as error:
        return {
            "status": "error",
            "message": "An unexpected error occurred.",
            "details": str(error)
        }