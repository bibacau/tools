/** Build-time native mode never sends local account credentials to a server. */
export const nativeApp = import.meta.env.VITE_NATIVE === "true";
let unlocked = false;
type Verifier = { salt: string; hash: string };
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function verifier(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new TextEncoder().encode(salt),
        iterations: 250000,
      },
      key,
      256,
    ),
  );
}
function account(): Verifier | null {
  const value = localStorage.getItem("native-account");
  return value ? JSON.parse(value) : null;
}
export async function appFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  if (!nativeApp) return fetch(input, init);
  const reply = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (input === "/api/auth" && !init?.method)
    return reply({ setup: !account(), authenticated: unlocked });
  if (input === "/api/auth" && init?.method === "POST") {
    const { password } = JSON.parse(String(init.body || "{}"));
    if (typeof password !== "string")
      return reply({ error: "Enter your password" }, 400);
    const old = account();
    if (old) {
      if ((await verifier(password, old.salt)) !== old.hash)
        return reply({ error: "Incorrect password" }, 401);
    } else {
      if (!/^[A-Za-z0-9]{8,200}$/.test(password))
        return reply({ error: "Use at least 8 letters or numbers only." }, 400);
      const salt = hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
      localStorage.setItem(
        "native-account",
        JSON.stringify({ salt, hash: await verifier(password, salt) }),
      );
    }
    unlocked = true;
    return reply({ ok: true });
  }
  if (input === "/api/logout") {
    unlocked = false;
    localStorage.removeItem("authorized");
    return reply({ ok: true });
  }
  if (input === "/api/password" && init?.method === "POST") {
    if (!unlocked) return reply({ error: "Unlock the app first" }, 401);
    const { currentPassword, newPassword } = JSON.parse(
      String(init.body || "{}"),
    );
    const old = account();
    if (
      !old ||
      typeof currentPassword !== "string" ||
      (await verifier(currentPassword, old.salt)) !== old.hash
    )
      return reply({ error: "Incorrect current password" }, 401);
    if (
      typeof newPassword !== "string" ||
      !/^[A-Za-z0-9]{8,200}$/.test(newPassword)
    )
      return reply({ error: "Use at least 8 letters or numbers only." }, 400);
    const salt = hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
    localStorage.setItem(
      "native-account",
      JSON.stringify({ salt, hash: await verifier(newPassword, salt) }),
    );
    return reply({ ok: true });
  }
  if (input === "/api/speech")
    return reply(
      {
        available: false,
        error:
          "The standalone APK does not include the optional speech server.",
      },
      init?.method === "POST" ? 503 : 200,
    );
  return reply(
    {
      error:
        "Standalone APK: data is saved on this device. Server sync is not configured.",
    },
    503,
  );
}
