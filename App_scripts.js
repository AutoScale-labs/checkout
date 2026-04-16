// ============================================================
//  LinkedIn AI Automation — Google Apps Script
//  Paste this entire file into your Apps Script editor.
//  Sheet columns: A=Timestamp B=Name C=Email D=Phone
//                 E=UTM Source F=UTM Medium G=UTM Campaign
//                 H=Status I=Payment ID
// ============================================================

function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (data.action === 'logLead') {
      return logLead(sheet, data);
    }

    if (data.action === 'updateStatus') {
      return updateStatus(sheet, data);
    }

    return respond({ status: 'error', message: 'Unknown action' });

  } catch (err) {
    return respond({ status: 'error', message: err.toString() });
  }
}


// ── ACTION 1: Log new lead from checkout page ──────────────
function logLead(sheet, data) {
  // Check for duplicate email (same session re-submit)
  const existing = findRowByEmail(sheet, data.email);
  if (existing !== -1) {
    // Already logged — don't duplicate
    return respond({ status: 'ok', note: 'duplicate' });
  }

  sheet.appendRow([
    new Date(),          // A — Timestamp
    data.name    || '',  // B — Name
    data.email   || '',  // C — Email
    data.phone   || '',  // D — Phone
    data.utm_source   || 'direct', // E — UTM Source
    data.utm_medium   || '',       // F — UTM Medium
    data.utm_campaign || '',       // G — UTM Campaign
    'PENDING',           // H — Status
    ''                   // I — Payment ID (empty until paid)
  ]);

  return respond({ status: 'ok' });
}


// ── ACTION 2: Update status to PAID after Razorpay redirect ─
function updateStatus(sheet, data) {
  if (!data.email) return respond({ status: 'error', message: 'No email' });

  const rowIndex = findRowByEmail(sheet, data.email);

  if (rowIndex === -1) {
    // Lead wasn't logged (rare: logging failed + localStorage worked)
    // Create a recovery row so the payment isn't invisible
    sheet.appendRow([
      new Date(),
      '',                // Name unknown
      data.email,
      '',                // Phone unknown
      'recovery',        // UTM — flag this for review
      '', '',
      'PAID',
      data.paymentId || ''
    ]);
    return respond({ status: 'ok', note: 'recovery row created' });
  }

  // Update status and payment ID columns
  sheet.getRange(rowIndex, 8).setValue('PAID');                  // col H
  sheet.getRange(rowIndex, 9).setValue(data.paymentId || '');    // col I
  sheet.getRange(rowIndex, 10).setValue(new Date());             // col J — paid timestamp

  return respond({ status: 'ok' });
}


// ── UTILITY: Find row index by email (1-indexed) ────────────
function findRowByEmail(sheet, email) {
  const data   = sheet.getDataRange().getValues();
  const target = email.toLowerCase().trim();

  for (let i = 1; i < data.length; i++) {      // start at 1 to skip header
    if (String(data[i][2]).toLowerCase().trim() === target) {
      return i + 1;    // Apps Script rows are 1-indexed
    }
  }
  return -1;
}


// ── UTILITY: Standard JSON response ─────────────────────────
function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
//  SETUP INSTRUCTIONS
//
//  1. Open your Google Sheet
//  2. Add a header row in Row 1:
//     Timestamp | Name | Email | Phone | UTM Source | UTM Medium
//     | UTM Campaign | Status | Payment ID | Paid At
//  3. Extensions → Apps Script → paste this code
//  4. Click Deploy → New Deployment → Web App
//  5. Execute as: Me
//     Who has access: Anyone
//  6. Authorize when prompted
//  7. Copy the /exec URL
//  8. Paste it as APPS_SCRIPT_URL in both index.html and success.html
//
//  REDEPLOYMENT NOTE:
//  Every time you edit this code, you must click
//  Deploy → Manage Deployments → Edit (pencil icon) →
//  change version to "New version" → Deploy.
//  Refreshing the exec URL alone does NOT pick up code changes.
// ============================================================