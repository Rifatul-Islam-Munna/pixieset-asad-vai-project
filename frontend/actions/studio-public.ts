"use server";

import { apiBaseUrl } from "@/lib/api-base-url";
import { fetchBackendJson } from "@/lib/backend-request";

export async function submitPublicStudioForm(token: string, body: Record<string, unknown>) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return { ok: false, message: "Invalid form link" };
  try {
    await fetchBackendJson(apiBaseUrl() + "/public/studio/forms/" + encodeURIComponent(token) + "/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Form submission failed" };
  }
}

export async function signPublicStudioContract(token: string, signerName: string, accept: boolean,
  signature?: {kind:"typed";name:string}|{kind:"drawn";strokes:number[][][]}|{kind:"image";url:string}) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return { ok: false, message: "Invalid contract link" };
  try {
    await fetchBackendJson(apiBaseUrl() + "/public/studio/contracts/" + encodeURIComponent(token) + "/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signerName, accept, signature }),
      cache: "no-store",
    });
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not sign contract" };
  }
}

export async function submitPublicStudioQuestionnaire(token: string, responses: Record<string, string>) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return { ok: false, message: "Invalid questionnaire link" };
  try {
    await fetchBackendJson(apiBaseUrl() + "/public/studio/questionnaires/" + encodeURIComponent(token) + "/submit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ responses }), cache: "no-store",
    });
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not submit questionnaire" };
  }
}

export async function acceptPublicStudioQuote(
  token: string, signerName: string, accept: boolean,
  selections: Record<string,string|string[]> = {},
) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return { ok: false, message: "Invalid quote link" };
  try {
    await fetchBackendJson(apiBaseUrl() + "/public/studio/quotes/" + encodeURIComponent(token) + "/accept", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ signerName, accept, selections }), cache: "no-store",
    });
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not accept quote" };
  }
}
