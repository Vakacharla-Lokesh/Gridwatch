/**
 * Master Seed Script for GridWatch
 * Orchestrates running all database seeding operations
 * Usage: bun scripts/seed.ts
 */

interface SeedTask {
  name: string;
  command: string;
}

const projectRoot = import.meta.dir;

const seedTasks: SeedTask[] = [
  {
    name: "📊 Database Schema & Core Data",
    command: "bun db/seed.ts",
  },
];

async function runTask(task: SeedTask): Promise<void> {
  console.log(`\n▶️  ${task.name}`);
  console.log(`   Command: ${task.command}`);
  console.log(`   Working directory: ${projectRoot}/../server\n`);

  const serverDir = `${projectRoot}/../server`;
  
  const proc = Bun.spawn(["bun", ...task.command.split(" ").slice(1)], {
    cwd: serverDir,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode === 0) {
    console.log(`✅ ${task.name} completed successfully\n`);
  } else {
    throw new Error(
      `❌ ${task.name} failed with exit code ${exitCode}`,
    );
  }
}

async function main(): Promise<void> {
  console.log("🌱 GridWatch Seed Script");
  console.log("========================\n");
  console.log(`Total tasks: ${seedTasks.length}`);

  let completed = 0;

  for (const task of seedTasks) {
    try {
      await runTask(task);
      completed++;
    } catch (error) {
      console.error(`\n${error instanceof Error ? error.message : String(error)}`);
      console.log("\n⚠️  Seed process stopped due to error.\n");
      process.exit(1);
    }
  }

  console.log(
    `\n🎉 All ${completed} seed task(s) completed successfully!`,
  );
  console.log("✨ Your GridWatch database is ready to use.\n");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
