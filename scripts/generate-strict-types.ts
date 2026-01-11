import { Client } from 'pg'
import * as fs from 'fs'

async function generateTypes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })

  await client.connect()

  // Get all tables and columns with NOT NULL constraints
  const result = await client.query(`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `)

  const tables: Record<string, Array<{
    name: string
    type: string
    nullable: boolean
    hasDefault: boolean
  }>> = {}

  for (const row of result.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = []

    let tsType = 'unknown'
    switch (row.udt_name) {
      case 'uuid': tsType = 'string'; break
      case 'text': tsType = 'string'; break
      case 'varchar': tsType = 'string'; break
      case 'int4': tsType = 'number'; break
      case 'int8': tsType = 'number'; break
      case 'float8': tsType = 'number'; break
      case 'bool': tsType = 'boolean'; break
      case 'timestamptz': tsType = 'string'; break
      case 'timestamp': tsType = 'string'; break
      case 'date': tsType = 'string'; break
      case 'time': tsType = 'string'; break
      case 'json': tsType = 'Json'; break
      case 'jsonb': tsType = 'Json'; break
      case '_text': tsType = 'string[]'; break
      case 'numeric': tsType = 'number'; break
      default: tsType = 'unknown'
    }

    tables[row.table_name].push({
      name: row.column_name,
      type: tsType,
      nullable: row.is_nullable === 'YES',
      hasDefault: row.column_default !== null
    })
  }

  await client.end()

  // Generate TypeScript
  let output = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
`

  for (const [tableName, columns] of Object.entries(tables)) {
    output += `      ${tableName}: {\n`

    // Row type
    output += `        Row: {\n`
    for (const col of columns) {
      output += `          ${col.name}: ${col.type}${col.nullable ? ' | null' : ''}\n`
    }
    output += `        }\n`

    // Insert type - STRICT: only columns with defaults or nullable are optional
    output += `        Insert: {\n`
    for (const col of columns) {
      const isOptional = col.hasDefault || col.nullable
      output += `          ${col.name}${isOptional ? '?' : ''}: ${col.type}${col.nullable ? ' | null' : ''}\n`
    }
    output += `        }\n`

    // Update type - all optional
    output += `        Update: {\n`
    for (const col of columns) {
      output += `          ${col.name}?: ${col.type}${col.nullable ? ' | null' : ''}\n`
    }
    output += `        }\n`
    output += `      }\n`
  }

  output += `    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
`

  fs.writeFileSync('src/types/database.generated.ts', output)
  console.log('✅ Strict types generated successfully')
}

generateTypes().catch(console.error)
