from health.health_server import create_health_app


def test_health_returns_ok():
    client = create_health_app().test_client()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
