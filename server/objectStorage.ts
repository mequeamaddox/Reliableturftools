import { Storage } from "@google-cloud/storage";
import path from "path";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;

const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  } as any,
  projectId: "",
});

async function signObjectURL({
  objectName,
  method,
  ttlSec,
}: {
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: BUCKET_ID,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to sign object URL: ${response.status}`);
  }
  const { signed_url } = await response.json();
  return signed_url;
}

export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const objectName = `public/uploads/${filename}`;
  const signedUrl = await signObjectURL({
    objectName,
    method: "PUT",
    ttlSec: 900,
  });
  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    body: buffer,
    headers: { "Content-Type": contentType },
  });
  if (!uploadRes.ok) {
    throw new Error(`GCS upload failed: ${uploadRes.status}`);
  }
  return `/uploads/${filename}`;
}

export async function getFileStream(filename: string) {
  const objectName = `public/uploads/${filename}`;
  const file = objectStorageClient.bucket(BUCKET_ID).file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;
  return file.createReadStream();
}
