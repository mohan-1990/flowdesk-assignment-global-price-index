import WebSocket from "ws";
import request from "supertest";
import { createMockWebSocketServer } from "./MockMarketDataServer/generic-market-data-server";
import { BinanceMarketData } from "../../MarketDataSources/binance-market-data";

const TEST_PORT = 4000;

describe("BinanceMarketData WebSocket Connection Tests", () => {
  let app: any;
  let server: any;
  let marketDataInstance: BinanceMarketData;

  beforeAll(async () => {
    // Start the mock WebSocket server on the same port for both HTTP and WebSocket
    ({ app, server } = createMockWebSocketServer(TEST_PORT));

    // Create an instance of BinanceMarketData pointing to the mock WebSocket server
    marketDataInstance = BinanceMarketData.create(
      `ws://localhost:${TEST_PORT}` // Use the same port for both WebSocket and HTTP
    ) as BinanceMarketData;

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

  test("Should establish a WebSocket connection", (done) => {
    const wsClient = new WebSocket(`ws://localhost:${TEST_PORT}`);

    wsClient.on("open", () => {
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
      wsClient.close();
      done();
    });

    wsClient.on("error", (err) => done(err));
  });

  test("Should receive messages and update midPrice", async () => {
    const messagePayload = { b: "88120.56000000", a: "88320.57900000" };

    // Send message via HTTP route
    await request(app).post("/message").send({ message: messagePayload });
    // Wait for 2 seconds for the Binance Market Data class to process the message
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const midPriceData = marketDataInstance.getMidPrice();
    expect(midPriceData.midPrice).toBe(88220.5695); // (88120.56000000 + 88320.57900000) / 2
    expect(midPriceData.marketDataSource).toBe("Binance");
  });
});
