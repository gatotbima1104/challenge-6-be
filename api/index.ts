import serverless from "serverless-http";
import { buildApp } from "../src/app";

const app = buildApp();

export default serverless(app);   // ✅ export handler, don’t call listen()