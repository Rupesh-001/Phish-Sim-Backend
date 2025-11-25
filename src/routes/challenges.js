// backend/src/routes/challenges.js
import express from "express";
import { ObjectId } from "mongodb";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { nanoid } from "nanoid";

const router = express.Router();

/* -------------------- Helpers -------------------- */
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomDomain() {
  const base = ["secure","update","verify","account","billing","notify","support","alert","mail","service"];
  return `${rand(base)}-${rnd(10,999)}.com`;
}
function fakeLink() {
  return `http://${randomDomain()}/login/${Math.random().toString(36).slice(2,9)}`;
}
function randomName() {
  const first = ["Alex","Priya","Rohit","Asha","Vikram","Sneha","Karan","Aman","Rupesh","Nisha"];
  const last = ["Kumar","Verma","Singh","Gupta","Patel","Rao","Joshi"];
  return `${rand(first)} ${rand(last)}`;
}
function randomCompany() {
  const comps = ["Globex","Finova","TrustBank","CloudServe","NetSafe","Apex Solutions","Bluegate"];
  const suffix = ["Inc","LLC","Pvt Ltd","Corporation"];
  return `${rand(comps)} ${rand(suffix)}`;
}

function makeOptions(correctId) {
  return [
    { id: "A", text: "This is a phishing email", correct: correctId === "A" },
    { id: "B", text: "This is a safe email", correct: correctId === "B" },
    { id: "C", text: "Looks suspicious but not harmful", correct: correctId === "C" }
  ];
}

/* Recommended remote logo URLs (publicly hosted icons) */
const LOGO_URLS = [
  "https://upload.wikimedia.org/wikipedia/commons/5/5f/Google_Icons_Gmail.svg",
  "https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg",
  "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_logo_2017.svg",
  "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png",
  "https://upload.wikimedia.org/wikipedia/commons/f/fb/Adobe_Corporate_Logo.png"
];

/* Create a simple invoice PDF and return public URL under /invoices */
async function createFakeInvoicePdf({ title, amount, invoiceId }) {
  const invoicesDir = path.join(process.cwd(), "public", "invoices");
  if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

  const filename = `invoice-${invoiceId || nanoid(8)}.pdf`;
  const filepath = path.join(invoicesDir, filename);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);

  doc.fontSize(22).text("INVOICE", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(12).text(`Invoice ID: ${invoiceId || nanoid(6)}`);
  doc.text(`Title: ${title}`);
  doc.text(`Amount: ${amount}`);
  doc.moveDown(1);
  doc.text("Billed to: Customer");
  doc.moveDown(2);
  doc.text("Description:");
  doc.text("This is a system-generated example invoice for training purposes only.");
  doc.end();

  await new Promise((res) => stream.on("finish", res));

  // Public URL served from /invoices in index.js
  return `/invoices/${filename}`;
}

/* Build challenge content variations */
async function buildChallenge(difficulty = "beginner") {
  const company = randomCompany();
  const person = randomName();
  const domain = randomDomain();
  const link = fakeLink();
  const imageUrl = LOGO_URLS[Math.floor(Math.random() * LOGO_URLS.length)];
  // defaults
  let title, sender, body, htmlBody, explanation, correct = "A", invoiceUrl = null;

  if (difficulty === "beginner") {
    title = rand([
      "Verify your account now!",
      "Your password will expire soon",
      "Unusual login attempt detected"
    ]);
    sender = `${company} <no-reply@${domain}>`;
    body = `Dear user,\nWe detected suspicious activity on your account. Please verify immediately: ${link}\nFailure to act may lead to suspension.`;
    htmlBody = `<div style="font-family:Arial,sans-serif;color:#111"><p>Dear user,</p><p>We detected suspicious activity on your account. <a href="${link}">Verify your account</a> immediately to avoid suspension.</p></div>`;
    explanation = `Uses urgency and a suspicious link (${link}). Sender domain is not an official domain for the service.`;
  } else if (difficulty === "intermediate") {
    const amount = `₹${rnd(500,15000)}`;
    const invoiceId = `INV-${rnd(1000,9999)}`;
    title = rand([
      `Invoice #${rnd(1000,9999)} for your recent payment`,
      "Payment failed — update billing details",
      "Your subscription has been paused"
    ]);
    sender = `${person} from ${company} <billing@${domain}>`;
    body = `Hello,\nPlease find attached invoice ${invoiceId}. Amount due: ${amount}.\nDownload invoice: ${link}\nIf payment is not received within 3 days, services may be interrupted.`;
    htmlBody = `<div style="font-family:Arial,sans-serif;color:#111">
      <h3>Invoice ${invoiceId}</h3>
      <p>Dear Customer,</p>
      <p>Your payment of <strong>${amount}</strong> failed. Download your invoice: <a href="${link}">Download Invoice</a></p>
    </div>`;
    explanation = `Asks to download an invoice through an external link (${link}) from a non-official domain and pressures for quick payment — classic phishing signs.`;
    // generate invoice PDF
    invoiceUrl = await createFakeInvoicePdf({ title, amount, invoiceId });
  } else {
    // advanced
    title = rand([
      "IT Notice: Credential validation required",
      "HR Update: Payroll verification needed",
      "Security update for internal employees"
    ]);
    sender = `${person} <${person.split(" ")[0].toLowerCase()}@${domain}>`;
    body = `Team,\nAs part of a scheduled maintenance we require all staff to validate credentials. Please validate here: ${link}\nThis is mandatory.`;
    htmlBody = `<div style="font-family:Arial,sans-serif;color:#111">
      <p>Team,</p>
      <p>As part of maintenance we require all staff to validate access credentials. Please <a href="${link}">validate now</a>.</p>
      <p>Regards,<br/>${person}</p>
    </div>`;
    explanation = `Spear-phishing style referencing internal processes and requiring credential validation — uses a suspicious domain (${link}).`;
  }

  return {
    title,
    sender,
    body,
    htmlBody,
    imageUrl,
    explanation,
    options: makeOptions(correct),
    difficulty,
    invoiceUrl
  };
}

/* -------------------- Routes -------------------- */

// POST /api/challenges/generate  -> generate local challenge, insert, return
router.post("/generate", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const difficulty = (req.body?.difficulty || "beginner").toLowerCase();
    const chal = await buildChallenge(difficulty);

    const doc = {
      title: chal.title,
      sender: chal.sender,
      body: chal.body,
      htmlBody: chal.htmlBody,
      imageUrl: chal.imageUrl,
      invoiceUrl: chal.invoiceUrl || null,
      options: chal.options,
      explanation: chal.explanation,
      difficulty,
      generatedBy: "local",
      createdAt: new Date()
    };

    const result = await db.collection("challenges").insertOne(doc);
    res.json({ id: result.insertedId, challenge: doc });
  } catch (err) {
    console.error("Local generate error:", err);
    res.status(500).json({ error: "Failed to generate challenge" });
  }
});

// GET /api/challenges/random?exclude=<id>
router.get("/random", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const excludeId = req.query.exclude;
    const match = excludeId ? { _id: { $ne: new ObjectId(excludeId) } } : {};
    // sample 2 to reduce repeats on small DBs
    const docs = await db.collection("challenges").aggregate([
      { $match: match },
      { $sample: { size: 2 } }
    ]).toArray();

    res.json({ challenge: docs[0] || null });
  } catch (err) {
    console.error("Random challenge error:", err);
    res.status(500).json({ error: "Failed to fetch random challenge" });
  }
});

export default router;
