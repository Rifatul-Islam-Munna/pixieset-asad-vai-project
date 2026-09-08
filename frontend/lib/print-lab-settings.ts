export type PrintLabSettings = {
  printLabEmail: string;
  printRequestsEnabled?: boolean;
  freePrintSizes?: string[];
  freePrintPapers?: string[];
  notifyPrintLabForFreeRequests: boolean;
  notifyPrintLabForPaidOrders: boolean;
};

export function validatePrintLabSettings(value: PrintLabSettings): string {
  if (value.printRequestsEnabled && !value.freePrintSizes?.length) return "Add at least one print size.";
  if (value.printRequestsEnabled && !value.freePrintPapers?.length) return "Add at least one paper type.";
  if (
    (value.notifyPrintLabForFreeRequests || value.notifyPrintLabForPaidOrders) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.printLabEmail.trim())
  ) {
    return "Enter a valid print-company email before enabling notifications.";
  }

  return "";
}
