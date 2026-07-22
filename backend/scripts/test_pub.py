import json
import urllib.request

base = "http://127.0.0.1:8000"
login = json.loads(
    urllib.request.urlopen(
        urllib.request.Request(
            base + "/api/auth/login",
            data=json.dumps({"usuario": "cajero1", "password": "1234"}).encode(),
            headers={"Content-Type": "application/json"},
        )
    ).read()
)
t = login["access_token"]
req = urllib.request.Request(
    base + "/api/publicidad/SALON_VIP",
    data=json.dumps(
        {"duracion_slide": 9000, "efecto_visual": "slide-left"}
    ).encode(),
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + t,
    },
    method="PUT",
)
r = json.loads(urllib.request.urlopen(req).read())
print("OK", r["efecto_visual"], r["duracion_slide"], len(r["slides"]), flush=True)
