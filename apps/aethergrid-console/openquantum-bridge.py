#!/usr/bin/env python3
"""Read-only Open Quantum SDK bridge: emits whitelisted metadata, never credentials."""
import argparse
import json
import os


def emit(payload):
    print(json.dumps(payload, separators=(",", ":"), ensure_ascii=True))


def credentials_present():
    packed = os.environ.get("AETHERGRID_OPENQUANTUM_SDK_KEY_JSON") or os.environ.get("OPENQUANTUM_SDK_KEY_JSON")
    return bool(packed or os.environ.get("OPENQUANTUM_SDK_KEY") or
                (os.environ.get("OPENQUANTUM_CLIENT_ID") and os.environ.get("OPENQUANTUM_CLIENT_SECRET")))


def credential_kwargs():
    packed = os.environ.get("AETHERGRID_OPENQUANTUM_SDK_KEY_JSON") or os.environ.get("OPENQUANTUM_SDK_KEY_JSON")
    if not packed:
        return {}
    try:
        data = json.loads(packed)
    except (ValueError, TypeError):
        raise ValueError("invalid_credentials_format") from None
    if not isinstance(data, dict) or not data.get("client_id") or not data.get("client_secret"):
        raise ValueError("invalid_credentials_format")
    from openquantum_sdk.auth import ClientCredentials
    return {"creds": ClientCredentials(client_id=data["client_id"], client_secret=data["client_secret"])}


def safe_backend(item):
    if not isinstance(item, dict):
        return None
    return {
        "name": str(item.get("name") or "")[:160],
        "shortCode": str(item.get("short_code") or "")[:100],
        "type": str(item.get("type") or "")[:32],
        "status": str(item.get("status") or "unknown")[:48],
        "acceptingJobs": item.get("accepting_jobs") if isinstance(item.get("accepting_jobs"), bool) else None,
        "queueDepth": item.get("queue_depth") if isinstance(item.get("queue_depth"), int) else None,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", required=True, choices=("status", "backends"))
    action = parser.parse_args().action
    try:
        from importlib.metadata import version
        sdk_version = version("openquantum-sdk")
        from openquantum_sdk import OpenQuantumClient
    except Exception:
        emit({"provider": "openquantum", "status": "sdk_missing", "hardwareSubmitted": False, "hardwareExecuted": False})
        return

    if action == "status":
        emit({"provider": "openquantum", "status": "configured" if credentials_present() else "unconfigured",
              "sdkInstalled": True, "sdkVersion": sdk_version, "hardwareSubmitted": False, "hardwareExecuted": False})
        return
    if not credentials_present():
        emit({"provider": "openquantum", "status": "unconfigured", "backends": [],
              "hardwareSubmitted": False, "hardwareExecuted": False})
        return
    try:
        client = OpenQuantumClient.from_env(**credential_kwargs())
        try:
            backends = client.backends(limit=50)
        finally:
            client.close()
        safe = [item for source in backends if (item := safe_backend(source)) is not None]
        emit({"provider": "openquantum", "status": "ready", "backends": safe, "live": True,
              "hardwareSubmitted": False, "hardwareExecuted": False})
    except ValueError:
        emit({"provider": "openquantum", "status": "invalid_credentials_format", "backends": [],
              "hardwareSubmitted": False, "hardwareExecuted": False})
    except Exception:
        # Never print third-party exception messages: they may contain sensitive data.
        emit({"provider": "openquantum", "status": "unavailable", "backends": [],
              "hardwareSubmitted": False, "hardwareExecuted": False})


if __name__ == "__main__":
    main()
