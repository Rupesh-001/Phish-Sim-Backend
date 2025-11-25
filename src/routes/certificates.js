// backend/src/routes/certificates.js
import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { nanoid } from "nanoid";
import { ObjectId } from "mongodb";
import QRCode from "qrcode";
import { requireAuth } from "./auth.js"; // adjust path if needed

const router = express.Router();

const CERTS_DIR = path.join(process.cwd(), "public", "certificates");

// Level thresholds (customize)
const LEVELS = [
  { key: "Beginner", min: 0 },
  { key: "Intermediate", min: 200 },
  { key: "Advanced", min: 600 },
];

async function ensureCertsDir() {
  await fsp.mkdir(CERTS_DIR, { recursive: true });
}

// GET user's certificates
router.get("/me", requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = new ObjectId(req.user.id);
    const user = await db.collection("users").findOne({ _id: userId }, { projection: { certificates: 1 } });
    res.json({ certificates: user?.certificates || [] });
  } catch (err) {
    console.error("Certificates fetch error:", err);
    res.status(500).json({ error: "Failed to load certificates" });
  }
});

// POST generate certificate (no templates, drawn programmatically)
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = new ObjectId(req.user.id);
    const user = await db.collection("users").findOne({ _id: userId });

    if (!user) return res.status(404).json({ error: "User not found" });

    const points = user.points || 0;
    // determine level
    let level = LEVELS[0].key;
    for (const L of LEVELS) if (points >= L.min) level = L.key;

    // policy: require at least Intermediate
    if (level === "Beginner") {
      return res.status(403).json({ error: "Not enough points to generate certificate" });
    }

    await ensureCertsDir();

    const filename = `certificate-${userId.toString()}-${nanoid(6)}.pdf`;
    const filepath = path.join(CERTS_DIR, filename);

    // A4 size PDF
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;

    // Background: dark rectangle
    doc.rect(0, 0, W, H).fill("#071118"); // deep dark blue/green

    // Soft large vignette: draw semi-transparent rectangles to simulate subtle gradient
    doc.save();
    doc.opacity(0.06).rect(0, 0, W, H * 0.5).fill("#003228");
    doc.opacity(0.06).rect(0, H * 0.5, W, H * 0.5).fill("#000000");
    doc.restore();
    doc.opacity(1);

    // Neon frame - outer border lines
    const pad = 36;
    doc.save();
    doc.lineWidth(2);
    doc.strokeColor("#00ff8a"); // neon green-ish
    // draw a thin rounded rectangle frame
    drawRoundedRect(doc, pad, pad, W - pad * 2, H - pad * 2, 8);
    doc.stroke();
    doc.restore();

    // Decorative top-left "circuit" accent (simple lines)
    doc.save();
    doc.strokeColor("#0af07a");
    doc.lineWidth(1.2);
    doc.moveTo(pad + 12, pad + 18).lineTo(pad + 120, pad + 18).stroke();
    doc.moveTo(pad + 12, pad + 28).lineTo(pad + 120, pad + 28).dash(4, { space: 4 }).stroke();
    doc.undash();
    doc.restore();

    // Header: CERTIFICATE OF COMPLETION
    doc.fontSize(28).fillColor("#00ff8a").font("Helvetica-Bold");
    doc.text("CERTIFICATE OF COMPLETION", 0, pad + 36, { align: "center" });

    // Subtitle
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor("#bfeed8").font("Helvetica");
    doc.text("This certifies that", { align: "center" });

    // Recipient name - bold large
    const recipientName = (user.name || user.email || "NAME HERE").toUpperCase();
    doc.moveDown(0.6);
    doc.fontSize(40).fillColor("#ffffff").font("Helvetica-Bold");
    doc.text(recipientName, { align: "center", characterSpacing: 1, lineGap: 2 });

    // small separator line
    const sepY = doc.y + 8;
    doc.save();
    doc.strokeColor("#0a7a4d");
    doc.lineWidth(1);
    doc.moveTo(pad + 40, sepY).lineTo(W - pad - 40, sepY).stroke();
    doc.restore();

    // Achievement text
    doc.moveDown(1.2);
    doc.fontSize(16).fillColor("#dfffe8").font("Helvetica");
    doc.text("has achieved the level:", { align: "center" });

    // Level badge (rounded pill)
    const badgeText = level.toUpperCase();
    const badgeWidth = doc.widthOfString(badgeText, { font: "Helvetica-Bold", size: 14 }) + 28;
    const badgeHeight = 26;
    const badgeX = (W - badgeWidth) / 2;
    const badgeY = doc.y + 8;

    // badge background
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2).fill("#00ff8a");
    // badge text
    doc.fillColor("#00140a").font("Helvetica-Bold").fontSize(12).text(badgeText, badgeX, badgeY + 6, {
      width: badgeWidth,
      align: "center",
    });

    // Move cursor below badge
    doc.y = badgeY + badgeHeight + 18;

    // Issued and issuer area (left: issued date; right: issuer)
    const issuedText = `Issued: ${new Date().toLocaleDateString()}`;
    const issuerName = process.env.CERT_ISSUER_NAME || "BreachBlockers";

    // Left column
    const leftX = pad + 60;
    const rightX = W - pad - 260;
    doc.fontSize(12).fillColor("#cfeed7").font("Helvetica");
    doc.text(issuedText, leftX, doc.y, { width: 300, align: "left" });

    // Right column
    doc.text(`Issuer: ${issuerName}`, rightX, doc.y, { width: 300, align: "right" });

    // Signature line (left) and role (left below)
    const sigLineY = doc.y + 42;
    doc.save();
    doc.strokeColor("#0a8f53");
    doc.lineWidth(0.8);
    doc.moveTo(leftX, sigLineY).lineTo(leftX + 180, sigLineY).stroke();
    doc.restore();

    doc.fontSize(10).fillColor("#bfeec9").text("Authorized Signature", leftX, sigLineY + 6);

    // Small verification instructions near bottom-left
    doc.fontSize(9).fillColor("#9fdcb6");
    doc.text("Scan the QR code to verify this certificate.", leftX, H - pad - 110, { width: 320 });

    // Generate QR pointing to public certificate URL
    const certPublicPath = `/certificates/${filename}`;
    const APP_BASE = process.env.APP_BASE_URL || "";
    const certificateUrl = `${APP_BASE}${certPublicPath}`;

    try {
      const qrDataUrl = await QRCode.toDataURL(certificateUrl, { margin: 0, width: 240 });
      const base64 = qrDataUrl.split(",")[1];
      const qrBuffer = Buffer.from(base64, "base64");

      // place QR at bottom-right
      const qrSize = 110;
      const qrX = W - pad - qrSize - 20;
      const qrY = H - pad - qrSize - 40;

      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // small link under QR
      doc.fontSize(8).fillColor("#bfeec9").text(certificateUrl, qrX - 10, qrY + qrSize + 6, {
        width: qrSize + 20,
        align: "center",
      });
    } catch (qrErr) {
      console.warn("QR failed:", qrErr);
    }

    // Decorative bottom circuit-like lines
    doc.save();
    doc.strokeColor("#0af07a");
    doc.lineWidth(1);
    const bottomY = H - pad - 30;
    doc.moveTo(pad + 20, bottomY).lineTo(W - pad - 20, bottomY).dash(6, { space: 6 }).stroke();
    doc.undash();
    doc.restore();

    // finalize
    doc.end();

    // wait until finished writing
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    // Save certificate reference to user's document
    const certRecord = {
      id: nanoid(10),
      level,
      issuedAt: new Date(),
      url: `/certificates/${filename}`,
      filename,
    };

    await db.collection("users").updateOne({ _id: userId }, { $push: { certificates: certRecord } });

    return res.json({ url: certRecord.url, level, cert: certRecord });
  } catch (err) {
    console.error("Certificate generate error:", err);
    return res.status(500).json({ error: "Failed to generate certificate" });
  }
});

export default router;

/* ---------- helper: rounded rectangle for pdfkit ---------- */
function drawRoundedRect(doc, x, y, w, h, r) {
  // pdfkit has roundedRect but keep a fallback for consistency
  if (typeof doc.roundedRect === "function") {
    doc.roundedRect(x, y, w, h, r);
    return;
  }
  // manual path
  doc.moveTo(x + r, y);
  doc.lineTo(x + w - r, y);
  doc.quadraticCurveTo(x + w, y, x + w, y + r);
  doc.lineTo(x + w, y + h - r);
  doc.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  doc.lineTo(x + r, y + h);
  doc.quadraticCurveTo(x, y + h, x, y + h - r);
  doc.lineTo(x, y + r);
  doc.quadraticCurveTo(x, y, x + r, y);
}
