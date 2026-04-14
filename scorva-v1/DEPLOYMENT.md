# SCORVA – Azure App Service Deployment Guide
# INTERNAL ACCESS ONLY – No public internet exposure

## Prerequisites
- Azure CLI installed (`az --version`)
- Azure subscription with Contributor access
- Node.js 18+ installed locally for testing
- Your company's Azure VNet name and subnet details (get from your network/Azure admin)

---

## Network Architecture (Internal Only)

```
Corporate Network / VPN
        │
        ▼
  Azure VNet (your-vnet)
  ┌─────────────────────────────────────┐
  │  app-subnet        db-subnet        │
  │  ┌─────────────┐  ┌──────────────┐  │
  │  │ App Service  │  │  PostgreSQL  │  │
  │  │  (iisnode)  │──│  Flex Server │  │
  │  └─────────────┘  └──────────────┘  │
  └─────────────────────────────────────┘
         ▲ No public internet access
```

All traffic stays inside the VNet. The app is only reachable from within the corporate network or VPN — not from the public internet.

---

## Step 1 — Create a VNet (or use existing)

If your company already has an Azure VNet, skip creation and note the VNet name and address space.

```bash
az login

# Create resource group
az group create --name scorva-rg --location eastus

# Create VNet with two subnets
az network vnet create \
  --name scorva-vnet \
  --resource-group scorva-rg \
  --address-prefix 10.0.0.0/16 \
  --subnet-name app-subnet \
  --subnet-prefix 10.0.1.0/24

# Add a second subnet for the database
az network vnet subnet create \
  --name db-subnet \
  --resource-group scorva-rg \
  --vnet-name scorva-vnet \
  --address-prefix 10.0.2.0/24
```

> **If you have an existing VNet:** Replace `scorva-vnet`, `app-subnet`, `db-subnet` throughout
> with your actual names. Ask your Azure admin for the correct subnet prefixes.

---

## Step 2 — Set Up PostgreSQL (No Public Access)

1. In Azure Portal, create **Azure Database for PostgreSQL – Flexible Server**
   - Tier: **Burstable B1ms**
   - Admin username: `scorva_admin`
   - Set a strong password — save it
   - Authentication: PostgreSQL only

2. In **Networking**:
   - Connectivity method: **Private access (VNet Integration)**
   - Select VNet: `scorva-vnet`
   - Select subnet: `db-subnet`
   - **Leave "Allow public access" OFF**

   This creates a private endpoint — the database has no public IP and cannot be reached from the internet.

3. Once created, go to the server → **Databases** → **+ Add** → name it `scorva`

4. **To run the schema and seed scripts**, you must connect from within the VNet.
   Options:
   - From an Azure VM or Bastion host inside the VNet
   - From your corporate machine if it's connected to the VNet via VPN or ExpressRoute
   - Use Azure Cloud Shell with VNet peering (ask your admin)

   ```bash
   psql "postgresql://scorva_admin@<your-server>:<password>@<private-ip>:5432/scorva?sslmode=require" \
     -f db/schema.sql \
     -f db/seed.sql
   ```
   > Use the **private IP** of the PostgreSQL server (found in Portal → PostgreSQL server → Overview → Private IP address), not the `.postgres.database.azure.com` hostname, unless Private DNS is configured.

5. **Change the default passwords** before or after seeding:
   ```bash
   # Generate a bcrypt hash for a new password
   node -e "require('bcryptjs').hash('YourNewPassword!', 12).then(console.log)"
   ```
   Then run:
   ```sql
   UPDATE users SET password_hash = '<new-hash>' WHERE username = 'sjohnson';
   -- Repeat for each user
   ```

---

## Step 3 — Create the App Service (VNet-Integrated)

```bash
# App Service plan — use P1v3 or higher for VNet integration
# (Basic B1 does NOT support VNet integration; need Standard or Premium)
az appservice plan create \
  --name scorva-plan \
  --resource-group scorva-rg \
  --sku P1v3 \
  --is-linux

# Create the Web App with Node 18
az webapp create \
  --name scorva-app \
  --resource-group scorva-rg \
  --plan scorva-plan \
  --runtime "NODE:18-lts"

# Integrate the App Service into the VNet
az webapp vnet-integration add \
  --name scorva-app \
  --resource-group scorva-rg \
  --vnet scorva-vnet \
  --subnet app-subnet
```

This puts the App Service inside `app-subnet` so it can reach the PostgreSQL private endpoint in `db-subnet`.

---

## Step 4 — Restrict App to Internal Access Only

### Option A: IP-Based Access Restriction (Simpler)

Whitelist only your corporate IP ranges or VPN gateway IPs. The app returns 403 to all other IPs.

```bash
# Replace with your actual corporate/VPN IP range(s)
az webapp config access-restriction add \
  --name scorva-app \
  --resource-group scorva-rg \
  --rule-name "Corporate Network" \
  --action Allow \
  --ip-address 203.0.113.0/24 \
  --priority 100

# Block everything else (Azure adds a default Deny All at priority 2147483647)
```

In the Portal: App Service → **Networking** → **Access restrictions** → **+ Add rule**
- Name: `Corporate Network`
- Action: Allow
- IP address range: your corporate egress IP or VPN gateway IP
- Priority: 100

### Option B: Private Endpoint on App Service (Most Secure)

Makes the App Service itself have no public IP — only reachable via the VNet.

```bash
# Disable public network access on the App Service
az webapp update \
  --name scorva-app \
  --resource-group scorva-rg \
  --set publicNetworkAccess=Disabled

# Create a private endpoint for the App Service
az network private-endpoint create \
  --name scorva-app-pe \
  --resource-group scorva-rg \
  --vnet-name scorva-vnet \
  --subnet app-subnet \
  --private-connection-resource-id $(az webapp show --name scorva-app --resource-group scorva-rg --query id -o tsv) \
  --group-id sites \
  --connection-name scorva-app-connection
```

> **Option B requires** that your corporate network has VPN or ExpressRoute connectivity to the Azure VNet. Coordinate with your Azure/network admin.

**Recommendation:** Start with Option A (IP restriction) — it's quick, requires no VPN changes, and is sufficient for most internal tools. Upgrade to Option B if your security policy requires no public endpoint at all.

---

## Step 5 — Configure Environment Variables

In Azure Portal → App Service → **Configuration** → **Application settings**, add:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://scorva_admin:<password>@<private-ip>:5432/scorva?sslmode=require` |
| `SESSION_SECRET` | (generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~18` |

> Use the PostgreSQL **private IP address** in `DATABASE_URL`, not the public hostname.
> If Private DNS zones are configured in your VNet, you can use the hostname instead.

Or via CLI:
```bash
az webapp config appsettings set \
  --name scorva-app \
  --resource-group scorva-rg \
  --settings \
    NODE_ENV=production \
    DATABASE_URL="postgresql://scorva_admin:<password>@<private-ip>:5432/scorva?sslmode=require" \
    SESSION_SECRET="your-secret-here"
```

---

## Step 6 — Deploy the Application

### Option A: ZIP Deploy

```bash
npm install --omit=dev

zip -r deploy.zip . \
  --exclude "*.git*" \
  --exclude ".env" \
  --exclude "node_modules/.cache/*" \
  --exclude "iisnode/*"

az webapp deploy \
  --name scorva-app \
  --resource-group scorva-rg \
  --src-path deploy.zip \
  --type zip
```

### Option B: GitHub Actions (Recommended for CI/CD)

1. App Service → **Deployment Center** → **GitHub** → connect your repo → select `mac-development` branch
2. Add to GitHub repo Secrets → `AZURE_WEBAPP_PUBLISH_PROFILE` (download from App Service → Overview → "Get publish profile")

```yaml
# .github/workflows/deploy.yml
name: Deploy SCORVA
on:
  push:
    branches: [mac-development]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install --omit=dev
      - uses: azure/webapps-deploy@v3
        with:
          app-name: scorva-app
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
```

---

## Step 7 — Configure Startup Command

In Azure Portal → App Service → **Configuration** → **General settings**:
- **Startup Command**: `node server/index.js`

```bash
az webapp config set \
  --name scorva-app \
  --resource-group scorva-rg \
  --startup-file "node server/index.js"
```

---

## Step 8 — Enable HTTPS Only

```bash
az webapp update \
  --name scorva-app \
  --resource-group scorva-rg \
  --https-only true
```

---

## Step 9 — Verify the Deployment

1. Connect to the corporate network or VPN
2. Browse to `https://scorva-app.azurewebsites.net` (or your internal DNS name)
3. You should be redirected to `/auth/login`
4. Log in with one of the seed users (e.g., `sjohnson` / your set password)
5. From outside the corporate network or VPN, the app should return **403 Forbidden** (Option A) or be unreachable (Option B)

---

## Post-Deployment Checklist

- [ ] Changed all default passwords in the database
- [ ] `SESSION_SECRET` is a strong random string (not the placeholder)
- [ ] HTTPS Only is enabled
- [ ] PostgreSQL has **no public access** — private endpoint or VNet only
- [ ] App Service access restricted to corporate IP range(s) or VNet private endpoint
- [ ] Verified app is NOT reachable from a non-corporate internet connection
- [ ] Reviewed CSP header in `web.config` — update if adding external resources
- [ ] Tested login with each role (Corporate Admin, Security, Viewer)
- [ ] Verified audit log captures logins in the `audit_log` table

---

## Local Development Setup

```bash
# 1. Clone and install
npm install

# 2. Copy env file
cp .env.example .env
# Edit .env with your local PostgreSQL credentials

# 3. Create local database
createdb scorva
psql scorva -f db/schema.sql
psql scorva -f db/seed.sql

# 4. Start dev server
npm run dev
# App runs at http://localhost:3000
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `403 Forbidden` from outside office | Expected — access restriction is working |
| `Cannot connect to database` | Verify App Service is VNet-integrated; check PostgreSQL private IP in `DATABASE_URL` |
| `401 Unauthorized` on all API calls | Check `SESSION_SECRET` is set and `NODE_ENV=production` |
| `iisnode` 500 errors | App Service → **Advanced Tools (Kudu)** → LogFiles → Application → iisnode |
| App loads but data is empty | Run `db/seed.sql` from inside the VNet |
| Login works but app shows blank | Check browser console for `/api/me` 401; verify session cookie settings |
| Can't reach PostgreSQL from Kudu/shell | VNet integration not applied to `app-subnet`; re-run `az webapp vnet-integration add` |
