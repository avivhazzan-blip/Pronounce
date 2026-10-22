'use strict';
// Runs only inside GitHub Actions, never in browser or public GitHub Pages.
const admin = require('firebase-admin');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) throw new Error('Missing GitHub Actions secret FIREBASE_SERVICE_ACCOUNT_JSON');
let creds;
try { creds = JSON.parse(raw); }
catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON'); }
if (creds.project_id !== 'proeng-23ae9') throw new Error('Service account belongs to the wrong Firebase project');
admin.initializeApp({ credential: admin.credential.cert(creds) });
const db = admin.firestore();
const tz = 'Asia/Jerusalem';

function israelTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hourCycle:'h23'
  }).formatToParts(date);
  const obj = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return {day:`${obj.year}-${obj.month}-${obj.day}`,hour:Number(obj.hour)};
}
function dueCount(user, now) {
  const progress = user.progress || {}, reviews = user.reviewData || {};
  let due = 0;
  for (const [id,state] of Object.entries(progress)) {
    if (!state || !state.starred) continue;
    const review = reviews[id];
    if (!review || !review.introduced || Number(review.m?.due || 0) <= now || Number(review.p?.due || 0) <= now) due++;
  }
  return due;
}
function goals(user, day) {
  const prefs = user.prefs || {};
  const done = Array.isArray(user.dailyData?.days?.[day]) ? user.dailyData.days[day].length : 0;
  return {done, goal:Math.max(1, Number(prefs.dailyGoal) || 8)};
}
async function alreadySent(uid, day) {
  // Dedicated document is not overwritten by the app's users/{uid}.set(snapshot).
  return db.collection('reminderDelivery').doc(`${uid}_${day}`).get();
}
async function main() {
  const {day, hour} = israelTime();
  console.log(`PronounceMe scheduled check: Israel ${day} hour ${hour}:00`);
  const result = await db.collection('users').where('prefs.reminders','==',true).get();
  let sent = 0, skipped = 0, failed = 0;
  for (const doc of result.docs) {
    const user = doc.data(), prefs = user.prefs || {};
    const requestedHour = Number(prefs.reminderHour ?? 18);
    if (requestedHour !== hour) { skipped++; continue; }
    const due = dueCount(user, Date.now());
    const {done,goal} = goals(user,day);
    if (!due && done >= goal) { skipped++; continue; }
    const tokens = [...new Set(Object.values(prefs.pushDevices || {}).filter(t=>typeof t==='string' && t.length>20))];
    if (!tokens.length) { skipped++; continue; }
    const already = await alreadySent(doc.id,day);
    if (already.exists) { skipped++; continue; }
    const body = due > 0
      ? `${due} words are ready for review. A few minutes can help you remember!`
      : `${Math.max(0,goal-done)} new words left to reach today's goal.`;
    let delivered = false;
    for (let i=0;i<tokens.length;i+=500) {
      const slice = tokens.slice(i,i+500);
      try {
        const outcome = await admin.messaging().sendEachForMulticast({
          tokens:slice,
          data:{title:'PronounceMe · Time to learn',body},
          android:{priority:'normal'}
        });
        const good = outcome.successCount;
        if (good) delivered = true;
        for (const response of outcome.responses) if (!response.success) {
          console.error('FCM delivery rejected:', response.error?.code || 'unknown');
        }
      } catch (e) { failed++; console.error('FCM send failed:',e.message); }
    }
    if (delivered) {
      await db.collection('reminderDelivery').doc(`${doc.id}_${day}`).set({
        day, sentAt:admin.firestore.FieldValue.serverTimestamp()
      });
      sent++;
    }
  }
  console.log(`Finished: ${sent} user(s) sent, ${skipped} skipped, ${failed} failed batches.`);
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
