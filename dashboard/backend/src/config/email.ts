import nodemailer from "nodemailer";

const GERENTE_EMAIL = process.env.GERENTE_EMAIL ?? "gerente@verdeecologico.com.co";

// Si no hay SMTP configurado (.env), no se envía correo de verdad — solo se deja constancia
// en consola. Así el dashboard funciona en desarrollo sin credenciales de correo reales.
const smtpConfigurado = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigurado
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_PORT === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

export async function notificarGerente(asunto: string, cuerpo: string) {
  if (!transporter) {
    console.log(`[email simulado] Para: ${GERENTE_EMAIL} · Asunto: ${asunto}\n${cuerpo}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: GERENTE_EMAIL,
    subject: asunto,
    text: cuerpo,
  });
}
