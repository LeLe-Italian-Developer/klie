import { importSPKI, jwtVerify } from "jose";
import { invoke } from "@tauri-apps/api/core";

export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq1C14de3FPMUiFbMfN7Q
OGvp2P/yQbhFlh+1RuB81jhsN+vVS5P72LUxmPEa12Mt714ZhgJZT6X7LmCof/e4
SxOpZs9ewnV3IHrFHisai814veWXCHxJBO0FNgGUirURByEZjA1D1pt10pT7uSlX
AuusWHI21IoqDq9dZ6zezBaIJS0ZqcUP/IROC9U5OpxAEoqPMb1vdTZ23vOo5p21
nD1P5Xio2XL/SQYdKbXqxiLq49MFPLlZru3iusYjdL84PY4Ox5Qd+197EdjorIj7
69Zi2Zqih7+QW8JT0qSCNLT0qDhGzBFxowcGaSd70+RaLBB7/PW5SMd08WdbQnQ6
2QIDAQAB
-----END PUBLIC KEY-----`;

export interface OfflineLicensePayload {
  sub: string;
  email: string;
  hardwareId: string;
  plan: string;
  exp?: number;
}

/**
 * Legge il JWT dallo storage locale e lo verifica matematicamente
 * usando la Chiave Pubblica RS256 e confrontando l'ID Hardware attuale del PC.
 * L'app non esegue richieste di rete se il token locale è integro e non scaduto.
 */
export async function verifyOfflineLicenseJWT(): Promise<{ isValid: boolean; payload?: OfflineLicensePayload; error?: string }> {
  try {
    const token = localStorage.getItem("klie.offlineLicenseJWT");
    if (!token) {
      return { isValid: false, error: "Nessun token di licenza offline trovato" };
    }

    // 1. Importa la Chiave Pubblica
    const publicKey = await importSPKI(PUBLIC_KEY_PEM, "RS256");

    // 2. Verifica la firma crittografica e la scadenza (exp)
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
    });

    const licensePayload = payload as unknown as OfflineLicensePayload;

    // 3. Verifica l'Hardware ID attuale del PC per evitare che la licenza venga copiata su un altro PC
    let currentHardwareId = "fallback-hw-id";
    try {
      const integrity: any = await invoke("check_app_integrity");
      if (integrity && integrity.hardwareId) {
        currentHardwareId = integrity.hardwareId;
      }
    } catch (err) {
      console.warn("Impossibile recuperare hardwareId da Tauri, uso fallback", err);
    }

    if (licensePayload.hardwareId && licensePayload.hardwareId !== currentHardwareId && currentHardwareId !== "fallback-hw-id") {
      return { isValid: false, error: "Violazione di licenza: ID Hardware non corrispondente (Licenza clonata/craccata)" };
    }

    return { isValid: true, payload: licensePayload };
  } catch (error: any) {
    console.error("Verifica licenza offline fallita:", error);
    return { isValid: false, error: error?.message || "Token scaduto o corrotto" };
  }
}
