// main.ts
import fs from "fs";
import path from "path";
import http from "http";
import express, { Request, Response } from "express";
import {
  IMarketDataSourceConstructor,
  MidPriceResponseMarketDataClass,
  MidPriceResponseAPIServer,
  IMarketDataSource,
} from "./MarketDataSources/types";

const marketDataClassesDirectoryPath = path.resolve(
  process.cwd(),
  "MarketDataSources"
);

async function readMarketDataClasses(): Promise<IMarketDataSource[]> {
  try {
    // Read all market data files in the directory except types.ts
    const files = fs.readdirSync(marketDataClassesDirectoryPath);
    const classFiles = files.filter(
      (file) => !file.includes("types.ts") && file.endsWith("-market-data.ts")
    );

    let marketDataSourceClasses: IMarketDataSource[] = [];

    // Loop through the files and dynamically import each one
    for (const file of classFiles) {
      const filePath = path.join(marketDataClassesDirectoryPath, file);

      // Dynamically import the market data class file
      const module = await import(filePath);

      // Loop through the module's exports and check for classes
      Object.values(module).forEach((exportedValue) => {
        // Check if the exported value is a class (i.e., a function with a prototype)
        if (
          typeof exportedValue === "function" &&
          exportedValue.prototype.constructor.name !== "Object"
        ) {
          // Assert that the exported value is a class that has a static create method
          const classReference = exportedValue as IMarketDataSourceConstructor;
          // Call the static create() method of the class
          const instanceFromCreateMethod = classReference.create();
          marketDataSourceClasses.push(instanceFromCreateMethod);
        }
      });
    }
    return marketDataSourceClasses;
  } catch (error) {
    console.error(
      "Error loading market data source classes in the directory :" +
        marketDataClassesDirectoryPath +
        ". Error: " +
        error
    );
    return [];
  }
}

// The below function will:-
// 1. dynamically import the Market Data Classes in the MarketDataSources directory using readMarketDataClasses() function
// 2. calculate the averaged mid-price from the ones that return a non-zero mid-price.

async function readMidPriceFromMarketDataSources(): Promise<MidPriceResponseAPIServer> {
  try {
    // Read all market data files in the directory using readMarketDataClasses()

    const marketDataClasses = await readMarketDataClasses();
    let marketDataClassResponses: MidPriceResponseMarketDataClass[] = [];
    let numSuccessfulMarketDataResponses = 0;

    // Loop through the files and dynamically import each one
    for (const marketDataClass of marketDataClasses) {
      const midPriceResponse = marketDataClass.getMidPrice();

      // Let's not take the response from a market data class that is 0.0
      if (midPriceResponse && midPriceResponse.midPrice != 0) {
        marketDataClassResponses.push(midPriceResponse);
        numSuccessfulMarketDataResponses++; // Used as a denominator in the averagedMidPrice calculation
      }
    }

    let sum = 0.0;
    let averagedMidPrice = 0.0;

    for (const marketDataClassResponse of marketDataClassResponses) {
      sum += marketDataClassResponse.midPrice;
    }

    averagedMidPrice = sum / numSuccessfulMarketDataResponses;

    return {
      midPriceSources: marketDataClassResponses,
      success: true,
      averagedMidPrice: averagedMidPrice.toFixed(8),
    };
  } catch (error) {
    console.error(
      "Error reading mid price from market data sources" + ". Error: " + error
    );
    return {
      midPriceSources: [],
      success: false,
      averagedMidPrice: "0.0",
    };
  }
}

async function terminateMarketDataSourcesWebsocketConnections(): Promise<boolean> {
  try {
    const marketDataClasses = await readMarketDataClasses();
    for (const marketDataClass of marketDataClasses) {
      marketDataClass.terminate();
    }
    return true;
  } catch (error) {
    console.error(
      "Some error occurred when terminating the websocket connections opened by the market data sources: " +
        error
    );
    return false;
  }
}

// Create an Express app
const app = express();

app.get("/mid-price", async (req: Request, res: Response) => {
  try {
    const averagedMidPrice = await readMidPriceFromMarketDataSources();
    res.json(averagedMidPrice);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server only if this file is run directly
let server: http.Server;
if (require.main === module) {
  // Initialize and read the mid-price one time from the available market data classes to avoid startup delays when the API client actually needs the averaged mid price via GET /mid-price

  (async () => {
    await readMidPriceFromMarketDataSources();
  })();

  const port = 3000;
  server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

// Terminating the API Server consists of terminating the Express HTTP Server and the websocket connections opened by the market data source classes
async function terminateAPIServer(callback: (err: Error | undefined) => void) {
  await terminateMarketDataSourcesWebsocketConnections();
  server.close(callback);
}

// Export the server instance for test cleanup
export { server };
// Named exports for testing
export { app, readMidPriceFromMarketDataSources, terminateAPIServer };
