/**
 * Deep Cuts EDH — free verification mailer for deepcutsedh@gmail.com
 * Deploy as a Google Apps Script Web App, executing as the script owner.
 * Only accepts signed, time-limited requests from Cloudflare Pages.
 * Never put your shared secret directly into this source file.
 */
function doGet() {
  return response_(false, "POST-only", null);
}
function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== "string" ||
        e.postData.contents.length > 2200) return response_(false, "invalid-request", null);
    var d = JSON.parse(e.postData.contents);
    if (!d || d.version !== 1 || typeof d !== "object") return response_(false, "invalid-request", null);
    var id = d.id, email = d.email, purpose = d.purpose, code = d.code;
    var ts = d.ts;
    if (!/^[0-9a-f]{32}$/.test(id || "") ||
        typeof email !== "string" || email.length > 254 ||
        email !== email.toLowerCase().trim() ||
        !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) ||
        (purpose !== "verify" && purpose !== "recover") ||
        !/^\d{8}$/.test(code || "") ||
        typeof ts !== "number" || !Number.isSafeInteger(ts) ||
        Math.abs(Date.now() - ts) > 300000 ||
        !/^[0-9a-f]{64}$/.test(d.signature || "")) {
      return response_(false, "invalid-request", null);
    }
    var secret = PropertiesService.getScriptProperties().getProperty("MAIL_SHARED_SECRET");
    if (!/^[0-9a-f]{64}$/.test(secret || "")) return response_(false, "not-configured", null);

    var canonical = ["v1", String(ts), id, purpose, email, code].join("\n");
    var bytes = Utilities.computeHmacSha256Signature(canonical, secret);
    var expected = bytes.map(function (b) {
      return ("0" + (b & 255).toString(16)).slice(-2);
    }).join("");
    if (!secureEqual_(d.signature, expected)) return response_(false, "unauthorized", null);

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var cache = CacheService.getScriptCache();
      if (cache.get("sent:" + id) === "1") return response_(true, "already-sent", id);

      var props = PropertiesService.getScriptProperties();
      var day = Utilities.formatDate(new Date(), "Etc/UTC", "yyyyMMdd");
      var countKey = "count:" + day;
      var used = Number(props.getProperty(countKey) || "0");
      if (used >= 60 || MailApp.getRemainingDailyQuota() < 1) {
        return response_(false, "quota-unavailable", null);
      }
      var instruction = purpose === "verify" ? "verify your profile recovery email" : "recover your profile access";
      var body = "Your Deep Cuts EDH verification code is:\n\n" +
        code + "\n\nUse this code to " + instruction +
        ". It expires in 15 minutes and can be used only once.\n\n" +
        "If you did not request this email, you can ignore it. Never share your code.\n\n" +
        "Deep Cuts EDH";
      MailApp.sendEmail({
        to: email,
        subject: "Deep Cuts EDH - Your verification code",
        body: body,
        name: "Deep Cuts EDH"
      });
      props.setProperty(countKey, String(used + 1));
      cache.put("sent:" + id, "1", 900);
      return response_(true, "sent", id);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // Never log or echo the raw request, destination email, secret or code.
    console.error("Deep Cuts mailer failure: " + String(err && err.name || "error"));
    return response_(false, "temporary-error", null);
  }
}

function response_(ok, status, id) {
  var value = {ok: ok, version: 1, status: status};
  if (id) value.id = id;
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
function secureEqual_(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== 64 || b.length !== 64) return false;
  var diff = 0;
  for (var i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
/** Run once, while signed in as deepcutsedh@gmail.com, to authorize MailApp. */
function authorizeMailer() {
  var remaining = MailApp.getRemainingDailyQuota();
  console.log("MailApp authorized; remaining recipient allowance: " + remaining);
}
