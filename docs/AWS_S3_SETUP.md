# AWS S3 setup — raw file storage for VAYU

VAYU stores the **original uploaded file** (the PDF/DOCX/PPTX/… behind each knowledge source)
in S3-compatible object storage. It's **opt-in**: with no credentials, ingestion still parses →
chunks → embeds; it just doesn't keep the raw bytes. Set the four `S3_*` vars and VAYU starts
persisting originals and can hand out short-lived download links (`GET /v1/knowledge/{id}/raw`).

This guide walks from *no AWS account* to *a working, least-privilege setup*. It takes ~10 min.
Locally you can skip AWS entirely and use the bundled **MinIO** (see the bottom).

---

## 1. Create an AWS account

1. Go to <https://aws.amazon.com/> → **Create an AWS Account**.
2. Enter email, account name, and a strong password.
3. Provide billing details (a card is required even for the free tier — S3 has a generous free
   tier: 5 GB storage + 20k GET + 2k PUT / month for 12 months).
4. Verify your phone, pick the **Basic (free) support** plan, and sign in to the **Console**.

> Tip: create an **IAM admin user** for day-to-day console use instead of the root account, and
> enable MFA on root. Not required to finish this guide, but good hygiene.

## 2. Create the S3 bucket

1. Console → search **S3** → **Create bucket**.
2. **Bucket name** — globally unique, e.g. `vayu-uploads-<yourname>` (lowercase, no spaces).
3. **Region** — pick the one nearest your app/users, e.g. `ap-south-1` (Mumbai), `us-east-1`
   (N. Virginia). **Remember this** — it becomes `S3_REGION`.
4. **Block Public Access** — leave **all four boxes checked** (ON). VAYU serves files through
   short-lived *presigned URLs*, so the bucket must stay private.
5. Leave versioning/encryption at defaults (default SSE-S3 encryption is fine) → **Create bucket**.

## 3. Create a least-privilege IAM user

Don't use root keys. Create a scoped user that can only touch this one bucket.

1. Console → **IAM** → **Users** → **Create user** (e.g. `vayu-s3`). Do **not** grant console access.
2. **Attach policies → Create inline policy → JSON**, paste this (replace `YOUR_BUCKET`):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "VayuBucketObjects",
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
       },
       {
         "Sid": "VayuBucketList",
         "Effect": "Allow",
         "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
         "Resource": "arn:aws:s3:::YOUR_BUCKET"
       }
     ]
   }
   ```

   This grants read/write/delete on **objects in that bucket only** — no account-wide access.
   (VAYU can auto-create the bucket if you also add `s3:CreateBucket`, but pre-creating it in
   step 2 is cleaner and safer.)
3. Name the policy `vayu-s3-access` → **Create policy** → finish creating the user.

## 4. Create access keys

1. IAM → **Users** → `vayu-s3` → **Security credentials** → **Create access key**.
2. Use case: **Application running outside AWS** → **Create**.
3. Copy the **Access key ID** and **Secret access key** now — the secret is shown only once.
   Store them in a password manager.

## 5. Configure VAYU

Set these four (plus the region + bucket from step 2):

```env
S3_ENDPOINT=            # leave BLANK for AWS S3 (uses the regional endpoint)
S3_REGION=ap-south-1    # the bucket's region from step 2
S3_BUCKET=vayu-uploads-yourname
S3_ACCESS_KEY_ID=AKIA...        # from step 4
S3_SECRET_ACCESS_KEY=...        # from step 4
```

- **Locally:** put them in the root `.env` (gitignored). Restart the AI plane (settings are
  cached at startup).
- **On Render (prod):** `vayu-ai` service → **Environment** → add the five vars → save (the
  service redeploys). They are **not** in `render.yaml` on purpose — storage stays off until you
  add them.

> Never commit real keys. `.env` is gitignored; `render.yaml` intentionally omits `S3_*`.

## 6. Test it

1. Confirm the AI plane sees storage as available:

   ```bash
   curl -s https://<your-ai-host>/v1/providers | grep -o '"storage":[^}]*}'
   # → "storage":{"provider":"s3","available":true}
   ```

2. Upload a document in the **Research Center** (`/research`). The source row shows a **"saved"**
   badge once the original is stored.
3. Fetch a download link (needs a logged-in JWT; `AUTH_ALLOW_DEV_TOKEN=true` + `Bearer dev`
   works locally):

   ```bash
   curl -s -H "Authorization: Bearer <jwt>" \
     https://<your-ai-host>/v1/knowledge/<source-id>/raw
   # → {"url":"https://<bucket>.s3.<region>.amazonaws.com/...&X-Amz-Signature=..."}
   ```

   Open that URL in a browser — it downloads the original file and expires in ~1 hour.

If `available` is `false`, both key vars aren't set (or the AI plane wasn't restarted). If uploads
succeed but no badge appears, check the AI-plane logs for `object_storage_put_failed` — usually a
wrong region, a bucket-name typo, or a policy that doesn't cover the bucket.

## Security checklist

- ✅ Bucket **Block Public Access** stays ON — access is only via presigned URLs.
- ✅ IAM user is **scoped to one bucket**, no console access.
- 🔁 **Rotate** the access key periodically (IAM → create new key → update env → delete old).
- 🔒 Keys live only in `.env` / the Render dashboard — never in git.

---

## Local alternative: MinIO (no AWS)

`infra/docker/docker-compose.yml` already runs MinIO. To exercise storage locally without AWS:

```env
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=vayu
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

VAYU auto-creates the `vayu` bucket on first upload. The MinIO console is at
<http://localhost:9001> (login `minioadmin` / `minioadmin`).

## Cloudflare R2 / Backblaze B2

Both are S3-compatible and cheaper for egress. Set `S3_ENDPOINT` to their S3 endpoint (e.g. R2's
`https://<account>.r2.cloudflarestorage.com`), `S3_REGION=auto` (R2), and use their access
key/secret. Everything else is identical.
