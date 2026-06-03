from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router
from . import observability

app = FastAPI(title="EchoVault Backend", version="0.1.0")

# Observability must be configured before routes are registered so that
# FastAPI instrumentation captures all endpoints.
observability.configure(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
