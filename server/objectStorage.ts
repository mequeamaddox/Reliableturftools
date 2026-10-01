import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";

// Railway Storage Bucket (S3-compatible). Credentials come from the
// AWS_* / S3_BUCKET variables on the Railway service.
const BUCKET = process.env.S3_BUCKET!;

const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  region: process.env.AWS_REGION || "auto",
});

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string): Promise<Readable | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return (res.Body as Readable) ?? null;
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  await putObject(`public/uploads/${filename}`, buffer, contentType);
  return `/uploads/${filename}`;
}

export async function getFileStream(filename: string) {
  return getObject(`public/uploads/${filename}`);
}
