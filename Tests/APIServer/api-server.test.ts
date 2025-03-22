import request from "supertest";
import { app, server, terminateAPIServer } from "../../main";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("GET /mid-price", () => {
  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => terminateAPIServer(resolve)); // Ensure the API server is stopped
    }
    await sleep(2000); // Additional 2 seconds buffer to ensure the API server resources have been fully stopped
  });

  // Reset the mock before each test
  beforeEach(() => {
    jest.restoreAllMocks(); // Restore any mocks that might have been applied previously
  });

  test("should return 200 and a valid mid-price response", async () => {
    const testAgent = request(app);
    await testAgent.get("/mid-price");
    await sleep(10000); // Buffer to ensure, the market data source classes are sufficiently ready and they don't return NAN for midprice;
    const response = await testAgent.get("/mid-price");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("averagedMidPrice");
    expect(response.body.averagedMidPrice).toBeTruthy();

    const midPriceReturned = parseFloat(response.body.averagedMidPrice);

    let midPriceCalculated = 0.0;
    let midPriceSum = 0.0;
    let midPriceSourcesCount = 0;
    const midPriceSources: any[] = response.body.midPriceSources;

    for (const midPriceSource of midPriceSources) {
      midPriceSum += midPriceSource["midPrice"];
      midPriceSourcesCount++;
    }

    midPriceCalculated = midPriceSum / midPriceSourcesCount;
    expect(midPriceReturned.toFixed(4)).toEqual(midPriceCalculated.toFixed(4)); // Ensure valid mid-price
  }, 15000); // 15 seconds timeout to ensure the endpoint returns a non-NAN result for the averaged mid-price
});
