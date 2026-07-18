"""Hardening de la API: límite de payload, headers de seguridad y no fuga de stack traces."""

from fastapi.testclient import TestClient

from app.main import create_app


def _client(lab_dataset):
    return TestClient(create_app(lab_dataset), raise_server_exceptions=False)


def test_oversized_request_body_is_rejected_with_413(lab_dataset):
    client = _client(lab_dataset)

    response = client.request("GET", "/api/muestras", content=b"0" * (2 * 1024 * 1024))

    assert response.status_code == 413


def test_normal_request_is_not_affected_by_body_size_limit(lab_dataset):
    client = _client(lab_dataset)

    response = client.get("/api/muestras")

    assert response.status_code == 200


def test_security_headers_are_present(lab_dataset):
    client = _client(lab_dataset)

    response = client.get("/api/muestras")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "strict-transport-security" in response.headers


def test_unhandled_exception_does_not_leak_internals(lab_dataset, monkeypatch):
    import app.api.muestras as muestras_module

    def _boom(*args, **kwargs):
        raise RuntimeError("SECRET_INTERNAL_DETAIL /c/Users/LaAma/nunca/deberia/salir.py")

    monkeypatch.setattr(muestras_module, "build_status", _boom)
    client = _client(lab_dataset)

    response = client.get("/api/muestras")

    assert response.status_code == 500
    assert "SECRET_INTERNAL_DETAIL" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text


def test_rate_limit_returns_429_once_threshold_exceeded(lab_dataset):
    app = create_app(lab_dataset)
    limiter = next(m for m in app.user_middleware if m.cls.__name__ == "RateLimitMiddleware")
    limiter.kwargs["max_requests"] = 3
    client = TestClient(app, raise_server_exceptions=False)

    for _ in range(3):
        assert client.get("/api/muestras").status_code == 200

    response = client.get("/api/muestras")
    assert response.status_code == 429
    assert "retry-after" in response.headers


def test_known_http_errors_still_get_their_real_status_code(lab_dataset):
    # Un HTTPException explícito (ej. 422 por archivo corrupto) no debe quedar "atrapado" por
    # el manejador genérico de excepciones no controladas. Una fila inválida ya no sirve para
    # este caso porque ahora es partial-success (200), no abortiva -- se usa un archivo
    # ilegible, que sigue siendo un error de archivo completo.
    lab_dataset.checklist_path.write_bytes(b"no soy un xlsx real")

    client = _client(lab_dataset)
    response = client.get("/api/muestras")

    assert response.status_code == 422


def test_malformed_query_param_does_not_crash_the_search_endpoint(lab_dataset):
    client = _client(lab_dataset)

    response = client.get("/api/muestras/buscar", params={"q": "'; DROP TABLE--<script>💥"})

    assert response.status_code == 200


def test_excessively_long_query_param_does_not_crash_the_search_endpoint(lab_dataset):
    client = _client(lab_dataset)

    response = client.get("/api/muestras/buscar", params={"q": "M" * 50_000})

    assert response.status_code == 200
    assert response.json()["muestras"] == []
