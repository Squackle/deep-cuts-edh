# Deep Cuts EDH: free Gmail recovery sender

This Google Apps Script sends profile verification and recovery codes from **deepcutsedh@gmail.com** using Google's free MailApp. The companion script is [Code.gs](Code.gs). The shared credential is never committed to the repository.

## Create the script under the new Gmail account

1. Sign in as **deepcutsedh@gmail.com** and open https://script.google.com/home/projects/create
2. Name the project **Deep Cuts EDH - Account Mailer**.
3. Replace the default Code.gs with the entire contents of the Code.gs file linked above, then Save.
4. In **Project Settings → Script properties → Add script property**, set **MAIL_SHARED_SECRET** to the **64 hexadecimal characters only** from the private downloadable DeepCuts-Gmail-Sender-Secret.txt file. Do not include the property name, quotes, or equals sign.
5. Select the function **authorizeMailer** in the editor and click Run. Approve Google's email-sending permission from the new account. This requests send-mail capability only, not Gmail inbox access.
6. Click **Deploy → New deployment → Web app**. Set **Execute as: Me (deepcutsedh@gmail.com)** and **Who has access: Anyone**. Deploy and copy the **Web app URL** ending in /exec. Do not use the /dev test URL.

## Connect the production website

At **Cloudflare → Workers & Pages → deep-cuts-edh → Settings → Variables and Secrets**, add these **production** settings:

| Setting | Type | Value |
| --- | --- | --- |
| GOOGLE_MAILER_URL | Plain text | The script's Web app /exec URL |
| GOOGLE_MAILER_SECRET | Encrypted secret | The same 64-character secret as Apps Script MAIL_SHARED_SECRET |

Keep all existing Ko-fi and Turnstile secrets and D1 database bindings intact. Trigger a fresh production deployment after saving the values.

The Cloudflare Pages Function sends an HTTPS POST signed with HMAC-SHA256. Its signature covers the timestamp, request ID, intended purpose, recipient email and 8-digit code. The Apps Script rejects invalid signatures and requests outside a 5-minute window and only sends its fixed verification template. A daily quota of 60 recipients and a 15-minute replay cache protect the new Gmail account. Cloudflare follows the Apps Script ContentService redirect only to the legitimate script.googleusercontent.com destination.

## Test Squackle

1. Sign in at https://deep-cuts-edh.pages.dev/community.html#account with your existing Squackle profile key.
2. Open **Private Recovery Email**; the pending address remains unusable for account recovery until verified.
3. Re-enter **logan.ottfamily@gmail.com** and request the 8-digit verification email.
4. Confirm delivery **from deepcutsedh@gmail.com**, then enter the code. The profile should show verified.
5. Only after verification, optionally test **Lost your profile key?** by requesting a recovery code and completing the reset. This revokes the previous key across all devices. Save the newly issued key.

## Limits and maintenance

- Google's published Apps Script consumer-account allowance is **100 recipients/day** (limits subject to change). The script deliberately caps itself at 60/day.
- The web app is accessible to Anyone so Cloudflare can call it, but every email command must pass the shared HMAC challenge. Never publish the secret or paste it into chat, source code or browser scripts.
- After changing Code.gs, use **Deploy → Manage deployments → Edit → New version**; saving alone does not update the published version.
- Existing Resend configuration, if any, remains supported as a fallback. If either part of the Google configuration is missing, Google sending remains disabled and users can still log in using profile keys.
- The owner alone must authorize the Google script. ChatGPT cannot perform Google's interactive Google Account authorization on their behalf.
