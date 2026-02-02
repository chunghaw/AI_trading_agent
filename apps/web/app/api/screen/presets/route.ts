import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { ScreenPresetSchema, ScreenPreset } from "@/lib/screen.schemas";
import { ensureTablesExist } from "@/lib/screen/db";

// GET - List all presets
export async function GET(req: NextRequest) {
  let client: Client | null = null;

  try {
    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    await ensureTablesExist(client);

    const result = await client.query(
      `SELECT id, name, filters_json, created_at, updated_at
       FROM screen_presets
       ORDER BY name ASC`
    );

    const presets = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      filters_json: row.filters_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    await client.end();

    return NextResponse.json({
      success: true,
      presets,
    });
  } catch (error: any) {
    console.error("Error fetching presets:", error);
    if (client) await client.end();

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch presets",
      },
      { status: 500 }
    );
  }
}

// POST - Create new preset
export async function POST(req: NextRequest) {
  let client: Client | null = null;

  try {
    const body = await req.json();
    const preset = ScreenPresetSchema.parse(body);

    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    await ensureTablesExist(client);

    const result = await client.query(
      `INSERT INTO screen_presets (name, filters_json, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, filters_json, created_at, updated_at`,
      [preset.name, JSON.stringify(preset.filters_json)]
    );

    const newPreset = result.rows[0];

    await client.end();

    return NextResponse.json({
      success: true,
      preset: {
        id: newPreset.id,
        name: newPreset.name,
        filters_json: newPreset.filters_json,
        created_at: newPreset.created_at,
        updated_at: newPreset.updated_at,
      },
    });
  } catch (error: any) {
    console.error("Error creating preset:", error);
    if (client) await client.end();

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create preset",
      },
      { status: 500 }
    );
  }
}

// PUT - Update existing preset
export async function PUT(req: NextRequest) {
  let client: Client | null = null;

  try {
    const body = await req.json();
    const preset = ScreenPresetSchema.parse(body);

    if (!preset.id) {
      return NextResponse.json(
        { success: false, error: "Preset ID is required for update" },
        { status: 400 }
      );
    }

    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    await ensureTablesExist(client);

    const result = await client.query(
      `UPDATE screen_presets
       SET name = $1, filters_json = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, filters_json, created_at, updated_at`,
      [preset.name, JSON.stringify(preset.filters_json), preset.id]
    );

    if (result.rows.length === 0) {
      await client.end();
      return NextResponse.json(
        { success: false, error: "Preset not found" },
        { status: 404 }
      );
    }

    const updatedPreset = result.rows[0];

    await client.end();

    return NextResponse.json({
      success: true,
      preset: {
        id: updatedPreset.id,
        name: updatedPreset.name,
        filters_json: updatedPreset.filters_json,
        created_at: updatedPreset.created_at,
        updated_at: updatedPreset.updated_at,
      },
    });
  } catch (error: any) {
    console.error("Error updating preset:", error);
    if (client) await client.end();

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update preset",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete preset
export async function DELETE(req: NextRequest) {
  let client: Client | null = null;

  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Preset ID is required" },
        { status: 400 }
      );
    }

    client = new Client({
      connectionString: process.env.POSTGRES_URL!,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    await ensureTablesExist(client);

    const result = await client.query(
      `DELETE FROM screen_presets WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.end();
      return NextResponse.json(
        { success: false, error: "Preset not found" },
        { status: 404 }
      );
    }

    await client.end();

    return NextResponse.json({
      success: true,
      message: "Preset deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting preset:", error);
    if (client) await client.end();

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete preset",
      },
      { status: 500 }
    );
  }
}
