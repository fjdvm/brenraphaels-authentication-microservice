export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { resumePendingDeliveries } = await import("./lib/account-requests/delivery.server");
    await resumePendingDeliveries();
  }
}
