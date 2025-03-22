import WebSocket from "ws";
import {
  IMarketDataSource,
  BinanceBookTickerDataResponse,
  MidPriceResponseMarketDataClass,
} from "./types";

export class BinanceMarketData implements IMarketDataSource {
  private wsURL: string;
  private socket: WebSocket | null = null;
  private midPrice: number;
  private serviceName: string;
  private bestBidPrice: number;
  private bestAskPrice: number;

  private reconnectInterval = 1000; // Reconnect interval initial value. Reconnection will be attempted when the server closes the connection
  private lastReceiveTimeUnixTimestamp: number;

  private intentionalWebsocketTermination: boolean = false;
  private static instance: IMarketDataSource | null = null;

  private constructor(wsURL: string) {
    this.bestBidPrice = 0.0;
    this.bestAskPrice = 0.0;
    this.midPrice = 0.0;
    this.wsURL = wsURL;
    this.serviceName = "Binance Market Data: ";
    this.lastReceiveTimeUnixTimestamp = 0;

    this.initialize();
  }

  static create(
    wsURL: string = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker"
  ): IMarketDataSource {
    if (BinanceMarketData.instance == null) {
      BinanceMarketData.instance = new BinanceMarketData(wsURL);
    }
    return BinanceMarketData.instance;
  }

  private initialize(): void {
    console.log(
      this.serviceName + "Connecting to websocket url: " + this.wsURL
    );
    this.socket = new WebSocket(this.wsURL);

    this.socket.onopen = () => {
      console.log(this.serviceName + "Initializing websocket connection");

      // Subscription payload
      const subscriptionMessage = {
        method: "SUBSCRIBE",
        params: ["btcusdt@bookTicker"], // This channel streams best bid and ask price for btcusdt pair in real time.
        // See:- https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
        id: 1,
      };

      if (this.socket == null) {
        console.error(
          this.serviceName + "Something went wrong. Socket object is null!!!"
        );
        process.exit(-1);
      }

      // Send the subscription message
      this.socket.send(JSON.stringify(subscriptionMessage));
    };

    this.socket.on("ping", () => {
      console.log(this.serviceName + "Ping received, sending Pong...");
      this.socket?.pong(); // Respond with Pong
    });

    this.socket.onmessage = (event) => {
      let rawData: string;

      // Check if event.data is a Buffer (which happens in Node.js with 'ws' package)
      if (event.data instanceof Buffer) {
        rawData = event.data.toString("utf-8"); // Convert Buffer to string
      } else {
        rawData = event.data as string; // If it's already a string, use it directly
      }

      const responseData = JSON.parse(rawData);

      const responseDataKeys = Object.keys(responseData);

      if (responseDataKeys.includes("result") && responseData.result == null) {
        console.log(
          this.serviceName +
            "Websocket connection successful! Received an ACK message from Binance Market Data websocket server"
        );

        this.reconnectInterval = 1000; // After receiving ACK, we can reset the reconnection interval

        return;
      }

      const marketData: BinanceBookTickerDataResponse = responseData;

      if (marketData == null || marketData == undefined) {
        console.warn(
          this.serviceName +
            "Received an empty response object from the websocket server. Ignoring the message!!"
        );
      }

      this.bestBidPrice = parseFloat(marketData.b);
      this.bestAskPrice = parseFloat(marketData.a);
      this.lastReceiveTimeUnixTimestamp = new Date().getTime();

      this.midPrice = (this.bestAskPrice + this.bestBidPrice) / 2;
    };

    this.socket.onerror = (error) => {
      console.error(this.serviceName + "WebSocket error: ", error);
    };

    this.socket.onclose = (event) => {
      console.log(
        this.serviceName +
          "WebSocket closed. Code: " +
          event.code +
          ". Reason: " +
          event.reason
      );

      // Below section will attempt to reconnect with the websocket server when the connection was closed by the websocket server
      // For intentional termination via this.terminate(), the below section will not be executed

      if (!this.intentionalWebsocketTermination) {
        setTimeout(this.initialize, this.reconnectInterval);
        this.reconnectInterval = Math.min(this.reconnectInterval * 2, 60000); // Exponential backoff (max 60 sec)
      }
    };
  }

  getMidPrice(): MidPriceResponseMarketDataClass {
    return {
      midPrice: this.midPrice,
      marketDataSource: "Binance",
      exchangeTimeStamp: new Date(
        this.lastReceiveTimeUnixTimestamp
      ).toUTCString(),
    };
  }

  terminate(): void {
    this.intentionalWebsocketTermination = true;
    this.socket?.close();
  }
}
