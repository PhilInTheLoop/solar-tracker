from fastapi import APIRouter, HTTPException
import httpx
from typing import Optional

router = APIRouter(prefix="/api/reference", tags=["reference"])

@router.get("/pvgis")
async def get_pvgis_data(
    lat: float = 48.1351,
    lon: float = 11.5820,
    peakpower: float = 4.84,
    loss: float = 14
):
    """
    Get reference solar yield data from PVGIS (EU JRC)
    https://re.jrc.ec.europa.eu/pvg_tools/en/
    """
    url = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"

    params = {
        'lat': lat,
        'lon': lon,
        'peakpower': peakpower,
        'loss': loss,
        'outputformat': 'json',
        'pvtechchoice': 'crystSi',
        'mountingplace': 'building',
        'angle': 35,
        'aspect': 0
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            outputs = data.get('outputs', {})
            monthly = outputs.get('monthly', {}).get('fixed', [])

            return {
                'yearly_yield': outputs.get('totals', {}).get('fixed', {}).get('E_y', 0),
                'monthly_yields': [
                    {
                        'month': m.get('month'),
                        'yield_kwh': m.get('E_m', 0),
                        'irradiance': m.get('H_m', 0)
                    }
                    for m in monthly
                ],
                'location': {
                    'latitude': lat,
                    'longitude': lon
                },
                'system': {
                    'peakpower_kwp': peakpower,
                    'loss_pct': loss
                }
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"PVGIS API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/typical-yields")
async def get_typical_yields():
    """
    Return typical solar yields for Germany by region
    """
    return {
        'germany_average': 950,
        'regions': {
            'north': {'name': 'Norddeutschland', 'yield_per_kwp': 850},
            'central': {'name': 'Mitteldeutschland', 'yield_per_kwp': 950},
            'south': {'name': 'Süddeutschland', 'yield_per_kwp': 1050},
            'alpine': {'name': 'Alpenregion', 'yield_per_kwp': 1100}
        },
        'monthly_distribution': {
            1: 0.03, 2: 0.05, 3: 0.08, 4: 0.10, 5: 0.12,
            6: 0.13, 7: 0.13, 8: 0.11, 9: 0.09, 10: 0.07,
            11: 0.04, 12: 0.03
        }
    }
