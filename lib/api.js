import { fetch as expoFetch } from "expo/fetch";
import { File, Paths, UploadType } from "expo-file-system";
import { getFirebaseAuth } from "../firebase/client";

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://erp.suvacorp.com.np").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(code, messageKey, fieldErrors, formError) {
    super(code);
    this.code = code;
    this.messageKey = messageKey;
    this.fieldErrors = fieldErrors;
    this.formError = formError;
  }
}

/**
 * Thin fetch wrapper for starterkit's bearer-token API
 * (shared/auth/guards.ts's requireApiUser). Every call re-reads
 * getIdToken() rather than caching one — the Firebase SDK auto-refreshes
 * the token in the background, so this always sends a fresh one, the same
 * way the web app's httpOnly session cookie is implicitly "fresh" on every
 * request.
 *
 * Two different failure envelopes exist in the API and both are handled
 * here: the auth-guard envelope `{ok:false, error:{code, messageKey}}`
 * (every route uses this for 401s), and the raw service-result shape a
 * create/update route returns unwrapped on validation failure —
 * `{ok:false, fieldErrors}` or `{ok:false, formError}` (e.g.
 * createSalesInvoice/createItem's own return value, passed straight
 * through by the route). A caller building a form checks `err.fieldErrors`/
 * `err.formError` first, falling back to `err.messageKey`.
 */
export async function apiFetch(path, options = {}) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError("not_authenticated", "auth.sessionExpired");
  }
  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.ok) {
    const code = json?.error?.code ?? "request_failed";
    // Generic transport/server failures are NOT sign-in failures — falling
    // back to auth.errSignInFailed told the user "Sign-in failed" for a
    // dropped network on the dashboard or a 500 while saving an invoice.
    // Real auth failures still carry their own messageKey from the server
    // (auth.sessionExpired etc.), which takes precedence above.
    const messageKey = json?.error?.messageKey ?? "common.somethingWentWrong";
    const fieldErrors = json?.error?.fieldErrors ?? json?.fieldErrors;
    const formError = json?.formError;
    throw new ApiError(code, messageKey, fieldErrors, formError);
  }

  // `raw` returns the whole success envelope instead of unwrapping `.data`.
  // Not every route wraps its payload: the shared (desktop) create routes
  // return their service result verbatim, e.g. POST /api/parties answers
  // `{ ok: true, id }` from createParty() with no `data` key at all — so the
  // default unwrap hands back undefined and the caller cannot see the new id.
  return options.raw ? json : json.data;
}

/**
 * Multipart counterpart used for scan-to-entry. Same Firebase bearer-token
 * and error-envelope handling as apiFetch, uploading one local file plus a
 * few plain string fields.
 *
 * Deliberately NOT `fetch()` + FormData. Since Expo SDK 54 the winter
 * runtime (expo/src/winter/runtime.native.ts) REPLACES globalThis.fetch
 * with expo/fetch unless EXPO_PUBLIC_USE_RN_FETCH=1, and expo/fetch's
 * multipart serializer (expo/src/winter/fetch/convertFormData.ts) handles
 * only strings, Blobs, and objects exposing bytes() — a React Native
 * `{ uri, name, type }` file part makes it throw "Unsupported
 * FormDataPart implementation" before the request is ever sent. That is
 * what silently broke every scan upload: the POST never reached the API,
 * so no scan_documents row was ever created and the screen only ever
 * showed the generic error. expo-file-system's native multipart upload is
 * the supported path and streams the file instead of buffering it in JS.
 *
 * `fields` values must be strings — they become multipart form parameters,
 * read on the server by request.formData() exactly as before.
 */
export async function apiUpload(path, { uri, mimeType, fields = {} }) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new ApiError("not_authenticated", "auth.sessionExpired");
  const token = await user.getIdToken();

  const result = await new File(uri).upload(`${API_BASE_URL}${path}`, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    parameters: fields,
    headers: { Authorization: `Bearer ${token}` },
  });

  let json = null;
  try {
    json = JSON.parse(result.body);
  } catch {
    json = null;
  }
  if (result.status < 200 || result.status >= 300 || !json?.ok) {
    throw new ApiError(json?.error?.code ?? "request_failed", json?.error?.messageKey ?? "common.somethingWentWrong", json?.error?.fieldErrors ?? json?.fieldErrors, json?.formError);
  }
  return json.data;
}

/**
 * Downloads a document's PDF (server-rendered from the exact same print
 * template desktop uses — see starterkit's app/api/mobile/sales-invoices/
 * [id]/pdf/route.ts) into the app's cache directory and returns the local
 * file:// uri, ready for expo-sharing's shareAsync(). Uses `expo/fetch`
 * directly rather than apiFetch() — apiFetch always parses the response as
 * JSON, which would corrupt binary PDF bytes.
 */
export async function downloadDocumentPdf(path, fileName) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError("not_authenticated", "auth.sessionExpired");
  }
  const token = await user.getIdToken();

  const response = await expoFetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    // Keep the server's code (e.g. 503 pdf_generation_failed when the
    // server-side Chrome can't start) so callers can report the real cause.
    const json = await response.json().catch(() => null);
    throw new ApiError(json?.error?.code ?? `http_${response.status}`, json?.error?.messageKey ?? "common.somethingWentWrong");
  }

  // Document numbers carry user-configured prefixes, so "SI/2083-84/0001" is
  // possible; a "/" would make the cache path point into a folder that doesn't
  // exist and the write would throw before the share sheet ever opened.
  const safeFileName = String(fileName).replace(/[^A-Za-z0-9._-]+/g, "-");
  const file = new File(Paths.cache, safeFileName);
  if (file.exists) file.delete();
  file.write(await response.bytes());
  return file.uri;
}
