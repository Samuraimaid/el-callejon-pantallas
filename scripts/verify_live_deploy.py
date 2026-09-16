import urllib.request
import re

def verify_live():
    url = "https://callejon-frontend-836176703716.us-central1.run.app/restaurante"
    req = urllib.request.urlopen(url)
    html = req.read().decode('utf-8')
    print("Page status:", req.status)
    print("Has root div:", '<div id="root">' in html)
    
    # Find script and css
    css_files = re.findall(r'href="(/assets/[^"]+\.css)"', html)
    js_files = re.findall(r'src="(/assets/[^"]+\.js)"', html)
    
    print("CSS files:", css_files)
    print("JS files:", js_files)
    
    # Check CSS content to verify overflow: hidden is gone from body
    for css_rel in css_files:
        css_url = f"https://callejon-frontend-836176703716.us-central1.run.app{css_rel}"
        css_content = urllib.request.urlopen(css_url).read().decode('utf-8')
        print(f"CSS {css_rel} size: {len(css_content)} bytes")
        # Check if body has overflow: hidden
        has_body_hidden = "body{overflow:hidden" in css_content.replace(" ", "")
        has_tv_lock = "tv-fullscreen-lock" in css_content
        print(f"  Has body overflow:hidden: {has_body_hidden}")
        print(f"  Has tv-fullscreen-lock: {has_tv_lock}")

    # Check JS content to verify maps URL
    for js_rel in js_files:
        js_url = f"https://callejon-frontend-836176703716.us-central1.run.app{js_rel}"
        js_content = urllib.request.urlopen(js_url).read().decode('utf-8')
        print(f"JS {js_rel} size: {len(js_content)} bytes")
        has_maps_url = "iaCtEbyPNmgrgpt99" in js_content
        has_cid = "9352514101869817184" in js_content
        print(f"  Contains user Google Maps short URL: {has_maps_url}")
        print(f"  Contains restaurant CID: {has_cid}")

if __name__ == "__main__":
    verify_live()
