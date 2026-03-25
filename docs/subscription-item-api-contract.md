# CBV Subscription Item API Contract (Theme Integration)

This theme now expects a customer-scoped app proxy API under:

- `GET /apps/cbv-subscriptions/items`
- `GET /apps/cbv-subscriptions/items/:id?type=<candle|wax-melt>`
- `POST /apps/cbv-subscriptions/items/:id`

## Theme data modes (merge-safe rollout)

Both subscription sections (`manage` and `edit`) support:

- `mock` (default): never calls live API; uses embedded demo records.
- `live`: only uses app-proxy API endpoints.
- `auto`: tries live first and falls back to mock records when live load fails.

In `mock` and `auto` fallback, save is demo-only and does not persist to Recharge.

## Ownership / security requirements

The backend behind the app proxy must:

1. Verify Shopify app proxy signature on every request.
2. Resolve the signed-in customer from the proxy request/session.
3. Return only subscription items owned by that customer.
4. Reject any `:id` that does not belong to the signed-in customer.
5. Persist updates to Recharge subscription item properties only after ownership checks.

## List response shape

`GET /apps/cbv-subscriptions/items`

```json
{
  "items": [
    {
      "id": "sub_item_123",
      "subscription_name": "Custom Candle Club",
      "product_title": "Custom Candle Club",
      "status": "Active",
      "builder_family": "candle",
      "builder_type": "Candle",
      "next_charge_date": "2026-04-18",
      "frequency": "Every 30 days",
      "billing_management_url": "https://...",
      "product": {
        "id": "gid://shopify/Product/123",
        "handle": "custom-candle-club"
      },
      "product_context": {
        "vessel_label": "Vessel / Jar",
        "vessel_values": ["9oz Jar", "18oz Jar"],
        "secondary_label": "Wick Upgrade",
        "secondary_values": ["Standard", "Wood Wick"],
        "secondary_prop_key": "wick_upgrade"
      },
      "properties": {
        "scent_1": "Vanilla Bean",
        "scent_family": "Bakery",
        "wax_color": "White Wax",
        "vessel": "18oz Jar",
        "wick_upgrade": "Standard"
      }
    }
  ]
}
```

## Single item response shape

`GET /apps/cbv-subscriptions/items/:id`

```json
{
  "item": {
    "id": "sub_item_123",
    "builder_family": "candle",
    "builder_type": "Candle",
    "subscription_name": "Custom Candle Club",
    "next_charge_date": "2026-04-18",
    "frequency": "Every 30 days",
    "product": {
      "id": "gid://shopify/Product/123",
      "handle": "custom-candle-club"
    },
    "product_context": {
      "vessel_label": "Vessel / Jar",
      "vessel_values": ["9oz Jar", "18oz Jar"],
      "secondary_label": "Wick Upgrade",
      "secondary_values": ["Standard", "Wood Wick"],
      "secondary_prop_key": "wick_upgrade"
    },
    "properties": {
      "scent_1": "Vanilla Bean",
      "scent_family": "Bakery",
      "wax_color": "White Wax",
      "vessel": "18oz Jar",
      "wick_upgrade": "Standard"
    }
  }
}
```

## Save request shape

`POST /apps/cbv-subscriptions/items/:id`

```json
{
  "action": "update_properties",
  "builder_family": "candle",
  "properties": {
    "scent_1": "Vanilla Bean",
    "scent_family": "Bakery",
    "wax_color": "White Wax",
    "vessel": "18oz Jar",
    "vessel_format": "",
    "wick_upgrade": "Standard",
    "pack_size": ""
  }
}
```

- `pack_size` is an example dynamic secondary key; it should match `product_context.secondary_prop_key` when present.
- For wax melt items, `vessel_format` is populated and `vessel`/`wax_color`/`wick_upgrade` are sent as empty strings.

## Save response shape

```json
{
  "ok": true,
  "item": {
    "id": "sub_item_123",
    "properties": {
      "scent_1": "Vanilla Bean"
    }
  }
}
```

Error response example:

```json
{
  "ok": false,
  "error": "Subscription item not found for customer"
}
```
