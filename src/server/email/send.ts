import { connect as tlsConnect } from "node:tls";
import { createConnection } from "node:net";
import { db } from "@/server/db";

export type OutboundEmail = { to: string; subject: string; text: string };

export async function sendEmail(message: OutboundEmail) {
  const capture = process.env.EMAIL_CAPTURE === "true" || process.env.NODE_ENV !== "production";
  if (capture) {
    await db()`
      INSERT INTO email_messages (to_email, subject, body)
      VALUES (${message.to}, ${message.subject}, ${message.text})
    `;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n----- email to ${message.to} | ${message.subject} -----\n${message.text}\n----- end email -----\n`);
  }
  if (!process.env.SMTP_HOST) return;
  await sendSmtp(message);
}

async function sendSmtp(message: OutboundEmail) {
  const host = process.env.SMTP_HOST ?? "127.0.0.1";
  const port = Number(process.env.SMTP_PORT || 1025);
  const secure = process.env.SMTP_SECURE === "true";
  const from = process.env.EMAIL_FROM || "Meme Market <noreply@localhost>";
  const socket = secure
    ? tlsConnect({ host, port, servername: host })
    : createConnection({ host, port });
  socket.setEncoding("utf8");

  let buffer = "";
  const wait = () =>
    new Promise<string>((resolve, reject) => {
      const onData = (chunk: string) => {
        buffer += chunk;
        if (buffer.includes("\n")) {
          const text = buffer;
          buffer = "";
          socket.off("data", onData);
          resolve(text);
        }
      };
      socket.on("data", onData);
      socket.once("error", reject);
    });

  const command = async (line: string) => {
    socket.write(`${line}\r\n`);
    return wait();
  };

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("error", reject);
  });
  await wait();
  await command(`EHLO meme-market`);
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    await command("AUTH LOGIN");
    await command(Buffer.from(process.env.SMTP_USER).toString("base64"));
    await command(Buffer.from(process.env.SMTP_PASS).toString("base64"));
  }
  await command(`MAIL FROM:<${fromAddress(from)}>`);
  await command(`RCPT TO:<${message.to}>`);
  await command("DATA");
  const body = [
    `From: ${from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    message.text.replace(/^\./gm, ".."),
    ".",
  ].join("\r\n");
  socket.write(`${body}\r\n`);
  await wait();
  await command("QUIT");
  socket.end();
}

function fromAddress(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  return match?.[1] ?? from;
}
