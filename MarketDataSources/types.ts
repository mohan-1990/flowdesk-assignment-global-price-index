// MarketDataSourceAdapter type definitions

export interface IMarketDataSource {
  getMidPrice(): MidPriceResponseMarketDataClass;
  terminate(): void;
}

export interface MidPriceResponseMarketDataClass {
  midPrice: number;
  marketDataSource: string;
  exchangeTimeStamp: string;
}

export interface MidPriceResponseAPIServer {
  midPriceSources: MidPriceResponseMarketDataClass[];
  success: boolean;
  averagedMidPrice: string;
}

// END - MarketDataSourceAdapter type definitions

// Required to import the various market data classes dynamically
export interface IMarketDataSourceConstructor {
  new (): IMarketDataSource; // The constructor signature for the class
  create(): IMarketDataSource; // Static method 'create'
}

// Binance Market Data type definitions

export interface BinanceBookTickerDataResponse {
  u: string;
  s: string;
  b: string;
  B: string;
  a: string;
  A: string;
}

// END - Binance Market Data type definitions

// Kraken Market Data type definitions

interface DataObject {
  symbol: string;
  bid: number;
  bid_qty: number;
  ask: number;
  ask_qty: number;
  last: number;
  volume: number;
  vwap: number;
  low: number;
  high: number;
  change: number;
  change_pct: number;
}

export interface KrakenMarketDataResponse {
  channel: string;
  type: string;
  data: DataObject[];
}

// END - Kraken Market Data type definitions

// Huobi Market Data type definitions

interface TickObject {
  seqId: number;
  ask: number;
  askSize: number;
  bid: number;
  bidSize: number;
  quoteTime: number;
  symbol: string;
}

export interface HuobiMarketDataResponse {
  ch: string;
  ts: number;
  tick: TickObject;
}

// END - Huobi Market Data type definitions
