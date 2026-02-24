import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import type { IRawStore } from "./interfaces.js";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("rustfs");

export class RustfsRawStore implements IRawStore {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = config.rustfsBucket;
    this.client = new S3Client({
      endpoint: config.rustfsEndpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: config.rustfsAccessKey,
        secretAccessKey: config.rustfsSecretKey,
      },
      forcePathStyle: true,
    });
  }

  async ensureBucket(bucket?: string): Promise<void> {
    const bucketName = bucket || this.bucket;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
      logger.info("RustFS bucket exists", { bucket: bucketName });
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
        logger.info("RustFS bucket created", { bucket: bucketName });
      } catch (createError) {
        // Bucket may have been created concurrently
        if (!String(createError).includes("BucketAlreadyOwnedByYou")) {
          throw createError;
        }
      }
    }
  }

  async upload(key: string, content: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      }),
    );

    const path = `s3://${this.bucket}/${key}`;
    logger.info("Uploaded to RustFS", { path, size: content.length });
    return path;
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const stream = response.Body;
    if (!stream) {
      throw new Error(`Empty response for key: ${key}`);
    }

    const chunks: Uint8Array[] = [];
    // @ts-expect-error - stream is AsyncIterable in Node/Bun
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    logger.info("Deleted from RustFS", { key });
  }
}
