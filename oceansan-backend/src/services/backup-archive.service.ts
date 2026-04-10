import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

const ARCHIVE_MAGIC = Buffer.from("OSB1");
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function toPowerShellLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function runPowerShell(command: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell",
      ["-NoProfile", "-Command", command],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
    });
  });
}

async function createZipArchive(sourceDir: string, destinationFile: string) {
  const command = [
    `$src = ${toPowerShellLiteral(sourceDir)}`,
    `$dest = ${toPowerShellLiteral(destinationFile)}`,
    "Compress-Archive -Path (Join-Path $src '*') -DestinationPath $dest -Force",
  ].join("; ");

  await runPowerShell(command);
}

async function encryptArchive(sourceFile: string, destinationFile: string, password: string) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 32, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey as Buffer);
    });
  });

  await new Promise<void>((resolve, reject) => {
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const input = fs.createReadStream(sourceFile);
    const output = fs.createWriteStream(destinationFile);

    output.write(ARCHIVE_MAGIC);
    output.write(salt);
    output.write(iv);

    input.on("error", reject);
    output.on("error", reject);
    cipher.on("error", reject);

    input.pipe(cipher).pipe(output, { end: false });

    cipher.on("end", () => {
      try {
        output.write(cipher.getAuthTag());
        output.end();
      } catch (error) {
        reject(error);
      }
    });

    output.on("close", () => resolve());
  });
}

export async function createEncryptedArchiveForUpload(sourceDir: string, password: string) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "oceansan-backup-"));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = path.basename(path.resolve(sourceDir)) || "backup";
  const zipFile = path.join(tempDir, `${baseName}-${timestamp}.zip`);
  const encryptedFile = `${zipFile}.enc`;

  try {
    await createZipArchive(sourceDir, zipFile);
    await encryptArchive(zipFile, encryptedFile, password);

    return {
      tempDir,
      filePath: encryptedFile,
      fileName: path.basename(encryptedFile),
      cloudPath: `archives/${path.basename(encryptedFile)}`,
    };
  } catch (error) {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function cleanupArchiveUpload(tempDir: string) {
  await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
}
