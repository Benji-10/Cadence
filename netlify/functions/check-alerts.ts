import { PrismaClient } from "@prisma/client";
import { runAlertCheck } from "../../src/lib/alert-checker";

const db = new PrismaClient();

export const handler = async () => {
  const result = await runAlertCheck({ db });
  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
};
