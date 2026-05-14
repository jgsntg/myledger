import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import alpaca, quiver
from app.database import init_db
from app.routers import (
    account,
    alerts,
    evaluate,
    filers,
    indicators,
    insights,
    market,
    orders,
    positions,
    settings,
    signals,
    watchlist,
)
from app.scanner import start_scanners

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await alpaca.startup()
    await quiver.startup()
    scanner_tasks = start_scanners()
    yield
    for task in scanner_tasks:
        task.cancel()
    await alpaca.shutdown()
    await quiver.shutdown()


app = FastAPI(title="Ledger API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [
    account.router,
    positions.router,
    orders.router,
    market.router,
    watchlist.router,
    indicators.router,
    signals.router,
    alerts.router,
    filers.router,
    settings.router,
    evaluate.router,
    insights.router,
]:
    app.include_router(router)
