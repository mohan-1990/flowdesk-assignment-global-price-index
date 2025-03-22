# flowdesk-assignment-global-price-index
A node express API server that provides mid price of BTC/USDT pair taken as an average of N exchanges. Where N is a positive integer greater than 0.

### Instructions to run the project

1. Clone this project - `git clone git@github.com:mohan-1990/flowdesk-assignment-global-price-index.git`
2. Change to project root directoty - `cd flowdesk-assignment-global-price-index`
3. Install dependencies - `yarn install`
4. Install `ts-node` package globally - `yarn global add ts-node`. This will allow us to run the project without having to compile the typescript files into javascript files
5. Start the web server - `yarn start`
6. Wait for 10 seconds. This will give the market data classes for Binance, Huobi and Kraken sufficient time create websocket connections with their respective websocket server
7. Open a browser and enter the url `http://localhost:3000/mid-price`. This endpoint will return the averaged mid price of the three exchanges in the `averagedMidPrice` field of the response

### Demo
[Demo](https://gist.github.com/user-attachments/assets/f205eb2c-da51-4cf0-9fb2-57ec83124b50)

### Project Structure
![project-structure](https://github.com/user-attachments/assets/f87fdcf7-5a06-481c-bc4c-0aed880cad7f)

### Architecture

1. The web-socket connection to the exchanges is maintained in a javascript class in the individual files inside the `MarketDataSources` folder. The javascript classes follows the naming convention `<ExchangeName>MarketData` and implements the interface `IMarketDataSource`
2. `IMarketDataSource` interface defines `getMidPrice()` function
3. The HTTP Server is defined in the `main.ts` file at the root of the project. This server runs on port 3000 and provides `GET /mid-price` endpoint

### Test Cases

#### To execute the test cases - run `yarn test`

1. Tests were written using Jest framework
2. Unit tests in the `Tests/MarketDataSources` folder ensure the mid-price returned by `getMidPrice()` function of `BinanceMarketData`, `HuobiMarketData` and `KrakenMarketData` are correct
3. The API test in the `Test/APIServer` folder ensures the `GET /mid-price` endpoint of the HTTP Server returns the correct mid-price averaged from the mid-price returned by the three exchanges

### Procedure to add a new exchange 🚀

Drop a new typescript file inside the `MarketDataSources` folder that satisfies the below conditions

1. Follows the file naming convention `<ExchangeName>-market-data.ts`
2. Implements `IMarketDataSource` interface and follows the class naming convention `<ExchangeName>MarketData`
3. Exposes a static method `create()` that returns a singleton object of the class
4. Exposes `getMidPrice()` function to read the mid-price from the exchange

If the above conditions are met, the `GET /mid-price` API endpoint will recognize the newly added exchange automatically from the next HTTP request and will adjust the denominator of the averaged mid-price accordingly.

With this design in place, we don't have to restart the HTTP server after a new exchange is added or removed!

This design is demonstrated in this video.

[Demo2](https://gist.github.com/user-attachments/assets/481c419f-9ce4-4c38-b6b0-14433471fb74)



