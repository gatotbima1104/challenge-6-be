import express, { Application, Request, Response, NextFunction } from "express";
import { PORT } from "./config";
import cors from "cors";
import { scheduleRouter } from "./routes/schedule.router";


export class App {

    private app: Application

    constructor() {
        this.app = express();
        this.configure();
        this.routes();
        this.handleError();
    }

    // Public getter to access the app instance
    public get instance(): Application {
        return this.app;
    }

    // configuration express
    private configure() {
        this.app.use(express.json());
        // this.app.use(express.urlencoded({extended: true}));
        this.app.use(
            cors({ 
                origin: "*",
                methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
                allowedHeaders: "Content-Type,Authorization",
            })
        );
    }

    // routes configuration
    private routes() {
        this.app.use("/", scheduleRouter());
    }

  // handler configuration
  private handleError() {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.status(404).send("Not Found !");
    });

    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).send({
          message: err.message,
        });
      }
    );
  }

  // start func
  start() {
    this.app.listen(PORT, () => {
      console.log(`Server running on PORT ${PORT}`);
    });
  }
}

// ✅ ADD THIS:
export function buildApp(): Application {
  return new App().instance;
}