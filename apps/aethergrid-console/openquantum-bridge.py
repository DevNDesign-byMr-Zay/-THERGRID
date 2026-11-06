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
    if not isinstance(data, dict) or not all(
        isinstance(data.get(field), str) and data[field].strip()
        for field in ("client_id", "client_secret")
    ):
        raise ValueError("invalid_credentials_format")
    from openquantum_sdk.auth import ClientCredentials
    return {"creds": ClientCredentials(client_id=data["client_id"], client_secret=data["client_secret"])}


def safe_backend(item):
    if not isinstance(item, dict):
        return None
    return {
        "name": str(item.get("name") or "")[:160],
        "providerId": str(item.get("provider_id") or "")[:100],
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
        from openquantum_sdk.exceptions import AuthenticationError
        from openquantum_sdk.models import APIError
        from requests.exceptions import HTTPError, RequestException, Timeout
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
    result = {"provider": "openquantum", "sdkInstalled": True, "sdkVersion": sdk_version,
              "backends": [], "hardwareSubmitted": False, "hardwareExecuted": False}
    try:
        options = credential_kwargs()
    except ValueError:
        result["status"] = "invalid_credentials_format"
        emit(result)
        return

    try:
        with OpenQuantumClient.from_env(**options) as client:
            page = client.management.list_backend_classes(limit=50)
        result.update(status="ready", live=True, backends=[
            safe_backend(vars(backend)) for backend in page.backend_classes[:50]
        ])
    except AuthenticationError:
        result["status"] = "authentication_failed"
    except APIError as error:
        status = error.error_response.status_code
        result["httpStatus"] = status if isinstance(status, int) and 400 <= status <= 599 else None
        result["status"] = "authentication_failed" if status == 401 else "provider_rejected"
    except HTTPError as error:
        status = error.response.status_code if error.response is not None else None
        result["httpStatus"] = status if isinstance(status, int) and 400 <= status <= 599 else None
        result["status"] = "authentication_failed" if status == 401 else "provider_rejected"
    except Timeout:
        result["status"] = "provider_timeout"
    except RequestException:
        result["status"] = "provider_unreachable"
    except Exception:
        # Third-party exception text can contain private values.
        result["status"] = "unavailable"
    emit(result)


if __name__ == "__main__":
    main()
