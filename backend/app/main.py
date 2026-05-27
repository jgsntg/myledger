import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import alpaca, massive, quiver, symbols as symbols_mod
from app.config import settings
from app.database import init_db
from app.routers import (
    account,
    ai as ai_router,
    alerts,
    evaluate,
    filers,
    indicators,
    insights,
    market,
    massive as massive_router,
    orders,
    positions,
    settings,
    signals,
    watchlist,
)
from app.symbols import router as symbols_router
from app.scanner import start_scanners

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await alpaca.startup()
    await quiver.startup()
    await massive.startup()
    await symbols_mod.load()
    scanner_tasks = start_scanners()
    yield
    for task in scanner_tasks:
        task.cancel()
    await alpaca.shutdown()
    await quiver.shutdown()
    await massive.shutdown()


app = FastAPI(title="Ledger API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
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
    massive_router.router,
    ai_router.router,
    symbols_router,
]:
    app.include_router(router)
