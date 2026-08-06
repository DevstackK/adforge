import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

let instance: S3Client | undefined;
function s3() {
  const config = env();
  return (instance ??= new S3Client({
    region: config.AWS_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials:
      config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: config.S3_ACCESS_KEY_ID,
            secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  }));
}

export async function createUploadUrl(
  key: string,
  contentType: string,
  bytes: number,
) {
  const command = new PutObjectCommand({
    Bucket: env().S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: bytes,
    Metadata: { uploadedBy: "adforge" },
  });
  return getSignedUrl(s3(), command, { expiresIn: 300 });
}

export async function createDownloadUrl(key: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }),
    { expiresIn: 900 },
  );
}

export async function putObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await s3().send(
    new PutObjectCommand({
      Bucket: env().S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function getObjectBytes(key: string) {
  const response = await s3().send(
    new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }),
  );
  if (!response.Body) throw new Error("Stored object has no body");
  return response.Body.transformToByteArray();
}

export async function inspectObject(key: string) {
  return s3().send(
    new HeadObjectCommand({ Bucket: env().S3_BUCKET, Key: key }),
  );
}

export async function deleteObject(key: string) {
  await s3().send(
    new DeleteObjectCommand({ Bucket: env().S3_BUCKET, Key: key }),
  );
}
