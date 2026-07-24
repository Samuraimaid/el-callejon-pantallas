#!/usr/bin/env python3
"""Smoke: manifiestos, lease prioritario, sensor, video turn."""
from __future__ import annotations

import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def j(path, method="GET", data=None):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(
        BASE + path,
        data=body,
        method=method,
        headers={"Content-Type": "application/json"} if data is not None else {},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main() -> int:
    fails = 0
    res = j("/api/content/resources?force=true")
    print("resources level=", res.get("level"), "cpu=", res.get("cpu_percent"))
    fails += "policy" not in res

    for tid in (1, 2, 3):
        m = j(f"/api/content/manifest/{tid}")
        print(
            f"TV{tid}: kind={m.get('kind')} assets={m.get('asset_count')} "
            f"videos={m.get('video_count')} budget={m.get('budget_mb')}MB "
            f"ver={m.get('version')}"
        )
        fails += m.get("asset_count", -1) < 0

    l1 = j("/api/content/lease", "POST", {"tv_id": 1})
    print("lease1 granted=", l1.get("granted"))
    fails += not l1.get("granted")

    l3 = j("/api/content/lease", "POST", {"tv_id": 3})
    print(
        "lease3 granted=",
        l3.get("granted"),
        "reason=",
        l3.get("reason"),
        "pos=",
        l3.get("queue_position"),
    )
    fails += l3.get("granted") is True  # should wait

    l2 = j("/api/content/lease", "POST", {"tv_id": 2})
    print("lease2 while 1 holds: granted=", l2.get("granted"), "pos=", l2.get("queue_position"))
    # TV2 should be ahead of TV3 in queue
    if l2.get("queue_position") and l3.get("queue_position"):
        if l2["queue_position"] > l3["queue_position"]:
            print("FAIL priority TV2 should be before TV3")
            fails += 1
        else:
            print("OK priority TV2 before/at better pos than TV3")

    j(
        "/api/content/lease/release",
        "POST",
        {"tv_id": 1, "lease_id": l1.get("lease_id")},
    )
    l2b = j("/api/content/lease", "POST", {"tv_id": 2})
    print("lease2 after release1 granted=", l2b.get("granted"))
    fails += not l2b.get("granted")
    j(
        "/api/content/lease/release",
        "POST",
        {"tv_id": 2, "lease_id": l2b.get("lease_id")},
    )
    j("/api/content/lease/release", "POST", {"tv_id": 3})

    vt = j("/api/content/video-turn")
    print("video_turn", vt.get("turn"))

    print("FAILS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
