import * as fs from 'fs'
import { execSync } from 'child_process'

async function generateTypes() {
  // Use psql to get schema info and generate types

  const dbUrl = "postgresql://postgres.ksramckuggspsqymcjpo:sm3YQla17P0Ru5r4@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

  // Get all tables and columns
  const query = `
    SELECT
      table_name,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `

  const result = execSync(
    `PGPASSWORD=sm3YQla17P0Ru5r4 /usr/local/opt/postgresql@17/bin/psql "${dbUrl}" -t -A -F"|" -c "${query.replace(/\n/g, ' ')}"`,
    { encoding: 'utf-8' }
  )

  const lines = result.trim().split('\n')
  const tables: Record<string, Array<{name: string, type: string, nullable: boolean}>> = {}

  for (const line of lines) {
    const [tableName, columnName, dataType, udtName, isNullable] = line.split('|')
    if (!tables[tableName]) tables[tableName] = []

    let tsType = 'unknown'
    switch (udtName) {
      case 'uuid': tsType = 'string'; break
      case 'text': tsType = 'string'; break
      case 'varchar': tsType = 'string'; break
      case 'int4': tsType = 'number'; break
      case 'int8': tsType = 'number'; break
      case 'float8': tsType = 'number'; break
      case 'bool': tsType = 'boolean'; break
      case 'timestamptz': tsType = 'string'; break
      case 'timestamp': tsType = 'string'; break
      case 'json': tsType = 'Json'; break
      case 'jsonb': tsType = 'Json'; break
      case '_text': tsType = 'string[]'; break
      default: tsType = 'unknown'
    }

    tables[tableName].push({
      name: columnName,
      type: tsType,
      nullable: isNullable === 'YES'
    })
  }

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
    output += `        Row: {\n`
    for (const col of columns) {
      output += `          ${col.name}: ${col.type}${col.nullable ? ' | null' : ''}\n`
    }
    output += `        }\n`
    output += `        Insert: {\n`
    for (const col of columns) {
      output += `          ${col.name}?: ${col.type}${col.nullable ? ' | null' : ''}\n`
    }
    output += `        }\n`
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
  console.log('✅ Types generated successfully')
}

generateTypes().catch(console.error)
