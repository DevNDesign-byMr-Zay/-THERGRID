"""Offline contract tests for the optional, pinned Open Quantum SDK."""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
from threading import Thread
from unittest import TestCase, main
from urllib.parse import parse_qs, urlsplit


BRIDGE = Path(__file__).resolve().parents[1] / "apps/aethergrid-console/openquantum-bridge.py"


class ProviderFixture(BaseHTTPRequestHandler):
    def log_message(self, _format, *args):
        pass

    def respond(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/realms/fixture/protocol/openid-connect/token":
            self.respond(404, {})
            return
        self.server.token_calls += 1
        body = self.rfile.read(int(self.headers["Content-Length"])).decode()
        fields = parse_qs(body)
        if fields.get("client_secret") == ["fixture-secret"]:
            self.respond(200, {"access_token": "fixture-token", "expires_in": 300})
        else:
            self.respond(401, {"error": "invalid_client"})

    def do_GET(self):
        path = urlsplit(self.path)
        if path.path != "/v1/backends/classes":
            self.respond(404, {})
            return
        if self.headers.get("Authorization") != "Bearer fixture-token":
            self.respond(401, {})
            return
        self.server.catalog_calls += 1
        if parse_qs(path.query).get("limit") != ["50"]:
            self.respond(400, {})
            return
        self.respond(200, {
            "backend_classes": [{
                "id": "fixture-id", "name": "Fixture simulator", "description": "",
                "type": "SIMULATOR", "provider_id": "fixture-provider",
                "short_code": "fixture:sim", "queue_depth": 0, "accepting_jobs": True,
                "status": "Online",
            }],
            "pagination": {"next_cursor": "must-not-follow"},
        })


class OpenQuantumBridgeTest(TestCase):
    def setUp(self):
        self.provider = ThreadingHTTPServer(("127.0.0.1", 0), ProviderFixture)
        self.provider.token_calls = 0
        self.provider.catalog_calls = 0
        thread = Thread(target=self.provider.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.provider.server_close)
        self.addCleanup(thread.join)
        self.addCleanup(self.provider.shutdown)
        self.endpoint = f"http://127.0.0.1:{self.provider.server_port}"

    def discover(self, packed=None, endpoint=None, split=False):
        env = {
            name: value for name, value in os.environ.items()
            if not name.startswith(("OPENQUANTUM_", "AETHERGRID_OPENQUANTUM_"))
        }
        target = endpoint or self.endpoint
        env.update(OPENQUANTUM_KEYCLOAK_BASE=target, OPENQUANTUM_KEYCLOAK_REALM="fixture",
                   OPENQUANTUM_MANAGEMENT_URL=target, NO_PROXY="127.0.0.1")
        if packed is not None:
            env["AETHERGRID_OPENQUANTUM_SDK_KEY_JSON"] = packed
        if split:
            env.update(OPENQUANTUM_CLIENT_ID="fixture", OPENQUANTUM_CLIENT_SECRET="fixture-secret")
        run = subprocess.run([sys.executable, str(BRIDGE), "--action", "backends"],
                             env=env, capture_output=True, text=True, check=True, timeout=10)
        self.assertEqual(run.stderr, "")
        self.assertNotIn("fixture-secret", run.stdout)
        self.assertNotIn("fixture-token", run.stdout)
        result = json.loads(run.stdout)
        self.assertFalse(result["hardwareExecuted"])
        self.assertFalse(result["hardwareSubmitted"])
        return result

    def test_sdk_authenticates_and_reads_one_catalog_page(self):
        result = self.discover(json.dumps({"client_id": "fixture", "client_secret": "fixture-secret"}))
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["sdkVersion"], "1.0.0")
        self.assertTrue(result["live"])
        self.assertEqual(result["backends"][0]["providerId"], "fixture-provider")
        self.assertEqual(result["backends"][0]["queueDepth"], 0)
        self.assertEqual(self.provider.token_calls, 1)
        self.assertEqual(self.provider.catalog_calls, 1)

    def test_explicit_split_credentials_override_a_malformed_legacy_alias(self):
        result = self.discover("invalid-legacy-value", split=True)
        self.assertEqual(result["status"], "ready")
        self.assertEqual(self.provider.token_calls, 1)

    def test_invalid_credentials_return_sanitized_http_status(self):
        result = self.discover(json.dumps({"client_id": "fixture", "client_secret": "bad"}))
        self.assertEqual(result["status"], "authentication_failed")
        self.assertEqual(result["httpStatus"], 401)
        self.assertEqual(self.provider.catalog_calls, 0)

    def test_missing_and_malformed_credentials_do_not_connect(self):
        self.assertEqual(self.discover()["status"], "unconfigured")
        self.assertEqual(self.discover("invalid")["status"], "invalid_credentials_format")
        self.assertEqual(self.provider.token_calls, 0)

    def test_connection_failure_is_distinct_from_invalid_credentials(self):
        from socket import socket
        with socket() as reserved:
            reserved.bind(("127.0.0.1", 0))
            port = reserved.getsockname()[1]
            result = self.discover(json.dumps({"client_id": "fixture", "client_secret": "fixture-secret"}),
                                   endpoint=f"http://127.0.0.1:{port}")
        self.assertEqual(result["status"], "provider_unreachable")
        self.assertEqual(result["backends"], [])


if __name__ == "__main__":
    main()
