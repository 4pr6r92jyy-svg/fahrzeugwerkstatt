/* Fahrzeugwerkstatt 2.0 – shared, versioned synchronization contract.
   No network requests in this module. UUID references, not device-local row IDs. */
(function(root){'use strict';
const SCHEMA = {
  "brands": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "name": {
      "cid": 1,
      "name": "name",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    }
  },
  "software": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "name": {
      "cid": 1,
      "name": "name",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "cost": {
      "cid": 2,
      "name": "cost",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "free": {
      "cid": 3,
      "name": "free",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": "0",
      "pk": 0
    },
    "paid": {
      "cid": 4,
      "name": "paid",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": "0",
      "pk": 0
    },
    "free_scope": {
      "cid": 5,
      "name": "free_scope",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "paid_scope": {
      "cid": 6,
      "name": "paid_scope",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "adapter": {
      "cid": 7,
      "name": "adapter",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "hardware": {
      "cid": 8,
      "name": "hardware",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "depth": {
      "cid": 9,
      "name": "depth",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "read_support": {
      "cid": 10,
      "name": "read_support",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "live": {
      "cid": 11,
      "name": "live",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "actuator": {
      "cid": 12,
      "name": "actuator",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "learn": {
      "cid": 13,
      "name": "learn",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "limits": {
      "cid": 14,
      "name": "limits",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "windows": {
      "cid": 15,
      "name": "windows",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "verification": {
      "cid": 16,
      "name": "verification",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "checked": {
      "cid": 17,
      "name": "checked",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "source": {
      "cid": 18,
      "name": "source",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "download": {
      "cid": 19,
      "name": "download",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "custom_link": {
      "cid": 20,
      "name": "custom_link",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "installed": {
      "cid": 21,
      "name": "installed",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "installed_version": {
      "cid": 22,
      "name": "installed_version",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "notes": {
      "cid": 23,
      "name": "notes",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    }
  },
  "software_brands": {
    "software_id": {
      "cid": 0,
      "name": "software_id",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 1
    },
    "brand_id": {
      "cid": 1,
      "name": "brand_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 2
    },
    "scope": {
      "cid": 2,
      "name": "scope",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    }
  },
  "adapters": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "name": {
      "cid": 1,
      "name": "name",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "owned": {
      "cid": 2,
      "name": "owned",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "type": {
      "cid": 3,
      "name": "type",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "candidates": {
      "cid": 4,
      "name": "candidates",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "limits": {
      "cid": 5,
      "name": "limits",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "notes": {
      "cid": 6,
      "name": "notes",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    }
  },
  "vehicles": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "brand_id": {
      "cid": 1,
      "name": "brand_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "model": {
      "cid": 2,
      "name": "model",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "build_year": {
      "cid": 3,
      "name": "build_year",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "model_year": {
      "cid": 4,
      "name": "model_year",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "engine": {
      "cid": 5,
      "name": "engine",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "engine_code": {
      "cid": 6,
      "name": "engine_code",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "power": {
      "cid": 7,
      "name": "power",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "fuel": {
      "cid": 8,
      "name": "fuel",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "ecu": {
      "cid": 9,
      "name": "ecu",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "vin": {
      "cid": 10,
      "name": "vin",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "plate": {
      "cid": 11,
      "name": "plate",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "owner_alias": {
      "cid": 12,
      "name": "owner_alias",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "mileage": {
      "cid": 13,
      "name": "mileage",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "mileage_date": {
      "cid": 14,
      "name": "mileage_date",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "first_registration": {
      "cid": 15,
      "name": "first_registration",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "notes": {
      "cid": 16,
      "name": "notes",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "status": {
      "cid": 17,
      "name": "status",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Aktiv'",
      "pk": 0
    },
    "created_at": {
      "cid": 18,
      "name": "created_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "updated_at": {
      "cid": 19,
      "name": "updated_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "favorite": {
      "cid": 20,
      "name": "favorite",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": "0",
      "pk": 0
    }
  },
  "cases": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "vehicle_id": {
      "cid": 1,
      "name": "vehicle_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "date": {
      "cid": 2,
      "name": "date",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "mileage": {
      "cid": 3,
      "name": "mileage",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "description": {
      "cid": 4,
      "name": "description",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "conditions": {
      "cid": 5,
      "name": "conditions",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "display_message": {
      "cid": 6,
      "name": "display_message",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "dtc_code": {
      "cid": 7,
      "name": "dtc_code",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "ecu": {
      "cid": 8,
      "name": "ecu",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "error_state": {
      "cid": 9,
      "name": "error_state",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "live_data": {
      "cid": 10,
      "name": "live_data",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "checks": {
      "cid": 11,
      "name": "checks",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "root_cause": {
      "cid": 12,
      "name": "root_cause",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "resolution": {
      "cid": 13,
      "name": "resolution",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "software_id": {
      "cid": 14,
      "name": "software_id",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "adapter_id": {
      "cid": 15,
      "name": "adapter_id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "status": {
      "cid": 16,
      "name": "status",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Offen'",
      "pk": 0
    },
    "notes": {
      "cid": 17,
      "name": "notes",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "created_at": {
      "cid": 18,
      "name": "created_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "updated_at": {
      "cid": 19,
      "name": "updated_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    }
  },
  "tests": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "vehicle_id": {
      "cid": 1,
      "name": "vehicle_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "software_id": {
      "cid": 2,
      "name": "software_id",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "adapter_id": {
      "cid": 3,
      "name": "adapter_id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "tested_at": {
      "cid": 4,
      "name": "tested_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "ecu": {
      "cid": 5,
      "name": "ecu",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "operation": {
      "cid": 6,
      "name": "operation",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "result": {
      "cid": 7,
      "name": "result",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Ungetestet'",
      "pk": 0
    },
    "notes": {
      "cid": 8,
      "name": "notes",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": "''",
      "pk": 0
    },
    "software_version": {
      "cid": 9,
      "name": "software_version",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    }
  },
  "maintenance": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "vehicle_id": {
      "cid": 1,
      "name": "vehicle_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "title": {
      "cid": 2,
      "name": "title",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "category": {
      "cid": 3,
      "name": "category",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Wartung'",
      "pk": 0
    },
    "due_date": {
      "cid": 4,
      "name": "due_date",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "due_mileage": {
      "cid": 5,
      "name": "due_mileage",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "status": {
      "cid": 6,
      "name": "status",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Geplant'",
      "pk": 0
    },
    "done_date": {
      "cid": 7,
      "name": "done_date",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "done_mileage": {
      "cid": 8,
      "name": "done_mileage",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "notes": {
      "cid": 9,
      "name": "notes",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "created_at": {
      "cid": 10,
      "name": "created_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "updated_at": {
      "cid": 11,
      "name": "updated_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "due_month": {
      "cid": 12,
      "name": "due_month",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "remind_months": {
      "cid": 13,
      "name": "remind_months",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": "1",
      "pk": 0
    },
    "warn_km": {
      "cid": 14,
      "name": "warn_km",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": "1000",
      "pk": 0
    }
  },
  "expenses": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "vehicle_id": {
      "cid": 1,
      "name": "vehicle_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "case_id": {
      "cid": 2,
      "name": "case_id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "date": {
      "cid": 3,
      "name": "date",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "category": {
      "cid": 4,
      "name": "category",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Ersatzteil'",
      "pk": 0
    },
    "description": {
      "cid": 5,
      "name": "description",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "amount_cents": {
      "cid": 6,
      "name": "amount_cents",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "supplier": {
      "cid": 7,
      "name": "supplier",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "part_number": {
      "cid": 8,
      "name": "part_number",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "notes": {
      "cid": 9,
      "name": "notes",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "created_at": {
      "cid": 10,
      "name": "created_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "updated_at": {
      "cid": 11,
      "name": "updated_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    }
  },
  "attachments": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "vehicle_id": {
      "cid": 1,
      "name": "vehicle_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "case_id": {
      "cid": 2,
      "name": "case_id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "filename": {
      "cid": 3,
      "name": "filename",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "title": {
      "cid": 4,
      "name": "title",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "notes": {
      "cid": 5,
      "name": "notes",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "stored_name": {
      "cid": 6,
      "name": "stored_name",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "media_type": {
      "cid": 7,
      "name": "media_type",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "size_bytes": {
      "cid": 8,
      "name": "size_bytes",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "sha256": {
      "cid": 9,
      "name": "sha256",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "created_at": {
      "cid": 10,
      "name": "created_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    }
  },
  "case_steps": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "case_id": {
      "cid": 1,
      "name": "case_id",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "position": {
      "cid": 2,
      "name": "position",
      "type": "INTEGER",
      "notnull": 1,
      "dflt_value": "0",
      "pk": 0
    },
    "title": {
      "cid": 3,
      "name": "title",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "status": {
      "cid": 4,
      "name": "status",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Offen'",
      "pk": 0
    },
    "result": {
      "cid": 5,
      "name": "result",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    }
  },
  "knowledge_entries": {
    "id": {
      "cid": 0,
      "name": "id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 1
    },
    "seed_key": {
      "cid": 1,
      "name": "seed_key",
      "type": "TEXT",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "category": {
      "cid": 2,
      "name": "category",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "kind": {
      "cid": 3,
      "name": "kind",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Eigener Eintrag'",
      "pk": 0
    },
    "title": {
      "cid": 4,
      "name": "title",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "codes": {
      "cid": 5,
      "name": "codes",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "tags": {
      "cid": 6,
      "name": "tags",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "scope": {
      "cid": 7,
      "name": "scope",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Allgemein'",
      "pk": 0
    },
    "brand_id": {
      "cid": 8,
      "name": "brand_id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "model": {
      "cid": 9,
      "name": "model",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "engine": {
      "cid": 10,
      "name": "engine",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "engine_code": {
      "cid": 11,
      "name": "engine_code",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "year_from": {
      "cid": 12,
      "name": "year_from",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "year_to": {
      "cid": 13,
      "name": "year_to",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "vehicle_id": {
      "cid": 14,
      "name": "vehicle_id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "source_case_id": {
      "cid": 15,
      "name": "source_case_id",
      "type": "INTEGER",
      "notnull": 0,
      "dflt_value": null,
      "pk": 0
    },
    "summary": {
      "cid": 16,
      "name": "summary",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "symptoms": {
      "cid": 17,
      "name": "symptoms",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "checks": {
      "cid": 18,
      "name": "checks",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "resolution": {
      "cid": 19,
      "name": "resolution",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "notes": {
      "cid": 20,
      "name": "notes",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "source_name": {
      "cid": 21,
      "name": "source_name",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "source_url": {
      "cid": 22,
      "name": "source_url",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "source_checked": {
      "cid": 23,
      "name": "source_checked",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "license": {
      "cid": 24,
      "name": "license",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "status": {
      "cid": 25,
      "name": "status",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "'Unbestätigt'",
      "pk": 0
    },
    "search_text": {
      "cid": 26,
      "name": "search_text",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": "''",
      "pk": 0
    },
    "created_at": {
      "cid": 27,
      "name": "created_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    },
    "updated_at": {
      "cid": 28,
      "name": "updated_at",
      "type": "TEXT",
      "notnull": 1,
      "dflt_value": null,
      "pk": 0
    }
  }
};
const ORDER=['brands','software','adapters','software_brands','vehicles','cases','tests','maintenance','expenses','attachments','case_steps','knowledge_entries'];
const FK={software_brands:{software_id:'software',brand_id:'brands'},vehicles:{brand_id:'brands'},cases:{vehicle_id:'vehicles',software_id:'software',adapter_id:'adapters'},tests:{vehicle_id:'vehicles',software_id:'software',adapter_id:'adapters'},maintenance:{vehicle_id:'vehicles'},expenses:{vehicle_id:'vehicles',case_id:'cases'},attachments:{vehicle_id:'vehicles',case_id:'cases'},case_steps:{case_id:'cases'},knowledge_entries:{brand_id:'brands',vehicle_id:'vehicles',source_case_id:'cases'}};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function stable(x){if(x===undefined)return 'null';if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(stable).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}'}
const equal=(a,b)=>stable(a??null)===stable(b??null);
async function hash(x){const data=typeof x==='string'?new TextEncoder().encode(x):x;const h=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('')}
const signature=doc=>hash(stable(doc));
const key=(entity,uid)=>entity+':'+uid;
const empty=(datasetId=null)=>({format:'FWCloud',version:1,dataset_id:datasetId,records:{}});
function fromPortable(snap,datasetId){const doc=empty(datasetId||snap?.dataset_id||null), ids={};for(const t of ORDER){ids[t]={};for(const r of snap?.entities?.[t]||[]){ids[t][t==='software_brands'?String(r.data.software_id)+'|'+r.data.brand_id:String(r.data.id)]=r.portable_id;}}
 for(const t of ORDER)for(const r of snap?.entities?.[t]||[]){const data=clone(r.data);if(t==='software')data._software_key=data._software_key||String(data.id);delete data.id;delete data.search_text;for(const [f,target]of Object.entries(FK[t]||{})){if(data[f]!==null&&data[f]!==undefined&&data[f]!==''){const ref=ids[target][String(data[f])];if(!ref)throw Error('Ungültige Zuordnung im Export: '+t+'.'+f);data[f]=ref}else data[f]=null;}doc.records[key(t,r.portable_id)]={entity:t,uid:r.portable_id,deleted:false,data};}
 for(const d of snap?.deleted||[])if(ORDER.includes(d.entity))doc.records[key(d.entity,d.portable_id)]={entity:d.entity,uid:d.portable_id,deleted:true,data:null};
 validate(doc);return doc;
}
function toPortable(doc){const snap={format:'MeineFahrzeugwerkstattPortable',format_version:1,dataset_id:doc.dataset_id,generated_at:new Date().toISOString(),entities:Object.fromEntries(ORDER.map(t=>[t,[]])),deleted:[]};for(const r of Object.values(doc.records)){if(r.deleted){snap.deleted.push({entity:r.entity,portable_id:r.uid});continue}const data=clone(r.data);data.id=r.uid;snap.entities[r.entity].push({portable_id:r.uid,revision:1,data});}return snap}
function defaults(entity,values={}){const data={};for(const [field,s] of Object.entries(SCHEMA[entity]||{})){if(field==='id'||field==='search_text')continue;const d=s.dflt_value;if(d!==null)data[field]=s.type==='INTEGER'?Number(d):String(d).replace(/^'|'$/g,'');else data[field]=s.notnull?(s.type==='INTEGER'?0:''):null;}Object.assign(data,values);const now=new Date().toISOString();if('created_at'in data&&!data.created_at)data.created_at=now;if('updated_at'in data)data.updated_at=now;return data}
function validate(doc){if(!doc||doc.format!=='FWCloud'||doc.version!==1||!doc.records||Array.isArray(doc.records))throw Error('Unbekanntes Synchronisationsformat.');if(doc.dataset_id!==null&&!UUID.test(doc.dataset_id))throw Error('Ungültige Datenbestandskennung.');const entries=Object.entries(doc.records);if(entries.length>25000)throw Error('Mehr als 25.000 Datensätze: Abgleich angehalten.');const uniques={brands:new Set(),software:new Set(),attachments:new Set(),knowledge_entries:new Set(),software_brands:new Set()};for(const [k,r]of entries){if(!r||!ORDER.includes(r.entity)||!UUID.test(r.uid)||k!==key(r.entity,r.uid)||typeof r.deleted!=='boolean')throw Error('Ungültige Datensatzkennung.');if(r.deleted){if(r.data!==null)throw Error('Löschvermerk enthält unerwartete Daten.');continue}if(!r.data||Array.isArray(r.data))throw Error('Datensatz ohne Inhalt.');const d=r.data,fields=SCHEMA[r.entity];for(const f of Object.keys(d)){if(f==='_software_key'&&r.entity==='software')continue;if(!fields[f]||f==='id'||f==='search_text')throw Error('Unzulässiges Feld '+r.entity+'.'+f);}
 for(const [f,s]of Object.entries(fields)){if(f==='id'||f==='search_text')continue;const v=d[f];if(v===undefined)throw Error('Unvollständiger Datensatz: '+r.entity+'.'+f);if(s.notnull&&(v===null||(typeof v==='string'&&({brands:['name'],software:['name'],adapters:['name'],vehicles:['model'],cases:['date','description'],tests:['tested_at'],maintenance:['title'],expenses:['date','description'],case_steps:['title'],knowledge_entries:['title']}[r.entity]||[]).includes(f)&&v.trim()==='')))throw Error('Pflichtfeld fehlt: '+r.entity+'.'+f);if(v===null)continue;if(FK[r.entity]?.[f]){const target=doc.records[key(FK[r.entity][f],v)];if(!UUID.test(v)||!target||target.deleted)throw Error('Verknüpfung fehlt: '+r.entity+'.'+f+'. Möglicher Löschkonflikt; kein Abgleich durchgeführt.');}else if(s.type==='INTEGER'){if(!Number.isSafeInteger(v))throw Error('Ungültige Zahl: '+f);}else if(typeof v!=='string'||v.length>300000||v.includes('\u0000'))throw Error('Ungültiger Text: '+f);}
 if(['expenses','attachments'].includes(r.entity)&&d.case_id){const c=doc.records[key('cases',d.case_id)];if(c.data.vehicle_id!==d.vehicle_id)throw Error('Der Diagnosefall gehört zu einem anderen Fahrzeug.');}
 if(r.entity==='vehicles'){if(d.mileage!==null&&d.mileage<0)throw Error('Negativer Kilometerstand.');if(![0,1].includes(d.favorite))throw Error('Favorit ungültig.');}
 if(r.entity==='maintenance'){if(!['Geplant','Erledigt','Entfällt'].includes(d.status))throw Error('Wartungsstatus ungültig.');if(d.due_month&&(!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.due_month)||d.due_date))throw Error('Fälligkeit: Monat oder genaues Datum, nicht beides.');if(d.status==='Erledigt'&&!d.done_date)throw Error('Erledigungsdatum fehlt.');if(d.remind_months<0||d.remind_months>12||d.warn_km<0||d.warn_km>100000)throw Error('Ungültige Wartungsvorwarnung.');}
 if(r.entity==='cases'&&!['Offen','In Prüfung','Wartet auf Teile','Gelöst','Nicht reproduzierbar'].includes(d.status))throw Error('Fallstatus ungültig.');
 if(r.entity==='case_steps'&&(!['Offen','Erledigt','Nicht möglich','Übersprungen'].includes(d.status)||d.position===null||d.position<0||d.position>100000))throw Error('Prüfschritt ungültig.');
 if(r.entity==='expenses'&&(d.amount_cents<0||d.amount_cents>1000000000))throw Error('Ungültiger Kostenbetrag.');
 if(r.entity==='attachments'){if(!/^[a-f0-9]{32}\.(pdf|png|jpe?g|webp|txt|csv)$/.test(d.stored_name)||!Number.isInteger(d.size_bytes)||d.size_bytes<1||d.size_bytes>20971520||!/^[a-f0-9]{64}$/.test(d.sha256))throw Error('Ungültiger Dateianhang.');}
 if(r.entity==='knowledge_entries'&&!['Fehlersuche','Wartung'].includes(d.category))throw Error('Wissensbereich ungültig.');
 let u=null;if(r.entity==='brands')u=d.name;if(r.entity==='software'){u=d._software_key;if(typeof u!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(u))throw Error('Softwarekennung ungültig.');}if(r.entity==='attachments')u=d.stored_name;if(r.entity==='knowledge_entries')u=d.seed_key;if(r.entity==='software_brands')u=d.software_id+'|'+d.brand_id;if(u){if(uniques[r.entity].has(u))throw Error('Doppelte eindeutige Zuordnung: '+r.entity+'. Nicht blind zusammenführen.');uniques[r.entity].add(u);}}
 return true;}
// Three-way merge, with explicit record-level conflicts. No last-writer-wins.
function merge(base,local,remote,choices={}){const result=empty(remote.dataset_id||local.dataset_id||base?.dataset_id||null),conflicts=[];const b=base?.records||{},l=local.records||{},r=remote.records||{};for(const k of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){let B=b[k]||null,L=l[k]||null,R=r[k]||null,out;const mark=stable([L,R]);if(equal(L,R))out=L;else if(equal(L,B))out=R;else if(equal(R,B))out=L;else if(choices[k]?.mark===mark)out=choices[k].side==='local'?L:R;else{conflicts.push({key:k,base:B,local:L,remote:R,mark});out=L;}if(out)result.records[k]=clone(out);}
 return {doc:result,conflicts};}
function changedCount(base,doc){return [...new Set([...Object.keys(base?.records||{}),...Object.keys(doc.records)])].filter(k=>!equal(base?.records?.[k],doc.records[k])).length}
function displayRecord(r,doc){if(!r)return '(Nicht vorhanden)';const d=r.data||{};let label=d.model||d.title||d.description||d.name||d.filename||d.date||r.entity;if(r.entity==='vehicles'){const b=doc?.records?.[key('brands',d.brand_id)];label=(b?.data?.name||'')+' '+(d.model||'');}return label+(r.deleted?' (gelöscht)':'');}
function maintenanceState(m,v,date=new Date()){if(['Erledigt','Entfällt'].includes(m.status))return {text:m.status,level:'done'};const now=new Date(date.getFullYear(),date.getMonth(),date.getDate()),monthIndex=now.getFullYear()*12+now.getMonth();let level='plan',label='Geplant';const rank={plan:0,soon:1,due:2,late:3};function take(l,t){if(rank[l]>rank[level]){level=l;label=t;}}
 if(m.due_month){const [y,mo]=m.due_month.split('-').map(Number),idx=y*12+mo-1;if(monthIndex>idx)take('late','Überfällig');else if(monthIndex===idx)take('due','Diesen Monat fällig');else if(monthIndex>=idx-Number(m.remind_months??1))take('soon','Bald fällig');}else if(m.due_date){const due=new Date(m.due_date+'T00:00:00'),start=new Date(due);start.setDate(1);start.setMonth(start.getMonth()-Number(m.remind_months??1));const max=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();start.setDate(Math.min(due.getDate(),max));if(now>due)take('late','Überfällig');else if(+now===+due)take('due','Heute fällig');else if(now>=start)take('soon','Bald fällig');}if(m.due_mileage!==null&&m.due_mileage!==undefined&&v?.mileage!==null&&v?.mileage!==undefined){if(v.mileage>m.due_mileage)take('late','Kilometergrenze überschritten');else if(v.mileage===m.due_mileage)take('due','Kilometergrenze erreicht');else if(v.mileage>=m.due_mileage-Number(m.warn_km??1000))take('soon','Kilometergrenze naht');}return {text:label,level};}
const api={SCHEMA,ORDER,FK,UUID,clone,stable,equal,hash,signature,key,empty,fromPortable,toPortable,defaults,validate,merge,changedCount,displayRecord,maintenanceState};root.FWModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
