import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "./server/routers";
import superjson from "superjson";

const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api/trpc",
    }),
  ],
});

async function run() {
  try {
    const res = await client.auth.register.mutate({
      name: "ruur",
      email: "ruu@gmail.com",
      password: "password",
      role: "rescuer",
      governmentCode: "2222",
    });
    console.log("Success:", res);
  } catch (err: any) {
    console.log("Error:", err.message);
    console.log("Stack:", err.stack);
  }
}

run();
