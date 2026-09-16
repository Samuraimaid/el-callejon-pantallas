import urllib.request
import json
import traceback

def update():
    try:
        # 1. Login with PIN 0000
        login_url = "https://callejon-backend-836176703716.us-central1.run.app/api/auth/pin"
        auth_data = json.dumps({"pin": "0000"}).encode("utf-8")
        req_auth = urllib.request.Request(
            login_url,
            data=auth_data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req_auth, timeout=10) as r:
            auth_res = json.loads(r.read())
            token = auth_res["access_token"]
            print("AUTH OK! Token acquired.")

        # 2. Get current landing config
        get_url = "https://callejon-backend-836176703716.us-central1.run.app/api/landing"
        with urllib.request.urlopen(get_url, timeout=10) as r:
            cfg = json.loads(r.read())
            print("CURRENT MAPS URL:", cfg.get("info_general", {}).get("google_maps_url"))

        # 3. Update info_general
        cfg["info_general"]["direccion"] = "Supermercado La Colonia, 2 ½ C abajo, León 21000, Nicaragua"
        cfg["info_general"]["google_maps_url"] = "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99"
        cfg["info_general"]["google_maps_embed_url"] = "https://maps.google.com/maps?cid=9352514101869817184&output=embed"
        cfg["info_general"]["waze_url"] = "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon"

        # 4. PUT update
        put_data = json.dumps(cfg).encode("utf-8")
        req_put = urllib.request.Request(
            get_url,
            data=put_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            method="PUT"
        )
        with urllib.request.urlopen(req_put, timeout=10) as r:
            res = json.loads(r.read())
            print("PUT SUCCESS!")
            print("UPDATED MAPS URL:", res.get("info_general", {}).get("google_maps_url"))
            print("UPDATED ADDRESS:", res.get("info_general", {}).get("direccion"))
    except Exception as e:
        print("ERROR:", e)
        traceback.print_exc()

if __name__ == "__main__":
    update()
