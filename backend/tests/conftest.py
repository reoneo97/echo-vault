import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def client():
    """Synchronous test client via httpx."""
    from starlette.testclient import TestClient

    return TestClient(app)


@pytest.fixture
async def async_client():
    """Async test client for async endpoint tests."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
