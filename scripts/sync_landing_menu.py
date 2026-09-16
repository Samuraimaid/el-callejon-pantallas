import urllib.request
import json
import traceback

def sync():
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

        # 2. Get current config
        get_url = "https://callejon-backend-836176703716.us-central1.run.app/api/landing"
        with urllib.request.urlopen(get_url, timeout=10) as r:
            cfg = json.loads(r.read())
            print("Config loaded from server.")

        # 3. Update info_general
        cfg.setdefault("info_general", {})
        cfg["info_general"]["nombre"] = "Buffet y Restaurante El Callejón"
        cfg["info_general"]["nombre_corto"] = "El Callejón"
        cfg["info_general"]["eslogan"] = "¡En la variedad está el sazón!"
        cfg["info_general"]["direccion"] = "Supermercado La Colonia, 2 ½ C abajo, León 21000, Nicaragua"
        cfg["info_general"]["google_maps_url"] = "https://maps.app.goo.gl/iaCtEbyPNmgrgpt99"
        cfg["info_general"]["google_maps_embed_url"] = "https://maps.google.com/maps?q=12.4361505,-86.8858488+(Buffet+y+Restaurante+El+Callej%C3%B3n)&t=&z=17&ie=UTF8&iwloc=&output=embed"
        cfg["info_general"]["waze_url"] = "https://waze.com/ul?q=Buffet+y+Restaurante+El+Callej%C3%B3n+Leon"
        cfg["info_general"]["logo_url"] = "/logo-el-callejon.png"
        cfg["info_general"]["mostrar_precios"] = True

        # 4. Synchronized menu items with TV Screen + Vegetable additions
        cfg["menu_items"] = [
            {
                "id": "plt-cordon",
                "codigo": "PLT-CORDON",
                "nombre": "Cordon Bleu",
                "categoria": "Especialidades",
                "precio_nio": 400.0,
                "precio_usd": 10.90,
                "descripcion": "Pechuga de pollo rellena de jamón y queso fundido, empanizada y dorada, con guarnición de la casa.",
                "imagen": "/images/platillos/cordon-bleu.jpg",
                "destacado": True,
            },
            {
                "id": "plt-canelon",
                "codigo": "PLT-CANELON",
                "nombre": "Canelones de carne",
                "categoria": "Especialidades",
                "precio_nio": 170.0,
                "precio_usd": 4.65,
                "descripcion": "Canelones horneados rellenos de carne sazonada con la receta especial de la casa y salsa gratinada.",
                "imagen": "/images/platillos/canelones.jpg",
                "destacado": True,
            },
            {
                "id": "plt-lasana",
                "codigo": "PLT-LASANA",
                "nombre": "Lasaña mixta",
                "categoria": "Especialidades",
                "precio_nio": 160.0,
                "precio_usd": 4.35,
                "descripcion": "Capas de pasta artesanal con carne, pollo, queso derretido y salsa boloñesa casera.",
                "imagen": "/images/platillos/relleno.jpg",
                "destacado": True,
            },
            {
                "id": "plt-carne-asa",
                "codigo": "PLT-CARNE-ASA",
                "nombre": "Carne asada",
                "categoria": "Carnes & Parrilla",
                "precio_nio": 190.0,
                "precio_usd": 5.20,
                "descripcion": "Jugosa carne de res marinada con sazón criollo al carbón, acompañada de gallo pinto y tajadas crujientes.",
                "imagen": "/images/platillos/carne-asada.jpg",
                "destacado": False,
            },
            {
                "id": "plt-pollo-plan",
                "codigo": "PLT-POLLO-PLAN",
                "nombre": "Pollo a la plancha",
                "categoria": "Platos Fuertes",
                "precio_nio": 160.0,
                "precio_usd": 4.35,
                "descripcion": "Filete de pechuga tierno cocinado a la plancha con hierbas aromáticas y vegetales salteados.",
                "imagen": "/images/platillos/PLT-POLLO-PLAN.jpg",
                "destacado": False,
            },
            {
                "id": "plt-chuleta",
                "codigo": "PLT-CHULETA",
                "nombre": "Chuleta de cerdo",
                "categoria": "Carnes & Parrilla",
                "precio_nio": 170.0,
                "precio_usd": 4.65,
                "descripcion": "Corte de cerdo ahumado dorado a punto con ensalada fresca y guarniciones típicas.",
                "imagen": "/images/platillos/lomo-cerdo.jpg",
                "destacado": False,
            },
            {
                "id": "plt-pescado",
                "codigo": "PLT-PESCADO",
                "nombre": "Filete de pescado",
                "categoria": "Mariscos",
                "precio_nio": 185.0,
                "precio_usd": 5.05,
                "descripcion": "Filete fresco del día empanizado crujiente o al ajillo con arroz blanco y ensalada.",
                "imagen": "/images/platillos/PLT-PESCADO.jpg",
                "destacado": False,
            },
            {
                "id": "plt-bistec",
                "codigo": "PLT-BISTEC",
                "nombre": "Bistec encebollado",
                "categoria": "Carnes & Parrilla",
                "precio_nio": 175.0,
                "precio_usd": 4.75,
                "descripcion": "Corte suave de res cocinado lentamente con abundantes aros de cebolla caramelizada, arroz y frijoles.",
                "imagen": "/images/platillos/churrasco.jpg",
                "destacado": False,
            },
            {
                "id": "plt-camarones",
                "codigo": "PLT-CAMARONES",
                "nombre": "Camarones al ajillo",
                "categoria": "Mariscos",
                "precio_nio": 220.0,
                "precio_usd": 6.00,
                "descripcion": "Generosa porción de camarones salteados en ajo dorado, mantequilla criolla y tostones de plátano.",
                "imagen": "/images/platillos/PLT-CAMARONES.jpg",
                "destacado": False,
            },
            {
                "id": "plt-costilla",
                "codigo": "PLT-COSTILLA",
                "nombre": "Costilla BBQ",
                "categoria": "Carnes & Parrilla",
                "precio_nio": 200.0,
                "precio_usd": 5.45,
                "descripcion": "Costillas tiernas y jugosas bañadas en deliciosa salsa BBQ casera, servidas con papas fritas doradas.",
                "imagen": "/images/platillos/PLT-COSTILLA.jpg",
                "destacado": False,
            },
            {
                "id": "plt-buffet-a",
                "codigo": "PLT-BUFFET-A",
                "nombre": "Buffet adulto",
                "categoria": "Buffet Libre",
                "precio_nio": 220.0,
                "precio_usd": 6.00,
                "descripcion": "Acceso ilimitado a nuestra barra de buffet diario: carnes, arroces, ensaladas, pastas y complementos.",
                "imagen": "/images/slides/slide-platos-mixtos.jpg",
                "destacado": True,
            },
            {
                "id": "plt-buffet-n",
                "codigo": "PLT-BUFFET-N",
                "nombre": "Buffet niño",
                "categoria": "Buffet Libre",
                "precio_nio": 140.0,
                "precio_usd": 3.80,
                "descripcion": "Acceso completo a la barra de buffet infantil para niños hasta 10 años.",
                "imagen": "/images/slides/slide1-buffet.jpg",
                "destacado": False,
            },
            {
                "id": "plt-verduras-salteadas",
                "codigo": "PLT-VERDURAS-SALT",
                "nombre": "Verduras Salteadas al Vapor",
                "categoria": "Verduras & Saludable",
                "precio_nio": 120.0,
                "precio_usd": 3.25,
                "descripcion": "Mezcla fresca de brócoli, coliflor, zanahorias baby, ejotes tiernos y maíz salteados en mantequilla criolla y finas hierbas.",
                "imagen": "/images/platillos/verduras-salteadas.jpg",
                "destacado": True,
            },
            {
                "id": "plt-ensalada-campesina",
                "codigo": "PLT-ENSALADA-CAMP",
                "nombre": "Ensalada Campesina con Aguacate",
                "categoria": "Verduras & Saludable",
                "precio_nio": 110.0,
                "precio_usd": 3.00,
                "descripcion": "Hojas de lechuga crujiente, tomates frescos de huerta, pepino, cebolla morada y suaves rodajas de aguacate con vinagreta artesanal.",
                "imagen": "/images/platillos/ensalada-campesina.jpg",
                "destacado": True,
            },
            {
                "id": "plt-buffet-vegetales",
                "codigo": "PLT-BUFFET-VEG",
                "nombre": "Barra Buffet de Vegetales & Legumbres",
                "categoria": "Verduras & Saludable",
                "precio_nio": 130.0,
                "precio_usd": 3.55,
                "descripcion": "Acceso a la variedad de vegetales cocidos, ensaladas frías, remolacha glaseada, chayote y aderezos caseros.",
                "imagen": "/images/publicidad/buffet-platos.jpg",
                "destacado": False,
            },
            {
                "id": "plt-ensalada-rusa",
                "codigo": "PLT-ENSALADA-RUSA",
                "nombre": "Ensalada Rusa Tradicional",
                "categoria": "Verduras & Saludable",
                "precio_nio": 115.0,
                "precio_usd": 3.15,
                "descripcion": "Papas en dados, zanahoria tierna, guisantes dulces y aderezo cremoso tradicional con el toque de la casa.",
                "imagen": "/images/platillos/ensalada-campesina.jpg",
                "destacado": False,
            },
        ]

        # 5. Send PUT request
        put_data = json.dumps(cfg, ensure_ascii=False).encode("utf-8")
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
            print("SYNC COMPLETED SUCCESSFULLY!")
            print("Updated items count:", len(res.get("menu_items", [])))
            print("Logo:", res.get("info_general", {}).get("logo_url"))
            print("Map URL:", res.get("info_general", {}).get("google_maps_embed_url"))
            print("Mostrar Precios:", res.get("info_general", {}).get("mostrar_precios"))

    except Exception as e:
        print("ERROR:", e)
        traceback.print_exc()

if __name__ == "__main__":
    sync()
