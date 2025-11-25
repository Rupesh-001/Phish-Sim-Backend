// backend/scripts/generate-many-seeds.js
// ES module — run with: node backend/scripts/generate-many-seeds.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "phish_sim";

const client = new MongoClient(MONGODB_URI, {});

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rndInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randomDomain(){ const words=['secure','account','update','verify','bank','notify','payment','support','alert','service']; return `${rand(words)}-${rndInt(10,999)}.com`; }
function fakeLink(){ return `http://${randomDomain()}/login/${Math.random().toString(36).slice(2,9)}`; }
function randomName(){ const first = ['Alex','Rohit','Priya','Karan','Sneha','Asha','Aman','Rupesh','Nisha','Vikram']; const last = ['Kumar','Sharma','Patel','Verma','Joshi','Gupta','Rao','Singh']; return `${rand(first)} ${rand(last)}`; }
function randomCompany(){ const comps = ['Globex','Apex Solutions','TrustBank','Finova','SecureMail','PayCore','CloudServe','Bluegate','NetSafe']; return `${rand(comps)} ${['Inc','LLC','Pvt Ltd','Corporation'][Math.floor(Math.random()*4)]}`; }

function makeOptions(correctId){
  // correctId is 'A'|'B'|'C'
  const ids = ['A','B','C'];
  return ids.map(id => ({
    id,
    text: id === 'A' ? 'This is a phishing email' : id === 'B' ? 'This is a safe email' : 'Looks suspicious but not harmful',
    correct: id === correctId
  }));
}

function makePhishTemplate(difficulty){
  // returns object with title,sender,body,correctChoice,explanation
  const company = randomCompany();
  const person = randomName();
  const link = fakeLink();
  if(difficulty === 'beginner'){
    const titles = [
      `Your password will expire soon`,
      `Unusual login attempt detected`,
      `Verify your account to avoid suspension`,
      `Action required: account verification`
    ];
    const title = rand(titles);
    const sender = `${company} <no-reply@${randomDomain()}>`;
    const body = `Dear user,\nWe detected suspicious activity on your account. ${title}. Please verify now: ${link}\nIf you do not act within 24 hours your account will be suspended.`;
    const explanation = `This email uses urgency and a suspicious link (${link}). The sender domain is not the official company domain.`;
    return { title, sender, body, correct: 'A', explanation };
  }

  if(difficulty === 'intermediate'){
    const titles = [
      `Invoice #${rndInt(1000,9999)} for your recent payment`,
      `Payment failed — update billing details`,
      `Your subscription has been paused`
    ];
    const title = rand(titles);
    const sender = `${person} from ${company} <billing@${randomDomain()}>`;
    const amount = `₹${rndInt(500,15000)}`;
    const body = `Hello,\nPlease find attached invoice ${rndInt(10000,99999)}. Amount due: ${amount}.\nDownload invoice: ${link}\nIf payment is not received within 3 days, services may be interrupted.`;
    const explanation = `This email asks to download an invoice via an external link (${link}) from a non-official domain and pressures for quick payment — common phishing signals.`;
    return { title, sender, body, correct: 'A', explanation };
  }

  // advanced
  {
    const titles = [
      `IT Notice: Server migration scheduled`,
      `HR: Please validate your payroll details`,
      `Vendor access request — immediate action required`
    ];
    const title = rand(titles);
    const sender = `${person} <${person.split(' ')[0].toLowerCase()}@${randomDomain()}>`;
    const body = `Team,\nAs part of the upcoming maintenance, we require all employees to validate access credentials.\nPlease validate here: ${link}\nThis is mandatory for continued access.\nRegards,\n${person}`;
    const explanation = `Targeted (spear-phishing) style email referencing internal processes and requiring credential validation — looks legitimate but uses a suspicious domain (${link}).`;
    return { title, sender, body, correct: 'A', explanation };
  }
}

async function main(){
  try{
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection('challenges');

    // counts you requested
    const counts = { beginner:50, intermediate:100, advanced:150 };

    let total = 0;
    for(const [level, cnt] of Object.entries(counts)){
      for(let i=0;i<cnt;i++){
        const tpl = makePhishTemplate(level);
        const doc = {
          title: tpl.title,
          sender: tpl.sender,
          body: tpl.body,
          options: makeOptions(tpl.correct),
          explanation: tpl.explanation,
          difficulty: level,
          generatedBy: 'local-bulk-seed',
          createdAt: new Date()
        };
        await col.insertOne(doc);
        total++;
        if(total % 25 === 0) console.log(`Inserted ${total}...`);
      }
    }

    console.log(`Done — inserted ${total} challenges.`);
    await client.close();
  }catch(err){
    console.error("Error:", err);
    await client.close();
    process.exit(1);
  }
}

main();
