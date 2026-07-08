# Mobile Gallery Type Verification

Generated from the development branch by GitHub Actions.

- Mobile Gallery TypeScript errors: NONE FOUND
- Full frontend TypeScript check: FAIL (the repository may contain unrelated existing type errors)

## Mobile Gallery matching errors
```text
No mobile-gallery errors found.
```

## Full TypeScript log tail
```text
actions/auth.ts(94,49): error TS2339: Property 'userData' does not exist on type '{}'.
actions/auth.ts(109,49): error TS2339: Property 'data' does not exist on type '{}'.
actions/auth.ts(110,45): error TS2339: Property 'access_token' does not exist on type '{}'.
api-hooks/api-hooks.ts(22,45): error TS2339: Property 'statusCode' does not exist on type '{}'.
api-hooks/use-api-mutation.ts(36,73): error TS2345: Argument of type 'TVariables' is not assignable to parameter of type 'TData'.
  'TData' could be instantiated with an arbitrary type which could be unrelated to 'TVariables'.
app/api/public-download/route.ts(77,27): error TS2345: Argument of type 'Uint8Array<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit | null | undefined'.
  Type 'Uint8Array<ArrayBufferLike>' is missing the following properties from type 'URLSearchParams': size, append, delete, get, and 2 more.
app/dashboard/[section]/[page]/page.tsx(40,27): error TS2322: Type 'string' is not assignable to type 'DashboardSection'.
app/dashboard/[section]/[page]/page.tsx(40,45): error TS2322: Type 'string' is not assignable to type 'DashboardPage'.
app/manifest.webmanifest/route.ts(11,56): error TS2339: Property 'nav' does not exist on type 'Record<HomeLanguage, HomeContent>'.
components/dashboard/client-dashboard.tsx(1049,32): error TS2339: Property 'collectionId' does not exist on type 'StoreOrderRecord'.
components/dashboard/client-dashboard.tsx(1049,71): error TS2339: Property 'collectionId' does not exist on type 'StoreOrderRecord'.
components/dashboard/client-dashboard.tsx(5501,13): error TS2345: Argument of type '(current: StoreSettingsRecord) => { paymentMethods: { stripe: { enabled?: boolean | undefined; publishableKey?: string | undefined; secretKey?: string | undefined; accountLink?: string | undefined; }; }; ... 10 more ...; digitalImageLicense: string; }' is not assignable to parameter of type 'SetStateAction<StoreSettingsRecord>'.
  Type '(current: StoreSettingsRecord) => { paymentMethods: { stripe: { enabled?: boolean | undefined; publishableKey?: string | undefined; secretKey?: string | undefined; accountLink?: string | undefined; }; }; ... 10 more ...; digitalImageLicense: string; }' is not assignable to type '(prevState: StoreSettingsRecord) => StoreSettingsRecord'.
    Call signature return types '{ paymentMethods: { stripe: { enabled?: boolean | undefined; publishableKey?: string | undefined; secretKey?: string | undefined; accountLink?: string | undefined; }; }; _id?: string | undefined; ... 9 more ...; digitalImageLicense: string; }' and 'StoreSettingsRecord' are incompatible.
      The types of 'paymentMethods.stripe.enabled' are incompatible between these types.
        Type 'boolean | undefined' is not assignable to type 'boolean'.
          Type 'undefined' is not assignable to type 'boolean'.
components/dashboard/client-dashboard.tsx(5939,42): error TS2304: Cannot find name 'StorePriceSheetRecord'.
components/dashboard/client-dashboard.tsx(5944,11): error TS2304: Cannot find name 'StorePriceSheetRecord'.
components/dashboard/client-dashboard.tsx(5945,26): error TS2304: Cannot find name 'StorePriceSheetRecord'.
components/dashboard/client-dashboard.tsx(5949,33): error TS2304: Cannot find name 'StorePriceSheetRecord'.
components/dashboard/client-dashboard.tsx(5981,31): error TS2304: Cannot find name 'StorePriceSheetRecord'.
components/dashboard/client-dashboard.tsx(6158,31): error TS2304: Cannot find name 'StorePriceSheetRecord'.
components/dashboard/client-dashboard.tsx(6163,69): error TS7006: Parameter 'item' implicitly has an 'any' type.
components/dashboard/client-dashboard.tsx(6167,37): error TS7006: Parameter 'item' implicitly has an 'any' type.
components/dashboard/client-dashboard.tsx(6252,50): error TS2304: Cannot find name 'StorePriceSheetRecord'.
components/dashboard/client-dashboard.tsx(8130,66): error TS2339: Property 'collectionId' does not exist on type 'StoreOrderRecord'.
components/dashboard/public-gallery.tsx(152,29): error TS2339: Property 'showPrintStoreNav' does not exist on type 'PresetStoreSettings'.
components/dashboard/public-gallery.tsx(171,124): error TS2339: Property 'originalName' does not exist on type '{ _id: string; url: string; }'.
components/dashboard/public-gallery.tsx(315,28): error TS2339: Property 'originalName' does not exist on type '{ _id: string; url: string; }'.
components/dashboard/public-gallery.tsx(332,23): error TS2339: Property 'originalName' does not exist on type '{ _id: string; url: string; }'.
components/dashboard/public-gallery.tsx(975,33): error TS2339: Property 'originalName' does not exist on type '{ _id: string; url: string; }'.
components/ui/calendar.tsx(90,9): error TS2353: Object literal may only specify known properties, and 'table' does not exist in type 'Partial<ClassNames>'.
next.config.ts(7,3): error TS2353: Object literal may only specify known properties, and 'skipWaiting' does not exist in type 'PluginOptions'.
```
