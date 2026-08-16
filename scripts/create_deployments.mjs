import fs from 'fs/promises';
import path from 'path';

async function main() {
    const rootDir = 'd:\\int\\int-hr-app2';
    const deploymentsDir = path.join(rootDir, 'deployments');
    const supabaseDir = path.join(rootDir, 'supabase');
    
    // Create deployments directory
    await fs.mkdir(deploymentsDir, { recursive: true });
    
    // Copy functions
    await fs.cp(path.join(supabaseDir, 'functions'), path.join(deploymentsDir, 'functions'), { recursive: true });
    
    // Copy migrations
    const migrationsDir = path.join(supabaseDir, 'migrations');
    await fs.cp(migrationsDir, path.join(deploymentsDir, 'migrations'), { recursive: true });
    
    // Concatenate migrations into full_schema.sql
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    
    let fullSchema = '';
    for (const file of sqlFiles) {
        fullSchema += `-- ${file}\n`;
        const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
        fullSchema += content;
        fullSchema += '\n\n';
    }
    
    await fs.writeFile(path.join(deploymentsDir, 'full_schema.sql'), fullSchema, 'utf-8');
    console.log('Successfully created deployments folder with functions, migrations, and full_schema.sql');
}

main().catch(console.error);
