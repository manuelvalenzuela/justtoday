#!/usr/bin/env bash
# Provisions the Azure App Service for justtoday. Idempotent — re-run safely.
# Prereqs: az login, subscription set to the VS Enterprise sub that owns rg-justtoday.

set -euo pipefail

RG="${RG:-rg-justtoday}"
LOCATION="${LOCATION:-westus3}"
PLAN="${PLAN:-justtoday-plan}"
APP="${APP:-justtoday-app-$(echo "$RANDOM" | md5sum | cut -c1-6)}"
PG_SERVER="${PG_SERVER:-justtoday-db-<your-suffix>}"

echo "Resource group: $RG"
echo "Plan:           $PLAN"
echo "Web app:        $APP"

az appservice plan show -g "$RG" -n "$PLAN" >/dev/null 2>&1 || \
  az appservice plan create \
    -g "$RG" -n "$PLAN" \
    --location "$LOCATION" \
    --is-linux \
    --sku B1

az webapp show -g "$RG" -n "$APP" >/dev/null 2>&1 || \
  az webapp create \
    -g "$RG" -n "$APP" \
    --plan "$PLAN" \
    --runtime "NODE:22-lts"

az webapp config set \
  -g "$RG" -n "$APP" \
  --startup-file "node server.js" \
  --always-on true >/dev/null

# App settings — placeholders. Real secrets must be set with:
#   az webapp config appsettings set -g "$RG" -n "$APP" --settings KEY=value
# DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET,
# AUTH_URL (https://<APP>.azurewebsites.net), AZURE_AI_ENDPOINT,
# AZURE_AI_API_KEY, AZURE_AI_DEPLOYMENT, AZURE_AI_API_VERSION.
az webapp config appsettings set \
  -g "$RG" -n "$APP" \
  --settings \
    SCM_DO_BUILD_DURING_DEPLOYMENT=false \
    WEBSITE_NODE_DEFAULT_VERSION="~22" \
    NODE_ENV=production \
  >/dev/null

OUTBOUND_IPS=$(az webapp show -g "$RG" -n "$APP" --query possibleOutboundIpAddresses -o tsv)
echo
echo "Possible outbound IPs (add each to Postgres firewall):"
echo "$OUTBOUND_IPS" | tr ',' '\n'

# Allow outbound IPs through to the Postgres flexible server.
i=0
for ip in $(echo "$OUTBOUND_IPS" | tr ',' ' '); do
  rule="appservice-${i}"
  az postgres flexible-server firewall-rule create \
    --resource-group "$RG" \
    --name "$PG_SERVER" \
    --rule-name "$rule" \
    --start-ip-address "$ip" \
    --end-ip-address "$ip" \
    >/dev/null 2>&1 || \
  az postgres flexible-server firewall-rule update \
    --resource-group "$RG" \
    --name "$PG_SERVER" \
    --rule-name "$rule" \
    --start-ip-address "$ip" \
    --end-ip-address "$ip" \
    >/dev/null
  i=$((i+1))
done

echo
echo "Hostname: https://$APP.azurewebsites.net"
echo "App name (export APP=$APP for the workflow secret):"
echo "  $APP"
