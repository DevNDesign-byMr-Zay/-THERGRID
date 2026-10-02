from serialization import sanitize_payload

def test_sanitize_payload():
    payload = {
        "apiKey": "sk-123456789012345678901234567890",
        "serviceCrn": "crn:v1:bluemix:public:quantum-computing:us-east:a/123456789:service-instance::",
        "nested": {
            "token": "secret-token",
            "normal": "public-data"
        }
    }
    cleaned = sanitize_payload(payload)
    assert cleaned["apiKey"] == "[REDACTED_SECRET]"
    assert cleaned["serviceCrn"] == "[REDACTED_SECRET]"
    assert cleaned["nested"]["token"] == "[REDACTED_SECRET]"
    assert cleaned["nested"]["normal"] == "public-data"
