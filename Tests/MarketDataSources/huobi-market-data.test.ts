import request from "supertest";
import { createMockWebSocketServer } from "./MockMarketDataServer/generic-market-data-server";
import { HuobiMarketData } from "../../MarketDataSources/huobi-market-data";

const TEST_PORT = 4001;

describe("HuobiMarketData WebSocket Connection Tests", () => {
  let app: any;
  let server: any;
  let marketDataInstance: HuobiMarketData;

  beforeAll(async () => {
    // Start the mock WebSocket server on the same port for both HTTP and WebSocket
    ({ app, server } = createMockWebSocketServer(TEST_PORT));

    // Create an instance of HuobiMarketData pointing to the mock WebSocket server
    marketDataInstance = HuobiMarketData.create(
      `ws://localhost:${TEST_PORT}` // Use the same port for both WebSocket and HTTP
    ) as HuobiMarketData;

    // Wait for a brief period to ensure everything is connected before each test
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll((done) => {
    // Close both WebSocket and HTTP server after all tests are done
    marketDataInstance.terminate();
    // close HTTP Server
    server.close();

    // Wait for onclose method to complete on the marketDataInstance's websocket. onclose method is invoked when the terminate function is called.
    setTimeout(() => {
      done(); // Signal Jest that the test is done
    }, 2000);
  });

  test("Should receive messages and update midPrice", async () => {
    const messagePayload = {
      ch: "bbo",
      ts: new Date().getTime(),
      tick: {
        seqId: 12345,
        ask: 90320.76008,
        askSize: 0.2,
        bid: 90645.96007,
        bidSize: 0.5,
        quoteTime: new Date().getTime() - 40000,
        symbol: "BTC/USDT",
      },
    };

    // Send message via HTTP route
    await request(app)
      .post("/message")
      .send({ message: messagePayload, gzipCompressionRequired: true });
    // Wait for 2 seconds for the Binance Market Data class to process the message
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const midPriceData = marketDataInstance.getMidPrice();
    expect(midPriceData.midPrice).toBe(90483.360075); // (90320.76008 + 90645.96007) / 2
    expect(midPriceData.marketDataSource).toBe("Huobi");
  });
});
