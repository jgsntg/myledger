from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    alpaca_api_key: str = ""
    alpaca_api_secret: str = ""
    # "paper" | "live" — live requires explicit opt-in
    alpaca_env: str = "paper"
    alpaca_feed: str = "iex"

    api_token: str = "change-me"
    database_url: str = "ledger.db"
    quiver_api_token: str = ""
    massive_api_key: str = ""
    port: int = 8000

    @property
    def trading_base_url(self) -> str:
        if self.alpaca_env == "live":
            return "https://api.alpaca.markets"
        return "https://paper-api.alpaca.markets"

    @property
    def data_base_url(self) -> str:
        return "https://data.alpaca.markets"


settings = Settings()
