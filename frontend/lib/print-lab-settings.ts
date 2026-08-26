export type PrintLabSettings = {
  printLabEmail: string;
  notifyPrintLabForFreeRequests: boolean;
  notifyPrintLabForPaidOrders: boolean;
};

export function validatePrintLabSettings(value: PrintLabSettings): string {
  if (
    (value.notifyPrintLabForFreeRequests || value.notifyPrintLabForPaidOrders) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.printLabEmail.trim())
  ) {
    return "Enter a valid print-company email before enabling notifications.";
  }

  return "";
}
