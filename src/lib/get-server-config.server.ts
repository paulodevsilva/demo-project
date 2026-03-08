import { createServerFn } from "@tanstack/react-start";
import { appConfig } from "./config.server";
import { withObservation } from "./observability.server";

export const getServerConfigServerFn = createServerFn().handler(async () => {
  return withObservation("config.getServerConfig", async () => {
    return appConfig;
  });
});
