import zlib from "zlib"; // Needed to decompress Huobi's GZIP responses
import WebSocket from "ws";
import {
  IMarketDataSource,
  HuobiMarketDataResponse,
  MidPriceResponseMarketDataClass,
} from "./types";

export class HuobiMarketData implements IMarketDataSource {
  private socket: WebSocket | null = null;
  private midPrice: number;
  private wsURL: string;
  private serviceName: string;
  private bestBidPrice: number;
  private bestAskPrice: number;

  private reconnectInterval = 1000; // Reconnect interval initial value. Reconnection will be attempted when the server closes the connection
  private lastReceiveTimeUnixTimestamp: number;

  private intentionalWebsocketTermination: boolean = false;
  private static instance: IMarketDataSource | null = null;

  private constructor(wsURL: string) {
    this.wsURL = wsURL;
    this.bestBidPrice = 0.0;
    this.bestAskPrice = 0.0;
    this.midPrice = 0.0;
    this.serviceName = "Huobi Market Data: ";
    this.lastReceiveTimeUnixTimestamp = 0;

    this.initialize();
  }

  static create(wsURL: string = "wss://api.huobi.pro/ws"): IMarketDataSource {
    if (HuobiMarketData.instance == null) {
      HuobiMarketData.instance = new HuobiMarketData(wsURL);
    }
    return HuobiMarketData.instance;
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
        sub: ["market.btcusdt.bbo"], // This channel streams best bid and ask price for btcusdt pair in real time.
        // See:- https://www.htx.com/en-us/opend/newApiPages/?id=7ec5333f-7773-11ed-9966-0242ac110003
        id: "id1",
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

    this.socket.on("message", (data: Buffer) => {
      // Huobi compresses messages with GZIP, so we need to decompress them
      zlib.gunzip(data, (err, decompressed) => {
        if (err) {
          console.error(this.serviceName + "Decompression error: ", err);
          return;
        }

        const message = JSON.parse(decompressed.toString());

        // Handle heartbeat (ping-pong mechanism)
        if (message.ping) {
          console.log(this.serviceName + "Received PING: ", message.ping);
          this.socket?.send(JSON.stringify({ pong: message.ping }));
          console.log(this.serviceName + "Sent PONG: ", message.ping);
        }
        // Handle market ticker update
        else if (message.tick) {
          const marketData: HuobiMarketDataResponse = message;
          const marketDataBTCUSDPair = marketData.tick;

          this.bestBidPrice = marketDataBTCUSDPair.bid;
          this.bestAskPrice = marketDataBTCUSDPair.ask;

          this.midPrice = (this.bestAskPrice + this.bestBidPrice) / 2;
          this.lastReceiveTimeUnixTimestamp = marketData.ts;
        }
        // Handle subscription confirmation
        else if (message.subbed) {
          console.log("Subscribed successfully:", message.subbed);
        }
      });
    });

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
      marketDataSource: "Huobi",
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
