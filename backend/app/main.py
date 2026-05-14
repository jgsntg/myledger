from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import alpaca
from app.database import init_db
from app.routers import account, alerts, indicators, market, orders, positions, signals, watchlist


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await alpaca.startup()
    yield
    await alpaca.shutdown()


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
]:
    app.include_router(router)
